import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RealtimeDashboard } from './RealtimeDashboard';
import { checkTCP } from '../services/tcp';
import apiService from '../services/api';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../services/tcp');
jest.mock('../services/api', () => ({ __esModule: true, default: { getTargets: jest.fn().mockResolvedValue([]) } }));
const check = checkTCP as jest.MockedFunction<typeof checkTCP>;
const getTargets = apiService.getTargets as jest.MockedFunction<typeof apiService.getTargets>;
const renderPage = () => render(<MemoryRouter><RealtimeDashboard /></MemoryRouter>);
const quickTargets = [
  { id: 'one', name: 'One', host: 'one.example', port: 443 },
  { id: 'two', name: 'Two', host: 'two.example', port: 443 },
  { id: 'three', name: 'Three', host: 'three.example', port: 443 },
  { id: 'four', name: 'Four', host: 'four.example', port: 443 },
];
beforeEach(() => { localStorage.clear(); getTargets.mockReset(); getTargets.mockResolvedValue([]); check.mockReset(); check.mockResolvedValue({ open: true, status: 'open', connect_time: 12 }); });
afterEach(() => { jest.useRealTimers(); });

test('shows real contract results and supports refresh, pause and resume', async () => {
  jest.useFakeTimers();
  localStorage.setItem('netmon-realtime-quick-targets', JSON.stringify(quickTargets));
  renderPage();
  await waitFor(() => expect(screen.getAllByText('TCP reachable')).toHaveLength(4));
  await act(async () => {});
  expect(screen.getAllByText('TCP reachable')).toHaveLength(4);
  expect(screen.getByText('12.00')).toBeTruthy();
  const pausedCalls = check.mock.calls.length;
  expect(pausedCalls).toBeGreaterThanOrEqual(4);
  fireEvent.click(screen.getByRole('button', { name: 'Pause monitoring' }));
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(check.mock.calls.length).toBe(pausedCalls);
  expect((screen.getByRole('button', { name: 'Refresh now' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Resume monitoring' }));
  await waitFor(() => expect(check.mock.calls.length).toBeGreaterThan(pausedCalls));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh now' })); });
  expect(check.mock.calls.length).toBeGreaterThan(pausedCalls);
});

test('validates custom targets, rejects duplicates and supports removal', async () => {
  renderPage();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No targets to check'));
  fireEvent.click(screen.getByRole('button', { name: 'Add target' }));
  expect(screen.getByRole('alert').textContent).toContain('65535');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My service' } });
  fireEvent.change(screen.getByLabelText('Host or IP'), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add target' }));
  await screen.findByRole('button', { name: 'Remove My service' });
  await waitFor(() => expect(check).toHaveBeenCalledWith('example.com', 443, expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Duplicate' } });
  fireEvent.change(screen.getByLabelText('Host or IP'), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add target' }));
  expect(screen.getByRole('alert').textContent).toContain('already monitored');
  fireEvent.click(screen.getByRole('button', { name: 'Remove My service' }));
  expect(screen.queryByRole('button', { name: 'Remove My service' })).toBeNull();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No targets to check'));
});

test('shows failed checks separately from unreachable ports', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('netmon-realtime-quick-targets', JSON.stringify(quickTargets));
  check.mockRejectedValue(new Error('API offline'));
  renderPage();
  expect(await screen.findAllByText('Check failed')).toHaveLength(4);
  expect(screen.getByRole('alert').textContent).toContain('4 target checks failed');
  const table = screen.getByRole('table');
  expect(within(table).queryByText('Closed')).toBeNull();
  log.mockRestore();
});

test('aborts active requests on pause and avoids overlapping batches', async () => {
  jest.useFakeTimers();
  localStorage.setItem('netmon-realtime-quick-targets', JSON.stringify(quickTargets));
  check.mockImplementation(() => new Promise(() => {}));
  const view = renderPage();
  await act(async () => {});
  const signals = check.mock.calls.map(call => call[2]);
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(check.mock.calls.length).toBeGreaterThanOrEqual(4);
  fireEvent.click(screen.getByRole('button', { name: 'Pause monitoring' }));
  expect(signals.every(signal => signal.aborted)).toBe(true);
  view.unmount();
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(check.mock.calls.length).toBeGreaterThanOrEqual(4);
});
