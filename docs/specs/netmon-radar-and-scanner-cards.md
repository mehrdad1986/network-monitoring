---
status: frozen
classification: feature
---
# NetMon Radar and scanner cards

## Goal

Provide standalone dashboard entry points for CDN Xray Scanner, Akamai IP Scan,
and NetMon Radar. Each page runs bounded, user-started checks through the local
NetMon API and shows real results without the main sidebar.

## Acceptance criteria

1. Dashboard cards named `CDN Xray Scanner`, `Akamai IP Scan`, and `NetMon Radar`
   open their corresponding pages.
2. DNS Hunter, Edge IP Checker, and all new scanner cards open without the main
   menu and include a back-to-dashboard control.
3. Akamai checks accept IPv4/CIDR input, sample at most 512 addresses, and only
   test TCP port 443. Results must not claim Akamai ownership or service identity.
4. CDN Xray accepts a bounded Xray JSON config and public IPv4/CIDR candidates.
   The backend starts a local-only SOCKS listener, changes the selected proxy
   outbound address, tests a fixed HTTPS endpoint, and deletes the temporary
   config after each check.
5. NetMon Radar supports the fixed source catalog, a user-supplied TLS hostname,
   the approved port list, up to 512 random public IPv4 samples, live progress,
   cancellation, and results sorted by measured latency.
6. NetMon Radar verifies TLS certificates against the supplied hostname and does
   not embed NovaRadar's connection identifier. Network source failures remain
   visible as errors.
7. The Iran Internet Observatory view and all standalone scanner pages stay
   within the viewport width; tables may scroll inside their own container.

## Boundaries and risks

- Scanner calls are manual and bounded; no background scans or database schema
  changes are introduced.
- Scanner APIs are available through the existing loopback-only local API.
- Akamai IP scans prove a TCP handshake only; they do not verify provider
  ownership.
- Xray configs may contain credentials. They are request-scoped, written to a
  mode-0600 temporary file, excluded from logs, and removed after the probe.
- NetMon Radar source URLs are fixed in backend code; the client cannot submit a
  URL to fetch.
- The network-checker clone is GPL-3.0 and its code/data were not copied into
  NetMon. The scanner behavior is implemented in NetMon's Go/React stack.
- NovaRadar's MIT-licensed source-selection/two-phase workflow is adapted;
  attribution and the upstream license are in `third_party/NovaRadar/`.

## Design

See `docs/design/netmon-radar-and-scanner-cards.md`.
