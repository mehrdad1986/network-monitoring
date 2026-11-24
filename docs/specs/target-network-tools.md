---
status: frozen
---
# Per-target network tools

## Goal

Let a user open a saved target, add one or more diagnostic tools to that target,
run the selected tools on demand, and inspect the real output beside the target.

## Acceptance criteria

1. Target detail has a searchable/visible catalog with Add actions for Ping,
   Traceroute, Paris traceroute, Nmap, MTR, TCP port check, DNS lookup, TLS
   certificate, BGP route, WHOIS, ASN lookup, and GeoIP.
2. Added tools form a target-specific queue, persist in this browser across reloads,
   can be removed, and do not execute when added.
3. Run selected executes configured tools sequentially against the saved target's
   address. Show per-tool queued/running/completed/failed/cancelled state and real
   response or a clear missing-tool error. Stop aborts the active request.
4. Keep results visible for this target and persist the last result locally.
   Display output as escaped text/JSON and include the run time.
5. Reuse the existing bounded APIs for supported tools. Add bounded backend
   handlers for Nmap top 100 TCP ports and Paris traceroute (20 hops, 1 probe/hop,
   25-second request deadline); pass validated host as an argv item, never a shell.
6. Unsupported binary, insufficient permission, timeout and network failure are
   reported as failures, never represented as successful results.

## Boundaries and risks

Configured tool selection/results live in browser localStorage per target, not in
the server database. Tool execution is a user-initiated diagnostic to the saved
target. The existing local API is loopback-only. Nmap is limited to top 100 TCP
ports with no service/version or OS detection. Paris traceroute requires the
`paris-traceroute` system package and its network permissions; do not silently
fall back to standard traceroute. No automatic runs, broad subnets, arbitrary
ports, shell commands, database schema changes, or changes to target persistence.

## Design

See `docs/design/target-network-tools.md`.
