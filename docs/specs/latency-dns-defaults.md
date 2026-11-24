# Latency monitoring public DNS defaults

Classification: quick-win. Replace only the default target data in `frontend/src/pages/LatencyMonitoring.tsx` with 20 unique IPv4 public DNS servers from 10 well-known providers, two endpoints each. Preserve measurement behavior, custom targets, layout and styling. Remove the existing generic AWS/Azure addresses.

Providers: Google, Cloudflare, Quad9, OpenDNS, AdGuard DNS, CleanBrowsing Security, Control D Unfiltered, DNS.SB, Yandex Basic and AliDNS. Use unique descriptive names/IDs and identify filtered services accurately. This is a provider selection, not a measured popularity ranking.

Acceptance: exactly 20 unique valid IPv4 hosts and IDs; all default cards render and the Monitored count reads 20. All code outside the default array stays unchanged. Verify provider-published addresses, source invariants, rendered page and production build.

## Address sources
- https://developers.google.com/speed/public-dns/docs/using
- https://developers.cloudflare.com/1.1.1.1/ip-addresses/
- https://quad9.net/service/service-addresses-and-features/
- https://www.opendns.com/setupguide/
- https://adguard-dns.io/en/public-dns.html
- https://cleanbrowsing.org/filters
- https://docs.controld.com/docs/free-dns
- https://dns.sb/guide/
- https://dns.yandex.com/
- https://www.alidns.com/

Rollback: restore only the default array from the session snapshot `/tmp/netmon-latency-before.tsx`.
