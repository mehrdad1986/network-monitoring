package api

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

var diagnosticHost = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9.-]*$`)

func validDiagnosticHost(s string) bool {
	return len(s) <= 253 && (net.ParseIP(s) != nil || diagnosticHost.MatchString(s))
}

// These diagnostic routes are public on the existing loopback-only local API.
// All subprocesses receive argv directly, with bounded runtime and output.
func (a *API) networkTool(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var req struct {
		Input string `json:"input"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Input) == "" || len(req.Input) > 2048 {
		c.JSON(400, gin.H{"error": "Enter a valid target"})
		return
	}
	input := strings.TrimSpace(req.Input)
	tool := strings.TrimPrefix(c.FullPath(), "/api/v1/tools/")
	if tool != "bandwidth" && tool != "bgp-route" && !validDiagnosticHost(input) {
		c.JSON(400, gin.H{"error": "Enter a hostname or IP address without a URL, port or command options"})
		return
	}
	if tool == "geoip" && net.ParseIP(input) == nil {
		c.JSON(400, gin.H{"error": "Enter an IPv4 or IPv6 address"})
		return
	}
	if tool == "bgp-route" {
		if _, err := netip.ParsePrefix(input); err != nil && net.ParseIP(input) == nil {
			c.JSON(400, gin.H{"error": "Enter an IP address or CIDR prefix"})
			return
		}
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()
	var result interface{}
	var err error
	switch tool {
	case "whois":
		var output string
		output, err = diagnosticCommand(ctx, "whois", input)
		result = gin.H{"domain": input, "raw": output}
	case "port-scan":
		result, err = diagnosticPorts(ctx, input)
	case "nmap":
		result, err = diagnosticNmap(ctx, input)
	case "parisroute":
		result, err = diagnosticParisRoute(ctx, input)
	case "ssl-check":
		result, err = diagnosticTLS(ctx, input)
	case "mtr":
		result, err = diagnosticMTR(ctx, input)
	case "packet-loss":
		result, err = diagnosticLoss(ctx, input)
	case "dns-propagation":
		result, err = diagnosticDNS(ctx, input)
	case "asn-lookup":
		result, err = diagnosticASN(ctx, input)
	case "bgp-route":
		result, err = diagnosticRegistry(ctx, "prefix-overview", input)
	case "geoip":
		result, err = diagnosticGeo(ctx, input)
	case "bandwidth":
		result, err = diagnosticBandwidth(ctx, input)
	default:
		c.JSON(404, gin.H{"error": "Unknown tool"})
		return
	}
	if err != nil {
		a.logger.Warn("network diagnostic failed", zap.String("tool", tool), zap.Error(err))
		status := 502
		if errors.Is(err, exec.ErrNotFound) {
			status = 503
		}
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			status = 504
			err = errors.New("Diagnostic timed out; try another target")
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, result)
}

type boundedDiagnosticOutput struct{ strings.Builder }

func (b *boundedDiagnosticOutput) Write(p []byte) (int, error) {
	n := len(p)
	if b.Len()+n > 256*1024 {
		return 0, errors.New("diagnostic output exceeds limit")
	}
	return b.Builder.Write(p)
}
func diagnosticCommand(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = append(os.Environ(), "LC_ALL=C")
	var output boundedDiagnosticOutput
	cmd.Stdout, cmd.Stderr = &output, &output
	err := cmd.Run()
	if err != nil {
		return output.String(), fmt.Errorf("%s failed (tool missing, target unavailable, or insufficient permissions): %w", name, err)
	}
	if strings.TrimSpace(output.String()) == "" {
		return "", fmt.Errorf("%s returned no result", name)
	}
	return output.String(), nil
}

func diagnosticPorts(ctx context.Context, host string) (gin.H, error) {
	// Fixed small port set prevents arbitrary/unbounded scans.
	ports := []int{21, 22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3000, 3306, 5432, 6379, 8080, 8443}
	addresses, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil || len(addresses) == 0 {
		return nil, errors.New("Cannot resolve target hostname")
	}
	open := []gin.H{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, port := range ports {
		wg.Add(1)
		go func(port int) {
			defer wg.Done()
			conn, e := (&net.Dialer{Timeout: 1500 * time.Millisecond}).DialContext(ctx, "tcp", net.JoinHostPort(addresses[0], strconv.Itoa(port)))
			if e == nil {
				conn.Close()
				mu.Lock()
				open = append(open, gin.H{"port": port, "protocol": "TCP", "state": "open", "service": "TCP handshake"})
				mu.Unlock()
			}
		}(port)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	sort.Slice(open, func(i, j int) bool { return open[i]["port"].(int) < open[j]["port"].(int) })
	return gin.H{"target": host, "open_ports": open, "scanned_ports": ports, "note": "A TCP handshake tests reachability, not service identity. Non-open ports may be closed or filtered."}, nil
}

func diagnosticNmap(ctx context.Context, host string) (gin.H, error) {
	tool, err := exec.LookPath("nmap")
	if err != nil {
		return nil, fmt.Errorf("Nmap is unavailable on the NetMon backend: %w", err)
	}
	output, err := diagnosticCommand(ctx, tool, "-n", "-Pn", "-sT", "--top-ports", "100", "--max-retries", "1", "--host-timeout", "20s", host)
	if err != nil {
		return nil, err
	}
	return gin.H{"target": host, "scan": "TCP top 100 ports", "output": output,
		"note": "A bounded TCP connect scan; it does not perform service/version or OS detection."}, nil
}

func diagnosticParisRoute(ctx context.Context, host string) (gin.H, error) {
	tool, err := exec.LookPath("paris-traceroute")
	if err != nil {
		return nil, fmt.Errorf("Paris traceroute is unavailable on the NetMon backend; install the paris-traceroute package: %w", err)
	}
	output, err := diagnosticCommand(ctx, tool, "-n", "-m", "20", "-M", "2", "-p", "udp", "-q", "1", "-w", "500", host)
	if err != nil {
		return nil, err
	}
	return gin.H{"target": host, "max_hops": 20, "probes_per_hop": 1, "output": output}, nil
}

func diagnosticTLS(ctx context.Context, host string) (gin.H, error) {
	conn, err := (&tls.Dialer{NetDialer: &net.Dialer{Timeout: 8 * time.Second}, Config: &tls.Config{MinVersion: tls.VersionTLS12, ServerName: host}}).DialContext(ctx, "tcp", net.JoinHostPort(host, "443"))
	if err != nil {
		return nil, fmt.Errorf("TLS verification failed: %w", err)
	}
	defer conn.Close()
	cert := conn.(*tls.Conn).ConnectionState().PeerCertificates[0]
	return gin.H{"valid": true, "common_name": cert.Subject.CommonName, "issuer": cert.Issuer.String(), "valid_from": cert.NotBefore, "valid_until": cert.NotAfter, "days_remaining": int(time.Until(cert.NotAfter).Hours() / 24), "san": cert.DNSNames}, nil
}

func diagnosticMTR(ctx context.Context, host string) (gin.H, error) {
	output, err := diagnosticCommand(ctx, "mtr", "--json", "--report-cycles", "3", "--interval", "1", "--max-ttl", "20", "--no-dns", host)
	if err != nil {
		return nil, err
	}
	var report struct {
		Report struct {
			Hubs []struct {
				Number int     `json:"count"`
				Host   string  `json:"host"`
				Loss   float64 `json:"Loss%"`
				Sent   int     `json:"Snt"`
				Last   float64 `json:"Last"`
				Avg    float64 `json:"Avg"`
				Best   float64 `json:"Best"`
				Worst  float64 `json:"Wrst"`
				Std    float64 `json:"StDev"`
			} `json:"hubs"`
		} `json:"report"`
	}
	if err = json.Unmarshal([]byte(output), &report); err != nil {
		return nil, errors.New("MTR returned an unreadable report")
	}
	if len(report.Report.Hubs) == 0 {
		return nil, errors.New("MTR returned no hops")
	}
	hops := []gin.H{}
	for _, h := range report.Report.Hubs {
		hops = append(hops, gin.H{"number": h.Number, "ip": h.Host, "loss": h.Loss, "sent": h.Sent, "last": h.Last, "avg": h.Avg, "best": h.Best, "worst": h.Worst, "stdev": h.Std})
	}
	last := report.Report.Hubs[len(report.Report.Hubs)-1]
	return gin.H{"target": host, "hops": hops, "packet_loss": last.Loss, "avg_latency": last.Avg}, nil
}

var lossPattern = regexp.MustCompile(`(\d+) packets transmitted, (\d+) (?:packets )?received.*?([\d.]+)% packet loss`)

func diagnosticLoss(ctx context.Context, host string) (gin.H, error) {
	output, err := diagnosticCommand(ctx, "ping", "-n", "-c", "5", "-i", "0.2", "-W", "2", host)
	// ping exit 1 denotes real total/partial loss; retain its measured summary.
	match := lossPattern.FindStringSubmatch(output)
	if len(match) != 4 {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Ping returned no packet summary")
	}
	sent, _ := strconv.Atoi(match[1])
	received, _ := strconv.Atoi(match[2])
	loss, _ := strconv.ParseFloat(match[3], 64)
	return gin.H{"target": host, "packets_sent": sent, "packets_received": received, "packet_loss": loss}, nil
}

func diagnosticDNS(ctx context.Context, domain string) (gin.H, error) {
	servers := []struct{ Name, IP string }{{"Cloudflare", "1.1.1.1"}, {"Google", "8.8.8.8"}, {"Quad9", "9.9.9.9"}}
	results := []gin.H{}
	for _, server := range servers {
		server := server
		resolver := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "udp", net.JoinHostPort(server.IP, "53"))
		}}
		queryCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		ips, err := resolver.LookupHost(queryCtx, domain)
		cancel()
		sort.Strings(ips)
		row := gin.H{"location": server.Name + " (" + server.IP + ")", "result": strings.Join(ips, ", "), "synced": false}
		if err != nil {
			row["error"] = "Resolver did not answer"
			row["result"] = "Unavailable"
		}
		results = append(results, row)
	}
	successful := 0
	baseline := ""
	for _, r := range results {
		if r["error"] == nil {
			successful++
			if baseline == "" {
				baseline = r["result"].(string)
			}
		}
	}
	if successful == 0 {
		return nil, errors.New("None of the public DNS resolvers answered; outbound DNS may be blocked")
	}
	for _, r := range results {
		r["synced"] = r["error"] == nil && r["result"] == baseline
	}
	return gin.H{"domain": domain, "servers": results, "note": "Compares answers from three public resolvers; CDN answers can legitimately differ."}, nil
}

func diagnosticJSON(ctx context.Context, address string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", address, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(req)
	if err != nil {
		return errors.New("Lookup provider is unreachable")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return fmt.Errorf("Lookup provider returned HTTP %d", response.StatusCode)
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 2*1024*1024)).Decode(out); err != nil {
		return errors.New("Lookup provider returned an unreadable response")
	}
	return nil
}
func diagnosticRegistry(ctx context.Context, endpoint, input string) (map[string]interface{}, error) {
	var response struct {
		Status string                 `json:"status"`
		Data   map[string]interface{} `json:"data"`
	}
	err := diagnosticJSON(ctx, "https://stat.ripe.net/data/"+endpoint+"/data.json?resource="+url.QueryEscape(input), &response)
	if err != nil {
		return nil, err
	}
	if response.Status != "ok" || response.Data == nil {
		return nil, errors.New("Registry has no data for this target")
	}
	return response.Data, nil
}
func diagnosticASN(ctx context.Context, input string) (gin.H, error) {
	resource := strings.ToUpper(input)
	var prefixes interface{} = []string{}
	if net.ParseIP(input) != nil {
		data, err := diagnosticRegistry(ctx, "network-info", input)
		if err != nil {
			return nil, err
		}
		asns, ok := data["asns"].([]interface{})
		if !ok || len(asns) == 0 {
			return nil, errors.New("No announced ASN found for this IP")
		}
		resource = "AS" + fmt.Sprint(asns[0])
		prefixes = []interface{}{data["prefix"]}
	} else {
		number, err := strconv.ParseUint(strings.TrimPrefix(resource, "AS"), 10, 32)
		if err != nil || number == 0 {
			return nil, errors.New("Enter an ASN such as AS13335 or an IP address")
		}
		resource = "AS" + strconv.FormatUint(number, 10)
	}
	data, err := diagnosticRegistry(ctx, "as-overview", resource)
	if err != nil {
		return nil, err
	}
	return gin.H{"asn": strings.TrimPrefix(resource, "AS"), "name": data["holder"], "organization": data["holder"], "country": "Not supplied by registry", "registry": "RIPEstat", "prefixes": prefixes}, nil
}
func diagnosticGeo(ctx context.Context, input string) (gin.H, error) {
	var data struct {
		Success    bool    `json:"success"`
		Message    string  `json:"message"`
		IP         string  `json:"ip"`
		City       string  `json:"city"`
		Region     string  `json:"region"`
		Country    string  `json:"country"`
		Latitude   float64 `json:"latitude"`
		Longitude  float64 `json:"longitude"`
		Connection struct {
			ISP string `json:"isp"`
			Org string `json:"org"`
		} `json:"connection"`
		Timezone struct {
			ID string `json:"id"`
		} `json:"timezone"`
	}
	if err := diagnosticJSON(ctx, "https://ipwho.is/"+url.PathEscape(input), &data); err != nil {
		return nil, err
	}
	if !data.Success {
		return nil, errors.New("GeoIP unavailable for this address (use a public IP)")
	}
	return gin.H{"ip": data.IP, "city": data.City, "region": data.Region, "country": data.Country, "latitude": data.Latitude, "longitude": data.Longitude, "isp": data.Connection.ISP, "organization": data.Connection.Org, "timezone": data.Timezone.ID}, nil
}

func publicDiagnosticIP(ip net.IP) bool {
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsUnspecified() && !isDiagnosticCGNAT(ip)
}
func isDiagnosticCGNAT(ip net.IP) bool {
	v := ip.To4()
	return v != nil && v[0] == 100 && v[1] >= 64 && v[1] <= 127
}
func diagnosticBandwidth(ctx context.Context, input string) (gin.H, error) {
	u, err := url.Parse(input)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil {
		return nil, errors.New("Enter a public HTTP or HTTPS file URL")
	}
	transport := &http.Transport{DisableCompression: true, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		if len(ips) == 0 {
			return nil, errors.New("Cannot resolve bandwidth server")
		}
		for _, ip := range ips {
			if !publicDiagnosticIP(ip.IP) {
				return nil, errors.New("Bandwidth target must resolve exclusively to public IP addresses")
			}
		}
		return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 15 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return errors.New("Redirects are not allowed; enter the final file URL")
	}}
	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Cache-Control", "no-cache")
	start := time.Now()
	response, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Bandwidth request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("Download server returned HTTP %d", response.StatusCode)
	}
	bytes, err := io.Copy(io.Discard, io.LimitReader(response.Body, 16*1024*1024))
	if err != nil {
		return nil, errors.New("Download interrupted; measurement discarded")
	}
	seconds := time.Since(start).Seconds()
	if bytes < 1024 || seconds <= 0 || math.IsNaN(seconds) {
		return nil, errors.New("Response too small for a bandwidth measurement")
	}
	return gin.H{"speed_mbps": float64(bytes) * 8 / seconds / 1e6, "bytes": bytes, "duration_seconds": seconds, "target": input, "measurement": "Backend host to supplied URL; single download estimate, capped at 16 MiB"}, nil
}
