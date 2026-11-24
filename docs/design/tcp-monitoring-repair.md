# TCP monitoring repair

Existing TCPMonitoring.tsx and TCPMonitoring.css define the approved layout.
Preserve the header, three summary cards, add-target form and target card grid.
Test All shows Testing only while a batch is active and is disabled during it.
Invalid target input appears below the existing form with role=alert.
Each existing status badge supports Checking, Port Open, Port Closed, Timeout,
and Check Failed; errors show a short explanation inside that card.
Closed summary counts confirmed refused ports only. Timeout/error remain separate
card states. Removed targets never contribute to summary totals.
