import { traceRoute } from './traceroute';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('keeps null RTTs and snake_case averages from the API', async () => {
  const data = { status: 'partial', hops: [{ number: 1, ip: '*', hostname: '*', rtt1: null, rtt2: null, rtt3: null, avg_rtt: null }] };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
  expect(await traceRoute('localhost', new AbortController().signal)).toEqual(data);
});

test('rejects invalid RTTs and shows backend setup errors', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'completed', hops: [{ ip: '127.0.0.1', rtt1: 'broken' }] }) });
  await expect(traceRoute('localhost', new AbortController().signal)).rejects.toThrow('invalid response');
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Install traceroute' }) });
  await expect(traceRoute('localhost', new AbortController().signal)).rejects.toThrow('Install traceroute');
});
