---
status: frozen
classification: quick-win
---
# Network diagnostics repair
Repair existing Network Tools actions and incorrect speed readings.
- Existing tool POST routes accept {"input":"target"}, return real observations or non-2xx {"error":"message"}. Validate input, cap request bodies, execution time, output and scan ports. No shell execution.
- WHOIS uses installed whois; TLS verifies peer certificates; port scan uses bounded TCP dials; MTR uses installed mtr JSON; loss uses installed ping; DNS queries named public resolvers; registry lookups use RIPEstat and GeoIP uses ipwho.is. Provider errors are explicit.
- Bandwidth performs one bounded download to a validated public HTTP(S) target; reject private/link-local and redirects. Label server-origin measurement.
- Browser speed tests transfer actual payloads directly to Cloudflare, count bytes and elapsed time, show measurement destination, and never reuse legacy fabricated history. Bounded adaptive transfers; no silent fallback to constants or localhost throughput.
- Failures, timeout and cancellation visible; prevent concurrent runs and stale updates after tab changes/unmount.
- Tests cover invalid input, real local sockets/TLS, upstream failure, speed arithmetic, UI error/retry and stale results. Verify build and running proxy.
# References
- https://github.com/cloudflare/speedtest (download/upload measurement endpoints)
- https://stat.ripe.net/docs/data-api/api-endpoints/as-overview
- https://stat.ripe.net/docs/data-api/api-endpoints/prefix-overview
