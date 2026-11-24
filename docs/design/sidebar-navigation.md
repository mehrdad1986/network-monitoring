# Focused network navigation

## Direction

Cloudflare dashboard inspiration: clear product groupings, scalable navigation, and crisp UI rather than heavy decoration. Source: https://developers.cloudflare.com/changelog/post/new-cloudflare-one-navigation-and-product-experience/ and https://blog.cloudflare.com/redesigning-cloudflare/. NetMon keeps its own dark palette and adds a restrained warm highlight for active location. This is an interpretation of the navigation principles, not a copy of Cloudflare's brand.

## Desktop composition

Keep the existing 240px sidebar and application content offset. Brand stays anchored at the top, signed-in user anchored at the bottom, only the menu list scrolls. All current groups, page labels and routes remain present.

```
╔══════════════════════════════╗
║ ◇  NOC System                 ║
║    NETWORK OPERATIONS         ║
╠══════════════════════════════╣
║ OVERVIEW                     ║
║ ▥  Dashboard         current ║  ← 46px tall, warm edge & glow
║ ∿  Real-time Monitor         ║  ← 42px tall, muted
║                              ║
║ MONITORING                ▾   ║
║ ◎  Targets                   ║
║ ┈  Monitors                  ║
║ ◇  Probes                    ║
║ ...                          ║
║ NETWORK PERFORMANCE       ▸   ║
║ PROTOCOLS                 ▸   ║
╠══════════════════════════════╣
║ PR  Preview             ↪     ║
╚══════════════════════════════╝
```

## Export tokens and behavior

- Sidebar: #080e1c base, #111a2b raised hover, 1px #26344a separators. Accent: #ffb36b active rail with #ff854d secondary light; secondary focus #65dce0. Text: #edf3fc active, #a9bbd1 normal, #788da7 subdued. Avoid hard color flicker.
- Replace platform emoji with consistent 18px outline SVG glyphs. Each link retains its existing text and destination. Icon shapes correspond to broad concepts (activity, routes, targets, tools, security, systems).
- Active link: 46px min-height, 14px/650 label, warm 3px rail, subtle tinted background and glow. Other links: 42px target, 12px/500 label, slightly reduced visual emphasis. Hover/focus: text grows to 14px and translates 2px over 180ms, without shrinking the clickable target or moving surrounding rows. Active remains prominent while a different item is hovered.
- A group containing the current page gets a brighter section heading. When route changes, its group opens automatically; other expanded groups keep their user-selected state. Group headings are buttons with `aria-expanded` and visible keyboard focus.
- Sidebar item target stays at least 42px. Labels use one line with ellipsis where needed; the full label remains available as the link's accessible name. Thin dark scrollbar instead of browser-white gutter.
- Mobile <=768px retains existing open/close overlay behavior. Sidebar width `min(240px, 100vw - 32px)`; routes close the drawer. Motion respects reduced-motion preference.

## Acceptance

1. All existing menu sections, routes and labels remain. Active item and containing heading identify the current route, including pages opened through deep links and browser Back.
2. Hover and keyboard focus enlarge the text; hover exit restores it. On selecting a page, previously active link returns to smaller typography and the new link gains the focused treatment.
3. Group buttons toggle by mouse and keyboard. Deep-linking to a collapsed group opens that group. The signed-in user stays pinned while the menu scrolls.
4. No horizontal overflow or clipping at desktop and mobile sizes, and a reduced-motion preference removes transitions.
