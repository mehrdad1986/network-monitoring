import { useEffect, useState } from 'react';
import { checkTCP, TCPStatus } from '../services/tcp';

export interface LiveTarget { id: string; name: string; host: string; port: number; custom?: boolean; usesDefaultPort?: boolean }
export interface LiveReading {
  status: TCPStatus;
  latency: number | null;
  checkedAt: string;
  history: (number | null)[];
}
export interface LiveEvent { id: string; name: string; status: TCPStatus; previous?: TCPStatus; time: string }
interface Snapshot { readings: Record<string, LiveReading>; events: LiveEvent[]; checks: number; updatedAt: string | null }

export function useRealtimeMonitor(targets: LiveTarget[], paused: boolean, interval: number, refresh: number) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ readings: {}, events: [], checks: 0, updatedAt: null });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (paused || targets.length === 0) { setChecking(false); return; }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let deadline: ReturnType<typeof setTimeout>;
    const run = async () => {
      controller = new AbortController();
      setChecking(true);
      deadline = setTimeout(() => controller.abort(), 10000);
      try {
        const results: { target: LiveTarget; status: TCPStatus; latency: number | null }[] = [];
        let nextTarget = 0;
        const worker = async () => {
          while (nextTarget < targets.length) {
            if (controller.signal.aborted) break;
            const target = targets[nextTarget++];
            try {
              const data = await checkTCP(target.host, target.port, controller.signal);
              results.push({ target, status: data.status, latency: data.status === 'open' ? data.connect_time : null });
            } catch (error) {
              if (!disposed) console.error('Realtime TCP request failed:', error);
              results.push({ target, status: 'error', latency: null });
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(12, targets.length) }, worker));
        if (disposed) return;
        const time = new Date().toISOString();
        setSnapshot(prev => {
          const readings: Record<string, LiveReading> = {};
          const events: LiveEvent[] = [];
          for (const { target, status, latency } of results) {
            const old = prev.readings[target.id];
            readings[target.id] = { status, latency, checkedAt: time,
              history: [...(old?.history || []), latency].slice(-30) };
            if (old?.status !== status) events.push({ id: `${time}-${target.id}`, name: target.name,
              status, previous: old?.status, time });
          }
          return { readings, events: [...events, ...prev.events].slice(0, 30),
            checks: prev.checks + results.length, updatedAt: time };
        });
      } finally {
        clearTimeout(deadline);
        if (!disposed) {
          setChecking(false);
          timer = setTimeout(run, interval);
        }
      }
    };
    void run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      controller?.abort();
    };
  }, [targets, paused, interval, refresh]);

  return { ...snapshot, checking };
}
