import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { RouteMonitoring } from './RouteMonitoring';

const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('shows the real kernel routing response and its source timestamp', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({
    routes: [{ dst: 'default', gateway: '192.0.2.1', dev: 'enp1s0', protocol: 'dhcp', metric: 100, table: 'main' }],
    count: 1, source: 'Linux kernel routing table', observedAt: '2026-10-27T12:00:00Z',
  }) });
  render(<RouteMonitoring />);
  expect(await screen.findByText('192.0.2.1')).toBeInTheDocument();
  expect(screen.getByText('enp1s0')).toBeInTheDocument();
  expect(screen.getByText('Linux kernel routing table', { exact: false })).toBeInTheDocument();
});

test('shows routing backend errors and retry action', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'iproute2 required' }) });
  render(<RouteMonitoring />);
  expect(await screen.findByRole('alert')).toHaveTextContent('iproute2 required');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
