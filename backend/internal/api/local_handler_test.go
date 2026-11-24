package api

import (
	"go.uber.org/zap"
	"net/http/httptest"
	"testing"
)

func TestLocalHandlerOrigins(t *testing.T) {
	handler := NewAPI(nil, zap.NewNop()).LocalHandler()
	for _, test := range []struct {
		host, origin string
		status       int
	}{
		{"127.0.0.1:8080", "http://127.0.0.1:3000", 200},
		{"localhost:8080", "", 200},
		{"127.0.0.1:8080", "https://untrusted.example", 403},
		{"127.0.0.1:8080", "null", 403},
		{"rebind.example:8080", "", 403},
	} {
		req := httptest.NewRequest("GET", "http://"+test.host+"/health", nil)
		req.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != test.status {
			t.Errorf("%s %s: got %d", test.host, test.origin, w.Code)
		}
	}
}
