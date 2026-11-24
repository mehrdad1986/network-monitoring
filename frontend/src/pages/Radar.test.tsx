import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import Radar from './Radar';

const originalFetch = global.fetch;
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body } as Response);
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('Run Radar uses Cloudflare provider ranges by default and shows candidate addresses', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(response({ sources: [{ id: 'official', name: 'Cloudflare Official' }] }));
  fetchMock.mockResolvedValueOnce(response({ job: null }));
  fetchMock.mockResolvedValueOnce(response({ id: 'job-1' }));
  fetchMock.mockResolvedValueOnce(response({
    id: 'job-1', state: 'complete', phase: 'Complete', total: 1, completed: 1, alive: 0, dead: 1,
    candidates: ['8.8.8.8'], results: [], updated_at: '2026-10-27T12:00:00Z',
  }));
  render(<Radar />);
  await screen.findByText('Cloudflare Official');
  fireEvent.click(screen.getByRole('button', { name: 'Run Radar' }));
  expect(await screen.findByText('Discovered IP candidates')).toBeInTheDocument();
  expect(screen.getByText('8.8.8.8')).toBeInTheDocument();
  expect(screen.getByText(/This does not mean the website is down/)).toBeInTheDocument();
  const startCall = fetchMock.mock.calls.find(call => String(call[0]).endsWith('/tools/netmon-radar/start'));
  expect(JSON.parse(startCall[1].body)).toMatchObject({ target: 'cloudflare.com', sources: ['official'], ports: [443], sample: 64 });
});

test('Run Radar reconnects to an existing scan and continues showing its progress', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(response({ sources: [{ id: 'official', name: 'Cloudflare Official' }] }));
  fetchMock.mockResolvedValueOnce(response({ job: null }));
  fetchMock.mockResolvedValueOnce(response({ id: 'existing-job', attached: true }));
  fetchMock.mockResolvedValueOnce(response({
    id: 'existing-job', state: 'scanning', phase: 'TCP discovery', total: 64, completed: 12,
    alive: 2, dead: 10, current_ip: '104.16.1.1', current_port: 443,
    candidates: null, results: null, updated_at: '2026-10-27T12:00:00Z',
  }));
  render(<Radar />);
  await screen.findByText('Cloudflare Official');
  fireEvent.click(screen.getByRole('button', { name: 'Run Radar' }));
  expect(await screen.findByText('Connected to the scan already running on this backend.')).toBeInTheDocument();
  expect(await screen.findAllByText('12 / 64')).toHaveLength(2);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('reopens an active scan automatically and displays its current phase and results', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(response({ sources: [{ id: 'official', name: 'Cloudflare Official' }] }));
  fetchMock.mockResolvedValueOnce(response({ job: {
    id: 'active-job', state: 'scanning', phase: 'TCP discovery', total: 64, completed: 9,
    alive: 1, dead: 8, current_ip: '104.16.1.1', current_port: 443,
    candidates: ['104.16.1.1'], results: [], updated_at: '2026-10-27T12:00:00Z',
  } }));
  fetchMock.mockResolvedValueOnce(response({
    id: 'active-job', state: 'scanning', phase: 'TCP discovery', total: 64, completed: 10,
    alive: 1, dead: 9, current_ip: '104.16.1.2', current_port: 443,
    candidates: ['104.16.1.1', '104.16.1.2'], results: [], updated_at: '2026-10-27T12:00:01Z',
  }));
  render(<Radar />);
  expect(await screen.findByText('Connected to the scan already running on this backend.')).toBeInTheDocument();
  expect(await screen.findByText('104.16.1.2')).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith('/tools/netmon-radar/active'))).toBe(true);
});
