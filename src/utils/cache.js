const CACHE_DURATION = 30 * 60 * 1000;
const memoryCache = new Map();

export function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data) {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(pattern = null) {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  const keys = [...memoryCache.keys()].filter(k => k.includes(pattern));
  keys.forEach(k => memoryCache.delete(k));
}

export function invalidateCache(key) {
  memoryCache.delete(key);
}

export function getCacheAge(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp;
}
