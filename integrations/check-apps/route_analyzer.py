#!/usr/bin/env python3
"""Standalone direct-interface traceroute and route comparison tool.

Uses UDP probes and ICMP replies, then optionally enriches public hop IPs with
ASN/prefix/country data from ipwho.is. Hop country and inferred transit paths
are approximate; traceroute does not reveal BGP sessions or prove a checkpoint.
"""

from __future__ import annotations

import argparse
import csv
import ipaddress
import json
import os
import socket
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

import requests

from direct_network import add_network_argument, require_direct_network


DEFAULT_WEBSITES = "world_top_2000_with_rank_and_country.txt"
DEFAULT_NEXT_WEBSITES = "world_next_2000_by_country.txt"
DEFAULT_DNS = "the MISP IPv4 DNS dataset.json"
DEFAULT_DOH_RESULTS = "doh_results.csv"
DEFAULT_CLOUD_RESULTS = "results/results.csv"
COUNTRIES = {
    "IR": "Iran", "TR": "Turkey", "AM": "Armenia", "AZ": "Azerbaijan",
    "TM": "Turkmenistan", "AF": "Afghanistan", "PK": "Pakistan",
    "IQ": "Iraq", "AE": "United Arab Emirates", "RU": "Russia",
}


def read_targets(args) -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = []
    for value in args.target:
        targets.append((value.strip(), "target"))
    website_paths = []
    if args.all_defaults:
        website_paths = [(Path(args.websites or DEFAULT_WEBSITES), 3000)]
        next_path = Path(args.websites_next or DEFAULT_NEXT_WEBSITES)
        if next_path.exists():
            website_paths.append((next_path, 3000))
    elif args.websites:
        website_paths = [(Path(args.websites), args.website_count)]
    website_values: set[str] = set()
    website_total = 0
    for path, site_limit in website_paths:
        if args.all_defaults:
            site_limit = max(0, 3000 - website_total)
        site_count = 0
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            value = fields[2] if len(fields) >= 3 else line.split(",")[0].strip().strip('"')
            if value and value.lower() not in {"domain", "website", "url"} and value not in website_values:
                website_values.add(value)
                targets.append((value, "website"))
                site_count += 1
                website_total += 1
                if site_limit and site_count >= site_limit:
                    break
    if args.doh:
        for line in Path(args.doh).read_text(encoding="utf-8-sig").splitlines():
            value = line.strip()
            if value and not value.startswith("#"):
                targets.append((value, "doh"))
    elif args.all_defaults:
        # Only use servers marked accessible by check_doh's actual DNS-query result.
        result_path = Path(args.doh_results)
        if result_path.exists():
            with result_path.open(newline="", encoding="utf-8-sig") as stream:
                for row in csv.DictReader(stream):
                    if str(row.get("accessible", "")).lower() in {"yes", "true", "1", "accessible"}:
                        endpoint = row.get("url", "").strip()
                        if endpoint:
                            targets.append((endpoint, "accessible-doh"))
    if args.dns or args.all_defaults:
        path = Path(args.dns or DEFAULT_DNS)
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        dns_limit = args.dns_count if args.dns else 300
        for value in data.get("list", [])[:dns_limit]:
            targets.append((str(value), "dns"))
    cloud_path = Path(args.cloud_ips or DEFAULT_CLOUD_RESULTS) if args.all_defaults or args.cloud_ips else None
    if cloud_path and cloud_path.exists():
        if cloud_path.suffix.lower() == ".csv":
            with cloud_path.open(newline="", encoding="utf-8-sig") as stream:
                for row in csv.DictReader(stream):
                    address = (row.get("ip") or row.get("IP") or "").strip()
                    if address:
                        targets.append((address, "cloud-server"))
        else:
            for line in cloud_path.read_text(encoding="utf-8-sig").splitlines():
                value = line.strip()
                if value and not value.startswith("#"):
                    targets.append((value, "cloud-server"))
    # Retain source labels but collapse duplicate inputs.
    unique = {}
    for value, kind in targets:
        key = (value.strip(), kind)
        unique.setdefault(key, kind)
    limit = args.limit or len(unique)
    return [(value, kind) for (value, kind) in list(unique.items())[:limit]]


def host_of(value: str) -> str:
    raw = value.strip()
    try:
        return str(ipaddress.ip_address(raw.strip("[]")))
    except ValueError:
        pass
    parsed = urlparse(raw if "://" in raw else "//" + raw)
    host = parsed.hostname or raw.split("/", 1)[0]
    return host.rstrip(".")


def resolve_ipv4(host: str) -> list[str]:
    try:
        return [str(ipaddress.IPv4Address(host))]
    except ipaddress.AddressValueError:
        return list(dict.fromkeys(row[4][0] for row in socket.getaddrinfo(
            host, None, socket.AF_INET, socket.SOCK_DGRAM)))


def traceroute(destination: str, interface: str, max_hops: int, probes: int,
               timeout: float) -> list[dict]:
    """Trace each stable UDP flow across TTLs and retain every responding router."""
    observations: dict[int, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    base_port = 33434 + (os.getpid() % 20000)
    max_probed = 0
    receiver = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
    receiver.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, interface.encode() + b"\0")
    try:
        for probe in range(probes):
            # One socket and destination port per probe keeps the flow stable across TTLs.
            port = base_port + probe
            sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sender.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, interface.encode() + b"\0")
            flow_finished = False
            try:
                for ttl in range(1, max_hops + 1):
                    max_probed = max(max_probed, ttl)
                    sender.setsockopt(socket.SOL_IP, socket.IP_TTL, ttl)
                    start = time.monotonic()
                    sender.sendto(b"route-analyzer", (destination, port))
                    deadline = start + timeout
                    while time.monotonic() < deadline:
                        receiver.settimeout(max(0.01, deadline - time.monotonic()))
                        try:
                            packet, address = receiver.recvfrom(512)
                        except socket.timeout:
                            break
                        # Validate the quoted original UDP flow before accepting this ICMP reply.
                        ip_header_len = (packet[0] & 0x0F) * 4 if packet else 0
                        icmp_offset = ip_header_len
                        if len(packet) < icmp_offset + 8 + 20 + 8:
                            continue
                        quoted_ip_offset = icmp_offset + 8
                        quoted_ihl = (packet[quoted_ip_offset] & 0x0F) * 4
                        udp_offset = quoted_ip_offset + quoted_ihl
                        if len(packet) < udp_offset + 8:
                            continue
                        quoted_source_port = int.from_bytes(packet[udp_offset:udp_offset + 2], "big")
                        quoted_dest_port = int.from_bytes(packet[udp_offset + 2:udp_offset + 4], "big")
                        quoted_ttl = packet[quoted_ip_offset + 8]
                        quoted_destination = socket.inet_ntoa(packet[quoted_ip_offset + 16:quoted_ip_offset + 20])
                        if (quoted_dest_port != port or quoted_source_port != sender.getsockname()[1]
                                or quoted_ttl != ttl or quoted_destination != destination):
                            continue
                        hop_ip = address[0]
                        rtt = round((time.monotonic() - start) * 1000, 2)
                        observations[ttl][hop_ip].append(rtt)
                        # ICMP type 3 means the destination (or a firewall) ended this flow.
                        icmp_type = packet[icmp_offset]
                        if hop_ip == destination or icmp_type == 3:
                            flow_finished = True
                        break
                    if flow_finished:
                        break
            finally:
                sender.close()
    finally:
        receiver.close()
    if not observations:
        return [{"ttl": ttl, "ip": "*", "rtt_ms": [], "responders": []}
                for ttl in range(1, max_hops + 1)]
    return [
        {
            "ttl": ttl,
            "ip": (max(observations[ttl], key=lambda ip: len(observations[ttl][ip]))
                   if observations[ttl] else "*"),
            "rtt_ms": (observations[ttl][max(observations[ttl], key=lambda ip: len(observations[ttl][ip]))]
                       if observations[ttl] else []),
            "responders": [{"ip": ip, "rtt_ms": samples}
                           for ip, samples in sorted(observations[ttl].items())],
        }
        for ttl in range(1, max_probed + 1)
    ]


def enrich_ip(ip: str, timeout: float) -> dict:
    if ip == "*":
        return {"asn": "", "prefix": "", "org": "", "country": "", "country_code": ""}
    address = ipaddress.ip_address(ip)
    if not address.is_global:
        return {"asn": "", "prefix": "", "org": "", "country": "non-public/reserved", "country_code": ""}
    try:
        response = requests.get(f"https://ipwho.is/{ip}", timeout=timeout)
        response.raise_for_status()
        data = response.json()
        connection = data.get("connection") or {}
        return {
            "asn": str(connection.get("asn") or ""),
            "prefix": str(connection.get("route") or ""),
            "org": str(connection.get("org") or ""),
            "country": str(data.get("country") or ""),
            "country_code": str(data.get("country_code") or ""),
        }
    except Exception:
        return {"asn": "", "prefix": "", "org": "", "country": "", "country_code": ""}


def write_results(path: Path, results: list[dict]) -> None:
    fields = ["input", "kind", "destination", "target_index", "target_total", "ttl", "hop_ip",
              "rtt_ms", "asn", "prefix", "org", "country", "country_code", "iran_boundary_candidate"]
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for result in results:
            for hop in result["hops"]:
                responders = hop.get("responders", [])
                if not responders:
                    responders = [{"ip": hop["ip"], "rtt_ms": hop["rtt_ms"],
                                   "meta": hop.get("meta", {}),
                                   "iran_boundary_candidate": hop.get("iran_boundary_candidate", False)}]
                for responder in responders:
                    meta = responder.get("meta", {})
                    writer.writerow({
                        "input": result["input"], "kind": result["kind"], "destination": result["destination"],
                        "target_index": result["target_index"], "target_total": result["target_total"],
                        "ttl": hop["ttl"], "hop_ip": responder["ip"],
                        "rtt_ms": ",".join(map(str, responder["rtt_ms"])), **meta,
                        "iran_boundary_candidate": responder.get("iran_boundary_candidate", False),
                    })


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch traceroute and compare common route hops")
    parser.add_argument("--target", action="append", default=[], help="IP, hostname, or URL; repeatable")
    parser.add_argument("--websites", default=None, help="website list to trace")
    parser.add_argument("--websites-next", default=None, help="second website list used by --all-defaults")
    parser.add_argument("--website-count", type=int, default=3000, help="max rows from --websites (default: 3000)")
    parser.add_argument("--doh", default=None, help="DoH URL list to trace (default: disabled)")
    parser.add_argument("--doh-results", default=DEFAULT_DOH_RESULTS, help="check_doh CSV used to select accessible DoH endpoints")
    parser.add_argument("--dns", default=None, help="JSON IPv4 DNS server dataset to trace")
    parser.add_argument("--dns-count", type=int, default=300, help="max DNS servers to trace (default: 300)")
    parser.add_argument("--cloud-ips", default=None, help="cloud_ping_rank results CSV or text file of cloud IPs")
    parser.add_argument("--all-defaults", action="store_true", help="trace the default batch (also selected automatically when no target inputs are given)")
    parser.add_argument("--limit", type=int, default=0, help="limit total unique input targets; 0 means all")
    parser.add_argument("--max-hops", type=int, default=30)
    parser.add_argument("--probes", type=int, default=3,
                        help="stable UDP flows traced per target (default: 3)")
    parser.add_argument("--timeout", type=float, default=1.0)
    parser.add_argument("--metadata-timeout", type=float, default=4.0)
    parser.add_argument("--no-metadata", action="store_true", help="skip public ASN/country lookups")
    parser.add_argument("--csv", default="route_results.csv")
    parser.add_argument("--report", default="route_analysis.txt")
    add_network_argument(parser)
    args = parser.parse_args()
    if not (args.target or args.websites or args.doh or args.dns or args.cloud_ips):
        args.all_defaults = True
    if args.all_defaults:
        args.websites = args.websites or DEFAULT_WEBSITES
    if not (args.target or args.websites or args.doh or args.dns or args.cloud_ips):
        parser.error("provide --target, --websites, --doh, --dns, --cloud-ips, or --all-defaults")
    if args.max_hops < 1 or args.probes < 1 or args.timeout <= 0:
        parser.error("max hops and probes must be positive, and timeout must be greater than zero")
    try:
        targets = read_targets(args)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        parser.error(f"cannot load targets: {exc}")
    if not targets:
        parser.error("no targets found")
    target_counts = Counter(kind for _, kind in targets)
    print("Queued targets: " + " | ".join(f"{kind}={count}" for kind, count in sorted(target_counts.items())), flush=True)
    if args.all_defaults:
        for kind, desired in (("website", 3000), ("dns", 300), ("accessible-doh", None)):
            actual = target_counts[kind]
            if desired and actual < desired:
                print(f"NOTICE: found {actual} {kind} targets; requested {desired}.", flush=True)
            if kind == "accessible-doh" and actual == 0:
                print(f"NOTICE: no accessible DoH endpoints found in {args.doh_results}.", flush=True)
        if target_counts["cloud-server"] == 0:
            print(f"NOTICE: no cloud IPs found; run cloud_ping_rank.py first or supply --cloud-ips (default path: {DEFAULT_CLOUD_RESULTS}).", flush=True)
    interface = require_direct_network(args.interface)
    print("Traceroute requires CAP_NET_RAW/root for ICMP receive. Proxies are disabled; sockets bind to the selected physical interface.", flush=True)
    print("Public IP ASN/country enrichment is approximate. Possible Iran gateway/checkpoint hops are candidates, not verified BGP peers.", flush=True)

    results = []
    metadata_cache = {}
    total = len(targets)
    for index, (value, kind) in enumerate(targets, 1):
        try:
            host = host_of(value)
            addresses = resolve_ipv4(host)
        except Exception as exc:
            print(f"{index}/{total} | {kind} | {value} | resolve failed: {exc}", flush=True)
            continue
        for destination in addresses:
            print(f"{index}/{total} | tracing {kind} | {value} -> {destination}", flush=True)
            try:
                hops = traceroute(destination, interface, args.max_hops, args.probes, args.timeout)
            except PermissionError as exc:
                parser.exit(1, f"Raw ICMP socket permission denied: {exc}. Run with sudo or grant CAP_NET_RAW.\n")
            previous_ttl_countries = set()
            for hop in hops:
                responders = hop.get("responders", [])
                if not responders and hop["ip"] != "*":
                    responders = [{"ip": hop["ip"], "rtt_ms": hop["rtt_ms"]}]
                if not responders:
                    print(f"  {hop['ttl']:>2} *", flush=True)
                current_ttl_countries = set()
                for responder in responders:
                    ip = responder["ip"]
                    if not args.no_metadata and ip not in metadata_cache:
                        metadata_cache[ip] = enrich_ip(ip, args.metadata_timeout)
                    meta = metadata_cache.get(ip, {"asn": "", "prefix": "", "org": "", "country": "", "country_code": ""})
                    code = meta["country_code"]
                    neighbors = {"TR", "AM", "AZ", "TM", "AF", "PK", "IQ"}
                    candidate = code == "IR" or ("IR" in previous_ttl_countries and code in neighbors)
                    responder.update(meta=meta, iran_boundary_candidate=candidate)
                    if code:
                        current_ttl_countries.add(code)
                    rtt = ",".join(f"{x:.1f}ms" for x in responder["rtt_ms"]) or "*"
                    marker = " | POSSIBLE IRAN GATEWAY/CHECKPOINT HOP (unverified)" if candidate else ""
                    print(f"  {hop['ttl']:>2} {ip:<16} {rtt:<16} AS{meta['asn']} {meta['country']} {meta['org']}{marker}", flush=True)
                primary = next((item for item in responders if item["ip"] == hop["ip"]), None)
                if primary:
                    hop.update(meta=primary["meta"], iran_boundary_candidate=primary["iran_boundary_candidate"])
                if current_ttl_countries:
                    previous_ttl_countries = current_ttl_countries
            results.append({"input": value, "kind": kind, "destination": destination,
                            "target_index": index, "target_total": total, "hops": hops})

    # Unique visible hop lists are used for aggregate route frequency comparisons.
    hop_usage = Counter(responder["ip"] for row in results for hop in row["hops"]
                        for responder in hop.get("responders", []) if responder["ip"] != "*")
    hop_country = {}
    for row in results:
        for hop in row["hops"]:
            for responder in hop.get("responders", []):
                if responder["ip"] != "*":
                    hop_country[responder["ip"]] = responder["meta"].get("country") or "unknown"
    countries = Counter()
    for ip, count in hop_usage.items():
        country = hop_country.get(ip, "unknown")
        if country not in {"Iran", "non-public/reserved", "unknown"}:
            countries[country] += count
    shared = [(ip, count, hop_country.get(ip, "unknown")) for ip, count in hop_usage.most_common() if count > 1]
    report = ["BATCH TRACEROUTE / COMMON-HOP ANALYSIS", "=" * 80,
              f"Resolved destination routes completed: {len(results)}; input entries queued: {total}",
              "Each hop is an observed ICMP source address; missing hops are shown as *.",
              "Country/ASN metadata is third-party best effort. Shared hop frequency does not equal traffic volume.",
              "This tool cannot prove a BGP peering relationship or identify an exact checkpoint.\n",
              "MOST COMMON OBSERVED HOPS", "-" * 80]
    report += [f"{ip:<16} {count:>6} traces | {hop_country.get(ip, 'unknown')}" for ip, count in shared[:100]] or ["No repeated visible hops."]
    report += ["\nMOST FREQUENT NON-IRAN HOP COUNTRIES (visible-hop observations)", "-" * 80]
    report += [f"{country:<35} {count}" for country, count in countries.most_common()] or ["No country metadata available."]
    neighbor_observations = [(country, countries[country]) for country in COUNTRIES.values() if countries[country]]
    report += ["\nOBSERVED HOPS IN IRAN'S NEIGHBORING/NEARBY COUNTRIES", "-" * 80]
    report += [f"{country:<35} {count}" for country, count in sorted(neighbor_observations, key=lambda item: item[1], reverse=True)] or ["No nearby-country hop annotations in this sample."]
    report += ["\nINTERPRETATION", "-" * 80,
               "Higher counts mean the country appeared on more observed hop rows in this sample. They do not measure how much traffic a country gives Iran.",
               "A candidate Iran gateway/checkpoint is only a hop whose provider geolocation says Iran or is adjacent to a listed neighbor country; verify with multiple vantage points and BGP data."]
    Path(args.report).write_text("\n".join(report) + "\n", encoding="utf-8")
    write_results(Path(args.csv), results)
    print(f"\nCSV saved: {Path(args.csv).resolve()}\nReport saved: {Path(args.report).resolve()}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
