package analyzer

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

func TestAnalyzerPromptBuilding(t *testing.T) {
	tempDir := t.TempDir()
	promptFile := filepath.Join(tempDir, "test_prompt.md")
	customPrompt := "You are a custom network testing analyst."
	if err := os.WriteFile(promptFile, []byte(customPrompt), 0o644); err != nil {
		t.Fatalf("failed to write prompt file: %v", err)
	}

	a := &Analyzer{
		Host:       "http://localhost:11434",
		Model:      "hermes3",
		Timeout:    10 * time.Second,
		DataDir:    tempDir,
		PromptFile: promptFile,
	}

	if a.prompt() != customPrompt {
		t.Errorf("expected %q, got %q", customPrompt, a.prompt())
	}
}

func TestAnalyzerRunMock(t *testing.T) {
	mockResponse := Analysis{
		OverallStatus:    "operational",
		Severity:         "none",
		SuspectedCauses:  []string{"None"},
		AffectedServices: []string{},
		PublicSummary:    "All monitored networks and endpoints are healthy.",
		Insight:          "Traffic patterns remain stable within baseline.",
		Recommendation:   "Continue normal polling operations.",
	}

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		respBytes, _ := json.Marshal(mockResponse)
		resp := map[string]interface{}{
			"message": map[string]interface{}{
				"content": string(respBytes),
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	tempDir := t.TempDir()
	a := &Analyzer{
		Host:       mockServer.URL,
		Model:      "hermes3",
		Timeout:    5 * time.Second,
		DataDir:    tempDir,
		PromptFile: "",
	}

	data := map[string]interface{}{
		"overall_status": "operational",
		"total_checks":   10,
	}

	res, err := a.Run(context.Background(), data)
	if err != nil {
		t.Fatalf("unexpected analyzer error: %v", err)
	}
	if len(res) == 0 {
		t.Fatalf("expected non-empty analysis result")
	}

	latestFile := filepath.Join(tempDir, "analysis", "latest.json")
	if _, err := os.Stat(latestFile); os.IsNotExist(err) {
		t.Fatalf("expected analysis/latest.json to exist")
	}
}
