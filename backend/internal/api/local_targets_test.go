package api

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/netmon/netmon/internal/models"
	"go.uber.org/zap"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func localTargetRequest(a *API, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	a.Router().ServeHTTP(w, req)
	return w
}
func TestLocalTargetsCreatePersistAndGet(t *testing.T) {
	path := filepath.Join(t.TempDir(), "targets.json")
	a, err := NewLocalAPI(zap.NewNop(), path)
	if err != nil {
		t.Fatal(err)
	}
	empty := localTargetRequest(a, "GET", "/api/v1/targets", "")
	if empty.Code != 200 || empty.Body.String() != "[]" {
		t.Fatal(empty.Body.String())
	}
	w := localTargetRequest(a, "POST", "/api/v1/targets", `{"name":"Local web","target_type":"server","address":"127.0.0.1","port":3000}`)
	if w.Code != 201 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	var created models.Target
	json.Unmarshal(w.Body.Bytes(), &created)
	if created.ID == uuid.Nil || created.TargetType != "server" || created.CreatedAt.IsZero() || !created.Enabled {
		t.Fatalf("%+v", created)
	}
	reopened, err := NewLocalAPI(zap.NewNop(), path)
	if err != nil {
		t.Fatal(err)
	}
	detail := localTargetRequest(reopened, "GET", "/api/v1/targets/"+created.ID.String(), "")
	if detail.Code != 200 || !strings.Contains(detail.Body.String(), "Local web") {
		t.Fatal(detail.Code, detail.Body.String())
	}
	duplicate := localTargetRequest(reopened, "POST", "/api/v1/targets", `{"name":"Duplicate","address":"127.0.0.1","port":3000}`)
	if duplicate.Code != 409 {
		t.Fatal(duplicate.Code)
	}
}
func TestLocalTargetsRejectInvalid(t *testing.T) {
	a, _ := NewLocalAPI(zap.NewNop(), filepath.Join(t.TempDir(), "targets.json"))
	for _, body := range []string{`{}`, `{"name":"x","address":"http://localhost"}`, `{"name":"x","address":"localhost","port":65536}`, `{"name":"x","address":"localhost","port":0}`, `{"name":"x","address":"localhost","target_type":"bogus"}`, `{"name":"x","address":"localhost","port":1.5}`} {
		if w := localTargetRequest(a, "POST", "/api/v1/targets", body); w.Code != 400 {
			t.Fatal(body, w.Code, w.Body.String())
		}
	}
	if w := localTargetRequest(a, "GET", "/api/v1/targets/bad-id", ""); w.Code != 400 {
		t.Fatal(w.Code)
	}
	if w := localTargetRequest(a, "GET", "/api/v1/targets/"+uuid.NewString(), ""); w.Code != 404 {
		t.Fatal(w.Code)
	}
}
func TestLocalTargetsCorruptionPreserved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "targets.json")
	original := []byte("broken existing state")
	os.WriteFile(path, original, 0600)
	if _, err := NewLocalAPI(zap.NewNop(), path); err == nil {
		t.Fatal("corrupt inventory accepted")
	}
	data, _ := os.ReadFile(path)
	if string(data) != string(original) {
		t.Fatal("corrupt state overwritten")
	}
}
func TestLocalTargetsFailedWriteDoesNotPublish(t *testing.T) {
	dir := t.TempDir()
	parent := filepath.Join(dir, "data")
	a, _ := NewLocalAPI(zap.NewNop(), filepath.Join(parent, "targets.json"))
	os.WriteFile(parent, []byte("not a directory"), 0600)
	w := localTargetRequest(a, "POST", "/api/v1/targets", `{"name":"not saved","address":"localhost"}`)
	if w.Code != 500 || len(a.localTargets.list(false)) != 0 {
		t.Fatal(w.Code, a.localTargets.list(false))
	}
}
func TestLocalTargetsConcurrentCreates(t *testing.T) {
	path := filepath.Join(t.TempDir(), "targets.json")
	a, _ := NewLocalAPI(zap.NewNop(), path)
	var wg sync.WaitGroup
	for n := 0; n < 12; n++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			w := localTargetRequest(a, "POST", "/api/v1/targets", fmt.Sprintf(`{"name":"target %d","address":"host-%d.example"}`, n, n))
			if w.Code != 201 {
				t.Errorf("%d %s", w.Code, w.Body.String())
			}
		}(n)
	}
	wg.Wait()
	reopened, err := NewLocalAPI(zap.NewNop(), path)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.localTargets.list(false)) != 12 {
		t.Fatal("concurrent records lost")
	}
}
