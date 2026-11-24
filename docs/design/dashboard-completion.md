# Dashboard Completion Design

## Main Dashboard

Replace the fixed device, monitor, and health figures with an inventory overview
loaded from `apiService.getTargets()`. Show total saved targets, enabled targets,
disabled targets, and targets whose stored status is known. Use explicit
“Unknown / no measurement” labels for targets without recorded checks. Include a
compact target table with address, configured port, enabled state, stored status,
and a link to the target detail page. Keep the existing service cards as the
navigation area and add refresh, loading, retry, and empty-inventory states.

## Real-time Monitor

Load enabled saved targets through the existing API and map them to the current
live-check model. A saved target port is used when present; otherwise use TCP
443 and label that fallback in the row and page explanation. The result is a
point-in-time TCP connection check from the backend. Preserve the existing quick
target form, controls, histories, and status-change feed. Keep manually added
quick-check targets separate from the server inventory and preserve them in
browser storage.

Display a retryable load error and an empty state linking to target management.
If a live TCP check fails at the API layer, display “Check failed”; closed and
timed-out ports remain separate outcomes. Do not present these results as ICMP,
scheduled monitoring, uptime, or service identity.

## Responsive and Accessibility Notes

Use semantic headings, a captioned table, explicit labels, accessible status
text, keyboard-operable controls, and a narrow-screen scroll wrapper for tables.
Retain the existing page color and card styles.

## Top Navigation

Place an Operations dropdown directly before System in the top-right header.
Group all links under Infrastructure, ISP & Connectivity, Incidents & Alerts,
and Applications headings. The Operations panel scrolls when needed, closes on
Escape, outside click, or route selection, restores focus to its trigger on
Escape, and marks the current route. Remove those four groups from the vertical
sidebar so each section appears in one navigation location.
