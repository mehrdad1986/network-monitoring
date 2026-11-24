import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScannerTools } from './ScannerTools';

const originalFetch = global.fetch;
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body } as Response);
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('Akamai scan resolves a hostname, displays candidate IPs, and reports per-IP results', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(response({ servers: [{ result: '8.8.8.8' }, { result: '1.1.1.1' }, { result: 'Unavailable', error: 'timeout' }] }));
  fetchMock.mockResolvedValueOnce(response({ results: [
    { ip: '1.1.1.1', open: true, latency_ms: 12, status: 'open' },
    { ip: '8.8.8.8', open: false, latency_ms: 1500, status: 'timeout' },
  ] }));
  render(<ScannerTools mode="akamai" />);
  fireEvent.click(screen.getByRole('button', { name: 'Find IPs and run scan' }));
  expect(await screen.findByText('Discovered IP candidates')).toBeInTheDocument();
  expect(await screen.findAllByText('open')).toHaveLength(2);
  expect(screen.getAllByText('8.8.8.8').length).toBeGreaterThan(0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('CDN Xray still shows discovered IPs when configuration is missing', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(response({ servers: [{ result: '142.250.72.14' }] }));
  render(<ScannerTools mode="cdn" />);
  fireEvent.click(screen.getByRole('button', { name: 'Find IPs and run scan' }));
  expect(await screen.findByText('IP addresses were found. Add your Xray JSON configuration to run the connectivity checks.')).toBeInTheDocument();
  expect(screen.getByText('142.250.72.14')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
