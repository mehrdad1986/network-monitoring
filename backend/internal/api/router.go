package api

import (
	"github.com/gin-gonic/gin"
	"time"
)

// ============ ROUTER MANAGEMENT ============

type RouterInterface struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"` // ethernet, pppoe, vlan, bridge, loopback
	Enabled         bool      `json:"enabled"`
	IPAddress       string    `json:"ip_address"`
	Netmask         string    `json:"netmask"`
	MTU             int       `json:"mtu"`
	MACAddress      string    `json:"mac_address"`
	Status          string    `json:"status"` // up, down, running
	RxBytes         int64     `json:"rx_bytes"`
	TxBytes         int64     `json:"tx_bytes"`
	RxPackets       int64     `json:"rx_packets"`
	TxPackets       int64     `json:"tx_packets"`
	RxErrors        int       `json:"rx_errors"`
	TxErrors        int       `json:"tx_errors"`
	Speed           string    `json:"speed"` // 1Gbps, 10Gbps, etc
	Duplex          string    `json:"duplex"` // full, half
	LastUpdated     time.Time `json:"last_updated"`
}

type RouterTraffic struct {
	ID              string    `json:"id"`
	InterfaceID     string    `json:"interface_id"`
	InterfaceName   string    `json:"interface_name"`
	RxBpsNow        int64     `json:"rx_bps_now"`
	TxBpsNow        int64     `json:"tx_bps_now"`
	RxBpsAvg        int64     `json:"rx_bps_avg"`
	TxBpsAvg        int64     `json:"tx_bps_avg"`
	RxBpsMax        int64     `json:"rx_bps_max"`
	TxBpsMax        int64     `json:"tx_bps_max"`
	Timestamp       time.Time `json:"timestamp"`
}

type ARPEntry struct {
	ID              string    `json:"id"`
	IPAddress       string    `json:"ip_address"`
	MACAddress      string    `json:"mac_address"`
	Interface       string    `json:"interface"`
	Status          string    `json:"status"` // complete, incomplete, permanent
	Age             int       `json:"age_seconds"`
	Hostname        string    `json:"hostname"`
}

type MangleRule struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Chain           string `json:"chain"` // prerouting, postrouting, forward, output
	Action          string `json:"action"` // mark-connection, mark-routing, mark-packet
	Protocol        string `json:"protocol"`
	SrcAddress      string `json:"src_address"`
	DstAddress      string `json:"dst_address"`
	InInterface     string `json:"in_interface"`
	OutInterface    string `json:"out_interface"`
	NewMark         string `json:"new_mark"`
	Status          string `json:"status"`
}

type BridgeInterface struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Members         []string `json:"members"`
	IPAddress       string   `json:"ip_address"`
	Netmask         string   `json:"netmask"`
	Status          string   `json:"status"`
	MACAddress      string   `json:"mac_address"`
}

type PPPoEInterface struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Interface       string    `json:"interface"`
	Username        string    `json:"username"`
	Status          string    `json:"status"` // connected, connecting, disconnected
	IPAddress       string    `json:"ip_address"`
	RemoteIP        string    `json:"remote_ip"`
	ConnectTime     time.Time `json:"connect_time"`
	UpTime          string    `json:"uptime"`
	BytesSent       int64     `json:"bytes_sent"`
	BytesReceived   int64     `json:"bytes_received"`
}

type IPAddress struct {
	ID              string `json:"id"`
	Address         string `json:"address"`
	Interface       string `json:"interface"`
	Netmask         string `json:"netmask"`
	Comment         string `json:"comment"`
	Status          string `json:"status"`
}

type Queue struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Target          string    `json:"target"`
	Direction       string    `json:"direction"`
	MaxLimitUp      int       `json:"max_limit_up_kbps"`
	MaxLimitDown    int       `json:"max_limit_down_kbps"`
	BurstLimitUp    int       `json:"burst_limit_up_kbps"`
	BurstLimitDown  int       `json:"burst_limit_down_kbps"`
	Status          string    `json:"status"`
}

type BGPPeer struct {
	ID              string    `json:"id"`
	RemoteASN       int       `json:"remote_asn"`
	RemoteAddress   string    `json:"remote_address"`
	LocalAddress    string    `json:"local_address"`
	Status          string    `json:"status"`
	Uptime          string    `json:"uptime"`
	RoutesReceived  int       `json:"routes_received"`
	RoutesSent      int       `json:"routes_sent"`
}

type RouterMonitorStats struct {
	ID              string    `json:"id"`
	Uptime          string    `json:"uptime"`
	CPUUsage        float64   `json:"cpu_usage_percent"`
	MemoryUsage     float64   `json:"memory_usage_percent"`
	MemoryTotal     int       `json:"memory_total_mb"`
	MemoryUsed      int       `json:"memory_used_mb"`
	DiskUsage       float64   `json:"disk_usage_percent"`
	Temperature     int       `json:"temperature_celsius"`
	Timestamp       time.Time `json:"timestamp"`
}

// ============ HANDLERS ============

func (api *API) routerInterfaces(c *gin.Context) {
	interfaces := []RouterInterface{
		{
			ID:          "eth_001",
			Name:        "ether1",
			Type:        "ethernet",
			Enabled:     true,
			IPAddress:   "192.168.1.1",
			Netmask:     "255.255.255.0",
			MTU:         1500,
			MACAddress:  "00:0C:29:AB:CD:EF",
			Status:      "up",
			RxBytes:     5368709120,
			TxBytes:     10737418240,
			RxPackets:   1000000,
			TxPackets:   2000000,
			RxErrors:    12,
			TxErrors:    5,
			Speed:       "1Gbps",
			Duplex:      "full",
			LastUpdated: time.Now(),
		},
		{
			ID:          "eth_002",
			Name:        "ether2",
			Type:        "ethernet",
			Enabled:     true,
			IPAddress:   "10.0.0.1",
			Netmask:     "255.255.255.0",
			MTU:         1500,
			MACAddress:  "00:0C:29:AB:CD:F0",
			Status:      "up",
			RxBytes:     2147483648,
			TxBytes:     4294967296,
			RxPackets:   500000,
			TxPackets:   1000000,
			RxErrors:    0,
			TxErrors:    0,
			Speed:       "1Gbps",
			Duplex:      "full",
			LastUpdated: time.Now(),
		},
	}
	c.JSON(200, gin.H{"interfaces": interfaces})
}

func (api *API) routerTraffic(c *gin.Context) {
	traffic := []RouterTraffic{
		{
			ID:          "traffic_001",
			InterfaceID: "eth_001",
			InterfaceName: "ether1",
			RxBpsNow:    125000000,
			TxBpsNow:    250000000,
			RxBpsAvg:    100000000,
			TxBpsAvg:    200000000,
			RxBpsMax:    800000000,
			TxBpsMax:    950000000,
			Timestamp:   time.Now(),
		},
	}
	c.JSON(200, gin.H{"traffic": traffic})
}

func (api *API) routerStaticRoutes(c *gin.Context) {
	routes := []StaticRoute{
		{
			ID:        "route_001",
			Destination: "172.16.0.0/16",
			Gateway:   "192.168.1.254",
			Interface: "ether1",
			Metric:    0,
			Status:    "active",
			Description: "Remote network",
		},
	}
	c.JSON(200, gin.H{"routes": routes})
}

func (api *API) arpTable(c *gin.Context) {
	entries := []ARPEntry{
		{
			ID:        "arp_001",
			IPAddress: "192.168.1.100",
			MACAddress: "AA:BB:CC:DD:EE:FF",
			Interface: "ether1",
			Status:    "complete",
			Age:       3600,
			Hostname:  "workstation",
		},
	}
	c.JSON(200, gin.H{"entries": entries})
}

func (api *API) routerFirewallRules(c *gin.Context) {
	rules := []FirewallRule{
		{
			ID:            "fw_001",
			Name:          "Allow SSH",
			Direction:     "inbound",
			Action:        "allow",
			Protocol:      "tcp",
			Port:          22,
			Status:        "active",
			HitCount:      145,
		},
	}
	c.JSON(200, gin.H{"rules": rules})
}

func (api *API) routerNATRules(c *gin.Context) {
	rules := []NATRule{
		{
			ID:       "nat_001",
			Type:     "source",
			Status:   "active",
			BytesTranslated: 50000,
		},
	}
	c.JSON(200, gin.H{"rules": rules})
}

func (api *API) mangleRules(c *gin.Context) {
	rules := []MangleRule{
		{
			ID:          "mang_001",
			Name:        "Mark connections",
			Chain:       "prerouting",
			Action:      "mark-connection",
			Protocol:    "tcp",
			NewMark:     "mymark",
			Status:      "active",
		},
	}
	c.JSON(200, gin.H{"rules": rules})
}

func (api *API) bridgeInterfaces(c *gin.Context) {
	bridges := []BridgeInterface{
		{
			ID:        "br_001",
			Name:      "bridge1",
			Members:   []string{"ether1", "ether2"},
			IPAddress: "192.168.100.1",
			Netmask:   "255.255.255.0",
			Status:    "up",
			MACAddress: "00:0C:29:AB:CD:F1",
		},
	}
	c.JSON(200, gin.H{"bridges": bridges})
}

func (api *API) pppoeInterfaces(c *gin.Context) {
	interfaces := []PPPoEInterface{
		{
			ID:          "pppoe_001",
			Name:        "pppoe-out1",
			Interface:   "ether1",
			Username:    "user@isp.com",
			Status:      "connected",
			IPAddress:   "203.0.113.45",
			RemoteIP:    "203.0.113.1",
			ConnectTime: time.Now().Add(-24 * time.Hour),
			UpTime:      "24 hours, 15 minutes",
			BytesSent:   5368709120,
			BytesReceived: 10737418240,
		},
	}
	c.JSON(200, gin.H{"interfaces": interfaces})
}

func (api *API) ipAddressList(c *gin.Context) {
	addresses := []IPAddress{
		{
			ID:        "ip_001",
			Address:   "192.168.1.1",
			Interface: "ether1",
			Netmask:   "24",
			Comment:   "Primary LAN",
			Status:    "active",
		},
	}
	c.JSON(200, gin.H{"addresses": addresses})
}

func (api *API) queueList(c *gin.Context) {
	queues := []Queue{
		{
			ID:              "q_001",
			Name:            "Main",
			Target:          "0.0.0.0/0",
			Direction:       "both",
			MaxLimitUp:      1000000,
			MaxLimitDown:    1000000,
			BurstLimitUp:    2000000,
			BurstLimitDown:  2000000,
			Status:          "active",
		},
	}
	c.JSON(200, gin.H{"queues": queues})
}

func (api *API) bgpPeers(c *gin.Context) {
	peers := []BGPPeer{
		{
			ID:            "bgp_001",
			RemoteASN:     65001,
			RemoteAddress: "10.0.0.2",
			LocalAddress:  "10.0.0.1",
			Status:        "up",
			Uptime:        "45 days, 12 hours",
			RoutesReceived: 2500,
			RoutesSent:     1200,
		},
	}
	c.JSON(200, gin.H{"peers": peers})
}

func (api *API) routerMonitorStats(c *gin.Context) {
	stats := RouterMonitorStats{
		ID:           "monitor_001",
		Uptime:       "365 days, 5 hours",
		CPUUsage:     35.2,
		MemoryUsage:  62.5,
		MemoryTotal:  1024,
		MemoryUsed:   640,
		DiskUsage:    45.3,
		Temperature:  42,
		Timestamp:    time.Now(),
	}
	c.JSON(200, stats)
}
