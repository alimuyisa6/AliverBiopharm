const CACHE_VERSION = 'v1';
const PREFIX = `aliver_cache_${CACHE_VERSION}_`;

function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({
        data,
        cachedAt: Date.now()
      })
    );
  } catch {}
}

export function cachedFetch(key, fetcher, options = {}) {
  const { onUpdate } = options;
  const cached = readCache(key);
  const cachedData = cached ? cached.data : null;

  fetcher()
    .then((fresh) => {
      if (fresh === undefined || fresh === null) return;

      const freshString = JSON.stringify(fresh);
      const cachedString =
        cachedData !== null ? JSON.stringify(cachedData) : null;

      if (freshString !== cachedString) {
        writeCache(key, fresh);
        if (onUpdate) onUpdate(fresh);
      }
    })
    .catch((err) => {
      console.error(`cachedFetch: background refresh failed for "${key}"`, err);
    });

  return {
    data: cachedData,
    isFromCache: cachedData !== null
  };
}

export function clearCache(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

export function clearAllCache() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {}
}
