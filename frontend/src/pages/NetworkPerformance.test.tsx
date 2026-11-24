import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NetworkPerformance } from './NetworkPerformance';
import { measureInternetSpeed } from '../services/networkDiagnostics';
jest.mock('../services/networkDiagnostics');
const measure = measureInternetSpeed as jest.MockedFunction<typeof measureInternetSpeed>;
beforeEach(() => { localStorage.clear(); measure.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('discards old fabricated history and stores real completed results', async () => {
  localStorage.setItem('speedtest_history', JSON.stringify([{ downloadSpeed: 85.5, uploadSpeed: 42.3 }]));
  measure.mockResolvedValue({ downloadSpeed: 123.45, uploadSpeed: 67.89, jitter: 1.2, publicIP: '203.0.113.1', location: 'Test', isp: 'Unavailable' });
  render(<NetworkPerformance />);
  expect(screen.getByText(/No test history/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Run Speed Test/ }));
  await waitFor(() => expect(localStorage.getItem('speedtest_history_v2')).toContain('123.45'));
  expect(screen.queryByText('85.50 Mbps')).toBeNull();
});

test('failed speed test stays out of successful history', async () => {
  measure.mockRejectedValue(new Error('Cloudflare unreachable'));
  render(<NetworkPerformance />);
  fireEvent.click(screen.getByRole('button', { name: /Run Speed Test/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cloudflare unreachable');
  expect(localStorage.getItem('speedtest_history_v2')).toBeNull();
  expect(screen.getByRole('button', { name: /Run Speed Test/ })).toBeEnabled();
});

test('cancels an active measurement and aborts on unmount', async () => {
  measure.mockImplementation(() => new Promise(() => {}));
  const view = render(<NetworkPerformance />);
  fireEvent.click(screen.getByRole('button', { name: /Run Speed Test/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(measure.mock.calls[0][0].aborted).toBe(true);
  view.unmount();
});
