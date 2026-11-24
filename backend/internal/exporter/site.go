package exporter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/netmon/netmon/internal/models"
)

// BuildSite aggregates monitoring data into site.json for the status page
func (e *Exporter) BuildSite(ctx context.Context) error {
	// Load latest data
	latestPath := filepath.Join(e.dataDir, "latest.json")
	latestData, err := os.ReadFile(latestPath)
	if err != nil {
		return fmt.Errorf("read latest.json: %w", err)
	}

	var latest map[string]interface{}
	if err := json.Unmarshal(latestData, &latest); err != nil {
		return fmt.Errorf("parse latest.json: %w", err)
	}

	// Load analysis if available
	analysisPath := filepath.Join(e.dataDir, "analysis", "latest.json")
	var analysis map[string]interface{}
	if analysisData, err := os.ReadFile(analysisPath); err == nil {
		json.Unmarshal(analysisData, &analysis)
	}

	// Load networks if available
	networksPath := filepath.Join(e.dataDir, "networks.json")
	var networks map[string]interface{}
	if networksData, err := os.ReadFile(networksPath); err == nil {
		json.Unmarshal(networksData, &networks)
	}

	// Query recent measurements for 24h history
	since := time.Now().Add(-24 * time.Hour)
	measurements, err := e.store.GetRecentMeasurements(ctx, since, 10000)
	if err != nil {
		return fmt.Errorf("query 24h measurements: %w", err)
	}

	// Build 24h cells (48 half-hour buckets)
	cells := build24HourCells(measurements)

	// Build site payload
	site := map[string]interface{}{
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
		"latest":        latest,
		"analysis":      analysis,
		"networks":      networks,
		"cells_24h":     cells,
		"updated_at":    time.Now().UTC().Format(time.RFC3339),
		"version":       "1.0",
	}

	siteJSON, err := json.MarshalIndent(site, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(e.dataDir, "site.json"), append(siteJSON, '\n'), 0o644); err != nil {
		return fmt.Errorf("write site.json: %w", err)
	}

	return nil
}

// build24HourCells creates 48 half-hour buckets showing status over 24 hours
func build24HourCells(measurements []*models.Measurement) []map[string]interface{} {
	now := time.Now()
	cells := make([]map[string]interface{}, 48)

	// Initialize cells
	for i := 0; i < 48; i++ {
		bucketStart := now.Add(-time.Duration(48-i) * 30 * time.Minute)
		cells[i] = map[string]interface{}{
			"time":   bucketStart.Format(time.RFC3339),
			"status": "unknown",
			"count":  0,
		}
	}

	// Aggregate measurements into buckets
	for _, m := range measurements {
		// Calculate which bucket this measurement belongs to
		age := now.Sub(m.Time)
		if age < 0 || age > 24*time.Hour {
			continue
		}

		bucketIdx := int(age / (30 * time.Minute))
		if bucketIdx >= 48 {
			continue
		}
		bucketIdx = 47 - bucketIdx // Reverse order (oldest to newest)

		cell := cells[bucketIdx]
		cell["count"] = cell["count"].(int) + 1

		// Worst status wins
		status := "up"
		if !m.Success {
			status = "down"
		} else if m.LatencyMs != nil && *m.LatencyMs > 3000 {
			status = "degraded"
		}

		currentStatus := cell["status"].(string)
		if currentStatus == "unknown" || status == "down" || (status == "degraded" && currentStatus == "up") {
			cell["status"] = status
		}
	}

	return cells
}
