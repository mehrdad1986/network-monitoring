import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { NetworkSummary, SummaryDetails } from '../components/NetworkSummary';
import { AkamaiScanResult, CdnXrayResult, resolveScannerIPv4, scanAkamaiIPs, scanCdnXrayIP } from '../services/scannerTools';
import './ScannerTools.css';

type ScannerMode = 'akamai' | 'cdn';

function parseIPv4(text: string, limit: number): string[] {
  const ranges: { network: bigint; first: bigint; usable: bigint }[] = [];
  let total = 0n;
  for (const raw of text.split(/[\s,;]+/)) {
    const item = raw.trim();
    if (!item) continue;
    const [address, prefixText] = item.split('/');
    const octets = address.split('.').map(part => Number(part));
    if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) throw new Error(`Invalid IPv4 address or range: ${item}`);
    const prefix = prefixText === undefined ? 32 : Number(prefixText);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`Invalid CIDR prefix: ${item}`);
    const value = octets.reduce((sum, octet) => (sum << 8n) | BigInt(octet), 0n);
    const hostBits = 32 - prefix;
    const mask = hostBits === 32 ? 0n : ((0xffffffffn << BigInt(hostBits)) & 0xffffffffn);
    const network = value & mask;
    const count = 1n << BigInt(hostBits);
    const first = prefix < 31 ? 1n : 0n;
    const usable = prefix < 31 ? count - 2n : count;
    if (usable <= 0n) continue;
    ranges.push({ network, first, usable });
    total += usable;
  }
  if (!ranges.length) return [];
  if (ranges.length > limit) throw new Error(`This scan accepts at most ${limit} separate ranges.`);
  const allocations = ranges.map(range => total <= BigInt(limit) ? Number(range.usable) : 1);
  if (total > BigInt(limit)) {
    const remainingBudget = limit - ranges.length;
    const remainingHosts = total - BigInt(ranges.length);
    ranges.forEach((range, index) => {
      if (remainingBudget > 0 && remainingHosts > 0n) allocations[index] += Number((BigInt(remainingBudget) * (range.usable - 1n)) / remainingHosts);
    });
    let allocated = allocations.reduce((sum, value) => sum + value, 0);
    for (let index = 0; allocated < limit && index < ranges.length; index = (index + 1) % ranges.length) {
      if (BigInt(allocations[index]) < ranges[index].usable) { allocations[index]++; allocated++; }
      if (ranges.every((range, candidate) => BigInt(allocations[candidate]) >= range.usable)) break;
    }
  }
  const result = new Set<string>();
  ranges.forEach((range, rangeIndex) => {
    const take = Math.min(allocations[rangeIndex], Number(range.usable));
    const step = range.usable > BigInt(take) ? (range.usable - 1n) / BigInt(Math.max(1, take - 1)) : 1n;
    for (let index = 0; index < take; index++) {
      const host = range.first + (take === 1 ? range.usable / 2n : BigInt(index) * step);
      const ip = range.network + host;
      result.add([24n, 16n, 8n, 0n].map(shift => Number((ip >> shift) & 255n)).join('.'));
    }
  });
  return [...result];
}

export function ScannerTools({ mode }: { mode: ScannerMode }) {
  const isAkamai = mode === 'akamai';
  const title = isAkamai ? 'Akamai IP Scan' : 'CDN Xray Scanner';
  const description = isAkamai
    ? 'Resolve a hostname to IPv4 candidates, then check TCP port 443.'
    : 'Resolve a hostname to IPv4 candidates, then test them through your Xray proxy configuration.';
  const [addresses, setAddresses] = useState(isAkamai ? 'www.akamai.com' : 'google.com');
  const [config, setConfig] = useState('');
  const [candidateIPs, setCandidateIPs] = useState<string[]>([]);
  const [results, setResults] = useState<(AkamaiScanResult | CdnXrayResult)[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [stage, setStage] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const openCount = useMemo(() => results.filter(item => 'open' in item ? item.open : item.success).length, [results]);
  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (abortRef.current) return;
    setError(''); setResults([]); setCandidateIPs([]); setProgress({ completed: 0, total: 0 }); setStage('Resolving target');
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const target = addresses.trim();
      const hostname = !/[\s,;\/]/.test(target) && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(target) && /^[A-Za-z0-9.-]+$/.test(target) && target.includes('.');
      let ips = hostname ? await resolveScannerIPv4(target, controller.signal) : parseIPv4(target, isAkamai ? 512 : 24);
      if (!ips.length) throw new Error(hostname ? 'No IPv4 addresses were returned for this hostname.' : 'Enter an IPv4 address, CIDR range, or hostname.');
      ips = hostname ? parseIPv4(ips.join('\n'), isAkamai ? 512 : 24) : ips;
      setCandidateIPs(ips);
      setProgress({ completed: 0, total: ips.length });
      if (!isAkamai) {
        if (!config.trim()) throw new Error('IP addresses were found. Add your Xray JSON configuration to run the connectivity checks.');
        const parsed = JSON.parse(config);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.inbounds) || !Array.isArray(parsed.outbounds)) throw new Error('IP addresses were found, but the Xray config must contain inbounds and outbounds arrays.');
      }
      setStage(isAkamai ? 'Checking TCP port 443' : 'Testing through Xray');
      if (isAkamai) {
        for (let offset = 0; offset < ips.length; offset += 128) {
          const response = await scanAkamaiIPs(ips.slice(offset, offset + 128), controller.signal);
          setResults(previous => [...previous, ...response.results]);
          setProgress({ completed: Math.min(offset + 128, ips.length), total: ips.length });
        }
      } else {
        for (let index = 0; index < ips.length; index++) {
          try {
            const response = await scanCdnXrayIP(ips[index], config, controller.signal);
            setResults(previous => [...previous, response]);
          } catch (reason) {
            if (controller.signal.aborted) throw reason;
            setResults(previous => [...previous, { ip: ips[index], success: false, error: reason instanceof Error ? reason.message : 'Xray check failed' }]);
          }
          setProgress({ completed: index + 1, total: ips.length });
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The scan failed.');
    } finally {
      abortRef.current = null; setBusy(false); setStage('Complete');
    }
  };

  const metrics = [
    { label: 'IP candidates found', value: candidateIPs.length || '—', icon: 'globe' },
    { label: 'Addresses checked', value: busy ? `${progress.completed} / ${progress.total}` : results.length || '—', icon: 'route' },
    { label: isAkamai ? 'Port 443 open' : 'Xray reachable', value: results.length ? `${openCount}` : '—', icon: 'check' },
    { label: 'Scan state', value: busy ? stage : error ? candidateIPs.length ? 'IPs found · scan stopped' : 'Failed' : results.length ? 'Complete' : 'Ready', icon: 'activity' },
  ];

  return <NetworkSummary title={title} category="Network Tools" description={description} metrics={metrics} source={busy ? `Checking ${progress.completed} of ${progress.total}` : 'User-started scan'}>
    <form className="scanner-tools-form" onSubmit={run}>
      <label htmlFor={`${mode}-addresses`}>Hostname, IPv4 addresses, or CIDR ranges</label>
      <textarea id={`${mode}-addresses`} value={addresses} onChange={event => setAddresses(event.target.value)} placeholder={'google.com\n8.8.8.8\n8.8.8.0/24'} rows={3} disabled={busy} required />
      {isAkamai ? <p>Checks TCP port 443 only; a successful handshake does not prove Akamai ownership or HTTPS identity. A run is capped at 512 sampled addresses. Scan only ranges you are authorized to check.</p> : <>
        <label htmlFor="cdn-xray-config">Xray JSON configuration</label>
        <textarea id="cdn-xray-config" value={config} onChange={event => setConfig(event.target.value)} placeholder="Paste an Xray JSON config with a proxy outbound" rows={7} disabled={busy} />
        <p>Config is sent only when you start a scan, used in a temporary backend file, and then removed. Up to 24 addresses per run.</p>
      </>}
      <div className="scanner-tools-actions"><button type="submit" disabled={busy || !addresses.trim()}>{busy ? `${stage} · ${progress.completed}/${progress.total}` : 'Find IPs and run scan'}</button>{busy && <button type="button" className="scanner-cancel" onClick={() => abortRef.current?.abort()}>Stop</button>}</div>
    </form>
    {error && <section className="scanner-tools-state" role="alert"><h2>Scan issue</h2><p>{error}</p></section>}
    {busy && <p className="scanner-tools-state" role="status">{stage === 'Resolving target' ? 'Resolving this hostname through public DNS resolvers…' : 'Scanning from the NetMon backend. Results appear as checks finish.'}</p>}
    {candidateIPs.length > 0 && <section className="scanner-tools-results"><h2>Discovered IP candidates <span>({candidateIPs.length})</span></h2><div className="scanner-tools-table-wrap"><table><thead><tr><th>IP address</th><th>Check status</th></tr></thead><tbody>{candidateIPs.map(ip => {
      const result = results.find(item => item.ip === ip);
      const status = result ? 'open' in result ? result.status : result.success ? 'Xray reachable' : result.error || 'Xray check failed' : busy ? 'Waiting' : error ? 'Not checked' : 'Discovered';
      return <tr key={ip}><td><code>{ip}</code></td><td>{status}</td></tr>;
    })}</tbody></table></div></section>}
    {!busy && !error && results.length === 0 && candidateIPs.length === 0 && <SummaryDetails title="Ready to scan" description="Start with the example hostname or enter a hostname, IP address, or CIDR range to discover candidate IPv4 addresses." rows={[]} />}
    {results.length > 0 && <section className="scanner-tools-results"><h2>Scan results</h2><div className="scanner-tools-table-wrap"><table><thead><tr><th>IP address</th><th>Status</th><th>Latency</th><th>Details</th></tr></thead><tbody>{results.map((item, index) => <tr key={`${item.ip}-${index}`}><td><code>{item.ip}</code></td><td>{'open' in item ? item.status : item.success ? 'Reachable' : 'Failed'}</td><td>{'latency_ms' in item && item.latency_ms ? `${item.latency_ms.toFixed(1)} ms` : '—'}</td><td>{'error' in item ? item.error || '—' : 'TCP 443'}</td></tr>)}</tbody></table></div></section>}
  </NetworkSummary>;
}
