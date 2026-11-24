import { getLocalRoutingTable, getRoutingHistory, removeRoutingHistory, saveRoutingHistory } from './routing';

const originalFetch = global.fetch;
beforeEach(() => { localStorage.clear(); global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('routing checks persist in browser storage and can be removed', () => {
  const saved = saveRoutingHistory({ kind: 'AS path lookup', input: '8.8.8.8', summary: 'RIPE RIS lookup completed' }, new Date('2026-10-27T12:00:00Z'));
  expect(saved).toHaveLength(1);
  expect(getRoutingHistory()[0]).toMatchObject({ kind: 'AS path lookup', input: '8.8.8.8' });
  expect(removeRoutingHistory(saved[0].id)).toEqual([]);
});

test('local routing table service reports backend errors and returns actual entries', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce({
    ok: true, json: async () => ({ routes: [{ dst: 'default', dev: 'eth0' }], count: 1, source: 'Linux kernel routing table', observedAt: '2026-10-27T12:00:00Z' }),
  } as Response);
  const result = await getLocalRoutingTable(new AbortController().signal);
  expect(result.routes[0]).toMatchObject({ dst: 'default', dev: 'eth0' });
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/tools/routing-table', expect.any(Object));

  fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'iproute2 missing' }) } as Response);
  await expect(getLocalRoutingTable(new AbortController().signal)).rejects.toThrow('iproute2 missing');
});
