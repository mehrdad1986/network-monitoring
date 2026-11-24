// Package radar pulls signals from the Cloudflare Radar API: 24h traffic
// timeseries and Cloudflare-confirmed outage annotations.
//
// Needs a free API token with the Account.Radar:Read scope in the
// CLOUDFLARE_API_TOKEN env var; without it Fetch is a silent no-op.
package radar

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// baseURL is a var so tests can point Fetch at a fake server.
var baseURL = "https://api.cloudflare.com/client/v4"

// Fetch queries Radar and writes data/radar.json. Returns nil (no error) when
// no token is configured; best-effort otherwise — a dead Radar API must never
// lose a pass, so callers log and continue on error.
func Fetch(ctx context.Context, dataDir string, location string) (json.RawMessage, error) {
	token := os.Getenv("CLOUDFLARE_API_TOKEN")
	if token == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	out := map[string]any{"ts": time.Now().UTC().Format(time.RFC3339)}
	// values are normalized 0-1 against the location's usual traffic level
	if v, err := get(ctx, token, fmt.Sprintf("/radar/netflows/timeseries?location=%s&dateRange=1d&aggInterval=1h", location)); err != nil {
		return nil, fmt.Errorf("radar traffic: %w", err)
	} else {
		out["traffic_24h_normalized"] = v
	}
	if v, err := get(ctx, token, fmt.Sprintf("/radar/annotations/outages?location=%s&dateRange=7d", location)); err != nil {
		return nil, fmt.Errorf("radar outages: %w", err)
	} else {
		out["confirmed_outages_7d"] = v
	}
	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dataDir, "radar.json"), append(b, '\n'), 0o644); err != nil {
		return nil, err
	}
	return b, nil
}

// get returns the raw `result` object of one Radar API call.
func get(ctx context.Context, token, path string) (json.RawMessage, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http %d", resp.StatusCode)
	}
	var envelope struct {
		Success bool            `json:"success"`
		Result  json.RawMessage `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, err
	}
	if !envelope.Success {
		return nil, fmt.Errorf("api success=false")
	}
	return envelope.Result, nil
}
