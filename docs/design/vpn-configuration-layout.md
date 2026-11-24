# VPN Configuration Page Layout

## Purpose

Keep the VPN protocol picker readable and use the full available browser width
on the standalone `/vpn` route.

## Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ VPN CONFIGURATION                                      [Dashboard ↩] │
│ Create VPN Subscription / Config                                    │
│ Choose the client format you want to configure.                     │
├────────────────────┬────────────────────┬──────────────────────────┤
│ OpenVPN            │ WireGuard          │ V2RayNG                  │
│ Outline VPN        │ Amnezia VPN        │ Hiddify                  │
└────────────────────┴────────────────────┴──────────────────────────┘
```

- The page wrapper grows to the full width of the application viewport.
- At desktop widths, show three equal-width columns and two rows.
- Keep consistent page gutters and gaps between cards.
- At widths of 760px or less, stack cards in one column and allow vertical
  scrolling; never shrink the page or cards to half the viewport.
- The full picker should remain in normal document flow, not in the legacy
  fixed VPN drawer.

## States

- Default: six protocol cards are visible and equally sized.
- Selected: the chosen card receives the existing selected treatment and a
  short status message appears below the grid.
