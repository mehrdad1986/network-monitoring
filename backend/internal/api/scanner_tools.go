package api

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type addressCheck struct {
	IP        string  `json:"ip"`
	Open      bool    `json:"open"`
	LatencyMS float64 `json:"latency_ms"`
	Status    string  `json:"status"`
}

func publicIPv4(value string) (netip.Addr, bool) {
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil || !addr.Is4() || !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() || addr.IsMulticast() || addr.IsUnspecified() {
		return netip.Addr{}, false
	}
	return addr, true
}

func (a *API) akamaiIPScan(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 24*1024)
	var req struct {
		IPs []string `json:"ips"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IPs) == 0 || len(req.IPs) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Submit between 1 and 128 IPv4 addresses per batch"})
		return
	}
	ips := make([]string, 0, len(req.IPs))
	seen := map[string]bool{}
	for _, raw := range req.IPs {
		ip, ok := publicIPv4(raw)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only public IPv4 addresses are accepted"})
			return
		}
		value := ip.String()
		if !seen[value] {
			ips = append(ips, value)
			seen[value] = true
		}
	}
	results := make([]addressCheck, len(ips))
	sem := make(chan struct{}, 32)
	var wait sync.WaitGroup
	for i, ip := range ips {
		wait.Add(1)
		go func(index int, address string) {
			defer wait.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			start := time.Now()
			ctx, cancel := context.WithTimeout(c.Request.Context(), 1800*time.Millisecond)
			defer cancel()
			conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(address, "443"))
			elapsed := float64(time.Since(start).Microseconds()) / 1000
			status := "closed"
			if err == nil {
				_ = conn.Close()
				status = "open"
			} else if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				status = "timeout"
			}
			results[index] = addressCheck{IP: address, Open: status == "open", LatencyMS: elapsed, Status: status}
		}(i, ip)
	}
	wait.Wait()
	c.JSON(http.StatusOK, gin.H{"port": 443, "results": results, "note": "TCP reachability on port 443 only; this does not verify Akamai ownership or HTTPS service identity."})
}

func (a *API) cdnXrayScan(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 80*1024)
	var req struct {
		IP     string `json:"ip"`
		Config string `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Config) == 0 || len(req.Config) > 64*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide an IPv4 address and an Xray JSON configuration no larger than 64 KiB"})
		return
	}
	ip, ok := publicIPv4(req.IP)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only public IPv4 addresses are accepted"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 14*time.Second)
	defer cancel()
	latency, err := runXrayProbe(ctx, ip.String(), json.RawMessage(req.Config))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ip": ip.String(), "success": true, "latency_ms": latency})
}

func runXrayProbe(ctx context.Context, ip string, raw json.RawMessage) (float64, error) {
	binary, err := exec.LookPath("xray")
	if err != nil {
		return 0, errors.New("Xray is unavailable on the NetMon backend")
	}
	var config map[string]any
	if err := json.Unmarshal(raw, &config); err != nil {
		return 0, errors.New("Xray configuration is not valid JSON")
	}
	inbounds, inOK := config["inbounds"].([]any)
	outbounds, outOK := config["outbounds"].([]any)
	if !inOK || len(inbounds) == 0 || !outOK || len(outbounds) == 0 {
		return 0, errors.New("Xray configuration must include inbounds and outbounds")
	}
	proxyProtocols := map[string]bool{"vless": true, "vmess": true, "trojan": true, "shadowsocks": true, "socks": true, "http": true}
	var proxyOutbound map[string]any
	for _, rawOutbound := range outbounds {
		outbound, ok := rawOutbound.(map[string]any)
		if !ok {
			continue
		}
		protocol, _ := outbound["protocol"].(string)
		if outbound["tag"] == "proxy" {
			proxyOutbound = outbound
			break
		}
		if proxyOutbound == nil && proxyProtocols[protocol] {
			proxyOutbound = outbound
		}
	}
	if proxyOutbound == nil {
		return 0, errors.New("No supported proxy outbound was found in the Xray configuration")
	}
	settings, ok := proxyOutbound["settings"].(map[string]any)
	if !ok {
		return 0, errors.New("The Xray proxy outbound has no server settings")
	}
	if !replaceXrayAddress(settings, ip) {
		return 0, errors.New("The Xray proxy server address could not be located")
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, errors.New("Could not reserve a local proxy port")
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()
	config["inbounds"] = []any{map[string]any{"listen": "127.0.0.1", "port": port, "protocol": "socks", "settings": map[string]any{"auth": "noauth", "udp": false}}}
	serialized, err := json.Marshal(config)
	if err != nil {
		return 0, errors.New("Xray configuration could not be prepared")
	}
	tempDir, err := os.MkdirTemp("", "netmon-xray-")
	if err != nil {
		return 0, errors.New("Could not create temporary Xray workspace")
	}
	defer os.RemoveAll(tempDir)
	configPath := filepath.Join(tempDir, "config.json")
	if err := os.WriteFile(configPath, serialized, 0600); err != nil {
		return 0, errors.New("Could not write temporary Xray configuration")
	}
	processCtx, stop := context.WithCancel(ctx)
	defer stop()
	cmd := exec.CommandContext(processCtx, binary, "run", "-config", configPath)
	cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
	if err := cmd.Start(); err != nil {
		return 0, errors.New("Xray could not start with this configuration")
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	defer func() {
		stop()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		select {
		case <-done:
		case <-time.After(time.Second):
		}
	}()
	timer := time.NewTimer(900 * time.Millisecond)
	select {
	case err := <-done:
		if err == nil {
			return 0, errors.New("Xray stopped before the scan began")
		}
		return 0, errors.New("Xray rejected this configuration or could not start")
	case <-timer.C:
	case <-ctx.Done():
		return 0, errors.New("Xray scan was cancelled or timed out")
	}
	started := time.Now()
	probeCtx, cancelProbe := context.WithTimeout(ctx, 8*time.Second)
	defer cancelProbe()
	args := []string{"--silent", "--show-error", "--fail", "--connect-timeout", "5", "--max-time", "8", "--socks5-hostname", fmt.Sprintf("127.0.0.1:%d", port), "--output", os.DevNull, "https://www.google.com/generate_204"}
	probe := exec.CommandContext(probeCtx, "curl", args...)
	probe.Stdout, probe.Stderr = io.Discard, io.Discard
	if err := probe.Run(); err != nil {
		return 0, errors.New("Xray proxy could not reach the CDN test endpoint")
	}
	return float64(time.Since(started).Microseconds()) / 1000, nil
}

func replaceXrayAddress(settings map[string]any, ip string) bool {
	if _, ok := settings["address"].(string); ok {
		settings["address"] = ip
		return true
	}
	for _, key := range []string{"vnext", "servers"} {
		list, ok := settings[key].([]any)
		if !ok || len(list) == 0 {
			continue
		}
		server, ok := list[0].(map[string]any)
		if !ok {
			continue
		}
		if _, ok := server["address"].(string); ok {
			server["address"] = ip
			return true
		}
	}
	return false
}

// Keep the scanner input bounded when addresses arrive through user-controlled forms.
func validateRadarTarget(host string) error {
	if !validDiagnosticHost(host) || net.ParseIP(host) != nil {
		return errors.New("Enter a valid DNS hostname for TLS verification")
	}
	return nil
}

func parseRadarCIDRs(content string) []netip.Prefix {
	prefixes := []netip.Prefix{}
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if prefix, err := netip.ParsePrefix(line); err == nil && prefix.Addr().Is4() {
			prefixes = append(prefixes, prefix.Masked())
		}
	}
	return prefixes
}

func randomIPFromPrefix(prefix netip.Prefix) (string, error) {
	hostBits := 32 - prefix.Bits()
	if hostBits <= 0 {
		return prefix.Addr().String(), nil
	}
	max := new(big.Int).Lsh(big.NewInt(1), uint(hostBits))
	offset, err := randInt(max)
	if err != nil {
		return "", err
	}
	base := new(big.Int).SetBytes(prefix.Addr().AsSlice())
	base.Add(base, offset)
	bytes := base.Bytes()
	padded := make([]byte, 4)
	copy(padded[4-len(bytes):], bytes)
	var raw [4]byte
	copy(raw[:], padded)
	return netip.AddrFrom4(raw).String(), nil
}

func randInt(max *big.Int) (*big.Int, error) { return rand.Int(rand.Reader, max) }
