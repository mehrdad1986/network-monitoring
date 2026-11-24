# NetMon sign-in and sign-up design

## Direction

Professional network operations console: ink background, slate surfaces, restrained ice-cyan accents, crisp typography. The user approved the left side and explicitly replaced the original right-side topology direction with the seven-scene motion design below. The left authentication surface, header, footer and responsive layout are fixed.

## Right-side motion revision

- A large, open, frameless motion canvas is the main focus of the right side, replacing the original editorial heading and topology card. Height capped at 540px so the approved form position is retained.
- Seven distinct SVG compositions, one second per scene in a seamless seven-second loop: TRACEROUTE / BGP CHECKPOINT / FUTURE WIRED / GLOBAL REACH / SIGNAL FLOW / PACKET STREAM / CONNECTED.
- Visuals: neon path across perspective rings; a geometric routing checkpoint; luminous braided wire sculpture; wireframe globe; colorful signal spectrum; a vanishing-point stream of light; a triangulated mesh. Fine lines, soft localized glow, cyan/violet/fuchsia/amber spectrum, dark negative space, coherent central alignment.
- Each scene has a centered large label, a concise caption, and synchronized 01–07 progress marks. Crossfade each change over approximately 140ms; no flashing background, shaking, or scrambled text. Animation persists as explicitly requested by the user.
- Animate SVG presentation through CSS and static geometry; no frame-by-frame React state updates, added dependencies, remote assets or fake telemetry. Use meaningful 3D-style geometry and smooth gradient color.
- Small keyboard-accessible Pause/Play control freezes the entire composition and its progress. Reduced motion displays the first scene statically. Hidden mobile illustration has no running animation.
- Acceptance: left section JSX and CSS byte-for-byte preserved relative to /tmp/netmon-home-left-approved.*; sample all seven scenes, 1s timing, pause/resume, reduced motion, browser screenshots and production build.

## Desktop composition

At 1440px: full-height canvas with a 92px brand header, a centered two-column content area capped at 1240px, and a compact footer. Left: approved 440px authentication surface centered inside its column. Right: dominant seven-scene motion canvas, capped at 540px, centered scene titles, progress rail and a small Pause/Play control. Use a 72px inter-column gap and 32px vertical stage padding. Outer padding 48px. Columns 1fr / 1.15fr.

```
NetMon / NETWORK INTELLIGENCE                         NETWORK OPERATIONS
--------------------------------------------------------------------
     WORKSPACE ACCESS                 THE ART OF CONNECTION
     Welcome back.
     Sign in to your workspace.         SEVEN ANIMATED COMPOSITIONS
     [    Sign In    |    Sign Up   ]
     Username                           Luminous paths / sculpture
     [                            ]     Globe / spectrum / mesh
     Password
     [                          o ]
     [ ] Remember me    Forgot...        CENTERED SCENE TITLE
     [      Sign In          ->   ]      Short caption
     -------- or continue with ----     -- -- -- -- -- -- --  Pause
     [ Google ]       [ GitHub ]         A world of signals.
     Terms and privacy                  One clear vision.
--------------------------------------------------------------------
NETWORK VISIBILITY, REFINED.                         NetMon PLATFORM
```

## Export tokens and components

- Canvas #080e18, surface #0e1725, field #0a1220, border #253247; primary text #eef4fc; secondary #a1afc4; muted #8494ac; accent #81e5e0; error #ff9da8.
- System sans serif, 14px body; approved 34px form heading; 31–44px centered animation title; 10px uppercase, tracked eyebrow. Monospace only for graphic coordinates.
- Form card padding 32px, radius 20px, 1px border. Grid tabs with exactly equal columns, 4px padding, 44px buttons and centered labels. Selected tab uses a subtle filled surface and border, no sliding indicator.
- Fields 48px high, label above, 44px reserved for leading/trailing icons. CTA 48px high; provider buttons 44px. Form groups 18px apart. Tabs 26px below header; form 24px below tabs.
- Cyan focus ring with 3px offset on keyboard controls. Errors below fields, loading disabled state, password reveal and existing form validation preserved.
- Animation: seven SVG compositions as specified above, gradient strokes and faint aurora lighting, restrained coordinate accents. Each scene appears for one second in a seven-second loop. No simulated metrics or security claims.

## Responsive and motion

Below 1000px: retain the approved single-column form (max-width 440px), brand/header/footer; hide the right side and disable its animations. Below 480px: 20px page padding, 24px card padding, 28px heading; allow terms/footer wrapping. Natural document scroll for sign-up on short screens. Support 320px without horizontal overflow. No entrance animation that hides form content. Respect prefers-reduced-motion by showing the first right-side scene statically on desktop.

## Verification

Browser checks at 1440, 1024, 768, 390 and 320px in both modes. Equal tab widths and center alignment, visible fields/CTA, no horizontal overflow, keyboard focus, password toggle, invalid form feedback and sign-up mode fields. Screenshot comparison to this composition. Production build.
