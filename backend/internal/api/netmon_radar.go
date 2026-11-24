package api

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/netip"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// NetMon Radar adapts NovaRadar's MIT-licensed source-selection and two-pass
// scanning workflow to NetMon's existing API and user-supplied TLS hostname.

type radarSource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"-"`
}

var radarSourceList = []radarSource{
	{ID: "official", Name: "Cloudflare Official", URL: "https://www.cloudflare.com/ips-v4/"},
	{ID: "cm", Name: "CM List", URL: "https://raw.githubusercontent.com/cmliu/cmliu/main/CF-CIDR.txt"},
	{ID: "as13335", Name: "AS13335 · Cloudflare", URL: "https://raw.githubusercontent.com/ipverse/asn-ip/master/as/13335/ipv4-aggregated.txt"},
	{ID: "as209242", Name: "AS209242 · Cloudflare", URL: "https://raw.githubusercontent.com/ipverse/asn-ip/master/as/209242/ipv4-aggregated.txt"},
	{ID: "as24429", Name: "AS24429 · Alibaba", URL: "https://raw.githubusercontent.com/ipverse/asn-ip/master/as/24429/ipv4-aggregated.txt"},
	{ID: "as199524", Name: "AS199524 · G-Core", URL: "https://raw.githubusercontent.com/ipverse/asn-ip/master/as/199524/ipv4-aggregated.txt"},
}

var radarJobs sync.Map
var radarRunning atomic.Bool

type radarResult struct {
	IP        string `json:"ip"`
	Port      int    `json:"port"`
	LatencyMS int64  `json:"latency_ms"`
	Status    string `json:"status"`
}

type radarJob struct {
	mu            sync.RWMutex
	id            string
	state         string
	phase         string
	total         int
	completed     int
	alive         int
	dead          int
	currentIP     string
	currentPort   int
	currentSource string
	candidates    []string
	error         string
	results       []radarResult
	updated       time.Time
	cancel        context.CancelFunc
}

func (j *radarJob) snapshot() gin.H {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return gin.H{
		"id": j.id, "state": j.state, "phase": j.phase, "total": j.total,
		"completed": j.completed, "alive": j.alive, "dead": j.dead,
		"current_ip": j.currentIP, "current_port": j.currentPort,
		"current_source": j.currentSource,
		"candidates":     append([]string{}, j.candidates...),
		"error":          j.error, "results": append([]radarResult{}, j.results...),
		"updated_at": j.updated,
	}
}

func (j *radarJob) progress(ip string, port int) {
	j.mu.Lock()
	j.completed++
	j.currentIP, j.currentPort, j.updated = ip, port, time.Now()
	j.mu.Unlock()
}

func (a *API) netmonRadarSources(c *gin.Context) {
	sources := make([]radarSource, len(radarSourceList))
	copy(sources, radarSourceList)
	c.JSON(http.StatusOK, gin.H{"sources": sources})
}

func (a *API) activeNetmonRadar(c *gin.Context) {
	job := activeNetmonRadarJob()
	if job == nil {
		c.JSON(http.StatusOK, gin.H{"job": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"job": job.snapshot()})
}

func (a *API) startNetmonRadar(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8*1024)
	var req struct {
		Target  string   `json:"target"`
		Sources []string `json:"sources"`
		Ports   []int    `json:"ports"`
		Sample  int      `json:"sample"`
	}
	if err := c.ShouldBindJSON(&req); err != nil ||
		validateRadarTarget(strings.TrimSpace(req.Target)) != nil ||
		len(req.Sources) > len(radarSourceList) ||
		len(req.Ports) == 0 || len(req.Ports) > 12 || req.Sample < 1 || req.Sample > 512 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide a TLS hostname, supported ports, and a sample size from 1 to 512"})
		return
	}

	allowedPorts := map[int]bool{443: true, 2053: true, 2083: true, 2087: true, 2096: true, 8443: true, 80: true, 2052: true, 2082: true, 2086: true, 2095: true, 8080: true}
	ports := make([]int, 0, len(req.Ports))
	seenPorts := map[int]bool{}
	for _, port := range req.Ports {
		if !allowedPorts[port] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "One or more ports are outside the supported Radar list"})
			return
		}
		if !seenPorts[port] {
			ports = append(ports, port)
			seenPorts[port] = true
		}
	}

	sourceMap := map[string]radarSource{}
	for _, source := range radarSourceList {
		sourceMap[source.ID] = source
	}
	sources := make([]radarSource, 0, len(req.Sources))
	seenSources := map[string]bool{}
	for _, id := range req.Sources {
		source, ok := sourceMap[id]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown Radar source"})
			return
		}
		if !seenSources[id] {
			sources = append(sources, source)
			seenSources[id] = true
		}
	}
	if !radarRunning.CompareAndSwap(false, true) {
		if active := activeNetmonRadarJob(); active != nil {
			c.JSON(http.StatusAccepted, gin.H{"id": active.id, "attached": true})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": "NetMon Radar is finishing another scan. Retry in a few seconds."})
		return
	}
	now := time.Now()
	radarJobs.Range(func(key, value any) bool {
		job := value.(*radarJob)
		job.mu.RLock()
		finished := job.state == "complete" || job.state == "failed" || job.state == "stopped"
		expired := finished && now.Sub(job.updated) > time.Hour
		job.mu.RUnlock()
		if expired {
			radarJobs.Delete(key)
		}
		return true
	})

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	phase := "Resolving hostname"
	if len(sources) > 0 {
		phase = "Loading selected IP sources"
	}
	job := &radarJob{id: uuid.NewString(), state: "preparing", phase: phase, results: []radarResult{}, updated: time.Now(), cancel: cancel}
	radarJobs.Store(job.id, job)
	go func() {
		defer cancel()
		defer radarRunning.Store(false)
		a.runNetmonRadar(ctx, job, strings.TrimSpace(req.Target), sources, ports, req.Sample)
	}()
	c.JSON(http.StatusAccepted, gin.H{"id": job.id})
}

func (a *API) getNetmonRadar(c *gin.Context) {
	value, ok := radarJobs.Load(c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Radar scan was not found"})
		return
	}
	c.JSON(http.StatusOK, value.(*radarJob).snapshot())
}

func (a *API) stopNetmonRadar(c *gin.Context) {
	value, ok := radarJobs.Load(c.Param("id"))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Radar scan was not found"})
		return
	}
	job := value.(*radarJob)
	job.mu.Lock()
	if job.cancel != nil {
		job.cancel()
	}
	job.updated = time.Now()
	job.mu.Unlock()
	c.JSON(http.StatusOK, gin.H{"stopped": true})
}

func (a *API) runNetmonRadar(ctx context.Context, job *radarJob, target string, sources []radarSource, ports []int, sample int) {
	defer func() {
		job.mu.Lock()
		if ctx.Err() != nil {
			job.state, job.phase = "stopped", "Stopped"
		} else if job.state != "failed" {
			job.state, job.phase = "complete", "Complete"
		}
		job.currentIP, job.currentPort, job.updated = "", 0, time.Now()
		job.mu.Unlock()
	}()
	var ips []string
	if len(sources) == 0 {
		job.mu.Lock()
		job.phase, job.updated = "Resolving hostname", time.Now()
		job.mu.Unlock()
		resolved, err := radarDNSCandidates(ctx, target, sample)
		if err != nil {
			job.mu.Lock()
			job.state, job.phase, job.error, job.updated = "failed", "DNS discovery failed", err.Error(), time.Now()
			job.mu.Unlock()
			return
		}
		ips = resolved
	} else {
		prefixes := []netip.Prefix{}
		client := &http.Client{Timeout: 8 * time.Second}
		for _, source := range sources {
			if ctx.Err() != nil {
				return
			}
			job.mu.Lock()
			job.phase, job.currentSource, job.updated = "Loading source: "+source.Name, source.Name, time.Now()
			job.mu.Unlock()
			request, err := http.NewRequestWithContext(ctx, http.MethodGet, source.URL, nil)
			if err != nil {
				continue
			}
			response, err := client.Do(request)
			if err != nil {
				continue
			}
			body, readErr := io.ReadAll(io.LimitReader(response.Body, 512*1024+1))
			_ = response.Body.Close()
			if readErr == nil && response.StatusCode >= 200 && response.StatusCode < 300 && len(body) <= 512*1024 {
				prefixes = append(prefixes, parseRadarCIDRs(string(body))...)
			}
		}
		if len(prefixes) == 0 {
			job.mu.Lock()
			job.state, job.phase = "failed", "Source fetch failed"
			job.error = "Selected IP sources returned no usable IPv4 ranges. Check backend internet access and retry."
			job.updated = time.Now()
			job.mu.Unlock()
			return
		}
		ips = randomRadarIPs(prefixes, sample)
	}
	if len(ips) == 0 {
		job.mu.Lock()
		job.state, job.phase = "failed", "No candidate IPs"
		job.error = "The selected sources did not provide usable public IPv4 addresses."
		job.mu.Unlock()
		return
	}
	job.mu.Lock()
	job.candidates = append([]string(nil), ips...)
	job.currentSource = ""
	job.state, job.phase, job.total, job.updated = "scanning", "TCP discovery", len(ips)*len(ports), time.Now()
	job.mu.Unlock()

	type candidate struct {
		ip      string
		port    int
		latency int64
	}
	candidates := make(chan candidate, len(ips)*len(ports))
	sem := make(chan struct{}, 32)
	var wait sync.WaitGroup
	for _, ip := range ips {
		for _, port := range ports {
			if ctx.Err() != nil {
				break
			}
			wait.Add(1)
			go func(ip string, port int) {
				defer wait.Done()
				select {
				case sem <- struct{}{}:
				case <-ctx.Done():
					return
				}
				defer func() { <-sem }()
				start := time.Now()
				conn, err := (&net.Dialer{Timeout: 1500 * time.Millisecond}).DialContext(ctx, "tcp", net.JoinHostPort(ip, strconv.Itoa(port)))
				job.progress(ip, port)
				if err == nil {
					_ = conn.Close()
					candidates <- candidate{ip: ip, port: port, latency: time.Since(start).Milliseconds()}
					job.mu.Lock()
					job.alive++
					job.mu.Unlock()
				} else {
					job.mu.Lock()
					job.dead++
					job.mu.Unlock()
				}
			}(ip, port)
		}
	}
	wait.Wait()
	close(candidates)
	items := []candidate{}
	for item := range candidates {
		items = append(items, item)
	}
	job.mu.Lock()
	job.state, job.phase, job.total, job.updated = "verifying", "TLS / HTTP verification", job.completed+len(items)*3, time.Now()
	job.mu.Unlock()

	verified := make(chan radarResult, len(items))
	verifySem := make(chan struct{}, 24)
	wait = sync.WaitGroup{}
	for _, item := range items {
		wait.Add(1)
		go func(item candidate) {
			defer wait.Done()
			select {
			case verifySem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-verifySem }()
			passed, best := 0, int64(0)
			for attempt := 0; attempt < 3; attempt++ {
				if ctx.Err() != nil {
					return
				}
				start := time.Now()
				ok := radarVerify(ctx, item.ip, item.port, target)
				latency := time.Since(start).Milliseconds()
				job.progress(item.ip, item.port)
				if ok {
					passed++
					if best == 0 || latency < best {
						best = latency
					}
				}
			}
			if passed >= 2 {
				result := radarResult{IP: item.ip, Port: item.port, LatencyMS: best, Status: "verified"}
				verified <- result
				job.mu.Lock()
				job.results = append(job.results, result)
				sort.Slice(job.results, func(i, j int) bool { return job.results[i].LatencyMS < job.results[j].LatencyMS })
				job.mu.Unlock()
			}
		}(item)
	}
	wait.Wait()
	close(verified)
	results := []radarResult{}
	for result := range verified {
		results = append(results, result)
	}
	sort.Slice(results, func(i, j int) bool { return results[i].LatencyMS < results[j].LatencyMS })
	job.mu.Lock()
	job.results, job.alive, job.dead, job.updated = results, len(results), len(ips)-len(results), time.Now()
	job.mu.Unlock()
}

func activeNetmonRadarJob() *radarJob {
	var active *radarJob
	radarJobs.Range(func(_, value any) bool {
		job := value.(*radarJob)
		job.mu.RLock()
		isActive := job.state == "preparing" || job.state == "scanning" || job.state == "verifying"
		job.mu.RUnlock()
		if isActive {
			active = job
			return false
		}
		return true
	})
	return active
}

func radarDNSCandidates(ctx context.Context, hostname string, limit int) ([]string, error) {
	if limit > 32 {
		limit = 32
	}
	data, err := diagnosticDNS(ctx, hostname)
	if err != nil {
		return nil, errors.New("Could not resolve this hostname through the public DNS resolvers")
	}
	servers, ok := data["servers"].([]gin.H)
	if !ok {
		return nil, errors.New("Public DNS returned no usable IPv4 addresses")
	}
	answers := []string{}
	for _, server := range servers {
		result, ok := server["result"].(string)
		if ok && result != "" && result != "Unavailable" {
			answers = append(answers, strings.Split(result, ",")...)
		}
	}
	ips := radarPublicIPv4s(answers, limit)
	if len(ips) == 0 {
		return nil, errors.New("No public IPv4 addresses were returned for this hostname")
	}
	return ips, nil
}

func radarPublicIPv4s(answers []string, limit int) []string {
	seen := map[string]bool{}
	ips := []string{}
	for _, answer := range answers {
		ip, ok := publicIPv4(strings.TrimSpace(answer))
		if !ok || seen[ip.String()] {
			continue
		}
		seen[ip.String()] = true
		ips = append(ips, ip.String())
	}
	sort.Strings(ips)
	if limit > 0 && len(ips) > limit {
		ips = ips[:limit]
	}
	return ips
}

func randomRadarIPs(prefixes []netip.Prefix, count int) []string {
	seen := map[string]bool{}
	result := make([]string, 0, count)
	if len(prefixes) == 0 {
		return result
	}
	for attempts := 0; attempts < count*32 && len(result) < count; attempts++ {
		idx, err := randInt(big.NewInt(int64(len(prefixes))))
		if err != nil {
			break
		}
		ip, err := randomIPFromPrefix(prefixes[int(idx.Int64())])
		if err != nil {
			continue
		}
		addr, ok := publicIPv4(ip)
		if !ok || seen[addr.String()] {
			continue
		}
		seen[addr.String()] = true
		result = append(result, addr.String())
	}
	return result
}

func radarVerify(ctx context.Context, ip string, port int, target string) bool {
	address := net.JoinHostPort(ip, strconv.Itoa(port))
	dialer := net.Dialer{Timeout: 2500 * time.Millisecond}
	if port == 80 || port == 2052 || port == 2082 || port == 2086 || port == 2095 || port == 8080 {
		conn, err := dialer.DialContext(ctx, "tcp", address)
		if err != nil {
			return false
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(2500 * time.Millisecond))
		_, err = io.WriteString(conn, "HEAD / HTTP/1.1\r\nHost: "+target+"\r\nConnection: close\r\n\r\n")
		if err != nil {
			return false
		}
		line := make([]byte, 12)
		_, err = io.ReadFull(conn, line)
		return err == nil && strings.HasPrefix(string(line), "HTTP/1.")
	}
	conn, err := (&tls.Dialer{NetDialer: &dialer, Config: &tls.Config{ServerName: target, MinVersion: tls.VersionTLS12}}).DialContext(ctx, "tcp", address)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}
