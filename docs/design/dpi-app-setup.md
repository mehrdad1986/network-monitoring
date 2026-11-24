# Specific App Setup Forms

Preserve standalone card/dialog layout. For listed apps, show labeled fields instead of requiring a JSON array:
- dropshape: TLS hostname and destination IPv4.
- make_xray: server hostname, UUID (masked), optional WebSocket path, server port, SOCKS port and output path. No credentials prefilled or saved.
- fake_rst/spoof_rst: source IP/port, destination IP/port, TCP sequence; explicit chosen connection only.
- saved-data utilities: optional existing traceroute directory and output path; blank data directory uses configured saved observations.

Required fields use native required validation plus pure argument validation. Advanced custom arguments remain under a disclosure for other apps; do not combine ambiguous structured/custom values. Cards label missing arguments as Configure target; permission blockers explain administrator action. Data provenance is shown alongside configured data path.
