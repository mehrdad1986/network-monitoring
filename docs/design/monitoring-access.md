# Monitoring access checks

User-directed layout: retain the existing sidebar and theme. Add six links under
Monitoring: Accessible DoH, Accessible DNS Servers, Accessible Websites, Filtered
Websites, Sanctioned Websites, Traceroute / BGP.

Desktop: a 280px controls column on the left and a flexible results column on the
right, with 24px gap. Below 900px stack controls above results. Use existing theme
variables, 16px panel padding, 8px corners, and visible keyboard focus.

Controls: page title, source description, bounded run size (1–100), Run and Stop.
Route checks additionally accept one hostname/IP. Results: run state and last
update, live output in a scrollable preformatted panel, then a horizontally
scrollable CSV table with pagination. Empty, loading, failure, cancellation, and
saved-report states must be explicit. Output is text, never HTML.

Sanctions view shows HTTP 451 legal-restriction indicators and explains that
neither 451 nor 403 proves sanctions. Route annotations are observations, not
proof of BGP sessions. Link to the existing BGP tools for routing lookups.
