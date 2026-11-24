import ipaddress
import platform
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

PROVIDER = "DigitalOcean"
CIDRS = [
    "45.55.0.0/16",
    "45.76.0.0/16",
    "45.77.0.0/16",
    "64.225.0.0/16",
    "66.42.0.0/16",
    "67.205.0.0/16",
    "68.183.0.0/16",
    "104.131.0.0/16",
    "104.236.0.0/16",
    "107.170.0.0/16",
    "108.61.0.0/16",
    "128.199.0.0/16",
    "134.209.0.0/16",
    "138.197.0.0/16",
    "139.59.0.0/16",
    "142.93.0.0/16",
    "143.198.0.0/16",
    "157.230.0.0/16",
    "159.65.0.0/16",
    "159.89.0.0/16",
    "161.35.0.0/16",
    "165.22.0.0/16",
    "167.71.0.0/16",
    "167.99.0.0/16",
    "178.128.0.0/16",
    "192.241.0.0/16",
    "206.189.0.0/16",
]
PORTS = (443, 80)
CONNECT_TIMEOUT = 2.5
MAX_IPS = 12
MAX_WORKERS = 12


def load_networks():
    return [ipaddress.ip_network(c) for c in CIDRS]


def first_host(net):
    if net.num_addresses <= 2:
        return net.network_address
    return net.network_address + 1


def sample_ips(networks, limit=MAX_IPS):
    if not networks:
        return []
    step = max(1, len(networks) // limit)
    return [str(first_host(net)) for net in networks[::step][:limit]]


def tcp_probe(ip, port):
    start = time.monotonic()
    try:
        with socket.create_connection((ip, port), timeout=CONNECT_TIMEOUT):
            return True, f"{(time.monotonic() - start) * 1000:.0f}ms"
    except socket.timeout:
        return False, "timeout"
    except ConnectionRefusedError:
        return False, "refused"
    except OSError as exc:
        return False, exc.strerror or type(exc).__name__


def ping(ip):
    if platform.system().lower() == "windows":
        cmd = ["ping", "-n", "1", "-w", "1500", ip]
    else:
        cmd = ["ping", "-c", "1", "-W", "1", ip]
    try:
        return subprocess.run(cmd, capture_output=True, timeout=6).returncode == 0
    except Exception:
        return False


def test_ip(ip):
    probes = [(port, *tcp_probe(ip, port)) for port in PORTS]
    pong = ping(ip)
    reachable = any(ok for _, ok, _ in probes) or pong
    return ip, probes, pong, reachable


def main():
    print(f"=== {PROVIDER} IP accessibility test ===")
    networks = load_networks()
    print(f"networks embedded: {len(networks)}")
    ips = sample_ips(networks)
    if not ips:
        print("no IPs to test")
        return 1
    print(f"testing {len(ips)} sampled IPs (tcp/{'/'.join(str(p) for p in PORTS)} + icmp)\n")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        results = list(pool.map(test_ip, ips))
    blocked = []
    for ip, probes, pong, reachable in results:
        status = "ACCESSIBLE" if reachable else "BLOCKED"
        detail = "  ".join(
            f"tcp/{port}={'OK ' + detail if ok else detail}" for port, ok, detail in probes
        )
        print(f"{ip:<16} {status:<11} ping={'OK' if pong else 'FAIL':<4} {detail}")
        if not reachable:
            blocked.append(ip)
    print(f"\nsummary: {len(results) - len(blocked)}/{len(results)} reachable, {len(blocked)} blocked")
    if blocked:
        print("blocked ips: " + ", ".join(blocked))
    return 0 if not blocked else 2


if __name__ == "__main__":
    sys.exit(main())
