#!/usr/bin/env python3
"""Real-time DNS Tunnel Monitor

Monitors live tunnel activity on the server via SSH.
Shows active connections, bandwidth, and stream statistics.
"""
import subprocess
import sys
import time
from datetime import datetime

SERVER_IP = "185.204.171.218"
SSH_USER = "root"
SSH_PASS = "@Ilovegod@"
PLINK_PATH = "C:/Program Files/PuTTY/plink.exe"


def ssh_command(cmd):
    """Execute SSH command and return output."""
    try:
        result = subprocess.run(
            [PLINK_PATH, "-batch", "-pw", SSH_PASS, f"{SSH_USER}@{SERVER_IP}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout, result.returncode
    except subprocess.TimeoutExpired:
        return "Command timeout", 1
    except Exception as e:
        return str(e), 1


def get_active_connections():
    """Get current active tunnel connections."""
    cmd = "ss -tunap | grep -E ':(53|5300|1080)' | wc -l"
    output, code = ssh_command(cmd)
    return int(output.strip()) if code == 0 else 0


def get_dnstt_streams():
    """Get active dnstt stream count from recent logs."""
    cmd = "journalctl -u dnstt-server --no-pager -n 50 | grep 'begin stream' | tail -5"
    output, code = ssh_command(cmd)
    return output if code == 0 else "No recent streams"


def get_process_stats():
    """Get process CPU and memory usage."""
    cmd = """ps aux | grep -E 'MasterDnsVPN|dnstt-server|danted' | grep -v grep | awk '{print $3,$4,$11}' """
    output, code = ssh_command(cmd)
    return output if code == 0 else "Process stats unavailable"


def get_network_stats():
    """Get network interface statistics."""
    cmd = "cat /proc/net/dev | grep -E 'eth0|ens' | head -1"
    output, code = ssh_command(cmd)
    return output if code == 0 else "Network stats unavailable"


def get_system_load():
    """Get system load average."""
    cmd = "uptime"
    output, code = ssh_command(cmd)
    return output.strip() if code == 0 else "Load unavailable"


def get_port_stats():
    """Get detailed port statistics."""
    cmd = """
    echo "=== Port 53 (MasterDNS) ==="
    ss -s | head -1
    ss -nu | grep ':53 ' | wc -l | xargs echo "UDP connections:"
    echo ""
    echo "=== Port 5300 (dnstt) ==="
    ss -nu | grep ':5300' | wc -l | xargs echo "UDP connections:"
    echo ""
    echo "=== Port 1080 (SOCKS5) ==="
    ss -tn | grep ':1080' | wc -l | xargs echo "TCP connections:"
    """
    output, code = ssh_command(cmd)
    return output if code == 0 else "Port stats unavailable"


def get_recent_logs():
    """Get most recent tunnel activity."""
    cmd = "journalctl -u dnstt-server --no-pager -n 10 --since '1 minute ago' | tail -5"
    output, code = ssh_command(cmd)
    return output if code == 0 else "No recent activity"


def monitor_loop(interval=5, iterations=None):
    """Monitor tunnel in real-time."""
    count = 0

    try:
        while iterations is None or count < iterations:
            # Clear screen (works in most terminals)
            print("\033[2J\033[H", end="")

            print(f"{'='*80}")
            print(f"  DNS Tunnel Live Monitor - {SERVER_IP}")
            print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  Refresh: Every {interval}s (Ctrl+C to stop)")
            print(f"{'='*80}\n")

            # System load
            print(f"[System Load]")
            print(f"  {get_system_load()}\n")

            # Process stats
            print(f"[Process Stats] (CPU% MEM% COMMAND)")
            stats = get_process_stats()
            for line in stats.strip().split('\n'):
                if line:
                    parts = line.split()
                    if len(parts) >= 3:
                        cpu, mem, cmd = parts[0], parts[1], parts[2]
                        print(f"  {cmd:30s} CPU: {cpu:>5s}%  MEM: {mem:>5s}%")
            print()

            # Port statistics
            print(f"[Port Statistics]")
            port_stats = get_port_stats()
            for line in port_stats.strip().split('\n'):
                if line:
                    print(f"  {line}")
            print()

            # Active connections
            print(f"[Active Connections]")
            conn_count = get_active_connections()
            print(f"  Total active connections: {conn_count}")
            print()

            # Recent tunnel activity
            print(f"[Recent Tunnel Activity] (Last minute)")
            recent = get_recent_logs()
            if recent and recent.strip():
                for line in recent.strip().split('\n')[-5:]:
                    if line and 'stream' in line:
                        # Extract timestamp and stream info
                        parts = line.split()
                        if len(parts) >= 3:
                            timestamp = ' '.join(parts[0:3]) if len(parts) >= 3 else ''
                            message = ' '.join(parts[3:]) if len(parts) > 3 else line
                            print(f"  {timestamp} {message}")
            else:
                print(f"  No recent stream activity")

            print(f"\n{'='*80}")
            print(f"Iteration #{count+1} - Next refresh in {interval}s...")

            count += 1
            if iterations is None or count < iterations:
                time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\n[!] Monitoring stopped by user")
        return


def show_snapshot():
    """Show a single snapshot of current status."""
    print(f"{'='*80}")
    print(f"  DNS Tunnel Status Snapshot")
    print(f"  Server: {SERVER_IP}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    print(f"[System Status]")
    print(f"{get_system_load()}\n")

    print(f"[Services Running]")
    cmd = "systemctl is-active dnstt-server && echo '✓ dnstt-server: active' || echo '✗ dnstt-server: inactive'"
    output, _ = ssh_command(cmd)
    print(f"  {output.strip()}")

    cmd = "pgrep MasterDnsVPN > /dev/null && echo '✓ MasterDNS VPN: running' || echo '✗ MasterDNS VPN: stopped'"
    output, _ = ssh_command(cmd)
    print(f"  {output.strip()}")

    cmd = "pgrep danted > /dev/null && echo '✓ SOCKS5 proxy: running' || echo '✗ SOCKS5 proxy: stopped'"
    output, _ = ssh_command(cmd)
    print(f"  {output.strip()}\n")

    print(f"[Process Resources]")
    stats = get_process_stats()
    for line in stats.strip().split('\n'):
        if line:
            print(f"  {line}")
    print()

    print(f"[Active Connections]")
    conn_count = get_active_connections()
    print(f"  Total: {conn_count} connections\n")

    print(f"[Port Status]")
    print(get_port_stats())

    print(f"[Recent Activity]")
    streams = get_dnstt_streams()
    print(f"{streams}\n")

    print(f"{'='*80}")


def show_menu():
    """Show interactive menu."""
    while True:
        print(f"\n{'='*80}")
        print(f"  DNS Tunnel Monitor - {SERVER_IP}")
        print(f"{'='*80}")
        print(f"\n  1) Show current status snapshot")
        print(f"  2) Start real-time monitoring (5s refresh)")
        print(f"  3) Start real-time monitoring (10s refresh)")
        print(f"  4) View recent dnstt logs (last 50 lines)")
        print(f"  5) View active connections details")
        print(f"  6) Check server configuration")
        print(f"  0) Exit")
        print(f"\n{'='*80}")

        choice = input("\nSelect option: ").strip()

        if choice == "1":
            show_snapshot()
        elif choice == "2":
            print("\nStarting real-time monitor (5s refresh)...\n")
            time.sleep(1)
            monitor_loop(interval=5)
        elif choice == "3":
            print("\nStarting real-time monitor (10s refresh)...\n")
            time.sleep(1)
            monitor_loop(interval=10)
        elif choice == "4":
            print("\n[Recent dnstt-server logs]")
            cmd = "journalctl -u dnstt-server --no-pager -n 50"
            output, _ = ssh_command(cmd)
            print(output)
            input("\nPress Enter to continue...")
        elif choice == "5":
            print("\n[Active Connections Detail]")
            cmd = "ss -tunap | grep -E ':(53|5300|1080)'"
            output, _ = ssh_command(cmd)
            print(output if output.strip() else "No active connections")
            input("\nPress Enter to continue...")
        elif choice == "6":
            print("\n[Server Configuration]")
            cmd = "cat /opt/masterdnsvpn/server_config.toml | grep -E '^(DOMAIN|PROTOCOL_TYPE|UDP_PORT|DATA_ENCRYPTION_METHOD)' | head -10"
            output, _ = ssh_command(cmd)
            print(output)
            input("\nPress Enter to continue...")
        elif choice == "0":
            print("\nExiting...")
            break
        else:
            print("\nInvalid option, try again.")


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        if sys.argv[1] == "--monitor":
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            print(f"Starting real-time monitor with {interval}s refresh...")
            time.sleep(1)
            monitor_loop(interval=interval)
        elif sys.argv[1] == "--snapshot":
            show_snapshot()
        elif sys.argv[1] == "--help":
            print("DNS Tunnel Monitor")
            print("\nUsage:")
            print("  python monitor_dns_tunnel.py              # Interactive menu")
            print("  python monitor_dns_tunnel.py --snapshot   # Show current status")
            print("  python monitor_dns_tunnel.py --monitor [interval]  # Real-time monitoring")
            print("\nExamples:")
            print("  python monitor_dns_tunnel.py --monitor 5   # Monitor with 5s refresh")
            print("  python monitor_dns_tunnel.py --snapshot    # Quick status check")
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Use --help for usage information")
    else:
        show_menu()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[!] Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n[!] Error: {e}")
        sys.exit(1)
