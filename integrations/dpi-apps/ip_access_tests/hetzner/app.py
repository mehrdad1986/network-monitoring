import ipaddress
import platform
import re
import socket
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROVIDER = "Hetzner"
RANGES_URL = "https://hetzner.com/_resources/network/hetzner.json"
FALLBACK_CIDRS = [
    "49.12.0.0/16",
    "65.21.0.0/16",
    "65.108.0.0/16",
    "78.46.0.0/16",
    "88.198.0.0/16",
    "95.216.0.0/16",
    "95.217.0.0/16",
    "116.202.0.0/15",
    "136.243.0.0/16",
    "148.251.0.0/16",
    "159.69.0.0/16",
    "168.119.0.0/16",
    "172.105.0.0/16",
    "188.166.0.0/16",
    "195.201.0.0/16",
    "213.133.98.0/24",
    "213.133.99.0/24",
    "213.133.100.0/24",
    "213.239.192.0/18",
]
PORTS = (443, 80)
CONNECT_TIMEOUT = 2.5
MAX_IPS = 12
MAX_WORKERS = 12

CIDR_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3}/\d{1,2})\b")
IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ip-access-test/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", "replace")


def extract_networks(text):
    networks = {}
    for match in CIDR_RE.finditer(text):
        try:
            net = ipaddress.ip_network(match.group(1), strict=False)
        except ValueError:
            continue
        if net.version == 4 and net.num_addresses > 2:
            networks[str(net)] = net
    for match in IP_RE.finditer(CIDR_RE.sub(" ", text)):
        try:
            ip = ipaddress.ip_address(match.group(1))
        except ValueError:
            continue
        if ip.version == 4:
            networks[str(ip)] = ipaddress.ip_network(f"{ip}/32")
    return sorted(networks.values(), key=lambda n: n.network_address)


def load_networks():
    try:
        text = fetch_text(RANGES_URL)
        networks = extract_networks(text)
        if networks:
            return networks, RANGES_URL
        print("[!] no networks found in live list, using fallback")
    except Exception as exc:
        print(f"[!] live list fetch failed: {exc}")
    return [ipaddress.ip_network(c) for c in FALLBACK_CIDRS], "embedded fallback"


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
    networks, source = load_networks()
    print(f"source: {source}")
    print(f"networks loaded: {len(networks)}")
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
