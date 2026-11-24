# Analytics and Home Navigation

## Purpose

Make Analytics useful with actual measurements collected by NetMon NetMon and
make the signed-in landing page easy to reach from every application section.

## Analytics screens

Keep the existing Analytics page structure, typography, colors, and metric-card
layout. Replace all sample figures and claims with values derived from saved
targets and their recorded measurements.

### Shared states

- **Loading:** retain the page title and show a concise loading message in the
  metric/detail area.
- **Success:** identify the measurement source and observation window. Derive
  values only from returned measurements; show the number of observations used.
- **Empty:** show “No monitoring measurements recorded yet” and direct users to
  add or enable a target/monitor. Do not display zero as if a measurement was
  collected.
- **Error:** show that analytics could not be loaded and provide a Retry action.
- **Capacity planning:** if there are no resource utilization measurements or
  forecast inputs, state that capacity planning data is unavailable. Do not
  invent a forecast from latency or reachability measurements.

### Metric definitions

- **Historical Analysis:** observation count, covered time range, and average
  latency for observations that include latency.
- **Performance Trends:** compare the earlier and later halves of the loaded
  observation window; show the direction only when both halves have comparable
  latency observations. Otherwise explain that more data is needed.
- **Availability Reports:** successful observations divided by all returned
  observations, with the sample count and covered time range.
- **Comparative Analysis:** compare earlier and later halves using the same
  latency and success-rate definitions; report unavailable when either side is
  empty.
- **Capacity Planning:** show only collected utilization metrics and forecasts
  supported by an actual data source; otherwise show the unavailable state.

## Return to signed-in landing page

Add a persistent “Home” navigation item in the signed-in application shell that
routes to `/app/`, the existing Dashboard landing page. Place it before the
collapsible Overview section so it remains visible while all sections are
collapsed. Use the app’s existing sidebar link styling and active-route state.

## Accessibility and responsive behavior

- Home is a keyboard-accessible link with a visible text label and a clear focus
  indicator.
- Loading, empty, error, and unavailable messages remain readable at narrow
  widths and are not conveyed by color alone.
- Retry is a semantic button and announces the resulting load state to assistive
  technology.

## Scope

Only the Analytics data presentation and a persistent return-home link are in
scope. Preserve existing routes, the current visual system, and unrelated
navigation groups. Do not add fabricated measurements or forecasts.
