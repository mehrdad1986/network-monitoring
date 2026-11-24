# DPI App Execution UI

Approved intent: user requests clicking an app runs that app and gives reports.

Preserve existing standalone layout and typography. App details adds a labeled timeout field (default 300 seconds), optional arguments JSON array, Run application button and inline submission error. Run accepts one job at a time and navigates to Runs after acceptance. App browsing itself never starts a job.

Runs shows app path, status, started/finished timestamps, exit code, duration, dependency/input errors, stdout, stderr, cancel button while running, and a downloadable JSON report after completion. Output uses wrapping, scrollable preformatted blocks and text-only rendering. Poll every second only while Runs is active; clear timers on navigation. Show fetch errors with Retry; retain last displayed output if polling fails. Empty history has an honest empty state. Connection shows live interpreter/catalog readiness or a clear unavailable state. Top status mirrors live connection state.
