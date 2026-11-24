import { checkTCP } from './tcp';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('sends a bounded TCP request through the configured API', async () => {
  const result = { open: false, status: 'timeout', connect_time: 5000 };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => result });
  const controller = new AbortController();
  expect(await checkTCP('127.0.0.1', 3000, controller.signal)).toEqual(result);
  expect(global.fetch).toHaveBeenCalledWith('/api/v1/tools/tcp-connect', expect.objectContaining({
    signal: controller.signal, body: JSON.stringify({ host: '127.0.0.1', port: 3000, timeout: 5 }),
  }));
});

test('rejects API failures and simulated or malformed responses', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  await expect(checkTCP('localhost', 80, new AbortController().signal)).rejects.toThrow('unavailable');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ open: true }) });
  await expect(checkTCP('localhost', 80, new AbortController().signal)).rejects.toThrow('invalid result');
});
