import { useCallback, useEffect, useRef, useState } from 'react';

export function useBackendList<T>(path: string, field: string, validate: (value: unknown) => value is T) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError('');
    try {
      const response = await fetch(path, { signal: current.signal, headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data && typeof data.error === 'string' ? data.error : 'This backend service is unavailable.');
      const records = field ? data?.[field] : data;
      if (!Array.isArray(records) || !records.every(validate)) throw new Error('The backend returned an invalid list.');
      if (!current.signal.aborted) setItems(records);
    } catch (cause) {
      if (!current.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Unable to load this report.'); console.error('Local backend report failed:', path); }
    } finally { if (!current.signal.aborted) setLoading(false); }
  }, [path, field, validate]);
  useEffect(() => { reload(); return () => controller.current?.abort(); }, [reload]);
  return { items, error, loading, reload };
}
