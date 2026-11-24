---
status: frozen
title: Iran Internet Observatory Integration
classification: feature
---

# Iran Internet Observatory Integration

## Goal

Expose the cloned Iran Internet Monitor's real generated observations inside
NetMon's authenticated application, using NetMon navigation and visual patterns.

## Scope

- Add an **Iran Internet Observatory** card to the post-login dashboard.
- Replace the existing hard-coded Iran monitor page with live local feed data.
- Display the monitor's configured service checks by category, including ISP
  gateways, Iranian DNS, domestic and foreign platforms, circumvention services,
  and observatories.
- Display the IP-range sweep grouped by network operator with range count,
  reachable count, percent, and median latency.
- Display Cloudflare Radar's Iran traffic and outage feed when `radar.json` is
  present; clearly report that it is not configured when the optional feed is
  absent.
- Preserve provenance and timestamps; make stale or unavailable feeds explicit.

## Acceptance Criteria

1. The authenticated dashboard contains a card named **Iran Internet
   Observatory** that opens `/app/iran-monitor`.
2. The page reads `site.json`, `networks.json`, and optionally `radar.json` from
   the running cloned monitor's local data directory through a same-origin
   development proxy.
3. No Iran endpoint, outage, network, or Radar values are fabricated in the
   frontend.
4. The page has loading, error/retry, empty, and success states and displays the
   feed timestamp and external measurement vantage limitation.
5. Services are filterable by category; network operator rows show the actual
   range and reachability fields.
6. If Radar data is absent, the page explains that the optional Cloudflare
   integration is not configured without failing the other sections.
7. The page uses NetMon's application shell and styles.

## Constraints

- Checks originate from the cloned monitor's single external vantage point and
  do not represent measurements from inside Iran.
- The cloned monitor remains a separate Go batch process; the integration reads
  its generated files and does not fork or copy its probing implementation.
- The current local integration is intended for the local development setup;
  production deployment requires equivalent hosting/proxy configuration.
