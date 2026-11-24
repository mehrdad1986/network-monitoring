package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func tcpRequest(t *testing.T, body string, ctx context.Context) (int, map[string]interface{}) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/tools/tcp-connect", bytes.NewBufferString(body)).WithContext(ctx)
	c.Request.Header.Set("Content-Type", "application/json")
	(&API{logger: zap.NewNop()}).tcpConnect(c)
	var result map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return w.Code, result
}

func TestTCPConnectRealSocket(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port
	body := fmt.Sprintf(`{"host":"127.0.0.1","port":%d,"timeout":1}`, port)
	code, result := tcpRequest(t, body, context.Background())
	if code != 200 || result["status"] != "open" || result["open"] != true {
		t.Fatalf("%d %v", code, result)
	}
	if result["connect_time"].(float64) < 0 {
		t.Fatal("negative elapsed time")
	}
	listener.Close()
	code, result = tcpRequest(t, body, context.Background())
	if code != 200 || result["status"] != "closed" || result["open"] != false {
		t.Fatalf("refused port: %d %v", code, result)
	}
}

func TestTCPConnectValidation(t *testing.T) {
	for _, body := range []string{`{`, `{}`, `{"host":"localhost","port":0}`, `{"host":"localhost","port":65536}`, `{"host":"https://localhost","port":443}`, `{"host":"localhost","port":80,"timeout":31}`, `{"host":"localhost","port":80,"timeout":-1}`} {
		code, result := tcpRequest(t, body, context.Background())
		if code != 400 {
			t.Errorf("body %s: %d %v", body, code, result)
		}
	}
}

func TestTCPConnectDeadline(t *testing.T) {
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	code, result := tcpRequest(t, `{"host":"127.0.0.1","port":443}`, ctx)
	if code != 200 || result["status"] != "timeout" || result["open"] != false {
		t.Fatalf("%d %v", code, result)
	}
}
