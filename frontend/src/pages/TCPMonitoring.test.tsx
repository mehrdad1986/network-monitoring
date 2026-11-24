import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TCPMonitoring } from './TCPMonitoring';
import { checkTCP } from '../services/tcp';

jest.mock('../services/tcp');
const check = checkTCP as jest.MockedFunction<typeof checkTCP>;

beforeEach(() => {
  check.mockReset();
  check.mockResolvedValue({ open: true, status: 'open', connect_time: 0.25 });
});

test('finishes the initial batch and allows repeated checks', async () => {
  render(<TCPMonitoring />);
  const button = await screen.findByRole('button', { name: /Test All/ });
  expect((button as HTMLButtonElement).disabled).toBe(false);
  expect(check).toHaveBeenCalledTimes(5);
  fireEvent.click(button);
  await waitFor(() => expect(check).toHaveBeenCalledTimes(10));
  await screen.findByRole('button', { name: /Test All/ });
});

test('reports backend failures separately from closed ports', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  check.mockRejectedValue(new Error('offline'));
  render(<TCPMonitoring />);
  expect(await screen.findAllByText('Check Failed')).toHaveLength(5);
  expect(screen.queryByText('Port Closed')).toBeNull();
  await screen.findByRole('button', { name: /Test All/ });
  log.mockRestore();
});

test('validates targets and removes their results from the summary', async () => {
  render(<TCPMonitoring />);
  await screen.findByRole('button', { name: /Test All/ });
  fireEvent.change(screen.getByLabelText('Target name'), { target: { value: 'Local' } });
  fireEvent.change(screen.getByLabelText('Hostname or IP address'), { target: { value: '127.0.0.1' } });
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '65536' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Target' }));
  expect(screen.getByRole('alert').textContent).toContain('65535');
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '3000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Target' }));
  await screen.findByRole('button', { name: /Test All/ });
  expect(screen.getByText('6', { selector: '.status-number.open' })).toBeTruthy();
  fireEvent.click(screen.getByTitle('Remove target'));
  await screen.findByRole('button', { name: /Test All/ });
  expect(screen.getByText('5', { selector: '.status-number.open' })).toBeTruthy();
});

test('disables repeated testing during a batch and cleans up on navigation', () => {
  jest.useFakeTimers();
  check.mockImplementation(() => new Promise(() => {}));
  const view = render(<TCPMonitoring />);
  expect((screen.getByRole('button', { name: /Testing/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(check).toHaveBeenCalledTimes(5);
  // Unmount aborts outstanding requests; no refresh survives navigation.
  view.unmount();
  act(() => { jest.advanceTimersByTime(30000); });
  expect(check).toHaveBeenCalledTimes(5);
  jest.useRealTimers();
});

test('refreshes completed checks every 30 seconds', async () => {
  jest.useFakeTimers();
  const view = render(<TCPMonitoring />);
  await act(async () => {});
  expect(check).toHaveBeenCalledTimes(5);
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(check).toHaveBeenCalledTimes(10);
  view.unmount();
  jest.useRealTimers();
});
