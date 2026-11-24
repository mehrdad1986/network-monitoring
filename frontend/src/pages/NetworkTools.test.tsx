import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NetworkTools } from './NetworkTools';
import { runNetworkTool } from '../services/networkDiagnostics';
jest.mock('../services/networkDiagnostics');
const run = runNetworkTool as jest.MockedFunction<typeof runNetworkTool>;
beforeEach(() => { run.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('shows backend error and allows retry', async () => {
  run.mockRejectedValueOnce(new Error('WHOIS unavailable')).mockResolvedValueOnce({ domain: 'example.com', raw: 'Real registry result' });
  render(<NetworkTools />);
  fireEvent.change(screen.getByPlaceholderText(/Enter domain/), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('WHOIS unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  expect(await screen.findByText('Real registry result')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('prevents duplicate runs and aborts on navigation', async () => {
  run.mockImplementation(() => new Promise(() => {}));
  const view = render(<NetworkTools />);
  fireEvent.change(screen.getByPlaceholderText(/Enter domain/), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: /Port Scanner/ })).toBeDisabled();
  const signal = run.mock.calls[0][2];
  view.unmount();
  expect(signal.aborted).toBe(true);
});

test('shows an explicit empty scan result', async () => {
  run.mockResolvedValue({ open_ports: [] });
  render(<NetworkTools />);
  fireEvent.click(screen.getByRole('button', { name: /Port Scanner/ }));
  fireEvent.change(screen.getByPlaceholderText('Enter IP or domain'), { target: { value: 'localhost' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  expect(await screen.findByText('No open ports found in the tested set.')).toBeInTheDocument();
});
