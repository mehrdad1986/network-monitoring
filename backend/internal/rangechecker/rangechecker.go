// Package rangechecker probes labeled IP ranges to detect network-wide issues.
package rangechecker

import (
	"bufio"
	"context"
	"encoding/csv"
	"fmt"
	"net"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Range represents a labeled IP allocation.
type Range struct {
	StartIP      string
	EndIP        string
	Count        int
	Date         string
	Organization string
}

// RangeResult is the probe result for one range.
type RangeResult struct {
	Range
	ProbeIP   string
	Reachable bool
	LatencyMs float64
	Error     string
}

// LoadRanges reads a CSV file of labeled IP allocations.
// Format: start_ip,end_ip,count,date,organization
func LoadRanges(path string) ([]Range, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	reader := csv.NewReader(bufio.NewReader(f))
	reader.FieldsPerRecord = -1 // Allow variable fields (some CSVs have messy data)
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	var ranges []Range
	for i, rec := range records {
		if i == 0 || len(rec) < 3 {
			continue // Skip header or malformed lines
		}

		// Clean fields (remove quotes)
		for j := range rec {
			rec[j] = strings.Trim(rec[j], `"`)
		}

		count := 0
		if len(rec) > 2 {
			count, _ = strconv.Atoi(rec[2])
		}

		org := "Unlabeled"
		if len(rec) > 4 {
			org = rec[4]
		}

		date := ""
		if len(rec) > 3 {
			date = rec[3]
		}

		ranges = append(ranges, Range{
			StartIP:      rec[0],
			EndIP:        rec[1],
			Count:        count,
			Date:         date,
			Organization: org,
		})
	}

	return ranges, nil
}

// CheckTESTNET1 dials the reserved TEST-NET-1 address (192.0.2.1:80).
// If it connects, the vantage is intercepting TCP :80 (VPN/proxy) and
// range sweep results would be invalid.
func CheckTESTNET1(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", "192.0.2.1:80")
	if err == nil {
		conn.Close()
		return fmt.Errorf("TEST-NET-1 guard failed: 192.0.2.1:80 connected (vantage is intercepting TCP :80)")
	}
	return nil
}

// ProbeRanges sweeps all ranges concurrently with a worker pool.
// Returns results and any fatal errors (like TEST-NET-1 guard failure).
func ProbeRanges(ctx context.Context, ranges []Range, workers int) ([]RangeResult, error) {
	// Safety guard
	if err := CheckTESTNET1(ctx); err != nil {
		return nil, err
	}

	results := make([]RangeResult, len(ranges))
	jobs := make(chan int, len(ranges))
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				results[idx] = probeRange(ctx, ranges[idx])
			}
		}()
	}

	// Queue jobs
	for i := range ranges {
		jobs <- i
	}
	close(jobs)

	wg.Wait()
	return results, nil
}

func probeRange(ctx context.Context, r Range) RangeResult {
	result := RangeResult{Range: r}

	// Get representative IP (first usable after network address)
	ip := nextIP(r.StartIP)
	if ip == "" {
		result.Error = "invalid start IP"
		return result
	}
	result.ProbeIP = ip

	// TCP :80 probe with 5s timeout
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	start := time.Now()
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(ip, "80"))
	latency := time.Since(start)

	if err == nil {
		conn.Close()
		result.Reachable = true
		result.LatencyMs = float64(latency.Milliseconds())
	} else {
		result.Error = err.Error()
	}

	return result
}

// nextIP returns the next IP after the given address (for finding representative IP).
func nextIP(ipStr string) string {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return ""
	}
	ip = ip.To4()
	if ip == nil {
		return ""
	}

	// Increment by 1
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			break
		}
	}

	return ip.String()
}

// AggregateByOrg groups results by organization and computes stats.
func AggregateByOrg(results []RangeResult) map[string]map[string]interface{} {
	orgs := make(map[string][]RangeResult)
	for _, r := range results {
		orgs[r.Organization] = append(orgs[r.Organization], r)
	}

	aggregated := make(map[string]map[string]interface{})
	for org, orgResults := range orgs {
		reachable := 0
		var latencies []float64

		for _, r := range orgResults {
			if r.Reachable {
				reachable++
				latencies = append(latencies, r.LatencyMs)
			}
		}

		upPercent := 0.0
		if len(orgResults) > 0 {
			upPercent = float64(reachable) / float64(len(orgResults)) * 100
		}

		medianLatency := 0.0
		if len(latencies) > 0 {
			medianLatency = median(latencies)
		}

		aggregated[org] = map[string]interface{}{
			"ranges":         len(orgResults),
			"reachable":      reachable,
			"up_percent":     upPercent,
			"median_latency": medianLatency,
		}
	}

	return aggregated
}

func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	n := len(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}
