# NetMon Radar and scanner cards — UI design

## Dashboard cards

Add three active cards using the existing dashboard grid and card tokens. The
labels are `CDN Xray Scanner`, `Akamai IP Scan`, and `NetMon Radar`. Each card
navigates to its own page.

## Standalone scanner pages

Use the existing NetMon network summary header and metric cards inside a centered
1360px content region. Place a back-to-dashboard arrow at the top right. Do not
render the application sidebar or System menu. Forms and result tables use
existing surface, border, accent, focus, and typography tokens; tables scroll
inside their own wrapper on narrow screens.

CDN Xray and Akamai pages use labeled textareas, explicit run/stop controls,
progress/status messages, and per-address results. NetMon Radar adds hostname,
source checkboxes, port checkboxes, a sample-size control, a progress indicator,
and latency-sorted results. Empty, loading, running, failed, cancelled, and
completed states are explicit.

## Iran Internet Observatory

Keep its current standalone shell and back arrow. Constrain the page to the
viewport width, reduce excess outer and metric-card spacing, and keep wide data
tables inside local horizontal-scroll wrappers.

## Accessibility and responsive behavior

All actions are native buttons or links with visible focus. Inputs have labels,
busy states disable duplicate submissions, progress uses a status region, and
tables retain readable headings. The layout uses one column on narrow screens
without document-level horizontal overflow.
