---
status: active
title: Routing, Analytics, scanner, and menu repair
---

# Routing, BGP, Analytics, and menu completeness repair

## Goal

Make Routing/BGP submenus display real lookup results or clearly scoped local data, let users save actual Analytics report snapshots, make scanner Start actions discover and display IP candidates, and expose existing product functions through complete Operations and System menus.

## Acceptance criteria

- AS Path Analysis and BGP Intelligence accept a user supplied IP or CIDR, run an explicit real RIPEstat lookup, and show loading, result, empty, and error states.
- Route Monitoring reads the host Linux routing table and never fabricates routes or change counts.
- Routing History contains only actual completed checks and persists them across page reloads in the same browser.
- Each Analytics report submenu can save the current measured summary, show saved reports after page reload, and remove a saved report; saved records are clearly browser-local.
- Routing and Analytics menu links stay separate from page content and work on direct navigation.
- CDN Xray and Akamai Start flows resolve a hostname or accept bounded IP/CIDR input, display the candidate IPv4 list, and show per-IP results or per-IP errors.
- NetMon Radar displays the actual sampled candidate IPs and progress while checking them, followed by verified results or an honest no-result state.
- DNS Hunter and Edge IP Checker start with a usable example hostname and display the resolver-derived IP list after a user starts the check.
- Operations contains links for the existing overview, monitoring, internet access, performance, protocols, diagnostics, routing, analytics, infrastructure, ISP/connectivity, incidents/alerts, and application pages.
- System contains the existing profile/preferences/security and administration destinations, grouped clearly and without duplicate operational links.
- Enumerate every frontend route and visible tab/action; run the available test suites and production build, then record verified, failed, and environment-blocked cases before the GitHub push.
- No known broken route, silent scanner failure, or fabricated successful result remains in the audited surfaces; issues without enough runtime/dependency access are recorded with concrete evidence.
- No credentials are read, changed, emitted, or stored by these changes.

## Implementation notes

Use the existing tools API and RIPEstat looking-glass endpoint for external BGP observations; use the Linux `ip -json route` command for the local route table. Reuse the DNS diagnostic endpoint for hostname-to-IPv4 discovery. Keep saved report summaries and routing history browser-local because the current local API has no authenticated user settings store. Do not represent browser history as a network-wide or server audit log. Menus must point only to existing App routes. Preserve user-provided Xray configuration without logging or writing its values into project files.

## Verification

Enumerate App routes and visible tabs/actions; run all existing frontend tests, relevant Go tests, production frontend build, and live loopback smoke checks for route-table, BGP input validation, scanner DNS discovery, and one real lookup when outbound access is available. Confirm both menus, deep links, saved-report reload/removal, scanner candidate lists, and empty/error states.

## Rollback

Revert only the routing/analytics repair edits and this spec. Preserve all unrelated pre-existing worktree modifications and runtime data.
