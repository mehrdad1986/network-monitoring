package exporter

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/netmon/netmon/internal/models"
)

func TestBuildLatestSummary(t *testing.T) {
	latencyFast := 50.0
	latencySlow := 3500.0

	measurements := []*models.Measurement{
		{
			ProbeID:   uuid.New(),
			TargetID:  uuid.New(),
			MonitorID: uuid.New(),
			Time:      time.Now(),
			Success:   true,
			LatencyMs: &latencyFast,
		},
		{
			ProbeID:   uuid.New(),
			TargetID:  uuid.New(),
			MonitorID: uuid.New(),
			Time:      time.Now(),
			Success:   true,
			LatencyMs: &latencySlow,
		},
		{
			ProbeID:   uuid.New(),
			TargetID:  uuid.New(),
			MonitorID: uuid.New(),
			Time:      time.Now(),
			Success:   false,
		},
	}

	summary := buildLatestSummary(measurements)
	counts, ok := summary["counts"].(map[string]int)
	if !ok {
		t.Fatalf("expected counts map, got %T", summary["counts"])
	}

	if counts["up"] != 1 || counts["degraded"] != 1 || counts["down"] != 1 {
		t.Errorf("unexpected counts: %+v", counts)
	}

	if summary["overall_status"] != "major_outage" { // 1 out of 3 is down -> major outage
		t.Errorf("expected major_outage, got %v", summary["overall_status"])
	}
}

func TestBuild24HourCells(t *testing.T) {
	measurements := []*models.Measurement{
		{
			ProbeID:   uuid.New(),
			TargetID:  uuid.New(),
			MonitorID: uuid.New(),
			Time:      time.Now().Add(-15 * time.Minute),
			Success:   true,
		},
	}

	cells := build24HourCells(measurements)
	if len(cells) != 48 {
		t.Fatalf("expected 48 cells, got %d", len(cells))
	}

	lastCell := cells[47]
	if lastCell["status"] != "up" || lastCell["count"].(int) != 1 {
		t.Errorf("unexpected last cell state: %+v", lastCell)
	}
}
