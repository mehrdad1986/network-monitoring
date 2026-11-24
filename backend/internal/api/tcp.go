package api

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// tcpConnect performs a normal TCP handshake; it does not require raw sockets.
func (a *API) tcpConnect(c *gin.Context) {
	var req struct {
		Host    string `json:"host"`
		Port    int    `json:"port"`
		Timeout int    `json:"timeout"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid TCP request"})
		return
	}
	req.Host = strings.TrimSpace(req.Host)
	if req.Host == "" || len(req.Host) > 253 || strings.ContainsAny(req.Host, " /\\\t\r\n\x00") || req.Port < 1 || req.Port > 65535 || req.Timeout < 0 || req.Timeout > 30 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide a hostname or IP, port 1–65535, and timeout 1–30 seconds"})
		return
	}
	if req.Timeout == 0 {
		req.Timeout = 5
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(req.Timeout)*time.Second)
	defer cancel()
	start := time.Now()
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(req.Host, strconv.Itoa(req.Port)))
	elapsed := float64(time.Since(start).Microseconds()) / 1000
	status := "open"
	message := ""
	if err != nil {
		var networkError net.Error
		switch {
		case errors.Is(err, context.DeadlineExceeded), errors.As(err, &networkError) && networkError.Timeout():
			status, message = "timeout", "Connection timed out"
		case errors.Is(err, syscall.ECONNREFUSED):
			status, message = "closed", "Connection refused"
		default:
			status, message = "error", "Could not resolve or reach this target"
		}
		a.logger.Info("TCP connection check failed", zap.String("status", status), zap.Error(err))
	} else if closeErr := conn.Close(); closeErr != nil {
		a.logger.Warn("TCP connection close failed", zap.Error(closeErr))
	}
	// Conventional names are hints based on port, not service detection.
	service := map[int]string{22: "SSH", 53: "DNS", 80: "HTTP", 443: "HTTPS", 3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 27017: "MongoDB"}[req.Port]
	c.JSON(http.StatusOK, gin.H{"host": req.Host, "port": req.Port, "open": status == "open", "status": status, "connect_time": elapsed, "service": service, "error": message})
}
