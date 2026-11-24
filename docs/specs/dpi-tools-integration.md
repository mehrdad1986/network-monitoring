# DPI Tools integration

Replace the post-login dashboard Advanced Analytics card with an active DPI Tools card pointing to /app/dpi-tools. After the existing login check, this entry loads the complete DPI document at /dpi-tools/#applications in the current tab. It occupies the entire browser page with the identical layout and functionality as port 3100. There is no iframe or surrounding NetMon navigation. Applications, Runs and Connection sidebar links enter the corresponding DPI section. Browser Back returns to the dashboard or previous NetMon page.

Preserve the independent DPI runner and API, proxying all /dpi-tools/ documents, assets and API calls from the development server to loopback port 3100 with host and origin validation. This includes catalog, readiness, execution, interactive input, cancellation, run history and report downloads. Existing analytics pages remain available.

Verification: full document navigation and section preservation, proxy origin rejection, TypeScript production build. Both local services must run; production hosting must proxy /dpi-tools/ to the local DPI service. Login remains the existing browser authentication model, not a new server authorization boundary. Rollback only these integration edits, preserving existing working changes.
