"""Linux-only networking policy: physical interface, direct DNS, no proxies.

No routes, VPN services, firewall rules, or system settings are changed. If the
kernel cannot enforce interface binding, the application must stop.
"""

from __future__ import annotations

import ipaddress
from contextlib import contextmanager
from contextvars import ContextVar
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.request

_socket = socket.socket
_getaddrinfo = socket.getaddrinfo
_interface: str | None = None
_lock = threading.Lock()
_configuration_lock = threading.Lock()
_cache: dict[tuple[str, int], tuple[float, tuple[str, ...]]] = {}
_dns_servers = ("1.1.1.1", "8.8.8.8")
_address_override = ContextVar("direct_address_override", default=None)


@contextmanager
def website_addresses(host: str, addresses: tuple[str, ...]):
    """Use the observed DNS answer for HTTP while preserving Host and TLS SNI."""
    token = _address_override.set((host.rstrip(".").lower(), addresses))
    try:
        yield
    finally:
        _address_override.reset(token)


class DirectNetworkError(RuntimeError):
    pass


def interface_dns(interface: str) -> tuple[str, ...]:
    """Read NetworkManager's per-device DNS, never the global VPN/stub DNS."""
    try:
        result = subprocess.run(
            ["nmcli", "-g", "IP4.DNS,IP6.DNS", "device", "show", interface],
            capture_output=True, text=True, timeout=3, check=True,
        )
    except (OSError, subprocess.SubprocessError):
        return _dns_servers
    servers = []
    for line in result.stdout.splitlines():
        try:
            address = ipaddress.ip_address(line.strip().replace("\\:", ":"))
        except ValueError:
            continue
        if not (address.is_loopback or address.is_unspecified or address.is_link_local):
            servers.append(str(address))
    return tuple(dict.fromkeys(servers)) or _dns_servers


def physical_interfaces() -> list[str]:
    root = Path("/sys/class/net")
    return sorted(p.name for p in root.iterdir()
                  if (p / "device").exists()
                  and (p / "type").read_text().strip() == "1"
                  and (p / "operstate").read_text().strip() == "up")


def select_interface(requested: str | None = None) -> str:
    candidates = physical_interfaces()
    if requested:
        if requested not in candidates:
            raise DirectNetworkError(f"{requested!r} is not an active physical Ethernet/Wi-Fi interface")
        return requested
    # Prefer the physical interface with the lowest-metric IPv4 default route.
    defaults = []
    for line in Path("/proc/net/route").read_text().splitlines()[1:]:
        fields = line.split()
        if len(fields) >= 8 and fields[0] in candidates and fields[1] == "00000000":
            if int(fields[3], 16) & 1:
                defaults.append((int(fields[6]), fields[0]))
    if defaults:
        return min(defaults)[1]
    if len(candidates) == 1:
        return candidates[0]
    raise DirectNetworkError("Cannot select a physical network interface. "
                             "Use --interface with an active Ethernet/Wi-Fi device (see ip link).")


class DirectSocket(_socket):
    def __init__(self, family=socket.AF_INET, type=socket.SOCK_STREAM, proto=0, fileno=None):
        super().__init__(family, type, proto, fileno=fileno)
        if self.family in (socket.AF_INET, socket.AF_INET6):
            try:
                self.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE,
                                _interface.encode() + b"\0")
            except Exception:
                self.close()
                raise


def _lookup(host: str, family: int) -> tuple[str, ...]:
    # Do not use libc/systemd-resolved: its upstream socket can belong to a VPN.
    import dns.message
    import dns.query
    import dns.rcode

    override = _address_override.get()
    if override and override[0] == host.rstrip(".").lower():
        addresses = tuple(ip for ip in override[1]
                          if ipaddress.ip_address(ip).version == (6 if family == socket.AF_INET6 else 4))
        if not addresses:
            raise socket.gaierror(socket.EAI_NONAME, "No address of requested family")
        return addresses
    key = (host, family)
    with _lock:
        cached = _cache.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    qtype = "AAAA" if family == socket.AF_INET6 else "A"
    query = dns.message.make_query(host, qtype)
    errors = []
    for server in _dns_servers:
        try:
            # dnspython's factory is explicitly replaced during initialization.
            reply = dns.query.udp(query, server, timeout=3, raise_on_truncation=True)
            if reply.rcode() != dns.rcode.NOERROR:
                raise OSError(f"DNS {dns.rcode.to_text(reply.rcode())}")
            answer = reply.resolve_chaining().answer
            if answer is None:
                raise OSError(f"no {qtype} answer")
            addresses = tuple(str(item.address) for item in answer)
            with _lock:
                _cache[key] = (time.monotonic() + min(answer.ttl, 30), addresses)
            return addresses
        except Exception as exc:
            errors.append(f"{server}: {exc}")
    raise socket.gaierror(socket.EAI_AGAIN, "Direct DNS failed: " + "; ".join(errors))


def direct_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host is None:
        return _getaddrinfo(host, port, family, type, proto, flags)
    name = host.decode("ascii") if isinstance(host, bytes) else host
    try:
        ipaddress.ip_address(name.split("%", 1)[0])
    except ValueError:
        if flags & socket.AI_NUMERICHOST:
            raise socket.gaierror(socket.EAI_NONAME, "numeric address required")
    else:
        return _getaddrinfo(name, port, family, type, proto, flags | socket.AI_NUMERICHOST)
    families = (socket.AF_INET, socket.AF_INET6) if family == socket.AF_UNSPEC else (family,)
    records = []
    for af in families:
        if af not in (socket.AF_INET, socket.AF_INET6):
            continue
        try:
            addresses = _lookup(name, af)
        except socket.gaierror:
            if len(families) == 1:
                raise
            continue
        for address in addresses:
            records.extend(_getaddrinfo(address, port, af, type, proto,
                                        flags | socket.AI_NUMERICHOST))
    if not records:
        raise socket.gaierror(socket.EAI_AGAIN, f"Direct DNS failed for {name}")
    return records


def add_network_argument(parser) -> None:
    parser.add_argument("--interface", help="physical Ethernet/Wi-Fi interface; auto-selected by default")


def configure_direct_network(requested: str | None = None) -> str:
    with _configuration_lock:
        return _configure_direct_network(requested)


def _configure_direct_network(requested: str | None = None) -> str:
    global _interface, _dns_servers
    if _interface:
        if requested and requested != _interface:
            raise DirectNetworkError("Cannot change physical interface during a run")
        return _interface
    if not sys.platform.startswith("linux") or not hasattr(socket, "SO_BINDTODEVICE"):
        raise DirectNetworkError("Physical interface enforcement requires Linux")
    selected = select_interface(requested or os.environ.get("DIRECT_NETWORK_INTERFACE"))
    # Preflight before changing any process-wide behavior or sending traffic.
    try:
        with _socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, selected.encode() + b"\0")
    except OSError as exc:
        raise DirectNetworkError(f"Cannot bind sockets to {selected}: {exc}. "
                                 "Stopping to avoid VPN routing.") from exc
    _dns_servers = interface_dns(selected)
    _interface = selected
    os.environ["DIRECT_NETWORK_INTERFACE"] = selected  # inherited by checker subprocesses
    for key in list(os.environ):
        if key.lower().endswith("_proxy"):
            os.environ.pop(key)
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
    socket.socket = DirectSocket
    socket.getaddrinfo = direct_getaddrinfo
    socket.gethostbyname = lambda host: direct_getaddrinfo(
        host, 0, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
    import dns.query
    dns.query.socket_factory = DirectSocket
    # All existing apps create Requests sessions after initialization.
    import requests
    original_init = requests.Session.__init__

    def session_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        self.trust_env = False

    requests.Session.__init__ = session_init
    return selected


def require_direct_network(requested: str | None = None) -> str:
    try:
        selected = configure_direct_network(requested)
    except (DirectNetworkError, OSError) as exc:
        raise SystemExit(f"Direct network unavailable: {exc}") from exc
    print(f"Network: direct via {selected}; proxies disabled; DNS via "
          f"{', '.join(_dns_servers)} on the same interface.", flush=True)
    return selected
