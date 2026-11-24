#!/usr/bin/env python3
"""
cloud_ping_rank.py
------------------
1. For every cloud provider, looks up its announced IPv4 prefixes (via the free
   RIPEstat API, using the provider's ASNs) and randomly picks N IPs (default 400).
2. Probes every IP (ICMP ping, then TCP 443/80 fallback) and measures latency.
3. Prints and saves each result LIVE: time | company | IP | reachable | latency.
4. At the end, ranks providers by how many of their IPs were reachable
   (tie-break: lower median latency) and saves the ranking.

Python 3.9+, requests and dnspython (shared direct networking policy).

Usage:
    python cloud_ping_rank.py
    python cloud_ping_rank.py --count 400 --concurrency 150 --timeout 2
    python cloud_ping_rank.py --providers "AWS,Hetzner,DigitalOcean" --count 100
    python cloud_ping_rank.py --method tcp          # if ICMP is blocked on your network
"""

import argparse
import asyncio
import csv
import ipaddress
import json
import os
import platform
import random
import re
import statistics
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime

from direct_network import add_network_argument, require_direct_network

# --------------------------------------------------------------------------
# Provider -> ASNs. Edit freely. Verify ASNs at https://bgp.he.net if needed.
# --------------------------------------------------------------------------
PROVIDERS = {
    # Hyperscalers
    "AWS": [16509, 14618],
    "Microsoft Azure": [8075],
    "Google Cloud": [396982, 15169],
    "Oracle Cloud": [31898],
    "IBM Cloud": [36351],
    # China
    "Alibaba Cloud": [45102, 37963],
    "Tencent Cloud": [45090, 132203],
    "Huawei Cloud": [136907],
    "Baidu Cloud": [38365, 55967],
    "Kingsoft Cloud": [59019],
    "UCloud": [135377],
    "Volcano Engine (ByteDance)": [137718],
    # Developer / mid-size
    "DigitalOcean": [14061],
    "Linode (Akamai)": [63949],
    "Vultr": [20473],
    "OVHcloud": [16276],
    "Hetzner": [24940],
    "Scaleway": [12876],
    "UpCloud": [202053],
    "Rackspace": [27357],
    "Equinix": [54825],
    "Fly.io": [40509],
    "Contabo": [51167],
    "Kamatera": [41436],
    # Edge / CDN
    "Cloudflare": [13335],
    "Akamai": [20940, 16625],
    "Fastly": [54113],
    "Bunny.net": [200325],
    # Regional
    "IONOS": [8560],
    "Gcore": [199524],
    "Exoscale": [61098],
    "Yandex Cloud": [13238],
    "Selectel": [49505],
    "VK Cloud": [47764],
    "Naver Cloud": [23576],
    "Sakura Internet": [9370, 7684],
    "Singtel": [7473],
    # Storage / SaaS
    "Backblaze": [40401],
    "Wasabi": [395717],
    "Dropbox": [19679],
    "Salesforce": [14340],
    # GPU / AI
    "CoreWeave": [40152],
    "Lambda Labs": [62904],
    # Hosting
    "GoDaddy": [26496],
    "Namecheap": [22612],
    "Hostinger": [47583],
}

RIPESTAT = "https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{asn}"
CACHE_FILE = "prefix_cache.json"
TCP_PORTS = (443, 80)


# --------------------------------------------------------------------------
# Step 1: get prefixes and sample IPs
# --------------------------------------------------------------------------
def fetch_prefixes_sync(asn):
    req = urllib.request.Request(
        RIPESTAT.format(asn=asn), headers={"User-Agent": "cloud-ping-rank/1.0"}
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=30) as r:
        data = json.load(r)
    return [p["prefix"] for p in data["data"]["prefixes"] if ":" not in p["prefix"]]


async def get_provider_prefixes(name, asns, cache, sem):
    prefixes = []
    for asn in asns:
        key = f"AS{asn}"
        if key not in cache:
            async with sem:
                for attempt in range(3):
                    try:
                        cache[key] = await asyncio.to_thread(fetch_prefixes_sync, asn)
                        break
                    except Exception as e:
                        if attempt == 2:
                            print(f"[warn] {name} AS{asn}: could not fetch prefixes ({e})")
                            cache[key] = []
                        else:
                            await asyncio.sleep(2 * (attempt + 1))
        prefixes.extend(cache[key])
    return prefixes


def sample_ips(prefixes, count, rng):
    nets = []
    for p in prefixes:
        try:
            n = ipaddress.ip_network(p, strict=False)
        except ValueError:
            continue
        if n.prefixlen <= 30 and n.is_global:
            nets.append(n)
    if not nets:
        return []
    weights = [n.num_addresses for n in nets]
    total_space = sum(weights)
    target = min(count, total_space - 2 * len(nets))
    picked, attempts = set(), 0
    while len(picked) < target and attempts < count * 50:
        attempts += 1
        n = rng.choices(nets, weights=weights, k=1)[0]
        offset = rng.randint(1, n.num_addresses - 2)  # skip network/broadcast
        picked.add(str(n.network_address + offset))
    return list(picked)


# --------------------------------------------------------------------------
# Step 2: probing
# --------------------------------------------------------------------------
_TIME_RE = re.compile(r"time[=<]\s*([\d.]+)\s*ms", re.IGNORECASE)
_SYSTEM = platform.system()
_ping_missing = False


async def icmp_probe(ip, timeout):
    global _ping_missing
    if _ping_missing:
        return None
    if _SYSTEM == "Windows":
        cmd = ["ping", "-n", "1", "-w", str(int(timeout * 1000)), ip]
    elif _SYSTEM == "Darwin":
        cmd = ["ping", "-c", "1", "-W", str(int(timeout * 1000)), ip]
    else:
        cmd = ["ping", "-c", "1", "-W", str(max(1, int(round(timeout)))), ip]
    if sys.platform.startswith("linux"):
        cmd[1:1] = ["-I", os.environ["DIRECT_NETWORK_INTERFACE"]]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
    except FileNotFoundError:
        _ping_missing = True
        print("[warn] 'ping' command not found, falling back to TCP probes only")
        return None
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout + 2)
    except asyncio.TimeoutError:
        proc.kill()
        return None
    m = _TIME_RE.search(out.decode(errors="ignore"))
    if m and proc.returncode == 0:
        return float(m.group(1))
    return None


async def tcp_probe(ip, timeout):
    """Returns (latency_ms, method) or None. A refused connection (RST) still
    proves the host is alive and gives a valid round-trip time."""
    for port in TCP_PORTS:
        start = time.perf_counter()
        try:
            _, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout)
            ms = (time.perf_counter() - start) * 1000
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return ms, f"tcp/{port}"
        except ConnectionRefusedError:
            return (time.perf_counter() - start) * 1000, f"tcp/{port}-rst"
        except Exception:
            continue
    return None


async def probe(ip, method, timeout):
    if method in ("icmp", "both"):
        ms = await icmp_probe(ip, timeout)
        if ms is not None:
            return ms, "icmp"
    if method in ("tcp", "both") or _ping_missing:
        res = await tcp_probe(ip, timeout)
        if res:
            return res
    return None


# --------------------------------------------------------------------------
# Step 3 & 4: run, live output, ranking
# --------------------------------------------------------------------------
async def worker(provider, ip, method, timeout, sem):
    async with sem:
        res = await probe(ip, method, timeout)
    if res:
        return provider, ip, True, round(res[0], 2), res[1]
    return provider, ip, False, None, "none"


def rank_and_report(results, out_dir):
    by_provider = defaultdict(list)
    for provider, ip, ok, lat, _ in results:
        by_provider[provider].append((ok, lat))

    rows = []
    for provider, items in by_provider.items():
        total = len(items)
        lats = sorted(l for ok, l in items if ok and l is not None)
        reachable = len(lats)
        rows.append({
            "provider": provider,
            "tested": total,
            "reachable": reachable,
            "unreachable": total - reachable,
            "reachable_pct": round(100 * reachable / total, 2) if total else 0.0,
            "min_ms": round(lats[0], 2) if lats else "",
            "avg_ms": round(statistics.mean(lats), 2) if lats else "",
            "median_ms": round(statistics.median(lats), 2) if lats else "",
            "p95_ms": round(lats[int(0.95 * (len(lats) - 1))], 2) if lats else "",
            "max_ms": round(lats[-1], 2) if lats else "",
        })

    rows.sort(key=lambda r: (-r["reachable_pct"],
                             r["median_ms"] if r["median_ms"] != "" else 1e9))
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    fields = ["rank", "provider", "tested", "reachable", "unreachable",
              "reachable_pct", "min_ms", "avg_ms", "median_ms", "p95_ms", "max_ms"]
    path = os.path.join(out_dir, "ranking.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print("\n" + "=" * 96)
    print("RANKING: most accessible cloud services (by % of IPs reachable, then median latency)")
    print("=" * 96)
    print(f"{'#':>3}  {'Provider':<28}{'Tested':>7}{'Reach':>7}{'Reach %':>9}"
          f"{'Min':>8}{'Median':>9}{'Avg':>9}{'P95':>9}")
    print("-" * 96)
    for r in rows:
        print(f"{r['rank']:>3}  {r['provider']:<28}{r['tested']:>7}{r['reachable']:>7}"
              f"{r['reachable_pct']:>8}%{str(r['min_ms']):>8}{str(r['median_ms']):>9}"
              f"{str(r['avg_ms']):>9}{str(r['p95_ms']):>9}")
    print(f"\nRanking saved to: {path}")


async def main():
    ap = argparse.ArgumentParser(description="Ping random IPs of cloud providers and rank them.")
    ap.add_argument("--count", type=int, default=400, help="IPs per provider (default 400)")
    ap.add_argument("--concurrency", type=int, default=100, help="parallel probes (default 100)")
    ap.add_argument("--timeout", type=float, default=2.0, help="seconds per probe (default 2)")
    ap.add_argument("--method", choices=["icmp", "tcp", "both"], default="both",
                    help="probe method (default: ICMP then TCP fallback)")
    ap.add_argument("--providers", type=str, default="",
                    help="comma-separated subset of provider names")
    ap.add_argument("--seed", type=int, default=None, help="random seed for reproducible sampling")
    ap.add_argument("--out", type=str, default="results", help="output folder")
    add_network_argument(ap)
    args = ap.parse_args()
    require_direct_network(args.interface)

    os.makedirs(args.out, exist_ok=True)
    rng = random.Random(args.seed)

    selected = PROVIDERS
    if args.providers:
        wanted = {p.strip().lower() for p in args.providers.split(",")}
        selected = {k: v for k, v in PROVIDERS.items() if k.lower() in wanted}
        if not selected:
            sys.exit("No matching providers. Check names in PROVIDERS.")

    # Prefix cache
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    print(f"Fetching IP prefixes for {len(selected)} providers...")
    fetch_sem = asyncio.Semaphore(4)
    names = list(selected)
    prefix_lists = await asyncio.gather(
        *(get_provider_prefixes(n, selected[n], cache, fetch_sem) for n in names)
    )
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

    jobs = []
    for name, prefixes in zip(names, prefix_lists):
        ips = sample_ips(prefixes, args.count, rng)
        print(f"  {name:<28} {len(prefixes):>6} prefixes -> {len(ips)} IPs sampled")
        jobs.extend((name, ip) for ip in ips)

    rng.shuffle(jobs)  # mix providers so live output and load are spread out
    print(f"\nProbing {len(jobs)} IPs (method={args.method}, concurrency={args.concurrency})...\n")

    probe_sem = asyncio.Semaphore(args.concurrency)
    tasks = [asyncio.create_task(worker(p, ip, args.method, args.timeout, probe_sem))
             for p, ip in jobs]

    results_path = os.path.join(args.out, "results.csv")
    results = []
    done = 0
    try:
        with open(results_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["timestamp", "provider", "ip", "reachable", "latency_ms", "method"])
            print(f"{'time':<9} {'company':<28} {'ip':<16} {'status':<13} latency")
            print("-" * 80)
            for fut in asyncio.as_completed(tasks):
                provider, ip, ok, lat, how = await fut
                done += 1
                ts = datetime.now().strftime("%H:%M:%S")
                status = "ACCESSIBLE" if ok else "UNREACHABLE"
                lat_txt = f"{lat} ms ({how})" if ok else "-"
                print(f"{ts:<9} {provider:<28} {ip:<16} {status:<13} {lat_txt}   [{done}/{len(jobs)}]")
                w.writerow([datetime.now().isoformat(timespec="seconds"),
                            provider, ip, ok, lat if lat is not None else "", how])
                f.flush()
                results.append((provider, ip, ok, lat, how))
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\nInterrupted. Ranking partial results...")
        for t in tasks:
            t.cancel()

    print(f"\nAll results saved to: {results_path}")
    if results:
        rank_and_report(results, args.out)


if __name__ == "__main__":
    if _SYSTEM == "Windows":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
