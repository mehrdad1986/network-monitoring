package api

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/net/dns/dnsmessage"
)

var pingTimePattern = regexp.MustCompile(`time[=<]([\d.]+)\s*ms`)

func measuredPing(ctx context.Context, target string, count int) (gin.H, error) {
	// Do not set ping's -w deadline alongside -c: iputils then waits for count
	// replies, sending additional requests until the deadline if none arrive.
	output, err := diagnosticCommand(ctx, "ping", "-n", "-c", strconv.Itoa(count), "-i", "0.2", "-W", "2", target)
	summary := lossPattern.FindStringSubmatch(output)
	if len(summary) != 4 {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Ping returned no measurement summary")
	}
	sent, _ := strconv.Atoi(summary[1])
	received, _ := strconv.Atoi(summary[2])
	loss, _ := strconv.ParseFloat(summary[3], 64)
	samples := []float64{}
	total := 0.0
	minimum := math.Inf(1)
	maximum := 0.0
	for _, match := range pingTimePattern.FindAllStringSubmatch(output, -1) {
		value, e := strconv.ParseFloat(match[1], 64)
		if e != nil {
			continue
		}
		samples = append(samples, value)
		total += value
		minimum = math.Min(minimum, value)
		maximum = math.Max(maximum, value)
	}
	result := gin.H{"target": target, "sent": sent, "received": received, "packets_sent": sent, "packets_received": received, "packet_loss": loss, "rtt_values": samples, "min_rtt": nil, "max_rtt": nil, "avg_rtt": nil, "latency": nil, "jitter": nil}
	if len(samples) > 0 {
		avg := total / float64(len(samples))
		variance := 0.0
		for _, sample := range samples {
			variance += (sample - avg) * (sample - avg)
		}
		result["min_rtt"], result["max_rtt"], result["avg_rtt"], result["latency"] = minimum, maximum, avg, avg
		result["jitter"] = math.Sqrt(variance / float64(len(samples)))
	}
	return result, nil
}
func (a *API) ping(c *gin.Context) {
	var req struct {
		Target string `json:"target"`
		Count  int    `json:"count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid ping request"})
		return
	}
	req.Target = strings.TrimSpace(req.Target)
	if !validDiagnosticHost(req.Target) || req.Count < 0 || req.Count > 10 {
		c.JSON(400, gin.H{"error": "Provide a hostname or IP and a count from 1 to 10"})
		return
	}
	if req.Count == 0 {
		req.Count = 4
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	result, err := measuredPing(ctx, req.Target, req.Count)
	if err != nil {
		a.diagnosticFailure(c, "ping", err)
		return
	}
	c.JSON(200, result)
}
func (a *API) icmpMonitor(c *gin.Context) { a.ping(c) }
func (a *API) jitterTest(c *gin.Context)  { a.ping(c) }
func (a *API) latencyMeasure(c *gin.Context) {
	var req struct {
		Host string `json:"host"`
	}
	if c.ShouldBindJSON(&req) != nil || !validDiagnosticHost(req.Host) {
		c.JSON(400, gin.H{"error": "Provide a hostname or IP"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	result, err := measuredPing(ctx, req.Host, 4)
	if err != nil {
		a.diagnosticFailure(c, "latency", err)
		return
	}
	if result["avg_rtt"] == nil {
		a.diagnosticFailure(c, "latency", errors.New("No ICMP replies; latency is unavailable"))
		return
	}
	samples := result["rtt_values"].([]float64)
	c.JSON(200, gin.H{"host": req.Host, "current": samples[len(samples)-1], "min": result["min_rtt"], "max": result["max_rtt"], "avg": result["avg_rtt"], "timestamp": time.Now()})
}
func (a *API) diagnosticFailure(c *gin.Context, tool string, err error) {
	a.logger.Warn("live diagnostic failed", zap.String("tool", tool), zap.Error(err))
	c.JSON(502, gin.H{"error": err.Error()})
}

func (a *API) httpCheck(c *gin.Context) {
	var req struct {
		URL string `json:"url"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"error": "Invalid HTTP request"})
		return
	}
	target, err := url.Parse(req.URL)
	if err != nil || target.Hostname() == "" || target.User != nil || (target.Scheme != "http" && target.Scheme != "https") {
		c.JSON(400, gin.H{"error": "Enter an HTTP or HTTPS URL without credentials"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Second)
	defer cancel()
	start := time.Now()
	ttfb := 0.0
	trace := &httptrace.ClientTrace{GotFirstResponseByte: func() { ttfb = float64(time.Since(start).Microseconds()) / 1000 }}
	request, _ := http.NewRequestWithContext(httptrace.WithClientTrace(ctx, trace), "GET", target.String(), nil)
	response, err := (&http.Client{Timeout: 12 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if req.URL.User != nil {
			return errors.New("Redirect URLs must not contain credentials")
		}
		if len(via) >= 5 {
			return errors.New("Too many redirects")
		}
		return nil
	}}).Do(request)
	if err != nil {
		a.diagnosticFailure(c, "http", err)
		return
	}
	defer response.Body.Close()
	size, err := io.Copy(io.Discard, io.LimitReader(response.Body, 1024*1024))
	if err != nil {
		a.diagnosticFailure(c, "http", errors.New("Response body could not be read"))
		return
	}
	length := response.ContentLength
	if length < 0 {
		length = size
	}
	sslValid := response.TLS != nil && len(response.TLS.VerifiedChains) > 0
	var sslDays interface{}
	if sslValid {
		sslDays = int(time.Until(response.TLS.PeerCertificates[0].NotAfter).Hours() / 24)
	}
	c.JSON(200, gin.H{"url": req.URL, "status_code": response.StatusCode, "response_time": float64(time.Since(start).Microseconds()) / 1000, "ttfb": ttfb, "content_length": length, "bytes_read": size, "ssl_valid": sslValid, "ssl_days": sslDays, "last_checked": time.Now()})
}

func (a *API) tlsCheck(c *gin.Context) {
	var req struct {
		Domain string `json:"domain"`
	}
	if c.ShouldBindJSON(&req) != nil || !validDiagnosticHost(req.Domain) {
		c.JSON(400, gin.H{"error": "Enter a hostname or IP without a URL"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	conn, err := (&tls.Dialer{NetDialer: &net.Dialer{Timeout: 8 * time.Second}, Config: &tls.Config{MinVersion: tls.VersionTLS12, ServerName: req.Domain}}).DialContext(ctx, "tcp", net.JoinHostPort(req.Domain, "443"))
	if err != nil {
		a.diagnosticFailure(c, "tls", err)
		return
	}
	defer conn.Close()
	cert := conn.(*tls.Conn).ConnectionState().PeerCertificates[0]
	days := int(time.Until(cert.NotAfter).Hours() / 24)
	status := "valid"
	if days < 30 {
		status = "expiring"
	}
	keySize := 0
	switch key := cert.PublicKey.(type) {
	case *rsa.PublicKey:
		keySize = key.N.BitLen()
	case *ecdsa.PublicKey:
		keySize = key.Curve.Params().BitSize
	}
	c.JSON(200, gin.H{"id": req.Domain, "domain": req.Domain, "issuer": cert.Issuer.CommonName, "issued_date": cert.NotBefore.Format("2006-01-02"), "expiry_date": cert.NotAfter.Format("2006-01-02"), "days_remaining": days, "status": status, "algorithms": cert.SignatureAlgorithm.String(), "public_key_size": keySize, "timestamp": time.Now()})
}

func (a *API) udpTest(c *gin.Context) {
	var req struct {
		Host    string `json:"host"`
		Port    int    `json:"port"`
		Timeout int    `json:"timeout"`
	}
	if c.ShouldBindJSON(&req) != nil || !validDiagnosticHost(req.Host) || req.Timeout < 0 || req.Timeout > 10 || req.Port < 1 || req.Port > 65535 {
		c.JSON(400, gin.H{"error": "Enter a host, port 1–65535 and timeout up to 10 seconds"})
		return
	}
	if req.Port != 53 && req.Port != 123 {
		c.JSON(422, gin.H{"error": "UDP verification supports DNS (53) and NTP (123). Other services require protocol-specific requests."})
		return
	}
	if req.Timeout == 0 {
		req.Timeout = 3
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(req.Timeout)*time.Second)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(ctx, "udp", net.JoinHostPort(req.Host, strconv.Itoa(req.Port)))
	if err != nil {
		a.diagnosticFailure(c, "udp", err)
		return
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	conn.SetDeadline(deadline)
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	service := "DNS"
	payload := make([]byte, 48)
	id := make([]byte, 2)
	if _, err = rand.Read(id); err != nil {
		a.diagnosticFailure(c, "udp", err)
		return
	}
	if req.Port == 53 {
		message := dnsmessage.Message{Header: dnsmessage.Header{ID: binary.BigEndian.Uint16(id), RecursionDesired: true}, Questions: []dnsmessage.Question{{Name: dnsmessage.MustNewName("example.com."), Type: dnsmessage.TypeA, Class: dnsmessage.ClassINET}}}
		payload, err = message.Pack()
		if err != nil {
			a.diagnosticFailure(c, "udp", err)
			return
		}
	} else {
		service = "NTP"
		payload[0] = 0x23
		if _, err = rand.Read(payload[40:48]); err != nil {
			a.diagnosticFailure(c, "udp", err)
			return
		}
	}
	start := time.Now()
	_, err = conn.Write(payload)
	if err != nil {
		a.diagnosticFailure(c, "udp", err)
		return
	}
	buffer := make([]byte, 4096)
	n, err := conn.Read(buffer)
	if err != nil {
		c.JSON(200, gin.H{"host": req.Host, "port": req.Port, "reachable": false, "response_time": nil, "packet_loss": 100, "service": service, "status": "no_response", "note": "No response to one protocol query; this does not establish that the port is closed."})
		return
	}
	if req.Port == 53 {
		var reply dnsmessage.Message
		err = reply.Unpack(buffer[:n])
		if err != nil || !reply.Header.Response || reply.ID != binary.BigEndian.Uint16(id) {
			a.diagnosticFailure(c, "udp", errors.New("Invalid DNS response"))
			return
		}
	} else if n < 48 || buffer[0]&7 != 4 || string(buffer[24:32]) != string(payload[40:48]) {
		a.diagnosticFailure(c, "udp", errors.New("Invalid NTP response"))
		return
	}
	c.JSON(200, gin.H{"host": req.Host, "port": req.Port, "reachable": true, "response_time": float64(time.Since(start).Microseconds()) / 1000, "packet_loss": 0, "service": service, "status": "response_received"})
}

func (a *API) dohCheck(c *gin.Context) {
	var req struct {
		URL string `json:"url"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"error": "Invalid DoH request"})
		return
	}
	target, err := url.Parse(req.URL)
	if err != nil || target.Scheme != "https" || target.Hostname() == "" || target.User != nil {
		c.JSON(400, gin.H{"error": "Enter an HTTPS DNS endpoint"})
		return
	}
	query := target.Query()
	query.Set("name", "example.com")
	query.Set("type", "A")
	target.RawQuery = query.Encode()
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, "GET", target.String(), nil)
	request.Header.Set("Accept", "application/dns-json")
	start := time.Now()
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(request)
	if err != nil {
		a.diagnosticFailure(c, "doh", err)
		return
	}
	defer response.Body.Close()
	// JSON DoH endpoints must return successful DNS answers, not just an HTTP page.
	var result struct {
		Status *int `json:"Status"`
	}
	if response.StatusCode != 200 {
		a.diagnosticFailure(c, "doh", fmt.Errorf("DoH server returned HTTP %d", response.StatusCode))
		return
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 64*1024)).Decode(&result); err != nil || result.Status == nil {
		a.diagnosticFailure(c, "doh", errors.New("Endpoint did not return DNS JSON; this checker requires a JSON DoH endpoint"))
		return
	}
	c.JSON(200, gin.H{"url": req.URL, "accessible": *result.Status == 0, "response_time": float64(time.Since(start).Microseconds()) / 1000, "status": response.StatusCode, "dns_status": *result.Status})
}
