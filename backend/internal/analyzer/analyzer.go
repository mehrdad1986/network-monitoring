// Package analyzer sends each monitoring pass to a local neural engine via Ollama and
// stores the structured analysis of the results.
package analyzer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Analysis is the structured analysis output plus metadata.
type Analysis struct {
	Timestamp        string   `json:"ts"`
	Model            string   `json:"model"`
	OverallStatus    string   `json:"overall_status"`
	Severity         string   `json:"severity"`
	SuspectedCauses  []string `json:"suspected_causes"`
	AffectedServices []string `json:"affected_services"`
	PublicSummary    string   `json:"public_summary"`
	Insight          string   `json:"insight"`
	Recommendation   string   `json:"recommendation"`
}

type Analyzer struct {
	Host       string
	Model      string
	Timeout    time.Duration
	DataDir    string
	PromptFile string
}

const defaultSystemPrompt = `You are an expert network monitoring analyst. Analyze the monitoring results and provide:

1. Overall status assessment (operational/degraded/partial_outage/major_outage)
2. Severity level (none/minor/major/critical)
3. Suspected root causes
4. Affected services or infrastructure
5. Public-facing summary (2-3 sentences)
6. Technical insight
7. Actionable recommendation

Reply with ONLY a JSON object, no markdown:
{
  "overall_status": "operational|degraded|partial_outage|major_outage",
  "severity": "none|minor|major|critical",
  "suspected_causes": ["cause1", "cause2"],
  "affected_services": ["service1", "service2"],
  "public_summary": "Brief summary for public status page",
  "insight": "One analytical sentence about the pattern",
  "recommendation": "One concrete action to take"
}`

func (a *Analyzer) prompt() string {
	if a.PromptFile != "" {
		if b, err := os.ReadFile(a.PromptFile); err == nil && len(b) > 0 {
			return string(b)
		}
	}
	return defaultSystemPrompt
}

// Run analyzes the latest monitoring data and writes analysis files
func (a *Analyzer) Run(ctx context.Context, latestData map[string]interface{}) (json.RawMessage, error) {
	prompt, err := a.buildPrompt(latestData)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()

	reqBody, _ := json.Marshal(map[string]interface{}{
		"model":  a.Model,
		"stream": false,
		"format": "json",
		"options": map[string]interface{}{
			"temperature": 0.2,
		},
		"messages": []map[string]string{
			{"role": "system", "content": a.prompt()},
			{"role": "user", "content": prompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.Host+"/api/chat", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama: http %d", resp.StatusCode)
	}

	var chat struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&chat); err != nil {
		return nil, fmt.Errorf("ollama response: %w", err)
	}

	var analysis Analysis
	if err := json.Unmarshal([]byte(chat.Message.Content), &analysis); err != nil {
		return nil, fmt.Errorf("model returned invalid JSON: %w", err)
	}

	if analysis.PublicSummary == "" {
		return nil, fmt.Errorf("model reply missing public_summary")
	}

	analysis.Timestamp = time.Now().UTC().Format(time.RFC3339)
	analysis.Model = a.Model

	out, err := json.MarshalIndent(analysis, "", "  ")
	if err != nil {
		return nil, err
	}

	// Write latest.json
	analysisDir := filepath.Join(a.DataDir, "analysis")
	if err := os.MkdirAll(analysisDir, 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(analysisDir, "latest.json"), append(out, '\n'), 0o644); err != nil {
		return nil, err
	}

	// Append to history.jsonl
	f, err := os.OpenFile(filepath.Join(analysisDir, "history.jsonl"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	if err := json.NewEncoder(f).Encode(analysis); err != nil {
		return nil, err
	}

	return json.RawMessage(out), nil
}

func (a *Analyzer) buildPrompt(latestData map[string]interface{}) (string, error) {
	data, err := json.MarshalIndent(latestData, "", "  ")
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("Analyze this monitoring data:\n\n%s", string(data)), nil
}
