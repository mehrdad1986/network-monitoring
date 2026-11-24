package api

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func validBGPResource(value string) bool {
	value = strings.TrimSpace(value)
	if net.ParseIP(value) != nil {
		return true
	}
	_, err := netip.ParsePrefix(value)
	return err == nil
}

func (a *API) lookupBGPPaths(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var request struct {
		Input string `json:"input"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || !validBGPResource(request.Input) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter an IP address or CIDR prefix"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()
	data, err := diagnosticRegistry(ctx, "looking-glass", strings.TrimSpace(request.Input))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"resource":   strings.TrimSpace(request.Input),
		"source":     "RIPE RIS BGP route collectors",
		"observedAt": time.Now().UTC(),
		"data":       data,
	})
}

func (a *API) routingTable(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()
	if _, err := exec.LookPath("ip"); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "The iproute2 'ip' command is required to read the local routing table"})
		return
	}
	output, err := diagnosticCommand(ctx, "ip", "-json", "route", "show", "table", "all")
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			c.JSON(http.StatusGatewayTimeout, gin.H{"error": "Local routing table lookup timed out"})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not read the local Linux routing table"})
		return
	}
	routes := []map[string]interface{}{}
	if err := json.Unmarshal([]byte(output), &routes); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "The local routing table returned invalid JSON"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"routes":     routes,
		"count":      len(routes),
		"source":     "Linux kernel routing table",
		"observedAt": time.Now().UTC(),
	})
}
