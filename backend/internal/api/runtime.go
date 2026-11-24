package api

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func (a *API) requireConfiguredStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := strings.TrimPrefix(c.Request.URL.Path, "/api/v1/")
		root := strings.SplitN(path, "/", 2)[0]
		localTargetRoute := root == "targets" && a.localTargets != nil && len(strings.Split(strings.Trim(path, "/"), "/")) <= 2
		if a.store == nil && !localTargetRoute && (root == "targets" || root == "probes" || root == "monitors" || root == "measurements") {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Persistent monitoring is unavailable: start the full NetMon backend with PostgreSQL configured. Local network diagnostic tools remain available."})
			return
		}
		c.Next()
	}
}
