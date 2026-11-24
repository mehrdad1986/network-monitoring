import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BGPRouteLookup } from './BGPRouteLookup';
import { getRoutingHistory } from '../services/routing';

beforeEach(() => localStorage.clear());
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('waits for a user lookup and displays the real BGP response', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ resource: '8.8.8.0/24', source: 'RIPE RIS BGP route collectors', observedAt: '2026-10-27T12:00:00Z', data: { routes: [{ path: [15169] }] } }),
  } as Response);
  render(<BGPRouteLookup pageClass="test" title="AS Path Analysis" description="Live paths" tool="as-path-analysis" historyKind="AS path lookup" />);
  expect(screen.getByText('Ready for a lookup')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('IP address or CIDR prefix'), { target: { value: '8.8.8.0/24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run BGP lookup' }));
  expect(await screen.findByText(/RIPE RIS BGP route collectors/)).toBeInTheDocument();
  await waitFor(() => expect(getRoutingHistory()).toHaveLength(1));
});

test('shows BGP backend errors instead of fabricated results', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'Lookup provider is unreachable' }) } as Response);
  render(<BGPRouteLookup pageClass="test" title="BGP Intelligence" description="Live routes" tool="bgp-intelligence" historyKind="BGP intelligence lookup" />);
  fireEvent.change(screen.getByLabelText('IP address or CIDR prefix'), { target: { value: '8.8.8.8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run BGP lookup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lookup provider is unreachable');
  expect(getRoutingHistory()).toHaveLength(0);
});
