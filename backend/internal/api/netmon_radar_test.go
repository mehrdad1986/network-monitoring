package api

import (
	"reflect"
	"testing"
	"time"
)

func TestRadarSnapshotReturnsEmptyArraysWhilePreparing(t *testing.T) {
	snapshot := (&radarJob{id: "job", state: "preparing", updated: time.Now()}).snapshot()
	if candidates, ok := snapshot["candidates"].([]string); !ok || candidates == nil {
		t.Fatalf("candidates = %#v, want a non-nil empty array", snapshot["candidates"])
	}
	if results, ok := snapshot["results"].([]radarResult); !ok || results == nil {
		t.Fatalf("results = %#v, want a non-nil empty array", snapshot["results"])
	}
}

func TestRadarPublicIPv4sFiltersAndDeduplicatesAnswers(t *testing.T) {
	got := radarPublicIPv4s([]string{"8.8.8.8", " 1.1.1.1", "8.8.8.8", "192.168.1.1", "2001:4860:4860::8888", "Unavailable"}, 32)
	want := []string{"1.1.1.1", "8.8.8.8"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("radarPublicIPv4s() = %#v, want %#v", got, want)
	}
}

func TestRadarPublicIPv4sHonorsCandidateLimit(t *testing.T) {
	got := radarPublicIPv4s([]string{"8.8.8.8", "1.1.1.1", "9.9.9.9"}, 2)
	if len(got) != 2 {
		t.Fatalf("radarPublicIPv4s() returned %d addresses, want 2", len(got))
	}
}
