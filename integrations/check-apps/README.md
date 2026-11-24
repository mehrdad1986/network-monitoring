# Direct DNS, DoH and website checkers

The apps run on Ubuntu/Linux and use a physical Ethernet/Wi-Fi interface. They
ignore proxy environment variables and bind network sockets to that interface.
They stop if interface binding cannot be enforced. They do not change your VPN,
firewall, routing tables, or system settings. A VPN kill switch can prevent direct
access; the apps do not silently fall back to the VPN.

Install the Python dependencies with `python3 -m pip install -r requirements.txt`.

## Check websites without requiring DoH

```bash
# The checker asks whether you want DoH. If yes, enter one DoH URL.
python3 simple_checker.py

# Supply the DoH URL on the command line instead of being prompted.
python3 simple_checker.py --doh https://dns.google/dns-query

# Skip DoH entirely; start website checking immediately.
python3 simple_checker.py --no-doh

# Short run with a chosen IPv4 comparison resolver.
python3 simple_checker.py --no-doh --dns-server 8.8.8.8 --limit 50

# Standalone website checker: DoH is optional.
python3 check_websites.py --no-doh --limit 50
python3 check_websites.py --doh https://dns.google/dns-query --limit 50

# Compare up to three verified DoH servers in separate website runs.
python3 master_checker.py
```

Every script accepts `--interface`, for example `--interface wlp8s0`. Omit it for
automatic selection. The selected interface is inherited by child checkers.
Virtual interfaces such as tun/wg/loopback are rejected. The program prints the
chosen interface and direct DNS servers before checking anything.

Hostname lookups use NetworkManager's per-device DNS over bound sockets, rather
than the system's global resolver, which could use a VPN. If per-device DNS is
unavailable, bootstrap lookups use 1.1.1.1 and 8.8.8.8 on that same interface.
The `--dns-server` option selects an additional IPv4 DNS server for website
comparison, defaulting to 8.8.8.8. TLS certificate checks remain enabled.

## What website results mean

- `accessible=yes`: HTTPS or HTTP returned a status below 400. HTTP error codes
  and connection errors are reported separately as inaccessible.
- `filtered=yes`: at least one DNS source returned a non-public address for a
  public website. Every returned IPv4 answer is checked, including `10.0.0.0/8`.
  The report identifies which source returned the suspicious address. This
  assumes the inputs are public websites, not internal sites.
- A non-public answer from the primary DNS source stops the HTTP probe, so the
  checker does not treat a private replacement/block page as the real website.
- If the primary resolver fails, a public answer from the comparison resolver or
  DoH can be used to test HTTP access, preserving the website hostname and TLS SNI.
- A website can be accessible through one DNS source while another source shows
  filtering evidence. Availability and DNS evidence are separate columns.
- Different public IPs can be normal CDN/geographic behavior. They set
  `dns_mismatch=yes`, but do not alone set `filtered=yes`.
- Timeouts, resets, TLS errors, DNS failures, and HTTP 403/500 responses do not
  establish the cause of a failure. They are not automatically labeled as DPI.
- An unavailable optional DoH server never prevents IPv4-only website checking.
- Website scans show live completed/total progress, such as `200/2000`, in
  both simple and master checker runs.
- In Ubuntu desktop sessions, simple checker, master checker, and DoH checker
  open a separate live terminal. It lists each website under accessible, DNS
  filtered, legal-restriction, forbidden, or other response groups as checks finish.
- Each website result shows its HTTP response code and meaning. HTTP 451 is
  reported as a legal-restriction indicator, separately from DNS filtering;
  HTTP 403 is forbidden with an unknown cause. Neither code alone confirms
  sanctions. Redirect chains such as `301 -> 200` are shown in the result and CSV.
- The simple checker asks whether to use DoH and prompts for a URL only if you
  answer yes. It does not run the DoH endpoint scanner automatically.

The default website inputs are the two supplied world website CSV files.
The simple checker writes `website_check_results.csv`, `filtered_websites_report.txt`,
`filtered_with_wrong_ips.txt`, `fastest_100_websites.txt`, and
`simple_checker_report.txt`. The master checker uses numbered website outputs.
The standalone CSV now names the comparison field `ipv4_dns_ip` (previously
`google_dns_ip`), because the IPv4 server is configurable. Address fields contain
comma-separated addresses when there is more than one answer.

## Check all DoH endpoints

```bash
# Prompts whether to slow the live display and how many seconds between servers.
python3 check_doh.py

# Set the live display pace directly, without prompting.
python3 check_doh.py --display-delay 1.5
python3 check_doh.py --display-delay 0
```

`DOH_MAX_PUBLIC_ENDPOINTS.txt` currently contains **737 unique endpoints**.
All unique non-comment URLs are checked; there is no 700-server cap. The default
DoH probes query these six domains and record each A response in `domain_results`:
`youtube.com`, `instagram.com`, `x.com`, `telegram.org`, `example.com`, and
`cloudflare.com`. The report includes each domain's rcode and resolved IPs.

A server is marked accessible when it returns at least one valid DNS-message
response that matches the query. This indicates that the DoH endpoint replied.
An NXDOMAIN, REFUSED, or SERVFAIL response still counts as an endpoint reply, but
its domain entry has no IP and shows the rcode. A network/HTTP/TLS failure is
reported separately. The scan queries each default domain once. Live result blocks print one second apart
by default after asking at startup; `--display-delay 0` removes the pause. DNS
requests remain concurrent.
`--attempts N` changes the query count, and `--min-successes` changes how many valid replies are
required. Reverification repeats the recorded domain queries.

DNS responses must be valid DNS wire messages over HTTPS with certificate
verification, HTTP 200, the DNS-message MIME type, a matching question and ID,
and no truncation. IP answers are recorded even when private, so they can be
inspected for filtering. The `--domain` option accepts a comma-separated list
when you want a different set of test domains. The wire format follows
[RFC 8484](https://www.rfc-editor.org/rfc/rfc8484).

`doh_results.csv` contains every endpoint, its errors/rcodes, reply counts, probe
domains and per-domain IPs. `doh_results.txt` ranks endpoints that replied.
`verified_doh_servers.json` records the current verification outcome. Failed
subprocesses never cause old CSV results to be reused implicitly. Measurements
include connection setup; bootstrap DNS answers may be cached for up to 30 seconds.
Run durations depend on timeouts, endpoint health, and concurrency.

## Standalone batch route analyzer

`route_analyzer.py` is a separate tool. With no arguments it queues up to 3,000
unique websites (from the top and next lists), the first 300 IPv4 DNS servers,
every DoH endpoint marked accessible in `doh_results.csv`, and every IP present
in `results/results.csv` from `cloud_ping_rank.py`. It binds probes to the
selected physical interface and disables proxy environment use, independently
of the website and DoH checker workflows.

```bash
# Trace a few targets
python3 route_analyzer.py --target 1.1.1.1 --target https://youtube.com

# Run the full default batch
sudo python3 route_analyzer.py

# Run cloud_ping_rank.py first to populate the cloud IP results, or supply a list
sudo python3 route_analyzer.py --cloud-ips cloud_server_ips.txt

# Trace a few targets instead
python3 route_analyzer.py --target 1.1.1.1 --target https://youtube.com
```

The app uses UDP traceroute probes and needs permission to receive ICMP
(`CAP_NET_RAW`, commonly provided by running it with `sudo`). It uses three
stable UDP probe flows per destination by default and records all responding
routers at each hop, including differing responders. `route_results.csv`
contains each observed hop, latency, and best-effort ASN/prefix/operator/country
annotations. `route_analysis.txt` lists repeated visible hops and countries that
appear most often in the sample. The country counts describe hop observations,
not traffic volume. The cloud IPs are all entries in the cloud scan output, not
every address in the providers' enormous announced prefixes. Geolocation does
not establish who provides transit to Iran;
possible Iran boundary/checkpoint hops are clearly marked as unverified
candidates, since traceroute cannot reveal BGP sessions or prove a checkpoint.

## Offline regression checks

```bash
python3 -m unittest discover -s tests -v
```

Tests exercise DNS replies, scan/verification agreement, all 737 inputs, optional
DoH fallback, 10.x detection, and direct-network enforcement without public traffic.
A real network run is still needed to measure reachability from your connection.
