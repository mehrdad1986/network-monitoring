package api

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func liveRequest(handler func(*gin.Context), body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	handler(c)
	return w
}
func TestLivePingValidation(t *testing.T) {
	api := &API{logger: zap.NewNop()}
	for _, body := range []string{`{"target":"127.0.0.1","count":-1}`, `{"target":"127.0.0.1","count":1000000000}`, `{"target":"-h"}`, `{"target":"localhost;echo bad"}`} {
		if w := liveRequest(api.ping, body); w.Code != 400 {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
}
func TestLivePingLoopback(t *testing.T) {
	w := liveRequest((&API{logger: zap.NewNop()}).icmpMonitor, `{"target":"127.0.0.1","count":2}`)
	var data map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &data)
	if w.Code != 200 || data["received"] != float64(2) || data["avg_rtt"].(float64) > 10 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
func TestLiveHTTPActualStatusAndBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(418); w.Write([]byte("real body")) }))
	defer server.Close()
	body, _ := json.Marshal(map[string]string{"url": server.URL})
	w := liveRequest((&API{logger: zap.NewNop()}).httpCheck, string(body))
	var result map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &result)
	if w.Code != 200 || result["status_code"] != float64(418) || result["content_length"] != float64(9) || result["ssl_valid"] != false {
		t.Fatal(w.Body.String())
	}
}
func TestLiveHTTPRejectsInvalidURLAndTLS(t *testing.T) {
	api := &API{logger: zap.NewNop()}
	for _, url := range []string{"file:///etc/passwd", "ftp://example.com", "bad"} {
		body, _ := json.Marshal(map[string]string{"url": url})
		if w := liveRequest(api.httpCheck, string(body)); w.Code != 400 {
			t.Fatal(w.Code)
		}
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer server.Close()
	body, _ := json.Marshal(map[string]string{"url": server.URL})
	if w := liveRequest(api.httpCheck, string(body)); w.Code != 502 {
		t.Fatal(w.Code)
	}
}
func TestDatabaseUnavailableNoPanic(t *testing.T) {
	router := NewAPI(nil, zap.NewNop()).Router()
	for _, path := range []string{"/api/v1/targets", "/api/v1/probes", "/api/v1/targets/1", "/api/v1/monitors", "/api/v1/measurements"} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 503 || !strings.Contains(w.Body.String(), "PostgreSQL") {
			t.Fatalf("%s %d %s", path, w.Code, w.Body.String())
		}
	}
}
func TestUDPUnsupportedProtocolIsExplicit(t *testing.T) {
	w := liveRequest((&API{logger: zap.NewNop()}).udpTest, `{"host":"127.0.0.1","port":161}`)
	if w.Code != 422 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
