package api

import (
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/netmon/netmon/internal/tools"
)

// registerLocalCatalog exposes read-only metadata through the existing local-only
// Host/Origin boundary. Availability uses PATH lookup; it never runs a command.
func (a *API) registerLocalCatalog() {
	started := time.Now().UTC()
	a.router.GET("/api/v1/tools/catalog", func(c *gin.Context) {
		type entry struct {
			Name        string `json:"name"`
			Binary      string `json:"binary"`
			Category    string `json:"category"`
			Description string `json:"description"`
			Installed   bool   `json:"installed"`
		}
		catalog := []entry{}
		for _, tool := range tools.ListTools() {
			item := entry{Name: tool.Name(), Installed: tool.IsInstalled()}
			if detail, ok := tool.(tools.DetailedTool); ok {
				item.Binary, item.Category, item.Description = detail.Binary(), string(detail.Category()), detail.Description()
			}
			catalog = append(catalog, item)
		}
		sort.Slice(catalog, func(i, j int) bool { return catalog[i].Name < catalog[j].Name })
		c.JSON(http.StatusOK, gin.H{"tools": catalog, "count": len(catalog), "source": "local-backend"})
	})
	a.router.GET("/api/v1/activity", func(c *gin.Context) {
		type event struct {
			ID       string    `json:"id"`
			Time     time.Time `json:"time"`
			Category string    `json:"category"`
			Action   string    `json:"action"`
		}
		events := []event{{ID: "runtime-start", Time: started, Category: "runtime", Action: "Local API started"}}
		for _, target := range a.localTargets.list(false) {
			events = append(events, event{ID: target.ID.String(), Time: target.CreatedAt, Category: "targets", Action: "Target inventory record created"})
		}
		sort.Slice(events, func(i, j int) bool { return events[i].Time.After(events[j].Time) })
		if len(events) > 100 {
			events = events[:100]
		}
		c.JSON(http.StatusOK, gin.H{"events": events, "source": "local-backend", "scope": "Current API session and saved target creation records", "limit": 100})
	})
}
