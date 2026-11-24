package api

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"go.uber.org/zap"
)

func TestLocalCatalogIsBoundedMetadata(t *testing.T) {
	a, err := NewLocalAPI(zap.NewNop(), filepath.Join(t.TempDir(), "targets.json"))
	if err != nil {
		t.Fatal(err)
	}
	w := localTargetRequest(a, "GET", "/api/v1/tools/catalog", "")
	var payload struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
		Count int `json:"count"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &payload) != nil || payload.Count == 0 || payload.Count != len(payload.Tools) {
		t.Fatal(w.Code, "invalid tool catalog")
	}
	if strings.Contains(w.Body.String(), "install_command") {
		t.Fatal("catalog should not expose executable installation instructions")
	}
	for n := 1; n < len(payload.Tools); n++ {
		if payload.Tools[n-1].Name >= payload.Tools[n].Name {
			t.Fatal("catalog is not unique and sorted")
		}
	}
}

func TestLocalActivityReflectsInventoryWithoutSensitiveDetails(t *testing.T) {
	a, _ := NewLocalAPI(zap.NewNop(), filepath.Join(t.TempDir(), "targets.json"))
	created := localTargetRequest(a, "POST", "/api/v1/targets", `{"name":"private target name","address":"localhost"}`)
	if created.Code != 201 {
		t.Fatal(created.Code)
	}
	w := localTargetRequest(a, "GET", "/api/v1/activity", "")
	var payload struct {
		Events []struct {
			Category string `json:"category"`
			Time     string `json:"time"`
		} `json:"events"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &payload) != nil || len(payload.Events) != 2 {
		t.Fatal("missing real activity records")
	}
	if strings.Contains(w.Body.String(), "private target name") || strings.Contains(w.Body.String(), "localhost") {
		t.Fatal("activity leaked target details")
	}
	for _, event := range payload.Events {
		if event.Time == "" {
			t.Fatal("event missing observation time")
		}
	}
}
