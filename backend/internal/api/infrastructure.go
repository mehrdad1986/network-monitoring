package api

import (
	"github.com/gin-gonic/gin"
	"time"
)

// ============ DHCP SERVER ============

type DHCPServer struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Subnet          string    `json:"subnet"`
	Gateway         string    `json:"gateway"`
	DNSServers      []string  `json:"dns_servers"`
	LeaseTime       int       `json:"lease_time_seconds"`
	Status          string    `json:"status"`
	ActiveLeases    int       `json:"active_leases"`
	TotalLeases     int       `json:"total_leases"`
	UtilizationPct  float64   `json:"utilization_percent"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ DHCP CLIENT ============

type DHCPClient struct {
	ID            string    `json:"id"`
	InterfaceName string    `json:"interface_name"`
	Status        string    `json:"status"`
	IPAddress     string    `json:"ip_address"`
	Gateway       string    `json:"gateway"`
	DNSServers    []string  `json:"dns_servers"`
	LeaseExpiry   time.Time `json:"lease_expiry"`
	UpTime        string    `json:"uptime"`
}

// ============ STATIC ROUTES ============

type StaticRoute struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Interface   string `json:"interface"`
	Metric      int    `json:"metric"`
	Status      string `json:"status"`
	Description string `json:"description"`
}

// ============ POLICY-BASED ROUTING ============

type PBRPolicy struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	SourceIP      string   `json:"source_ip"`
	DestinationIP string   `json:"destination_ip"`
	Protocol      string   `json:"protocol"`
	Port          int      `json:"port"`
	Action        string   `json:"action"` // route, drop, mark
	NextHop       string   `json:"next_hop"`
	Status        string   `json:"status"`
	HitCount      int      `json:"hit_count"`
}

// ============ BGP ============

type BGPSession struct {
	ID              string    `json:"id"`
	RemoteASN       int       `json:"remote_asn"`
	RemoteIP        string    `json:"remote_ip"`
	LocalIP         string    `json:"local_ip"`
	Status          string    `json:"status"` // up, down
	Uptime          string    `json:"uptime"`
	RoutesReceived  int       `json:"routes_received"`
	RoutesSent      int       `json:"routes_sent"`
	PrefixesIn      int       `json:"prefixes_in"`
	PrefixesOut     int       `json:"prefixes_out"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ OSPF ============

type OSPFArea struct {
	ID              string    `json:"id"`
	AreaID          string    `json:"area_id"`
	Type            string    `json:"type"` // standard, stub, nssa
	RouterCount     int       `json:"router_count"`
	NetworkCount    int       `json:"network_count"`
	Status          string    `json:"status"`
	SPFCalculations int       `json:"spf_calculations"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ NAT ============

type NATRule struct {
	ID              string `json:"id"`
	Type            string `json:"type"` // source, destination, static
	SourceIP        string `json:"source_ip"`
	TranslatedIP    string `json:"translated_ip"`
	Interface       string `json:"interface"`
	Status          string `json:"status"`
	ActiveSessions  int    `json:"active_sessions"`
	BytesTranslated int64  `json:"bytes_translated"`
}

// ============ FIREWALL ============

type FirewallRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Direction       string    `json:"direction"` // inbound, outbound
	Action          string    `json:"action"`    // allow, deny
	SourceIP        string    `json:"source_ip"`
	DestinationIP   string    `json:"destination_ip"`
	Protocol        string    `json:"protocol"`
	Port            int       `json:"port"`
	Status          string    `json:"status"`
	HitCount        int       `json:"hit_count"`
	LastHit         *time.Time `json:"last_hit"`
}

// ============ WIREGUARD ============

type WireGuardInterface struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	PublicKey       string    `json:"public_key"`
	PrivateKey      string    `json:"private_key_masked"` // Never expose
	ListenPort      int       `json:"listen_port"`
	Status          string    `json:"status"`
	PeersConnected  int       `json:"peers_connected"`
	BytesReceived   int64     `json:"bytes_received"`
	BytesSent       int64     `json:"bytes_sent"`
	LastUpdated     time.Time `json:"last_updated"`
}

type WireGuardPeer struct {
	ID              string    `json:"id"`
	PublicKey       string    `json:"public_key"`
	AllowedIPs      []string  `json:"allowed_ips"`
	Endpoint        string    `json:"endpoint"`
	LastHandshake   *time.Time `json:"last_handshake"`
	BytesReceived   int64     `json:"bytes_received"`
	BytesSent       int64     `json:"bytes_sent"`
	Status          string    `json:"status"`
}

// ============ OPENVPN ============

type OpenVPNServer struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Protocol        string    `json:"protocol"` // udp, tcp
	Port            int       `json:"port"`
	Status          string    `json:"status"`
	ClientsConnected int      `json:"clients_connected"`
	BytesReceived   int64     `json:"bytes_received"`
	BytesSent       int64     `json:"bytes_sent"`
	LastUpdated     time.Time `json:"last_updated"`
}

type OpenVPNClient struct {
	ID              string    `json:"id"`
	CommonName      string    `json:"common_name"`
	VirtualIP       string    `json:"virtual_ip"`
	RealIP          string    `json:"real_ip"`
	ConnectedSince  time.Time `json:"connected_since"`
	BytesReceived   int64     `json:"bytes_received"`
	BytesSent       int64     `json:"bytes_sent"`
	Status          string    `json:"status"`
}

// ============ MULTI-WAN ============

type WANConnection struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Interface       string    `json:"interface"`
	ISP             string    `json:"isp"`
	PublicIP        string    `json:"public_ip"`
	Status          string    `json:"status"`
	Latency         int       `json:"latency_ms"`
	PacketLoss      float64   `json:"packet_loss_percent"`
	Bandwidth       int       `json:"bandwidth_mbps"`
	UpTime          string    `json:"uptime"`
	Primary         bool      `json:"primary"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ VRF ============

type VirtualRouterContext struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	RouteTableID    string    `json:"route_table_id"`
	Interfaces      []string  `json:"interfaces"`
	RouteCount      int       `json:"route_count"`
	Status          string    `json:"status"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ VLAN ============

type VLAN struct {
	ID              string    `json:"id"`
	VLANId          int       `json:"vlan_id"`
	Name            string    `json:"name"`
	Subnet          string    `json:"subnet"`
	Gateway         string    `json:"gateway"`
	Interfaces      []string  `json:"interfaces"`
	Status          string    `json:"status"`
	HostCount       int       `json:"host_count"`
	ActiveHosts     int       `json:"active_hosts"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ QoS ============

type QoSPolicy struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Interface       string `json:"interface"`
	SourceIP        string `json:"source_ip"`
	DestinationIP   string `json:"destination_ip"`
	Protocol        string `json:"protocol"`
	BandwidthLimit  int    `json:"bandwidth_limit_mbps"`
	Priority        int    `json:"priority"` // 0-7
	Status          string `json:"status"`
	CurrentUsage    int    `json:"current_usage_mbps"`
	DropRate        float64 `json:"drop_rate_percent"`
}

// ============ HANDLERS ============

func (api *API) dhcpServers(c *gin.Context) {
	servers := []DHCPServer{
		{
			ID:             "dhcp001",
			Name:           "DHCP Server - Main",
			Subnet:         "192.168.1.0/24",
			Gateway:        "192.168.1.1",
			DNSServers:     []string{"8.8.8.8", "8.8.4.4"},
			LeaseTime:      86400,
			Status:         "running",
			ActiveLeases:   156,
			TotalLeases:    250,
			UtilizationPct: 62.4,
			LastUpdated:    time.Now(),
		},
	}
	c.JSON(200, gin.H{"servers": servers})
}

func (api *API) dhcpClients(c *gin.Context) {
	clients := []DHCPClient{
		{
			ID:            "dhcp_cli001",
			InterfaceName: "eth0",
			Status:        "bound",
			IPAddress:     "192.168.1.50",
			Gateway:       "192.168.1.1",
			DNSServers:    []string{"8.8.8.8", "8.8.4.4"},
			LeaseExpiry:   time.Now().Add(24 * time.Hour),
			UpTime:        "5 days, 14 hours",
		},
	}
	c.JSON(200, gin.H{"clients": clients})
}

func (api *API) staticRoutes(c *gin.Context) {
	routes := []StaticRoute{
		{
			ID:          "sr001",
			Destination: "10.0.0.0/8",
			Gateway:     "192.168.1.254",
			Interface:   "eth0",
			Metric:      10,
			Status:      "active",
			Description: "Corporate network",
		},
	}
	c.JSON(200, gin.H{"routes": routes})
}

func (api *API) pbrPolicies(c *gin.Context) {
	policies := []PBRPolicy{
		{
			ID:            "pbr001",
			Name:          "ISP2 for Video",
			SourceIP:      "192.168.1.0/24",
			DestinationIP: "0.0.0.0/0",
			Protocol:      "tcp",
			Port:          443,
			Action:        "route",
			NextHop:       "10.0.0.1",
			Status:        "active",
			HitCount:      15234,
		},
	}
	c.JSON(200, gin.H{"policies": policies})
}

func (api *API) bgpSessions(c *gin.Context) {
	sessions := []BGPSession{
		{
			ID:             "bgp001",
			RemoteASN:      65001,
			RemoteIP:       "10.0.0.1",
			LocalIP:        "10.0.0.2",
			Status:         "up",
			Uptime:         "45 days, 12 hours",
			RoutesReceived: 2541,
			RoutesSent:     1203,
			PrefixesIn:     542,
			PrefixesOut:    203,
			LastUpdated:    time.Now(),
		},
	}
	c.JSON(200, gin.H{"sessions": sessions})
}

func (api *API) ospfAreas(c *gin.Context) {
	areas := []OSPFArea{
		{
			ID:              "ospf001",
			AreaID:          "0.0.0.0",
			Type:            "standard",
			RouterCount:     8,
			NetworkCount:    12,
			Status:          "active",
			SPFCalculations: 342,
			LastUpdated:     time.Now(),
		},
	}
	c.JSON(200, gin.H{"areas": areas})
}

func (api *API) natRules(c *gin.Context) {
	rules := []NATRule{
		{
			ID:              "nat001",
			Type:            "source",
			SourceIP:        "192.168.1.0/24",
			TranslatedIP:    "203.0.113.1",
			Interface:       "eth0",
			Status:          "active",
			ActiveSessions:  234,
			BytesTranslated: 5368709120,
		},
	}
	c.JSON(200, gin.H{"rules": rules})
}

func (api *API) firewallRules(c *gin.Context) {
	rules := []FirewallRule{
		{
			ID:            "fw001",
			Name:          "Allow SSH",
			Direction:     "inbound",
			Action:        "allow",
			SourceIP:      "10.0.0.0/8",
			DestinationIP: "0.0.0.0/0",
			Protocol:      "tcp",
			Port:          22,
			Status:        "active",
			HitCount:      1203,
			LastHit:       func() *time.Time { t := time.Now(); return &t }(),
		},
	}
	c.JSON(200, gin.H{"rules": rules})
}

func (api *API) wireguardInterfaces(c *gin.Context) {
	interfaces := []WireGuardInterface{
		{
			ID:             "wg001",
			Name:           "wg0",
			PublicKey:      "mFJJE...encrypted",
			PrivateKey:     "[REDACTED]",
			ListenPort:     51820,
			Status:         "up",
			PeersConnected: 3,
			BytesReceived:  1073741824,
			BytesSent:      2147483648,
			LastUpdated:    time.Now(),
		},
	}
	c.JSON(200, gin.H{"interfaces": interfaces})
}

func (api *API) wireguardPeers(c *gin.Context) {
	peers := []WireGuardPeer{
		{
			ID:            "wgpeer001",
			PublicKey:     "8sJm9...encrypted",
			AllowedIPs:    []string{"10.0.0.2/32"},
			Endpoint:      "203.0.113.10:51820",
			LastHandshake: func() *time.Time { t := time.Now(); return &t }(),
			BytesReceived: 536870912,
			BytesSent:     1073741824,
			Status:        "connected",
		},
	}
	c.JSON(200, gin.H{"peers": peers})
}

func (api *API) openvpnServers(c *gin.Context) {
	servers := []OpenVPNServer{
		{
			ID:               "ovpn001",
			Name:             "OpenVPN Server - Main",
			Protocol:         "udp",
			Port:             1194,
			Status:           "running",
			ClientsConnected: 12,
			BytesReceived:    10737418240,
			BytesSent:        21474836480,
			LastUpdated:      time.Now(),
		},
	}
	c.JSON(200, gin.H{"servers": servers})
}

func (api *API) openvpnClients(c *gin.Context) {
	clients := []OpenVPNClient{
		{
			ID:             "ovpn_cli001",
			CommonName:     "user@example.com",
			VirtualIP:      "10.8.0.6",
			RealIP:         "203.0.113.45",
			ConnectedSince: time.Now().Add(-2 * time.Hour),
			BytesReceived:  536870912,
			BytesSent:      1073741824,
			Status:         "connected",
		},
	}
	c.JSON(200, gin.H{"clients": clients})
}

func (api *API) multiWAN(c *gin.Context) {
	connections := []WANConnection{
		{
			ID:          "wan001",
			Name:        "ISP Primary",
			Interface:   "eth0",
			ISP:         "Comcast",
			PublicIP:    "203.0.113.1",
			Status:      "up",
			Latency:     12,
			PacketLoss:  0.1,
			Bandwidth:   500,
			UpTime:      "60 days, 5 hours",
			Primary:     true,
			LastUpdated: time.Now(),
		},
		{
			ID:          "wan002",
			Name:        "ISP Backup",
			Interface:   "eth1",
			ISP:         "Verizon",
			PublicIP:    "203.0.113.2",
			Status:      "up",
			Latency:     15,
			PacketLoss:  0.2,
			Bandwidth:   300,
			UpTime:      "45 days, 12 hours",
			Primary:     false,
			LastUpdated: time.Now(),
		},
	}
	c.JSON(200, gin.H{"connections": connections})
}

func (api *API) vrf(c *gin.Context) {
	vrfs := []VirtualRouterContext{
		{
			ID:           "vrf001",
			Name:         "Management",
			RouteTableID: "1",
			Interfaces:   []string{"eth0", "eth1"},
			RouteCount:   24,
			Status:       "active",
			LastUpdated:  time.Now(),
		},
	}
	c.JSON(200, gin.H{"vrfs": vrfs})
}

func (api *API) vlans(c *gin.Context) {
	vlans := []VLAN{
		{
			ID:          "vlan001",
			VLANId:      100,
			Name:        "Management",
			Subnet:      "10.1.0.0/24",
			Gateway:     "10.1.0.1",
			Interfaces:  []string{"eth0.100", "eth1.100"},
			Status:      "active",
			HostCount:   254,
			ActiveHosts: 45,
			LastUpdated: time.Now(),
		},
		{
			ID:          "vlan002",
			VLANId:      200,
			Name:        "Production",
			Subnet:      "10.2.0.0/24",
			Gateway:     "10.2.0.1",
			Interfaces:  []string{"eth0.200", "eth1.200"},
			Status:      "active",
			HostCount:   254,
			ActiveHosts: 128,
			LastUpdated: time.Now(),
		},
	}
	c.JSON(200, gin.H{"vlans": vlans})
}

func (api *API) qosPolicies(c *gin.Context) {
	policies := []QoSPolicy{
		{
			ID:             "qos001",
			Name:           "Video Streaming",
			Interface:      "eth0",
			SourceIP:       "192.168.1.0/24",
			DestinationIP:  "0.0.0.0/0",
			Protocol:       "tcp",
			BandwidthLimit: 100,
			Priority:       4,
			Status:         "active",
			CurrentUsage:   75,
			DropRate:       0.05,
		},
	}
	c.JSON(200, gin.H{"policies": policies})
}
