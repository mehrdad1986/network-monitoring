import { runNetworkTool, transferMbps, measureInternetSpeed } from './networkDiagnostics';

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

test('converts actual bytes and milliseconds to decimal Mbps', () => {
  expect(transferMbps(10_000_000, 2000)).toBe(40);
  expect(() => transferMbps(0, 1)).toThrow();
  expect(() => transferMbps(1, 0)).toThrow();
  expect(() => transferMbps(1, Infinity)).toThrow();
});

test('reports HTTP diagnostic failures instead of silently doing nothing', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'Resolver unavailable' }) });
  await expect(runNetworkTool('whois', 'example.com', new AbortController().signal)).rejects.toThrow('Resolver unavailable');
});

test('uses same-origin API and trims targets', async () => {
  const signal = new AbortController().signal;
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ open_ports: [] }) });
  await runNetworkTool('port-scan', '  localhost  ', signal);
  expect(fetch).toHaveBeenCalledWith('/api/v1/tools/port-scan', expect.objectContaining({ body: '{"input":"localhost"}', signal }));
});

test('speed test rejects a failed remote transfer rather than returning constants', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  await expect(measureInternetSpeed(new AbortController().signal, jest.fn())).rejects.toThrow('503');
  expect((fetch as jest.Mock).mock.calls[0][0]).toContain('https://speed.edgecompute.app/down');
});

test('rejects an incomplete download', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await expect(measureInternetSpeed(new AbortController().signal, jest.fn())).rejects.toThrow('Incomplete download');
});
