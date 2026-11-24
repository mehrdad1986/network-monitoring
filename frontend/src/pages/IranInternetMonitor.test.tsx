import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IranInternetMonitor from './IranInternetMonitor';

const originalFetch = global.fetch;
const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
} as Response);

afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('loads bundled Iran service and operator feeds; missing optional Radar data stays non-blocking', async () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith('/site.json')) return Promise.resolve(jsonResponse({
      ts: '2026-10-27T05:31:45Z', overall: 'major_outage', counts: { up: 23, degraded: 1, down: 16 },
      categories: [{ name: 'ISP endpoints', services: [{ id: 'gateway', name: 'TIC gateway', kind: 'TCP', status: 'down', latency_ms: 0 }] }],
    }));
    if (path.endsWith('/networks.json')) return Promise.resolve(jsonResponse({
      ts: '2026-10-27T05:31:45Z', ranges_total: 1068, ranges_up: 45,
      orgs: [{ org: 'Iran Telecommunication Company', ranges: 237, ips: 100, up: 8, pct: 3.3, median_ms: 54 }],
    }));
    return Promise.resolve(jsonResponse({ error: 'not available' }, 404));
  }) as jest.MockedFunction<typeof fetch>;

  render(<MemoryRouter><StrictMode><IranInternetMonitor /></StrictMode></MemoryRouter>);
  expect(await screen.findByText('TIC gateway')).toBeInTheDocument();
  expect(screen.getByText('major outage')).toBeInTheDocument();
  expect(screen.getByText('45 / 1068')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
