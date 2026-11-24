package radar

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRadarFetchWithoutToken(t *testing.T) {
	origToken := os.Getenv("CLOUDFLARE_API_TOKEN")
	os.Unsetenv("CLOUDFLARE_API_TOKEN")
	defer func() {
		if origToken != "" {
			os.Setenv("CLOUDFLARE_API_TOKEN", origToken)
		}
	}()

	res, err := Fetch(context.Background(), t.TempDir(), "IR")
	if err != nil {
		t.Fatalf("expected nil error when no token set, got: %v", err)
	}
	if res != nil {
		t.Fatalf("expected nil result when no token set, got: %v", res)
	}
}

func TestRadarFetchWithMockServer(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := map[string]interface{}{
			"success": true,
			"result": map[string]interface{}{
				"meta": map[string]interface{}{"status": "ok"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	origBase := baseURL
	baseURL = mockServer.URL
	defer func() { baseURL = origBase }()

	os.Setenv("CLOUDFLARE_API_TOKEN", "mock-token-test")
	defer os.Unsetenv("CLOUDFLARE_API_TOKEN")

	tempDir := t.TempDir()
	res, err := Fetch(context.Background(), tempDir, "IR")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) == 0 {
		t.Fatalf("expected non-empty response from mock server")
	}

	radarFile := filepath.Join(tempDir, "radar.json")
	if _, err := os.Stat(radarFile); os.IsNotExist(err) {
		t.Fatalf("expected radar.json to be created in %s", tempDir)
	}
}

func TestRadarReportSerialization(t *testing.T) {
	now := time.Now().UTC()
	rep := RadarReport{
		Timestamp: now.Format(time.RFC3339),
		Location:  "IR",
		TopASNs: []ASNMetric{
			{ASN: 58224, Name: "TCI (Telecommunication Company of Iran)", Country: "IR", TrafficPct: 45.2},
			{ASN: 44244, Name: "Irancell", Country: "IR", TrafficPct: 28.6},
		},
		ProtocolBreakdown: &ProtocolMetrics{
			IPv4Percentage: 88.5,
			IPv6Percentage: 11.5,
			HTTP1Pct:       15.0,
			HTTP2Pct:       65.0,
			HTTP3Pct:       20.0,
		},
	}

	data, err := json.Marshal(rep)
	if err != nil {
		t.Fatalf("failed to marshal RadarReport: %v", err)
	}

	var parsed RadarReport
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal RadarReport: %v", err)
	}

	if parsed.Location != "IR" || len(parsed.TopASNs) != 2 {
		t.Errorf("unmarshaled report mismatch: %+v", parsed)
	}
}
