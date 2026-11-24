# Iran Internet Observatory — NetMon UI

## Layout

Use the existing signed-in NetMon shell, page title hierarchy, metric cards,
tables, colors, and spacing. The page is a regular `/app/iran-monitor` view and
keeps the existing sidebar and top bar.

```text
Iran Internet Observatory                 Updated <timestamp> · External vantage
Iran-specific reachability and network measurements

[Overall status] [Services up] [Degraded] [Down] [Ranges reachable / total]

[Service checks] [Networks by operator] [Cloudflare Radar]

Service checks: category filter + responsive table of actual service results
Networks: scrollable operator table with ranges, reachable, percent, median RTT
Radar: normalized 24 h traffic + confirmed 7 d outage data or unavailable state
```

## States and behavior

- Loading retains the page heading and presents a status message.
- Errors include a retry action and explain how to start the local monitor data
  endpoint.
- Missing/empty feed data is reported as unavailable; do not substitute fixtures.
- Cloudflare Radar is optional; absence does not block services or range data.
- Feed timestamp is always visible, and the page identifies the single external
  measurement vantage point.
- Tables adapt to narrow screens with contained horizontal scrolling.
- Category filters and tabs are semantic buttons with visible selected state,
  focus rings, and accessible names.
