import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToolManagement } from './ToolManagement';
import { AuditLogs } from './AuditLogs';
import { NotificationSettings } from './AnalyticsMonitoring';
import { MemoryRouter } from 'react-router-dom';
import { BackupManagement } from './BackupManagement';

beforeEach(() => { global.fetch = jest.fn(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('tool inventory renders backend values and filters actual availability', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tools: [
    { name: 'Ping', binary: 'ping', category: 'icmp', description: 'ICMP checks', installed: true },
    { name: 'MTR', binary: 'mtr', category: 'traceroute', description: 'Route checks', installed: false },
  ] }) });
  render(<ToolManagement />);
  expect(await screen.findByRole('heading', { name: 'Ping' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Installed' }));
  expect(screen.queryByRole('heading', { name: 'MTR' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All tools' }));
  fireEvent.change(screen.getByLabelText('Search diagnostic tools'), { target: { value: 'route' } });
  expect(screen.getByRole('heading', { name: 'MTR' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Ping' })).not.toBeInTheDocument();
});

test('tool report shows backend failure and supports retry without invented records', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Service unavailable' }) }).mockResolvedValue({ ok: true, json: async () => ({ tools: [] }) });
  render(<ToolManagement />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }));
  expect(await screen.findByRole('heading', { name: 'No tools match this filter' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('activity report filters events returned by the backend', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ events: [
    { id: 'runtime', time: '2026-10-27T00:00:00Z', category: 'runtime', action: 'Local API started' },
    { id: 'target', time: '2026-10-26T00:00:00Z', category: 'targets', action: 'Target inventory record created' },
  ] }) });
  render(<AuditLogs />);
  expect(await screen.findByText('Local API started')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Targets' }));
  expect(screen.queryByText('Local API started')).not.toBeInTheDocument();
  expect(screen.getByText('Target inventory record created')).toBeInTheDocument();
});

test('leaving a backend report aborts its outstanding request', async () => {
  (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const page = render(<AuditLogs />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  const signal = (fetch as jest.Mock).mock.calls[0][1].signal;
  page.unmount(); expect(signal.aborted).toBe(true);
});

test.each([null, {}, { tools: [{ name: { invalid: true } }] }])('malformed backend responses produce a clear error rather than broken cards (%j)', async data => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => data });
  render(<ToolManagement />);
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid list');
});

test('notification filters show channel configuration without pretending delivery is live', () => {
  render(<NotificationSettings />);
  expect(screen.getByRole('heading', { name: 'Email' })).toBeInTheDocument();
  expect(screen.getByText('Sample data')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Needs setup' }));
  expect(screen.getByRole('heading', { name: 'SMS' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Email' })).not.toBeInTheDocument();
});

test('backup setup uses actual router targets and excludes other inventory', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [
    { id: 'router', name: 'Branch router', address: '192.0.2.1', target_type: 'router' },
    { id: 'server', name: 'Application server', address: '192.0.2.2', target_type: 'server' },
  ] });
  render(<MemoryRouter><BackupManagement /></MemoryRouter>);
  expect(await screen.findByText('Branch router')).toBeInTheDocument();
  expect(screen.queryByText('Application server')).not.toBeInTheDocument();
  expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
  expect(screen.getByText('Setup required')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Manage router targets' })).toHaveAttribute('href', '/app/targets');
});

test('backup setup handles an empty actual inventory', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
  render(<MemoryRouter><BackupManagement /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Add your first router' })).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
});
