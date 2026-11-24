# Login layout repair

Classification: quick-win. Scope: redesign the existing Home login/sign-up presentation and correct mode-tab alignment.

## Design reference and implementation plan

Design source: `docs/design/login.md`. Implementation: `frontend/src/pages/Home.tsx` and `frontend/src/pages/Home.css`.
Use an ink/slate canvas, restrained cyan accents, brand header, centered authentication card, editorial typography and a framed network topology illustration.
Right-side revision requested by user: replace the topology illustration and editorial copy with a dominant colorful futuristic motion showcase. Seven distinct pictures/captions cycle at one-second intervals: Traceroute, BGP Checkpoint, Future Wired, Global Reach, Signal Flow, Packet Stream, Connected. Smooth crossfades, static SVG geometry with CSS motion, pause/resume control, and a static reduced-motion fallback. See docs/design/login.md §Right-side motion revision.
The left authentication section is approved and must remain unchanged during this revision.
Below 1000px, show a centered single-column form. Preserve natural scrolling for sign-up and short viewports.
Each field has its label above a full-width input; reserve 44px inside inputs for icons on both sides.
Center the leading icon and trailing password control within a relatively positioned input wrapper.
Keep validation text below the field. Let footer controls wrap on narrow screens.
Use a two-column grid with equally sized, centered Sign In/Sign Up buttons and no sliding indicator. Scope all styling strongly enough to resist generic dashboard rules.
Preserve authentication handlers, fields, validation, password reveal, submit/loading states and provider buttons.

## Acceptance and verification

- Login form rules take precedence over generic selectors imported by other pages.
- Icons and password controls occupy reserved space inside their respective inputs.
- Checkboxes retain intrinsic size; narrow footer rows wrap instead of colliding.
- Sign-in and sign-up fit desktop and mobile widths without horizontal overflow; mode controls have equal widths and centered text.
- Seven visual scenes change every second and loop, with synchronized progress and centered titles. No invented live metrics or unsupported security claims.
- Pause freezes scene changes and all nested motion; reduced motion presents one static composition. The approved left section remains unchanged.
- Keyboard focus, reduced motion, password reveal and invalid-field feedback remain usable.
- Live browser checks and screenshots at desktop/mobile widths; production compilation succeeds.

## Risk and rollback

Risk: global button styles may leak into the form. Use page-scoped overrides.
Rollback: restore the session's saved Home/spec copies; preserve the existing dirty worktree.
No authentication logic, credentials, or backend changes.
