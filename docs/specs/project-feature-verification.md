---
status: frozen
classification: feature
---
# Project feature verification and repair
User scope: test root login/dashboard, every app route and tab, starting with Realtime; fix observed problems.
## Acceptance criteria
- AC1: Enumerate every App.tsx route and visible tabs/actions, record browser render/interaction results and network failures with reproducible evidence.
- AC2: Exercise Realtime initial measurements, refresh, pause/resume, interval selection, invalid/duplicate/custom target creation and removal; verify request cancellation and status correctness.
- AC3: Finish Network Tools and speed measurement repairs with live providers, visible failures, bounded execution and regression coverage.
- AC4: Fix reproducible cross-page crashes, broken navigation, request/response mismatches and silent failures. Database/service absence yields explicit unavailable states, never false success or fabricated live data.
- AC5: Distinguish existing unimplemented capabilities and environment-dependent actions from passing functional tests. Never claim every feature works when only rendering was verified.
- AC6: Run all existing frontend tests, relevant Go tests, production build and repeat browser checks after edits; persist coverage and handoff.
## Boundaries
No real firewall/routing/storage/user/package mutations, deployments or destructive test operations. Isolated browser profile; synthetic local demo inputs only. Do not redesign pages or implement an entire backend architecture without a concrete verified defect and scoped design.
## Execution
Inventory and baseline browser sweep; focused reproducible failures; minimal fixes and meaningful regression tests; final coverage matrix including blocked or unimplemented actions. Large missing product capabilities remain explicit findings rather than fake implementations.
