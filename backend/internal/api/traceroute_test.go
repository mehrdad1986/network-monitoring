package api

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os/exec"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func TestParseTraceroute(t *testing.T) {
	hops, destination := parseTrace("traceroute to example.com (192.0.2.1), 20 hops max\n 1  192.0.2.254  1.0 ms * 3.0 ms\n 2  * * *\n 3 192.0.2.1 0.1 ms 0.2 ms 0.3 ms\n")
	if destination != "192.0.2.1" || len(hops) != 3 {
		t.Fatalf("%s %v", destination, hops)
	}
	if hops[0].RTT2 != nil || *hops[0].Average != 2 {
		t.Fatalf("mixed probes: %+v", hops[0])
	}
	if hops[1].Average != nil || hops[1].IP != "*" {
		t.Fatalf("unanswered: %+v", hops[1])
	}
	if *hops[2].RTT3 != 0.3 {
		t.Fatalf("destination: %+v", hops[2])
	}
}

func TestTracerouteLoopback(t *testing.T) {
	if _, err := exec.LookPath("traceroute"); err != nil {
		t.Fatal("traceroute required for integration test")
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/v1/tools/traceroute", bytes.NewBufferString(`{"target":"127.0.0.1"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	(&API{logger: zap.NewNop()}).traceroute(c)
	var result struct {
		Status string     `json:"status"`
		Hops   []traceHop `json:"hops"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if w.Code != 200 || result.Status != "completed" || len(result.Hops) != 1 || result.Hops[0].IP != "127.0.0.1" {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}

func TestTracerouteValidation(t *testing.T) {
	for _, body := range []string{`{`, `{}`, `{"target":"-I"}`, `{"target":"example.com; echo bad"}`, `{"target":"https://example.com"}`} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/tools/traceroute", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")
		(&API{logger: zap.NewNop()}).traceroute(c)
		if w.Code != 400 {
			t.Errorf("%s: %d", body, w.Code)
		}
	}
}

func TestTracerouteMissingTool(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/v1/tools/traceroute", bytes.NewBufferString(`{"target":"127.0.0.1"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	(&API{logger: zap.NewNop()}).traceroute(c)
	if w.Code != 503 {
		t.Fatalf("missing executable: %d", w.Code)
	}
}
