package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/netmon/netmon/internal/models"
	"go.uber.org/zap"
)

const maxLocalTargets = 1000
const maxTargetFileBytes = 2 * 1024 * 1024

var errDuplicateTarget = errors.New("A target with this address and port already exists")
var errTargetLimit = errors.New("Local target limit reached (1000)")

type localTargetFile struct {
	Version int             `json:"version"`
	Targets []models.Target `json:"targets"`
}
type localTargetRepository struct {
	mu      sync.RWMutex
	path    string
	targets []models.Target
}

// NewLocalAPI enables persistent target inventory for the database-free launcher.
// It does not synthesize measurements or start a monitoring scheduler.
func NewLocalAPI(logger *zap.Logger, path string) (*API, error) {
	repository, err := openLocalTargets(path)
	if err != nil {
		return nil, err
	}
	api := NewAPI(nil, logger)
	api.localTargets = repository
	api.registerLocalCatalog()
	return api, nil
}
func openLocalTargets(path string) (*localTargetRepository, error) {
	repository := &localTargetRepository{path: path, targets: []models.Target{}}
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return repository, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open target inventory: %w", err)
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if info.Size() > maxTargetFileBytes {
		return nil, errors.New("target inventory exceeds 2 MiB limit")
	}
	var state localTargetFile
	decoder := json.NewDecoder(io.LimitReader(file, maxTargetFileBytes+1))
	if err = decoder.Decode(&state); err != nil {
		return nil, fmt.Errorf("invalid target inventory; existing file preserved: %w", err)
	}
	if err = decoder.Decode(new(interface{})); err != io.EOF {
		return nil, errors.New("invalid trailing data in target inventory; existing file preserved")
	}
	if state.Version != 1 || state.Targets == nil || len(state.Targets) > maxLocalTargets {
		return nil, errors.New("unsupported target inventory version or record count; existing file preserved")
	}
	ids := map[uuid.UUID]bool{}
	for _, target := range state.Targets {
		if target.ID == uuid.Nil || ids[target.ID] || validateTarget(target) != nil || target.CreatedAt.IsZero() || target.UpdatedAt.IsZero() {
			return nil, errors.New("invalid target inventory record; existing file preserved")
		}
		ids[target.ID] = true
	}
	repository.targets = state.Targets
	return repository, nil
}
func validateTarget(target models.Target) error {
	if strings.TrimSpace(target.Name) == "" || len(target.Name) > 120 {
		return errors.New("Name is required and must be at most 120 characters")
	}
	if !validDiagnosticHost(target.Address) {
		return errors.New("Address must be a hostname or IP without a URL, port or spaces")
	}
	if target.Port != nil && (*target.Port < 1 || *target.Port > 65535) {
		return errors.New("Port must be between 1 and 65535")
	}
	if len(target.Description) > 2000 {
		return errors.New("Description must be at most 2000 characters")
	}
	switch target.TargetType {
	case "host", "server", "router", "switch", "firewall", "load_balancer":
	default:
		return errors.New("Choose a supported target type")
	}
	return nil
}
func (r *localTargetRepository) list(enabledOnly bool) []models.Target {
	r.mu.RLock()
	defer r.mu.RUnlock()
	targets := []models.Target{}
	for _, target := range r.targets {
		if !enabledOnly || target.Enabled {
			targets = append(targets, target)
		}
	}
	return targets
}
func (r *localTargetRepository) get(id uuid.UUID) (models.Target, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, target := range r.targets {
		if target.ID == id {
			return target, true
		}
	}
	return models.Target{}, false
}
func sameTargetEndpoint(a, b models.Target) bool {
	if !strings.EqualFold(strings.TrimSuffix(a.Address, "."), strings.TrimSuffix(b.Address, ".")) {
		return false
	}
	return a.Port == nil && b.Port == nil || a.Port != nil && b.Port != nil && *a.Port == *b.Port
}
func (r *localTargetRepository) create(target models.Target) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.targets) >= maxLocalTargets {
		return errTargetLimit
	}
	for _, existing := range r.targets {
		if sameTargetEndpoint(existing, target) {
			return errDuplicateTarget
		}
	}
	next := append(append([]models.Target{}, r.targets...), target)
	data, err := json.MarshalIndent(localTargetFile{Version: 1, Targets: next}, "", "  ")
	if err != nil {
		return err
	}
	if len(data) > maxTargetFileBytes {
		return errors.New("Target inventory size limit reached")
	}
	dir := filepath.Dir(r.path)
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	temp, err := os.CreateTemp(dir, ".targets-*.tmp")
	if err != nil {
		return err
	}
	// Only remove this operation's temporary file, never existing inventory.
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err = temp.Write(data); err != nil {
		temp.Close()
		return err
	}
	if err = temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err = temp.Close(); err != nil {
		return err
	}
	if err = os.Rename(tempPath, r.path); err != nil {
		return err
	}
	r.targets = next
	return nil
}
func (a *API) listLocalTargets(c *gin.Context) {
	c.Header("X-NetMon-Storage", "local-file")
	c.JSON(http.StatusOK, a.localTargets.list(c.Query("enabled") == "true"))
}
func (a *API) getLocalTarget(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid target ID"})
		return
	}
	target, ok := a.localTargets.get(id)
	if !ok {
		c.JSON(404, gin.H{"error": "Target not found"})
		return
	}
	c.Header("X-NetMon-Storage", "local-file")
	c.JSON(200, target)
}
func (a *API) createLocalTarget(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8192)
	var req struct {
		Name        string `json:"name"`
		Type        string `json:"target_type"`
		LegacyType  string `json:"type"`
		Address     string `json:"address"`
		Port        *int   `json:"port"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid target data"})
		return
	}
	kind := req.Type
	if kind == "" {
		kind = req.LegacyType
	}
	if kind == "" {
		kind = "host"
	}
	now := time.Now().UTC()
	target := models.Target{ID: uuid.New(), Name: strings.TrimSpace(req.Name), TargetType: kind, Address: strings.TrimSpace(req.Address), Port: req.Port, Enabled: true, Description: strings.TrimSpace(req.Description), CreatedAt: now, UpdatedAt: now}
	if err := validateTarget(target); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if err := a.localTargets.create(target); err != nil {
		switch {
		case errors.Is(err, errDuplicateTarget):
			c.JSON(409, gin.H{"error": err.Error()})
		case errors.Is(err, errTargetLimit):
			c.JSON(409, gin.H{"error": err.Error()})
		default:
			a.logger.Error("target inventory save failed", zap.Error(err))
			c.JSON(500, gin.H{"error": "Target could not be saved. Check the local data directory permissions."})
		}
		return
	}
	c.Header("Location", "/api/v1/targets/"+target.ID.String())
	c.JSON(201, target)
}
