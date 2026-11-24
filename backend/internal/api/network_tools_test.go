package api

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"net"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestNetworkToolsRoutesValidate(t *testing.T) {
	router := NewAPI(nil, zap.NewNop()).Router()
	for _, tool := range []string{"whois", "port-scan", "ssl-check", "mtr", "asn-lookup", "geoip", "dns-propagation", "bgp-route", "packet-loss", "bandwidth"} {
		t.Run(tool, func(t *testing.T) {
			for _, body := range []string{`{}`, `{"input":""}`, `{"input":"` + strings.Repeat("a", 4097) + `"}`} {
				w := httptest.NewRecorder()
				r := httptest.NewRequest("POST", "/api/v1/tools/"+tool, bytes.NewBufferString(body))
				r.Header.Set("Content-Type", "application/json")
				router.ServeHTTP(w, r)
				if w.Code != 400 {
					t.Fatalf("%s: %d %s", body[:2], w.Code, w.Body.String())
				}
			}
		})
	}
	for _, input := range []string{"-help", "example.com;touch /tmp/bad", "https://example.com", "example.com\n--help"} {
		if validDiagnosticHost(input) {
			t.Errorf("unsafe host accepted: %q", input)
		}
	}
}

func TestDiagnosticPortScanRealListener(t *testing.T) {
	// Scanner's documented fixed set includes 8443.
	listener, err := net.Listen("tcp", "127.0.0.1:8443")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := diagnosticPorts(ctx, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, port := range result["open_ports"].([]gin.H) {
		if port["port"] == 8443 {
			found = true
		}
	}
	if !found {
		t.Fatal("real open listener was not found")
	}
}

func TestDiagnosticPortScanDNSFailure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := diagnosticPorts(ctx, "invalid..invalid"); err == nil {
		t.Fatal("DNS failure reported as successful scan")
	}
}
func TestDiagnosticMissingCommand(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	router := NewAPI(nil, zap.NewNop()).Router()
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/tools/whois", strings.NewReader(`{"input":"example.com"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != 503 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
func TestDiagnosticBandwidthBlocksPrivateTargets(t *testing.T) {
	for _, ip := range []string{"127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "100.64.1.2", "::1", "fc00::1"} {
		if publicDiagnosticIP(net.ParseIP(ip)) {
			t.Errorf("allowed %s", ip)
		}
	}
	server := httptest.NewServer(nil)
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := diagnosticBandwidth(ctx, server.URL); err == nil {
		t.Fatal("private server allowed")
	}
}
func TestRetiredSpeedEndpointsNeverReturnMockSpeed(t *testing.T) {
	router := NewAPI(nil, zap.NewNop()).Router()
	for _, direction := range []string{"download", "upload"} {
		method := "GET"
		if direction == "upload" {
			method = "POST"
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(method, "/api/v1/tools/speed-test/"+direction, nil))
		if w.Code != 410 || strings.Contains(w.Body.String(), "speed_mbps") {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
}
func TestDiagnosticLossLoopback(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	result, err := diagnosticLoss(ctx, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(result)
	if result["packets_sent"] != 5 || result["packets_received"] != 5 {
		t.Fatal(string(b))
	}
}
func TestDiagnosticOutputBound(t *testing.T) {
	var out boundedDiagnosticOutput
	if _, err := out.Write([]byte(strings.Repeat("x", 256*1024+1))); err == nil {
		t.Fatal("unbounded output")
	}
	if !validDiagnosticHost("::1") || !validDiagnosticHost("example.com") {
		t.Fatal(strconv.Itoa(out.Len()))
	}
}

func TestDiagnosticMTRLoopback(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	result, err := diagnosticMTR(ctx, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if len(result["hops"].([]gin.H)) != 1 || result["packet_loss"] != float64(0) {
		t.Fatalf("%v", result)
	}
}
