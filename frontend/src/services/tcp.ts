export type TCPStatus = 'open' | 'closed' | 'timeout' | 'error';
export interface TCPCheck {
  open: boolean;
  status: TCPStatus;
  connect_time: number;
  service?: string;
  error?: string;
}

export async function checkTCP(host: string, port: number, signal: AbortSignal): Promise<TCPCheck> {
  const base = (process.env.REACT_APP_API_URL || '/api/v1').replace(/\/$/, '');
  const response = await fetch(`${base}/tools/tcp-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, timeout: 5 }),
    signal,
  });
  if (!response.ok) throw new Error('TCP API unavailable. Check that the NetMon backend is running.');
  const data = await response.json();
  if (!['open', 'closed', 'timeout', 'error'].includes(data.status) || typeof data.connect_time !== 'number') {
    throw new Error('TCP API returned an invalid result.');
  }
  return data;
}
