package radar

import "time"

// RadarReport encapsulates the synthesized intelligence data from Cloudflare Radar.
type RadarReport struct {
	Timestamp            string            `json:"ts"`
	Location             string            `json:"location,omitempty"`
	Traffic24hNormalized *TrafficTimeseries `json:"traffic_24h_normalized,omitempty"`
	ConfirmedOutages7d   []OutageEvent     `json:"confirmed_outages_7d,omitempty"`
	TopASNs              []ASNMetric       `json:"top_asns,omitempty"`
	ProtocolBreakdown    *ProtocolMetrics  `json:"protocol_breakdown,omitempty"`
}

// TrafficTimeseries holds normalized traffic flow values over time.
type TrafficTimeseries struct {
	Timestamps []time.Time `json:"timestamps"`
	Values     []float64   `json:"values"`
}

// OutageEvent represents a confirmed network outage or disruption anomaly.
type OutageEvent struct {
	ID          string    `json:"id,omitempty"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Scope       string    `json:"scope,omitempty"`       // national, regional, asn
	OutageType  string    `json:"outage_type,omitempty"` // outage, degradation, anomaly
	StartDate   time.Time `json:"start_date"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	ImpactedASN []int64   `json:"impacted_asns,omitempty"`
	Status      string    `json:"status,omitempty"`      // verified, ongoing, resolved
}

// ASNMetric captures ASN-level traffic volume, routing status, and latency.
type ASNMetric struct {
	ASN         int64   `json:"asn"`
	Name        string  `json:"name"`
	Country     string  `json:"country"`
	TrafficPct  float64 `json:"traffic_pct"`
	AvgLatency  float64 `json:"avg_latency_ms,omitempty"`
	PacketLoss  float64 `json:"packet_loss_pct,omitempty"`
	Status      string  `json:"status,omitempty"`
}

// ProtocolMetrics models protocol and transport breakdown (IPv4/IPv6, HTTP/1/2/3, TLS).
type ProtocolMetrics struct {
	IPv4Percentage float64 `json:"ipv4_pct"`
	IPv6Percentage float64 `json:"ipv6_pct"`
	HTTP1Pct       float64 `json:"http1_pct"`
	HTTP2Pct       float64 `json:"http2_pct"`
	HTTP3Pct       float64 `json:"http3_pct"`
	BotPercentage  float64 `json:"bot_pct,omitempty"`
}
