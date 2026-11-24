# Sidebar navigation focus

Classification: quick-win. Scope: visual and interaction refinement of the existing navigation component. Keep current routes, labels, groups and application layout.

Design source: `docs/design/sidebar-navigation.md`.

## Acceptance criteria

- The current page has a stronger typographic, color and edge treatment than other pages. Nonactive items are visually smaller, while each link keeps a usable hit area.
- Hover or keyboard focus smoothly enlarges a label and highlights its icon. Moving away returns it to its original presentation.
- Group headings work as accessible buttons. A route opened directly or via browser history expands its containing group. Manual expansion remains possible.
- Consistent outline icons replace emoji. All route destinations and labels remain equivalent to the prechange component, including DPI links and mobile drawer behavior.
- The menu scrolls independently between pinned brand and user sections; desktop/mobile layouts have no horizontal overflow. Reduced motion removes transitions.

## Verification

Browser checks on `/app/`, monitoring, performance and protocol routes; hover, click, Back, group keyboard toggle, mobile drawer, focus and reduced motion. Production build and scoped diff checks. No backend or authentication changes.
