# Feature repair UI contract
Retain existing navigation, page layouts, cards and tabs. Repair only observable failure states.
Each data section: loading -> results or explicit unavailable/error with retry. Missing dependencies must not appear as successful fabricated measurements.
No user input/session/history loss during navigation. Action buttons must perform their labelled action or clearly disclose unsupported capability. Real-world destructive actions are excluded from automated clicking.
Network Performance retains measured metric cards/history and displays the actual external test destination. Network Tools retains sidebar and result panels.
