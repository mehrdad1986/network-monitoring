---
status: frozen
---

# Dashboard Completion

## Goal

Make the main dashboard and Real-time Monitor reflect the user's saved network
targets and real backend observations instead of fixed sample figures or a
hardcoded public-host list.

## Scope

- `/app/dashboard`: load the saved target inventory, derive target totals and
  enabled/disabled counts from it, show the actual known status of each target,
  and link directly to target management and target details.
- `/app/realtime`: load enabled saved targets as the initial live-check set;
  use the saved port where available and clearly state the TCP check being made.
  Show loading, empty, retryable error and live result states.
- Preserve quick-check targets added on the Real-time Monitor page and its
  pause, refresh, interval, history and event controls.
- Move Infrastructure, ISP & Connectivity, Incidents & Alerts, and Applications
  navigation groups from the sidebar into an Operations dropdown immediately
  to the left of the existing System dropdown in the top-right header.
- Keep every page route and submenu link available after moving the groups.
- Show a clear no-measurement state when the backend has no recorded monitoring
  measurements. Do not invent uptime, monitor counts, incidents or alert counts.

## Acceptance Criteria

1. Dashboard summary numbers come from saved targets, never fixed sample values.
2. Dashboard target rows link to their target detail pages and provide a link to
   add/manage targets.
3. Realtime starts from enabled saved targets rather than a fixed list of public
   services.
4. Realtime reports a TCP connection result for each target and identifies its
   host and port; a failed API check is distinct from a closed or timed-out port.
5. Both pages handle loading, empty inventory, and backend failure without
   displaying fabricated success or health data.
6. Existing pause, interval, refresh, event history, and manually added target
   behavior continue to work.
7. The four moved navigation groups and all their links are available from the
   top-right Operations dropdown, immediately before System, and are absent from
   the left sidebar.

## Constraints

- Use the existing target and TCP diagnostic APIs.
- Do not add database tables, dependencies, scheduled jobs, or synthetic data.
- Label live TCP observations as reachability checks, not historical monitoring
  measurements or full device health.
