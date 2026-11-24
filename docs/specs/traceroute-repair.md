---
status: frozen
title: Traceroute page repair
---

Repair /app/traceroute and POST /api/v1/tools/traceroute. Preserve the existing
card/grid layout and provider targets. Replace simulated hops with Linux
traceroute output executed without a shell, with numeric addresses, three probes,
20-hop limit, 0.5s waits and a 20-second context deadline. Reject empty/option-like
targets. Missing tools return an actionable error. Partial traces are not labeled
as reaching the destination. Missing replies are nullable and display as stars.
Use avg_rtt consistently. Handle API failures, repeated runs and unmount cleanup.
Design source: existing Traceroute.tsx and Traceroute.css; preserve structure,
show errors inside existing cards, show Partial when destination is unreached,
and keep the existing expand control for both completed and partial traces.
Verify parser fixtures, real loopback trace, invalid requests, React rendering
of nullable RTTs and failures, production build, and live frontend proxy.
Rollback only task-specific edits; preserve previous TCP repair and dirty files.

Runtime: updated local API runs /tmp/netmon-traceroute-api on loopback port 8080, using the same database-free local-api launcher. Full scheduler/SNMP limitations from the previous TCP repair remain unchanged.
