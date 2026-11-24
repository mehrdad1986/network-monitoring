package api

import (
	"github.com/gin-gonic/gin"
	"time"
)

// ============ DNSMASQ DHCP SERVER ============

type DHCPServerConfig struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Enabled         bool     `json:"enabled"`
	Interface       string   `json:"interface"`
	StartIP         string   `json:"start_ip"`
	EndIP           string   `json:"end_ip"`
	Netmask         string   `json:"netmask"`
	Gateway         string   `json:"gateway"`
	DNSServers      []string `json:"dns_servers"`
	Domain          string   `json:"domain"`
	LeaseTime       int      `json:"lease_time_seconds"`
	Status          string   `json:"status"`
	ActiveLeases    int      `json:"active_leases"`
	TotalLeases     int      `json:"total_leases"`
	UtilizationPct  float64  `json:"utilization_percent"`
	LastUpdated     time.Time `json:"last_updated"`
}

type DHCPLease struct {
	ID              string    `json:"id"`
	ServerID        string    `json:"server_id"`
	IPAddress       string    `json:"ip_address"`
	MACAddress      string    `json:"mac_address"`
	Hostname        string    `json:"hostname"`
	ClientName      string    `json:"client_name"`
	LeaseStart      time.Time `json:"lease_start"`
	LeaseExpiry     time.Time `json:"lease_expiry"`
	RemainingTime   int       `json:"remaining_seconds"`
	Status          string    `json:"status"` // active, expired, reserved
	Vendor          string    `json:"vendor"`
	Type            string    `json:"type"` // dynamic, static, reserved
}

type DHCPOptions struct {
	ID              string   `json:"id"`
	ServerID        string   `json:"server_id"`
	OptionNumber    int      `json:"option_number"`
	OptionName      string   `json:"option_name"`
	OptionValue     string   `json:"option_value"`
	OptionType      string   `json:"option_type"` // string, int, ip, bytes
	Description     string   `json:"description"`
	Enabled         bool     `json:"enabled"`
}

type StaticReservation struct {
	ID              string `json:"id"`
	ServerID        string `json:"server_id"`
	MACAddress      string `json:"mac_address"`
	IPAddress       string `json:"ip_address"`
	Hostname        string `json:"hostname"`
	Description     string `json:"description"`
}

// ============ DNSMASQ DNS ============

type DNSRecord struct {
	ID              string `json:"id"`
	Domain          string `json:"domain"`
	RecordType      string `json:"record_type"` // A, AAAA, CNAME, MX, etc
	Value           string `json:"value"`
	TTL             int    `json:"ttl"`
	Enabled         bool   `json:"enabled"`
}

type DNSCache struct {
	ID              string    `json:"id"`
	CacheSize       int       `json:"cache_size"`
	CacheUsed       int       `json:"cache_used"`
	CacheUtilPct    float64   `json:"cache_util_percent"`
	CacheHits       int64     `json:"cache_hits"`
	CacheMisses     int64     `json:"cache_misses"`
	HitRatio        float64   `json:"hit_ratio_percent"`
	LastUpdated     time.Time `json:"last_updated"`
}

// ============ DHCP CLIENT ============

type DHCPClientInterface struct {
	ID              string    `json:"id"`
	InterfaceName   string    `json:"interface_name"`
	Enabled         bool      `json:"enabled"`
	Status          string    `json:"status"` // bound, searching, rebinding, init-reboot
	IPAddress       string    `json:"ip_address"`
	Netmask         string    `json:"netmask"`
	Gateway         string    `json:"gateway"`
	DNSServers      []string  `json:"dns_servers"`
	DHCPServer      string    `json:"dhcp_server"`
	LeaseStart      time.Time `json:"lease_start"`
	LeaseExpiry     time.Time `json:"lease_expiry"`
	LeaseRemaining  int       `json:"lease_remaining_seconds"`
	RenewalTime     time.Time `json:"renewal_time"`
	RebindTime      time.Time `json:"rebind_time"`
	ClientID        string    `json:"client_id"`
	UpTime          string    `json:"uptime"`
}

type DHCPClientHistory struct {
	ID              string    `json:"id"`
	InterfaceID     string    `json:"interface_id"`
	InterfaceName   string    `json:"interface_name"`
	IPAddress       string    `json:"ip_address"`
	DHCPServer      string    `json:"dhcp_server"`
	AcquisitionTime time.Time `json:"acquisition_time"`
	ReleaseTime     *time.Time `json:"release_time"`
	Duration        int       `json:"duration_seconds"`
	Status          string    `json:"status"` // successful, failed, renewed, released
}

// ============ HANDLERS ============

func (api *API) dhcpServerConfigs(c *gin.Context) {
	servers := []DHCPServerConfig{
		{
			ID:              "dhcp_srv001",
			Name:            "Main DHCP Server",
			Enabled:         true,
			Interface:       "eth0",
			StartIP:         "192.168.1.100",
			EndIP:           "192.168.1.200",
			Netmask:         "255.255.255.0",
			Gateway:         "192.168.1.1",
			DNSServers:      []string{"8.8.8.8", "8.8.4.4"},
			Domain:          "example.local",
			LeaseTime:       86400,
			Status:          "running",
			ActiveLeases:    67,
			TotalLeases:     101,
			UtilizationPct:  66.3,
			LastUpdated:     time.Now(),
		},
		{
			ID:              "dhcp_srv002",
			Name:            "Guest DHCP Server",
			Enabled:         true,
			Interface:       "eth1",
			StartIP:         "10.0.0.100",
			EndIP:           "10.0.0.200",
			Netmask:         "255.255.255.0",
			Gateway:         "10.0.0.1",
			DNSServers:      []string{"1.1.1.1", "1.0.0.1"},
			Domain:          "guest.local",
			LeaseTime:       3600,
			Status:          "running",
			ActiveLeases:    45,
			TotalLeases:     101,
			UtilizationPct:  44.6,
			LastUpdated:     time.Now(),
		},
	}
	c.JSON(200, gin.H{"servers": servers})
}

func (api *API) dhcpLeases(c *gin.Context) {
	leases := []DHCPLease{
		{
			ID:            "lease001",
			ServerID:      "dhcp_srv001",
			IPAddress:     "192.168.1.105",
			MACAddress:    "00:1A:2B:3C:4D:5E",
			Hostname:      "laptop-user",
			ClientName:    "User Laptop",
			LeaseStart:    time.Now().Add(-12 * time.Hour),
			LeaseExpiry:   time.Now().Add(12 * time.Hour),
			RemainingTime: 43200,
			Status:        "active",
			Vendor:        "Dell Inc.",
			Type:          "dynamic",
		},
		{
			ID:            "lease002",
			ServerID:      "dhcp_srv001",
			IPAddress:     "192.168.1.110",
			MACAddress:    "00:5F:6G:7H:8I:9J",
			Hostname:      "server-prod",
			ClientName:    "Production Server",
			LeaseStart:    time.Now().Add(-24 * time.Hour),
			LeaseExpiry:   time.Now().Add(24 * time.Hour),
			RemainingTime: 86400,
			Status:        "active",
			Vendor:        "HP Inc.",
			Type:          "static",
		},
	}
	c.JSON(200, gin.H{"leases": leases})
}

func (api *API) dhcpOptions(c *gin.Context) {
	options := []DHCPOptions{
		{
			ID:           "opt001",
			ServerID:     "dhcp_srv001",
			OptionNumber: 3,
			OptionName:   "Router",
			OptionValue:  "192.168.1.1",
			OptionType:   "ip",
			Description:  "Default gateway",
			Enabled:      true,
		},
		{
			ID:           "opt002",
			ServerID:     "dhcp_srv001",
			OptionNumber: 6,
			OptionName:   "Domain Name Server",
			OptionValue:  "8.8.8.8, 8.8.4.4",
			OptionType:   "ip",
			Description:  "DNS servers",
			Enabled:      true,
		},
		{
			ID:           "opt003",
			ServerID:     "dhcp_srv001",
			OptionNumber: 15,
			OptionName:   "Domain Name",
			OptionValue:  "example.local",
			OptionType:   "string",
			Description:  "Domain name",
			Enabled:      true,
		},
	}
	c.JSON(200, gin.H{"options": options})
}

func (api *API) staticReservations(c *gin.Context) {
	reservations := []StaticReservation{
		{
			ID:         "res001",
			ServerID:   "dhcp_srv001",
			MACAddress: "00:AA:BB:CC:DD:EE",
			IPAddress:  "192.168.1.50",
			Hostname:   "print-server",
			Description: "Network printer",
		},
		{
			ID:         "res002",
			ServerID:   "dhcp_srv001",
			MACAddress: "00:11:22:33:44:55",
			IPAddress:  "192.168.1.51",
			Hostname:   "nas-storage",
			Description: "NAS storage device",
		},
	}
	c.JSON(200, gin.H{"reservations": reservations})
}

func (api *API) dnsRecords(c *gin.Context) {
	records := []DNSRecord{
		{
			ID:         "dns001",
			Domain:     "example.local",
			RecordType: "A",
			Value:      "192.168.1.1",
			TTL:        3600,
			Enabled:    true,
		},
		{
			ID:         "dns002",
			Domain:     "www.example.local",
			RecordType: "A",
			Value:      "192.168.1.100",
			TTL:        3600,
			Enabled:    true,
		},
		{
			ID:         "dns003",
			Domain:     "mail.example.local",
			RecordType: "MX",
			Value:      "10 mail.example.local",
			TTL:        3600,
			Enabled:    true,
		},
	}
	c.JSON(200, gin.H{"records": records})
}

func (api *API) dnsCache(c *gin.Context) {
	cache := DNSCache{
		ID:           "cache001",
		CacheSize:    1024,
		CacheUsed:    756,
		CacheUtilPct: 73.8,
		CacheHits:    125643,
		CacheMisses:  18234,
		HitRatio:     87.3,
		LastUpdated:  time.Now(),
	}
	c.JSON(200, cache)
}

func (api *API) dhcpClientInterfaces(c *gin.Context) {
	interfaces := []DHCPClientInterface{
		{
			ID:             "dhcp_cli001",
			InterfaceName:  "eth0",
			Enabled:        true,
			Status:         "bound",
			IPAddress:      "203.0.113.45",
			Netmask:        "255.255.255.0",
			Gateway:        "203.0.113.1",
			DNSServers:     []string{"8.8.8.8", "8.8.4.4"},
			DHCPServer:     "203.0.113.1",
			LeaseStart:     time.Now().Add(-5 * time.Hour),
			LeaseExpiry:    time.Now().Add(19 * time.Hour),
			LeaseRemaining: 68400,
			RenewalTime:    time.Now().Add(time.Duration(float64(9.5)*float64(time.Hour))),
			RebindTime:     time.Now().Add(14 * time.Hour),
			ClientID:       "01:00:1A:2B:3C:4D:5E",
			UpTime:         "30 days, 12 hours",
		},
	}
	c.JSON(200, gin.H{"interfaces": interfaces})
}

func (api *API) dhcpClientHistory(c *gin.Context) {
	history := []DHCPClientHistory{
		{
			ID:              "hist001",
			InterfaceID:     "dhcp_cli001",
			InterfaceName:   "eth0",
			IPAddress:       "203.0.113.45",
			DHCPServer:      "203.0.113.1",
			AcquisitionTime: time.Now().Add(-720 * time.Hour),
			Duration:        2592000, // 30 days
			Status:          "successful",
		},
		{
			ID:              "hist002",
			InterfaceID:     "dhcp_cli001",
			InterfaceName:   "eth0",
			IPAddress:       "203.0.113.44",
			DHCPServer:      "203.0.113.1",
			AcquisitionTime: time.Now().Add(-1440 * time.Hour),
			ReleaseTime:     func() *time.Time { t := time.Now().Add(-720 * time.Hour); return &t }(),
			Duration:        2592000, // 30 days
			Status:          "renewed",
		},
	}
	c.JSON(200, gin.H{"history": history})
}
