import { resolveScannerIPv4 } from './scannerTools';

const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

test('DNS scanner discovery returns unique IPv4 answers from public resolvers', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ servers: [
      { result: '142.250.72.14, 142.250.72.15' },
      { result: '142.250.72.14, 2607:f8b0:4007:80a::200e' },
      { result: 'Unavailable', error: 'Resolver did not answer' },
    ] }),
  } as Response);
  const addresses = await resolveScannerIPv4('google.com', new AbortController().signal);
  expect(addresses).toEqual(['142.250.72.14', '142.250.72.15']);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/tools/dns-propagation', expect.objectContaining({ method: 'POST' }));
});

test('DNS scanner discovery surfaces backend errors', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'DNS unavailable' }) } as Response);
  await expect(resolveScannerIPv4('invalid.example', new AbortController().signal)).rejects.toThrow('DNS unavailable');
});
