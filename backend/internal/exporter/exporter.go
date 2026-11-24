// Package exporter exports database measurements to JSONL files for git tracking
// and public consumption.
package exporter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/netmon/netmon/internal/models"
	"github.com/netmon/netmon/internal/store"
)

type Exporter struct {
	store   *store.Store
	dataDir string
}

func NewExporter(store *store.Store, dataDir string) *Exporter {
	return &Exporter{
		store:   store,
		dataDir: dataDir,
	}
}

// ExportLatest queries recent measurements and exports to data/latest.json
// and appends to data/history.jsonl
func (e *Exporter) ExportLatest(ctx context.Context) error {
	// Create data directories if they don't exist
	if err := os.MkdirAll(e.dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(e.dataDir, "analysis"), 0o755); err != nil {
		return fmt.Errorf("create analysis dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(e.dataDir, "raw"), 0o755); err != nil {
		return fmt.Errorf("create raw dir: %w", err)
	}

	// Query measurements from the last monitoring cycle (last 5 minutes)
	since := time.Now().Add(-5 * time.Minute)
	measurements, err := e.store.GetRecentMeasurements(ctx, since, 1000)
	if err != nil {
		return fmt.Errorf("query measurements: %w", err)
	}

	if len(measurements) == 0 {
		return nil // No new data
	}

	// Build latest summary
	latest := buildLatestSummary(measurements)
	latestJSON, err := json.MarshalIndent(latest, "", "  ")
	if err != nil {
		return err
	}

	// Write latest.json
	if err := os.WriteFile(filepath.Join(e.dataDir, "latest.json"), append(latestJSON, '\n'), 0o644); err != nil {
		return fmt.Errorf("write latest.json: %w", err)
	}

	// Append to history.jsonl
	historyFile, err := os.OpenFile(
		filepath.Join(e.dataDir, "history.jsonl"),
		os.O_CREATE|os.O_APPEND|os.O_WRONLY,
		0o644,
	)
	if err != nil {
		return fmt.Errorf("open history.jsonl: %w", err)
	}
	defer historyFile.Close()

	for _, m := range measurements {
		line := convertMeasurementToJSONL(m)
		if err := json.NewEncoder(historyFile).Encode(line); err != nil {
			return fmt.Errorf("append to history.jsonl: %w", err)
		}
	}

	// Write raw snapshot
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05Z")
	rawPath := filepath.Join(e.dataDir, "raw", fmt.Sprintf("%s.json", timestamp))
	if err := os.WriteFile(rawPath, latestJSON, 0o644); err != nil {
		return fmt.Errorf("write raw snapshot: %w", err)
	}

	// Prune old raw files (older than 7 days)
	if err := e.pruneRawFiles(7); err != nil {
		return fmt.Errorf("prune raw files: %w", err)
	}

	return nil
}

func buildLatestSummary(measurements []*models.Measurement) map[string]interface{} {
	if len(measurements) == 0 {
		return map[string]interface{}{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"counts":    map[string]int{"up": 0, "degraded": 0, "down": 0},
		}
	}

	up, degraded, down := 0, 0, 0
	for _, m := range measurements {
		if m.Success {
			if m.LatencyMs != nil && *m.LatencyMs > 3000 {
				degraded++
			} else {
				up++
			}
		} else {
			down++
		}
	}

	total := up + degraded + down
	overallStatus := "operational"
	if down >= total/3 {
		overallStatus = "major_outage"
	} else if down >= total/10 {
		overallStatus = "partial_outage"
	} else if degraded > 0 {
		overallStatus = "degraded"
	}

	return map[string]interface{}{
		"timestamp":      measurements[0].Time.Format(time.RFC3339),
		"overall_status": overallStatus,
		"counts": map[string]int{
			"up":       up,
			"degraded": degraded,
			"down":     down,
		},
		"total_checks": len(measurements),
	}
}

func convertMeasurementToJSONL(m *models.Measurement) map[string]interface{} {
	result := map[string]interface{}{
		"ts":           m.Time.Format(time.RFC3339),
		"target_id":    m.TargetID.String(),
		"monitor_type": m.MonitorType,
		"success":      m.Success,
	}

	if m.LatencyMs != nil {
		result["latency_ms"] = *m.LatencyMs
	}
	if m.ErrorMessage != "" {
		result["error"] = m.ErrorMessage
	}
	if m.PacketLoss != nil {
		result["packet_loss"] = *m.PacketLoss
	}
	if m.JitterMs != nil {
		result["jitter_ms"] = *m.JitterMs
	}

	return result
}

func (e *Exporter) pruneRawFiles(retentionDays int) error {
	rawDir := filepath.Join(e.dataDir, "raw")
	entries, err := os.ReadDir(rawDir)
	if err != nil {
		return err
	}

	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(rawDir, entry.Name()))
		}
	}

	return nil
}
