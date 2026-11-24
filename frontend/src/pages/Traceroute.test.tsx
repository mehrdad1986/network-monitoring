import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Traceroute } from './Traceroute';
import { traceRoute } from '../services/traceroute';

jest.mock('../services/traceroute');
const trace = traceRoute as jest.MockedFunction<typeof traceRoute>;
beforeEach(() => { trace.mockReset(); });

test('expands real snake_case averages and unanswered probes without crashing', async () => {
  trace.mockResolvedValue({ status: 'partial', hops: [{ number: 1, ip: '*', hostname: '*',
    rtt1: null, rtt2: 2, rtt3: null, avg_rtt: 2 }] });
  render(<Traceroute />);
  await screen.findByRole('button', { name: /Run Traceroute/ });
  expect(screen.getAllByText(/Partial —/)).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Show hops for Google DNS Primary' }));
  expect(screen.getByText('avg: 2.0 ms')).toBeTruthy();
  expect(screen.getAllByText('*').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /Run Traceroute/ }));
  await waitFor(() => expect(trace).toHaveBeenCalledTimes(10));
  await screen.findByRole('button', { name: /Run Traceroute/ });
});

test('shows actionable API errors and allows retry', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  trace.mockRejectedValue(new Error('Install traceroute on the backend'));
  render(<Traceroute />);
  expect(await screen.findAllByRole('alert')).toHaveLength(5);
  expect(screen.getAllByText('Install traceroute on the backend')).toHaveLength(5);
  await screen.findByRole('button', { name: /Run Traceroute/ });
  log.mockRestore();
});
