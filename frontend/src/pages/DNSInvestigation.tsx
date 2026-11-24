import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { NetworkSummary, SummaryDetails } from '../components/NetworkSummary';
import { runNetworkTool } from '../services/networkDiagnostics';
import './DNSInvestigation.css';

type ResolverAnswer = { location: string; result: string; synced: boolean; error?: string };
type DNSResult = { domain: string; servers: ResolverAnswer[]; note?: string };
type InvestigationMode = 'dns' | 'edge';

export function DNSInvestigation({ mode }: { mode: InvestigationMode }) {
  const title = mode === 'dns' ? 'DNS Hunter' : 'Edge IP Checker';
  const description = mode === 'dns'
    ? 'Compare the DNS addresses returned by Cloudflare, Google, and Quad9 for a domain.'
    : 'Inspect the IP addresses public DNS resolvers return for a domain. CDN answers can differ by resolver and location.';
  const [domain, setDomain] = useState('google.com');
  const [result, setResult] = useState<DNSResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const uniqueAddresses = useMemo(() => [...new Set((result?.servers || [])
    .flatMap(answer => answer.result === 'Unavailable' ? [] : answer.result.split(/,\s*/))
    .map(value => value.trim()).filter(Boolean))], [result]);

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = domain.trim();
    if (!target || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 28_000);
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await runNetworkTool('dns-propagation', target, request.signal) as DNSResult;
      if (mounted.current) setResult(data);
    } catch (reason) {
      if (mounted.current) setError(request.signal.aborted ? 'DNS lookup timed out. Try again.' : reason instanceof Error ? reason.message : 'DNS lookup failed.');
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      if (mounted.current) setLoading(false);
    }
  };

  const metrics = [
    { label: 'Resolvers answered', value: loading ? 'Checking…' : result ? `${result.servers.filter(answer => !answer.error).length} / ${result.servers.length}` : '—', icon: 'check' },
    { label: mode === 'dns' ? 'Unique DNS answers' : 'Observed IP addresses', value: loading ? 'Checking…' : result ? uniqueAddresses.length : '—', icon: 'globe' },
    { label: 'Domain', value: result?.domain || domain.trim() || 'Not selected', icon: 'link' },
  ];

  return <NetworkSummary title={title} category="Network Tools" description={description} metrics={metrics} source="Live resolver query">
    <form className="dns-investigation-form" onSubmit={run}>
      <label htmlFor={`${mode}-domain`}>Domain name</label>
      <div className="dns-investigation-input-row">
        <input id={`${mode}-domain`} name="domain" type="text" autoComplete="url" placeholder="example.com" value={domain} onChange={event => setDomain(event.target.value)} maxLength={253} required disabled={loading} />
        <button type="submit" disabled={loading || !domain.trim()}>{loading ? 'Checking…' : mode === 'dns' ? 'Find DNS answers' : 'Check IP answers'}</button>
      </div>
      <p>Start to resolve the hostname from the NetMon backend through three public DNS resolvers; returned IPv4 and IPv6 answers are listed below.</p>
    </form>
    {error ? <section className="dns-investigation-result" role="alert"><h2>Lookup failed</h2><p>{error}</p></section>
      : loading ? <p className="dns-investigation-state" role="status">Querying public DNS resolvers…</p>
      : !result ? <SummaryDetails title="Ready to check" description={mode === 'dns' ? 'Enter a domain to compare its DNS answers across public resolvers.' : 'Enter a domain to inspect the IP addresses currently returned by public resolvers.'} rows={[]} />
      : mode === 'dns' ? <SummaryDetails title={`DNS answers for ${result.domain}`} description={result.note || 'Answers are from three public resolvers; differences can be normal for CDN-backed domains.'} rows={result.servers.map(answer => ({ label: answer.location, value: answer.error || answer.result }))} />
      : <>
        <SummaryDetails title={`Observed IP answers for ${result.domain}`} description="These are the IP addresses returned by the queried resolvers. The tool does not claim an address belongs to a CDN edge without provider-specific verification." rows={uniqueAddresses.length ? uniqueAddresses.map((address, index) => ({ label: `Address ${index + 1}`, value: address })) : [{ label: 'IP addresses', value: 'No addresses returned' }]} />
        <section className="dns-investigation-result"><h2>Resolver results</h2><div className="dns-resolver-list">{result.servers.map(answer => <div key={answer.location}><strong>{answer.location}</strong><span>{answer.error || answer.result}</span></div>)}</div></section>
      </>}
  </NetworkSummary>;
}
