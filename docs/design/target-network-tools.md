# Target network tools design

In the saved target detail view, preserve the target identity/status header and
existing summary cards. Below them, place a two-column workspace: a compact
tool catalog on the left, and selected tools plus results on the right. On narrow
screens stack the catalog above the queue/results.

Catalog items have the tool name, one-line purpose and an `Add` button. Added
tools appear as cards on the right with `Run selected`, `Remove`, and a clear
per-tool state. The run button is the only execution trigger. A `Stop` control
appears while work is in progress. Results appear in each tool card with the
timestamp and readable fields or preformatted output. Empty catalog selection,
empty queue, failures, unsupported system tools, and no-result responses get
explicit text. Use existing theme tokens and keyboard-visible focus styles.

Target-specific queue/results persist in localStorage. No duplicate tool tabs are
added to the sidebar or target header.
