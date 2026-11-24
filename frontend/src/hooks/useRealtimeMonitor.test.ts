import { act, renderHook } from '@testing-library/react';
import { useRealtimeMonitor, LiveTarget } from './useRealtimeMonitor';
import { checkTCP } from '../services/tcp';

jest.mock('../services/tcp');
const check = checkTCP as jest.MockedFunction<typeof checkTCP>;
const targets: LiveTarget[] = [{ id: 'one', name: 'Local', host: '127.0.0.1', port: 8080 }];

test('caps sample and event retention while recording real status transitions', async () => {
  jest.useFakeTimers();
  check.mockReset();
  let calls = 0;
  check.mockImplementation(async () => ({ open: ++calls % 2 === 1,
    status: calls % 2 === 1 ? 'open' : 'closed', connect_time: 2 }));
  const { result, unmount } = renderHook(() => useRealtimeMonitor(targets, false, 5000, 0));
  await act(async () => {});
  for (let i = 0; i < 35; i++) await act(async () => { jest.advanceTimersByTime(5000); });
  expect(result.current.checks).toBe(36);
  expect(result.current.readings.one.history).toHaveLength(30);
  expect(result.current.events).toHaveLength(30);
  expect(result.current.events[0].previous).toBe('open');
  expect(result.current.events[0].status).toBe('closed');
  expect(result.current.readings.one.history).toContain(null);
  unmount();
  jest.useRealTimers();
});
