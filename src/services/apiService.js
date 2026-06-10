const API_BASE = '/api/query';

export async function apiCall(action, params = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json.data !== undefined ? json.data : json;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
