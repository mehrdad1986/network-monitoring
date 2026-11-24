# NetMon - Enhanced with iran-internet-monitor Features

This document describes the new features integrated from iran-internet-monitor.

## New Features

### 1. Automated Analysis
- **Location**: `backend/internal/analyzer/`
- **Configuration**: `ollama` section in config.yaml
- **Analyst Persona**: `prompt.md`
- **Output**: `data/analysis/latest.json`, `data/analysis/history.jsonl`

**Usage**:
```yaml
ollama:
  enabled: true
  host: http://localhost:11434
  model: hermes3
  timeoutseconds: 180
```

Start Ollama with Hermes model:
```bash
ollama pull hermes3
ollama serve
```

### 2. Git-Based Data Persistence
- **Location**: `backend/internal/git/`
- **Configuration**: `git` section in config.yaml
- **Output**: Commits to `data/` directory after each monitoring pass

**Usage**:
```yaml
git:
  enabled: true
  remote: origin
  branch: main
```

**Commit Message Format**: `📊 <timestamp> | up:X degraded:Y down:Z | <status>`

### 3. Data Export Layer
- **Location**: `backend/internal/exporter/`
- **Configuration**: `export` section in config.yaml
- **Outputs**:
  - `data/history.jsonl` - Append-only check history
  - `data/latest.json` - Most recent pass
  - `data/site.json` - Aggregated payload for status page
  - `data/raw/<timestamp>.json` - Raw snapshots (7-day retention)

### 4. IP Range Sweeping
- **Location**: `backend/internal/rangechecker/`
- **Configuration**: `rangecheck` section in config.yaml
- **Input**: `ranges.csv` (format: start_ip,end_ip,count,date,organization)
- **Output**: `data/networks.json`, `data/networks_history.jsonl`

**Features**:
- Fixed 128-worker pool
- TCP :80 probes with 5s timeout
- TEST-NET-1 guard (192.0.2.1:80) for vantage honesty
- Per-organization aggregation

**Usage**:
```yaml
rangecheck:
  enabled: true
  csvpath: ranges.csv
  intervalseconds: 600
  location: US
```

### 5. Cloudflare Radar Integration
- **Location**: `backend/internal/radar/`
- **Environment**: `CLOUDFLARE_API_TOKEN`
- **Output**: `data/radar.json`

**Features**:
- Traffic timeseries (24h, normalized 0-1)
- Confirmed outage events (7d)
- Best-effort: failures don't block monitoring

**Usage**:
```bash
export CLOUDFLARE_API_TOKEN="your_token_here"
```

### 6. Public Status Page
- **Location**: `web/index.html`
- **Data Source**: `data/site.json`
- **Features**:
  - Real-time status display
  - 24-hour history visualization (48 half-hour cells)
  - automated analysis integration
  - Dark/light mode support
  - Auto-refresh every 60 seconds

**Deployment**: Automated via GitHub Actions to Cloudflare Pages

### 7. CI/CD Pipeline
- **Location**: `.github/workflows/deploy.yml`
- **Trigger**: Push to main on web/** or data/*.json changes
- **Target**: Cloudflare Pages

**Required Secrets**:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Data Flow

```
Monitor checks → Database
                    ↓
            Export to JSONL (data/history.jsonl, data/latest.json)
                    ↓
            Build site.json (24h cells, aggregations)
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Automated Analysis   Range Sweep    Radar Fetch
(parallel)     (parallel)     (parallel)
    ↓               ↓               ↓
data/analysis/ data/networks.json data/radar.json
                    ↓
            Git commit & push
                    ↓
        GitHub Actions → Cloudflare Pages
```

## Testing the Features

### Test Data Export
```bash
cd backend
go run cmd/server/main.go
```

Check that `data/latest.json` and `data/site.json` are created after monitoring runs.

### Test Status Page
```bash
cd web
python -m http.server 8000
# Open http://localhost:8000 in browser
```

### Test Automated Analysis (requires Ollama)
```bash
ollama pull hermes3
ollama serve
# In config.yaml, set ollama.enabled: true
# Run monitoring cycle
# Check data/analysis/latest.json
```

### Test IP Range Sweeping
```bash
# Edit config.yaml: rangecheck.enabled: true
# Add test ranges to ranges.csv
# Run monitoring cycle
# Check data/networks.json
```

### Test Git Integration
```bash
git init
git config user.name "NetMon"
git config user.email "netmon@example.com"
# In config.yaml, set git.enabled: true
# Run monitoring cycle
# Check git log
```

### Test Cloudflare Radar
```bash
export CLOUDFLARE_API_TOKEN="your_token"
# Run monitoring cycle
# Check data/radar.json
```

## Integration with Scheduler

To integrate these features with the existing scheduler, you'll need to modify `backend/internal/scheduler/scheduler.go` to:

1. After each monitoring cycle, call `exporter.ExportLatest()`
2. Optionally run `analyzer.Run()` if ollama.enabled
3. Optionally run `rangechecker.ProbeRanges()` if rangecheck.enabled
4. Optionally run `radar.Fetch()` if CLOUDFLARE_API_TOKEN is set
5. Build `site.json` with `exporter.BuildSite()`
6. Optionally commit and push with `git.CommitAndPush()` if git.enabled

## File Structure Summary

```
netmon/
├── .github/workflows/deploy.yml    # CI/CD
├── backend/internal/
│   ├── analyzer/                   # automated analysis
│   ├── git/                        # Git operations
│   ├── exporter/                   # DB → JSONL + site.json
│   ├── radar/                      # Cloudflare Radar
│   └── rangechecker/              # IP range sweeping
├── data/                          # Git-tracked data
│   ├── latest.json
│   ├── site.json
│   ├── history.jsonl
│   ├── analysis/
│   ├── raw/
│   └── networks.json
├── web/                           # Public status page
│   ├── index.html
│   ├── llms.txt
│   └── robots.txt
├── prompt.md                      # Analysis analyst persona
├── ranges.csv                     # IP range definitions
└── config.yaml                    # Extended configuration
```

## Notes

- All new features are **optional** and disabled by default
- Database remains the source of truth; JSONL files are exports
- Git operations are asynchronous and best-effort
- automated analysis failures don't block monitoring
- Status page works with or without analysis data
- Range sweeping includes TEST-NET-1 safety guard
