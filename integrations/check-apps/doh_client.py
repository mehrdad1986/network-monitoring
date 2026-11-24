"""Shared, direct HTTPS transport and DNS validation for all DoH callers."""

from __future__ import annotations

import base64
import ipaddress
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

import dns.flags
import dns.message
import dns.rcode
import requests

from direct_network import configure_direct_network

DNS_MESSAGE_MIME = "application/dns-message"
DEFAULT_PROBE_DOMAINS = (
    "youtube.com", "instagram.com", "x.com", "telegram.org",
    "example.com", "cloudflare.com",
)


class DoHError(ValueError):
    def __init__(self, message: str, rcode: str = ""):
        super().__init__(message)
        self.rcode = rcode


@dataclass(frozen=True)
class DoHReply:
    addresses: tuple[str, ...]
    latency_ms: float
    rcode: str


def exchange_doh(url: str, domain: str, timeout: float = 5.0) -> DoHReply:
    """Send one A query and accept any matching, well-formed DNS response."""
    configure_direct_network()
    parts = urlsplit(url)
    if parts.scheme.lower() != "https" or not parts.hostname or parts.fragment:
        raise DoHError("not a valid HTTPS endpoint URL")
    query = dns.message.make_query(domain, "A")
    query.id = 0
    parameter = base64.urlsafe_b64encode(query.to_wire()).rstrip(b"=").decode("ascii")
    started = time.perf_counter()
    with requests.Session() as session:
        session.trust_env = False
        with session.get(
            url, params={"dns": parameter},
            headers={"Accept": DNS_MESSAGE_MIME, "User-Agent": "DoH-Checker/3.0"},
            timeout=timeout, verify=True, allow_redirects=False,
        ) as response:
            # Do not attribute a redirect target's availability to this endpoint.
            if response.status_code != 200:
                raise DoHError(f"HTTP {response.status_code}")
            mime = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if mime != DNS_MESSAGE_MIME:
                raise DoHError(f"not a DoH reply (Content-Type: {mime or 'missing'})")
            reply = dns.message.from_wire(response.content)

    if not query.is_response(reply) or query.question != reply.question:
        raise DoHError("reply does not match the query")
    rcode = dns.rcode.to_text(reply.rcode())
    if reply.flags & dns.flags.TC:
        raise DoHError("truncated DNS response", rcode)
    addresses = ()
    if reply.rcode() == dns.rcode.NOERROR:
        # Follow CNAMEs; ignore unrelated address records in the answer section.
        answer = reply.resolve_chaining().answer
        if answer is not None:
            addresses = tuple(str(item.address) for item in answer
                              if item.rdtype == dns.rdatatype.A)
    return DoHReply(addresses, (time.perf_counter() - started) * 1000, rcode)


def query_doh(url: str, domain: str = "example.com", timeout: float = 5.0,
              *, public_only: bool = True) -> DoHReply:
    """Resolve A records and require a successful address answer."""
    result = exchange_doh(url, domain, timeout)
    if result.rcode != "NOERROR":
        raise DoHError(f"DNS {result.rcode}", result.rcode)
    if not result.addresses:
        raise DoHError("no A answer for the requested domain", result.rcode)
    addresses = result.addresses
    if public_only and any(not ipaddress.ip_address(ip).is_global for ip in addresses):
        raise DoHError("non-public address in test-domain answer", result.rcode)
    return result


def error_text(exc: Exception) -> str:
    """Keep the underlying network error, including proxy/TLS/DNS failures."""
    message = " ".join(str(exc).split())
    return f"{type(exc).__name__}: {message}"


def verify_doh_endpoint(url: str, timeout: float = 5.0,
                       domain: str = "example.com") -> tuple[bool, float | None, str]:
    """Check whether the endpoint returns a valid DNS response for the domain."""
    try:
        result = exchange_doh(url, domain=domain, timeout=timeout)
        return True, round(result.latency_ms, 2), ""
    except Exception as exc:
        return False, None, error_text(exc)
