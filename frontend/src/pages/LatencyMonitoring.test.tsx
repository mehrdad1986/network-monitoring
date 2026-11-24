import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LatencyMonitoring } from './LatencyMonitoring';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ current: 10, min: 8, max: 12, avg: 10 }) });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('finishes measurements, displays values and allows another batch', async () => {
  render(<LatencyMonitoring />);
  const button = await screen.findByRole('button', { name: /Measure Now/ });
  expect(button).toBeEnabled();
  expect(fetch).toHaveBeenCalledTimes(20);
  expect(screen.getAllByText('10.00 ms').length).toBeGreaterThan(0);
  fireEvent.click(button);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(40));
  expect(await screen.findByRole('button', { name: /Measure Now/ })).toBeEnabled();
});

test('shows failed measurements without presenting missing latency as zero', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'No ICMP replies' }) });
  render(<LatencyMonitoring />);
  expect(await screen.findAllByRole('alert')).toHaveLength(20);
  expect(screen.getAllByText(/No ICMP replies/)).toHaveLength(20);
  expect(screen.queryByText('0.0 ms')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /Measure Now/ })).toBeEnabled();
});

test('shows pending states and aborts requests when leaving the page', () => {
  (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const view = render(<LatencyMonitoring />);
  expect(screen.getAllByRole('status')).toHaveLength(20);
  expect(screen.getByRole('button', { name: /Measuring/ })).toBeDisabled();
  const signal = (fetch as jest.Mock).mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});

test('rejects malformed numeric responses instead of crashing the cards', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ current: null, avg: '10' }) });
  render(<LatencyMonitoring />);
  expect(await screen.findAllByRole('alert')).toHaveLength(20);
  expect(screen.getAllByText(/invalid latency data/)).toHaveLength(20);
});
