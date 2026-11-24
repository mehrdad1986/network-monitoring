package api

import (
	"context"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type traceHop struct {
	Number   int      `json:"number"`
	IP       string   `json:"ip"`
	Hostname string   `json:"hostname"`
	RTT1     *float64 `json:"rtt1"`
	RTT2     *float64 `json:"rtt2"`
	RTT3     *float64 `json:"rtt3"`
	Average  *float64 `json:"avg_rtt"`
}

func parseTrace(output string) ([]traceHop, string) {
	hops := []traceHop{}
	destination := ""
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if strings.HasPrefix(strings.TrimSpace(line), "traceroute to ") {
			for _, field := range fields {
				ip := strings.Trim(field, "(),")
				if net.ParseIP(ip) != nil {
					destination = ip
					break
				}
			}
		}
		if len(fields) < 2 {
			continue
		}
		number, err := strconv.Atoi(fields[0])
		if err != nil || number < 1 || number > 20 {
			continue
		}
		hop := traceHop{Number: number, IP: "*", Hostname: "*"}
		samples := []*float64{}
		for _, field := range fields[1:] {
			if net.ParseIP(field) != nil {
				if hop.IP == "*" {
					hop.IP, hop.Hostname = field, field
				}
				continue
			}
			if len(samples) == 3 {
				continue
			}
			if field == "*" {
				samples = append(samples, nil)
				continue
			}
			if value, err := strconv.ParseFloat(field, 64); err == nil && value >= 0 {
				valueCopy := value
				samples = append(samples, &valueCopy)
			}
		}
		for len(samples) < 3 {
			samples = append(samples, nil)
		}
		hop.RTT1, hop.RTT2, hop.RTT3 = samples[0], samples[1], samples[2]
		sum, count := 0.0, 0
		for _, sample := range samples {
			if sample != nil {
				sum += *sample
				count++
			}
		}
		if count > 0 {
			average := sum / float64(count)
			hop.Average = &average
		}
		hops = append(hops, hop)
	}
	return hops, destination
}

func (a *API) traceroute(c *gin.Context) {
	var req struct {
		Target string `json:"target"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid traceroute request"})
		return
	}
	req.Target = strings.TrimSpace(req.Target)
	if req.Target == "" || len(req.Target) > 253 || strings.HasPrefix(req.Target, "-") || strings.ContainsAny(req.Target, " /\\\t\r\n\x00") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide a hostname or IP address"})
		return
	}
	tool, err := exec.LookPath("traceroute")
	if err != nil {
		a.logger.Error("Traceroute executable unavailable", zap.Error(err))
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Install the traceroute system package on the NetMon backend"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	output, runErr := exec.CommandContext(ctx, tool, "-n", "-q", "3", "-w", "0.5", "-m", "20", req.Target).CombinedOutput()
	hops, destination := parseTrace(string(output))
	if runErr != nil {
		a.logger.Warn("Traceroute command failed", zap.Error(runErr))
		if len(hops) == 0 {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Traceroute could not run or resolve this target"})
			return
		}
	}
	status := "partial"
	if runErr == nil && len(hops) > 0 && destination != "" && hops[len(hops)-1].IP == destination {
		status = "completed"
	}
	if len(hops) == 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Traceroute returned no hop observations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"target": req.Target, "hops": hops, "status": status})
}
