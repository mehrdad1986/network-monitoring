#!/usr/bin/env python3
"""SNI fragmentation timing sweep - determines if ANY millisecond interval
can bypass the SNI-based filter.

Based on existing measurements, the filter REASSEMBLES ClientHello fragments
before matching SNI. This script tests a dense range of timing gaps to
confirm there is NO bypass window.

Tests fragmentation at: 1ms, 5ms, 10ms, 25ms, 50ms, 75ms, 100ms,
                        150ms, 200ms, 250ms, 300ms, 400ms, 500ms,
                        600ms, 800ms, 1000ms, 1500ms, 2000ms, 3000ms, 5000ms

For each gap, sends the SAME SNI both fragmented and non-fragmented,
then compares verdicts.

Requires Iranian DPI network (MCI/Rightel).
"""
import socket
import ssl
import time
import sys


from tls_bio_probe import probe_tls


def send_fragmented_clienthello(ip, sni, gap_ms, timeout=10):
    return probe_tls(ip, sni, gap_ms, timeout)


def send_full_clienthello(ip, sni, timeout=10):
    return probe_tls(ip, sni, 0, timeout)


def main():
    if len(sys.argv) < 2:
        host = "a.workers.dev"
        print("Usage: python3 sni_fragment_sweep.py <hostname> [ip] [timeout]")
        print("Default: testing SNI=%s on 188.114.97.6" % host)
    else:
        host = sys.argv[1]
        host = sys.argv[1]

    ip = sys.argv[2] if len(sys.argv) > 2 else "188.114.97.6"
    timeout = float(sys.argv[3]) if len(sys.argv) > 3 else 10

    gaps = [0, 1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300,
            400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000]

    print("=" * 100)
    print("SNI FRAGMENTATION TIMING SWEEP")
    print("Target SNI: %s (labels=%d)" % (host, len(host.split("."))))
    print("Target IP:  %s" % ip)
    print("Timeout:    %ds per attempt" % int(timeout))
    print("=" * 100)
    print()
    print("Hypothesis from existing measurements:")
    print("  The filter REASSEMBLES ClientHello before matching SNI.")
    print("  No fragmentation timing should bypass it.")
    print()
    print("This script tests that hypothesis exhaustively.")
    print()

    # Control: single write (no fragmentation)
    print("CONTROL: Single write (no fragmentation)")
    v_ctrl, d_ctrl, ms_ctrl = send_full_clienthello(ip, host, timeout)
    print("  -> %s: %s (%dms)" % (v_ctrl, d_ctrl, ms_ctrl))
    print()

    # Test all gaps
    print("FRAGMENTATION TIMING RESULTS")
    print("%-12s %-15s %-20s %s" % ("Gap(ms)", "Verdict", "Detail", "Elapsed(ms)"))
    print("-" * 90)

    blocked_by_fragment = []
    served_by_fragment = []

    for gap in gaps:
        v, d, ms = send_fragmented_clienthello(ip, host, gap, timeout)
        status = "BLOCKED" if v in ("HANG", "RST") else "SERVED" if v == "RESPONSE" else "OTHER"
        print("  %-12d %-15s %-20s %s" % (gap, status, d[:20], ms))
        sys.stdout.flush()

        if v == "HANG":
            blocked_by_fragment.append(gap)
        elif v == "RESPONSE":
            served_by_fragment.append(gap)
        elif v == "RST":
            blocked_by_fragment.append(gap)

    print()
    print("=" * 100)
    print("RESULT")
    print("=" * 100)

    if served_by_fragment:
        print("  Decrypted HTTP response received at gaps: %s" % served_by_fragment)
        print("  Repeat with paired controls before attributing a difference to fragmentation.")
    elif len(blocked_by_fragment) == len(gaps):
        print("  Timed out or reset at all tested gaps: %s" % blocked_by_fragment)
        print("  No successful HTTP response observed in this sweep; cause is undetermined.")

    else:
        print("  Mixed results - see table above.")
    print()
    print("EXISTING MEASUREMENT (from reports, 2026-10-02):")
    print("  SNI=jade-garden-6ff7...workers.dev:")
    print("    single   (one packet)                -> timeout, 0 bytes     BLOCKED")
    print("    fragment (2 writes, 150 ms apart)   -> timeout, 0 bytes     BLOCKED")
    print("    delay    (2 writes, 600 ms apart)   -> timeout, 0 bytes     BLOCKED")
    print()
    print("  SNI=workers.dev (control):")
    print("    single 0.2s / fragment 0.4s / delay 0.8s  -> SERVED in all modes")
    print()
    print("Current verdict is based only on the measurements above; historical results are not current proof.")


if __name__ == "__main__":
    main()
