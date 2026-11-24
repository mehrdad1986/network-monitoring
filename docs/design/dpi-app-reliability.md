# DPI Reliability UI

Keep standalone layout. Application cards display readiness or blockers from selected interpreter; add Refresh readiness in Connection. Details displays exact arguments and requirements; Run supports normal existing JSON arguments.

Runs retains the report panel but updates live stdout/stderr while running. Add a labeled prompt reply field and Send input button to the active report. Preserve the form and focus during polling. Show a message that output is live and interactive prompts can be answered here. Completed reports remain downloadable. Poll errors retain last output and offer retry.

Show missing data, dependency, arguments and privileges distinctly. Never mark a probe outcome successful just because its process exited zero. Existing Completed definition remains exit code 0.

Batch runner timeout defaults to 1800 seconds; other apps default to 300. Both accept 1–3600 seconds so multi-test batches are not forced into a single five-minute budget.
