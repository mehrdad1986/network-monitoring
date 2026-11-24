package rangechecker

import (
	"math"
	"testing"
)

func TestMedian(t *testing.T) {
	tests := []struct {
		name     string
		input    []float64
		expected float64
	}{
		{
			name:     "empty slice",
			input:    []float64{},
			expected: 0,
		},
		{
			name:     "single element",
			input:    []float64{42.5},
			expected: 42.5,
		},
		{
			name:     "odd number of elements",
			input:    []float64{10.0, 50.0, 20.0, 40.0, 30.0},
			expected: 30.0,
		},
		{
			name:     "even number of elements",
			input:    []float64{10.0, 20.0, 30.0, 40.0},
			expected: 25.0,
		},
		{
			name:     "unsorted even elements",
			input:    []float64{40.0, 10.0, 30.0, 20.0},
			expected: 25.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := median(tt.input)
			if math.Abs(actual-tt.expected) > 1e-9 {
				t.Errorf("median(%v) = %f; want %f", tt.input, actual, tt.expected)
			}
		})
	}
}

func TestNextIP(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"192.168.1.0", "192.168.1.1"},
		{"10.0.0.254", "10.0.0.255"},
		{"invalid", ""},
	}

	for _, tt := range tests {
		actual := nextIP(tt.input)
		if actual != tt.expected {
			t.Errorf("nextIP(%q) = %q; want %q", tt.input, actual, tt.expected)
		}
	}
}

func TestAggregateByOrg(t *testing.T) {
	results := []RangeResult{
		{
			Range: Range{
				StartIP:      "192.168.1.0",
				EndIP:        "192.168.1.255",
				Count:        256,
				Organization: "OrgA",
			},
			Reachable: true,
			LatencyMs: 20.0,
		},
		{
			Range: Range{
				StartIP:      "192.168.2.0",
				EndIP:        "192.168.2.255",
				Count:        256,
				Organization: "OrgA",
			},
			Reachable: true,
			LatencyMs: 40.0,
		},
		{
			Range: Range{
				StartIP:      "10.0.0.0",
				EndIP:        "10.0.0.255",
				Count:        256,
				Organization: "OrgB",
			},
			Reachable: false,
			Error:     "timeout",
		},
	}

	agg := AggregateByOrg(results)
	if len(agg) != 2 {
		t.Fatalf("expected 2 orgs, got %d", len(agg))
	}

	orgA := agg["OrgA"]
	if orgA["ranges"] != 2 || orgA["reachable"] != 2 || orgA["up_percent"] != 100.0 || orgA["median_latency"] != 30.0 {
		t.Errorf("unexpected OrgA stats: %+v", orgA)
	}

	orgB := agg["OrgB"]
	if orgB["ranges"] != 1 || orgB["reachable"] != 0 || orgB["up_percent"] != 0.0 || orgB["median_latency"] != 0.0 {
		t.Errorf("unexpected OrgB stats: %+v", orgB)
	}
}
