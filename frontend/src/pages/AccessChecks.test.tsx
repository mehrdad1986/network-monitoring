import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AccessChecks } from './AccessChecks';
import { runNetworkTool } from '../services/networkDiagnostics';
jest.mock('../services/networkDiagnostics', () => ({ runNetworkTool: jest.fn() }));

const report = { rows: [{ url: 'https://resolver.example/dns-query', accessible: 'yes' }],
  columns: ['url', 'accessible'], total: 1, page: 1, state: 'saved report', historical: true,
  updated_at: '2026-10-27T04:00:00Z', log: '' };

function show(category = 'doh') {
  return render(<MemoryRouter initialEntries={[`/monitoring/${category}`]}><Routes>
    <Route path="/monitoring/:category" element={<AccessChecks />} />
  </Routes></MemoryRouter>);
}

afterEach(() => jest.restoreAllMocks());

test('loads saved report and its source time', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => report });
  show();
  expect(await screen.findByText('https://resolver.example/dns-query')).toBeInTheDocument();
  expect(screen.getByText(/Historical report/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Accessible DoH' })).toBeInTheDocument();
});

test('shows service errors without claiming a successful scan', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Bridge offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Bridge offline');
});

test('starts only on explicit run and uses the full DoH list by default', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => report });
  show();
  await screen.findByText('https://resolver.example/dns-query');
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Run check' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/check-tools/api/checks/doh',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ limit: 814, target: '1.1.1.1' }) })));
});

test('uses all DNS servers and websites by default', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => report });
  const dns = show('dns');
  expect(dns.getByLabelText('Targets per run')).toHaveValue(62780);
  dns.unmount();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => report });
  const websites = show('websites');
  expect(websites.getByLabelText('Targets per run')).toHaveValue(4000);
});

test('explains sanctions uncertainty', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...report, rows: [], total: 0 }) });
  show('sanctioned-websites');
  expect(screen.getByText(/HTTP 451.*does not confirm sanctions/)).toBeInTheDocument();
  await screen.findByText(/No matching results/);
});

test('shows BGP diagnostic results in the right results panel', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => report });
  (runNetworkTool as jest.Mock).mockResolvedValue({ prefix: '1.1.1.0/24', asn: 'AS13335' });
  show('routes');
  fireEvent.change(screen.getByLabelText('Route tool'), { target: { value: 'bgp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run check' }));
  await waitFor(() => expect(screen.getByLabelText('BGP route results')).toHaveTextContent('AS13335'));
  expect(runNetworkTool).toHaveBeenCalledWith('bgp-intelligence', '1.1.1.1', expect.any(AbortSignal));
});
