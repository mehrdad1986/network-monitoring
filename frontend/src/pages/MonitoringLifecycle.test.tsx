import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HTTPMonitoring } from './HTTPMonitoring';
import { ICMPMonitoring } from './ICMPMonitoring';
import { UDPMonitoring } from './UDPMonitoring';

beforeEach(() => {
 global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status_code: 200, response_time: 1, ttfb: 0.5, content_length: 10, packet_loss: 0, min_rtt: 1, max_rtt: 2, avg_rtt: 1.5, sent: 4, received: 4, reachable: true }) });
 jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each([['HTTP', HTTPMonitoring, 'Test All'], ['ICMP', ICMPMonitoring, 'Ping All'], ['UDP', UDPMonitoring, 'Test All']] as const)('%s finishes a batch and allows another check', async (_, Component, label) => {
 const view = render(<Component />);
 const button = await screen.findByRole('button', { name: new RegExp(label) });
 expect(button).toBeEnabled();
 expect(fetch).toHaveBeenCalledTimes(5);
 fireEvent.click(button);
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(10));
 expect(await screen.findByRole('button', { name: new RegExp(label) })).toBeEnabled();
 view.unmount();
});

test.each([['HTTP', HTTPMonitoring], ['ICMP', ICMPMonitoring], ['UDP', UDPMonitoring]] as const)('%s shows API errors and aborts on navigation', async (_, Component) => {
 (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Diagnostic service unavailable' }) });
 const view = render(<Component />);
 expect(await screen.findByRole('alert')).toHaveTextContent('Diagnostic service unavailable');
 view.unmount();
 (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
 const pending = render(<Component />);
 const signal = (fetch as jest.Mock).mock.calls.slice(-1)[0][1].signal;
 pending.unmount();
 expect(signal.aborted).toBe(true);
});
