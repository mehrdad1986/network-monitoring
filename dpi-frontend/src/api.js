export async function request(path, options = {}) {
  try {
    const response = await fetch(new URL(`../api/${path}`, import.meta.url), {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-DPI-Request': '1', ...options.headers },
      signal: options.signal || AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || `Request failed (${response.status})`);
    return data;
  } catch (error) {
    console.error('DPI API request failed:', path.split('/')[0], error.name);
    throw error;
  }
}
