# BGP/BGPS IP Inventory - All 3 ISPs Comparison
**Last Updated**: 2026-10-15  
**Test Environment**: 3 consecutive ISPs, same physical location (Turkey)

---

## ISP #1 (Original) - 10.21.251.158 Network

### BGP/BGPS IPs:
```
Local Network:
  192.168.0.1          - Local D-Link router (hop 1)
  10.21.251.158        - ISP aggregation + DPI (hop 7)
  10.21.251.166        - ISP aggregation + DPI (hop 7, alternate)
  10.21.0.10           - ISP core (hop 8)
  10.21.211.10         - ISP core (hop 8-9)
  10.21.211.20         - ISP core (hop 8-9)
  10.21.21.23          - ISP core (hop 8)
  10.21.41.21          - ISP intermediate (hop 9-10)
  10.50.10.x           - ISP intermediate (hops 9-10)

International Gateways (BGP exit):
  80.81.194.180        - AS13335 - DE-CIX Frankfurt (Cloudflare peering)
  80.81.195.54         - AS13335 - DE-CIX Frankfurt (secondary)
  162.158.84.x         - AS13335 - Cloudflare Frankfurt PoP
  217.131.59.45        - AS6453  - Superonline/Tellcom (Google)
  193.251.150.199      - AS5412  - Turkcell Superonline (Google)
  193.251.252.234      - AS5412  - Superonline (Google)
  91.93.169.33         - AS6453  - Tata/Tellcom (Vercel/AWS)
  72.14.214.52         - AS15169 - Google backbone
  85.132.90.153        - UNKNOWN - Turkcell backbone (Quad9)
  213.248.93.33        - AS174   - Cogent (Quad9)
  62.115.x.x           - AS174   - Cogent backbone

Sinkhole: 10.10.34.35

Hops to destination: 11-17 (long path)
```

---

## ISP #2 - 10.0.22.x Network

### BGP/BGPS IPs:
```
Local Network:
  192.168.0.1          - Local router (hop 1)
  10.0.22.161          - ISP internal (hop 3, 10.0.22.177 alternate)
  10.0.22.130          - ISP internal (hop 4)
  10.0.22.137          - ISP internal (hop 5)
  10.0.22.142          - ISP aggregation (hop 6)
  10.30.96.157         - ISP transit (hop 7)
  10.202.7.132         - BGP edge (hop 8)
  10.21.21.11          - International gateway (hop 9)
  10.21.211.20         - International gateway (alternate, Vercel)
  10.21.41.13          - International gateway (Google)
  10.202.9.142         - BGP edge

International Gateways (BGP exit):
  80.81.194.180        - AS13335 - DE-CIX Frankfurt (Cloudflare)
  10.21.41.13          - UNKNOWN - ISP gateway (Google)
  10.202.9.142         - UNKNOWN - ISP gateway
  217.131.59.45        - AS6453  - Tellcom (Google)
  72.14.212.96         - AS15169 - Google backbone
  193.251.150.199      - AS5412  - Superonline (Google)
  91.93.169.33         - AS6453  - Tata/Tellcom (Vercel/AWS)
  85.132.90.161        - UNKNOWN - Turkcell (Quad9)
  10.50.10.154         - UNKNOWN - ISP intermediate
  10.40.173.49         - AS16509 - AWS backbone
  213.248.93.33        - AS174   - Cogent (Quad9)

Sinkhole: 10.10.34.36

Hops to destination: 12-22 (long path)
```

---

## ISP #3 (Current) - 192.168.1.x / 10.21.x Network

### BGP/BGPS IPs:
```
Local Network:
  192.168.1.1          - Local router (hop 1)
  10.230.219.65        - ISP aggregation (hop 3) ← NEW IP!
  10.224.195.121       - ISP core (hop 5) ← NEW IP!
  10.21.251.114        - International gateway (hop 6, Google DNS) ← NEW IP!
  10.202.6.114         - International gateway (hop 6, Google/Vercel) ← NEW IP!
  10.21.251.122        - International gateway (hop 6, Quad9) ← NEW IP!
  10.21.251.58         - International gateway (hop 6, Fastly) ← NEW IP!

International Gateways (BGP exit):
  Direct connections to major networks (very short path)

Sinkhole: 10.10.34.35 (returned to original)
Hops to destination: 6-7 (very short path!)
```

### Complete BGP IP Summary (ISP #3):

**LOCAL NETWORK IPs:**
| IP | Role | Appears In |
|---|---|---|
| `192.168.1.1` | Local router | All routes |
| `10.230.219.65` | ISP aggregation (hop 3) | All routes |
| `10.224.195.121` | ISP core (hop 5) | 6 of 7 routes |
| `10.21.251.114` | Int'l gateway (Google DNS path) | 8.8.8.8 |
| `10.202.6.114` | Int'l gateway (Google/Vercel/Fastly) | 8.8.4.4, Google, Vercel, Fastly |
| `10.21.251.122` | Int'l gateway (Quad9 path) | 9.9.9.9 |
| `10.21.251.58` | Int'l gateway (Fastly path) | Fastly/NYTimes |

**SINKHOLE IPs:**
| IP | Role |
|---|---|
| `10.10.34.35` | Primary DNS sinkhole (youtube, instagram, facebook, netflix, pages.dev) |

**DESTINATION IPs (reached directly):**
| IP | ASN | Description |
|---|---|---|
| `1.1.1.1` | AS13335 | Cloudflare DNS |
| `8.8.8.8` | AS15169 | Google DNS |
| `8.8.4.4` | AS15169 | Google DNS |
| `142.250.202.163` | AS15169 | Google |
| `64.29.17.67` | AS16509 | Vercel |
| `104.16.133.229` | AS13335 | Cloudflare |

---

## Key Finding: ISP #3 Has Minimal Filtering

| Metric | ISP #1 | ISP #2 | ISP #3 |
|---|---|---|---|
| Routing length | 11-17 hops | 12-22 hops | **6-7 hops** |
| SNI filtering | Sophisticated (TLD-aware) | Moderate | **NONE** |
| DNS poisoning | 10 domains | 10 domains | **5 domains** |
| DoH bypass | ✅ Works | ❌ Blocked | ❌ Blocked |
| No SNI | ✅ Works | ❌ Blocked | ✅ Works |
| Sinkhole IP | 10.10.34.35 | 10.10.34.36 | 10.10.34.35 |
| BGP gateways | 80.81.194.180 (DE-CIX) etc | Same | Direct ISP peering |

**ISP #3 has the most direct connectivity** with shortest routes (6-7 hops to destination). The DPI filtering is still present (DNS poisoning of social media), but **SNI filtering has been completely removed**.
