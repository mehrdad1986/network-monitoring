# Real-time monitor design

Use the existing dark application shell. Scope every new style to .realtime-page.
Palette: navy surfaces #111c2e/#18263d, subtle #2a3d56 borders, white primary text,
slate secondary text, teal #34d399 for reachable, amber #fbbf24 for timeout,
red #fb7185 for closed, slate for unavailable. Radius 12px, 16–24px gaps.

Desktop layout:
```
Real-time Monitor                 [5 seconds v] [Refresh] [Pause monitoring]
Live TCP connectivity · measured from the NetMon backend   ● Live / Paused
[Reachable / total] [Closed / timed out] [Mean connect time] [Session checks]
Targets                              Status changes
Name / host:port | Status | ms        Timestamp / target / transition
                | Recent samples     Keep the latest 30 events
                | Last checked       Empty state before first results
[Name] [Host] [Port] [Add target]
Last completed check · Session-only history (latest 30 samples per target)
```

At <900px stack the target table and event feed. Target table scrolls within its
own container, never the page. At <600px use two metric columns and wrap controls.
Buttons and inputs have visible focus and labels. Chart history has accessible
text; missing observations are gaps. Loading, empty, error, paused and ready
states are explicit. Errors preserve the previous readings and show timestamps.
An empty target list offers the same add-target form. Only custom targets can be
removed; limit 12 total. No external images or added libraries are needed.
