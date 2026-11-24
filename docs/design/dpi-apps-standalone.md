# Standalone DPI Apps Frontend

Status: proposed; awaiting design confirmation.

## Scope
Build a separate application in `dpi-frontend/`, with its own package manifest, development server, and build output. Preserve the existing `frontend/` application. Use the Python backend's `apps_catalog.json` as the application inventory. API integration remains part of the original objective; verify available backend contracts before implementing execution controls.

## Layout
```text
+------------------------------------------------------------------+
| DPI Apps                    Applications | Runs | Connection       |
+------------------------------------------------------------------+
| All | Network Probes | Live Monitors | Batch Runners | Reports     |
| Utilities | Packet Experiments | Smoke Checks                     |
+------------------------------------------------------------------+
| Search applications...                         App count          |
|                                                                  |
| Application name       Type                     Open details      |
| Description                                                      |
| Source script path                                               |
|                                                                  |
| Application details: requirements, arguments, integration status  |
+------------------------------------------------------------------+
```

## Visual Specification
- Neutral dark navy background; lighter bordered panels; cyan selected navigation.
- System sans-serif; body 14–16px, heading 26px; 8px spacing scale.
- Main content maximum width 1280px, centered, with 24px desktop / 16px mobile padding.
- Header and category navigation wrap or scroll horizontally on narrow screens without body overflow.
- Native links/buttons, visible keyboard focus, labeled search field, active category conveyed programmatically.

## Behavior and States
- Categories follow actual catalog `kind` values; preserve distinct script paths even when names repeat.
- Search filters app names, descriptions, and paths within the selected category.
- Opening details displays the selected application's catalog metadata.
- Clearly show empty results and unavailable backend states.
- Do not show fabricated results, successful connection indicators, or enabled run controls before a real execution API is connected.
- Runs and Connection pages reflect verified API capabilities; no invented endpoints.

## Verification
- Verify catalog coverage, category/search behavior, keyboard navigation, mobile layout, and production build.
- Verify actual API responses before claiming backend connectivity or execution support.
