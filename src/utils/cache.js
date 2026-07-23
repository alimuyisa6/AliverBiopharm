const CACHE_CONFIG = {
  sections: 60 * 60 * 1000,
  flashcards: 30 * 60 * 1000,
  notes: 15 * 60 * 1000,
  stats: 5 * 60 * 1000,
  default: 30 * 60 * 1000,
};

const memoryCache = new Map();
const MAX_CACHE_SIZE = 50;

function getTypeFromKey(key) {
  if (key.includes('section')) return 'sections';
  if (key.includes('flashcard')) return 'flashcards';
  if (key.includes('note')) return 'notes';
  if (key.includes('stats') || key.includes('activity')) return 'stats';
  return 'default';
}

function pruneCache() {
  if (memoryCache.size <= MAX_CACHE_SIZE) return;
  
  const entries = [...memoryCache.entries()]
    .map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      accessedAt: value.accessedAt || value.timestamp,
    }))
    .sort((a, b) => b.accessedAt - a.accessedAt);
  
  const toDelete = Math.ceil(entries.length * 0.2);
  for (let i = entries.length - 1; i >= entries.length - toDelete; i--) {
    memoryCache.delete(entries[i].key);
  }
}

export function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  const type = getTypeFromKey(key);
  const maxAge = CACHE_CONFIG[type] || CACHE_CONFIG.default;
  
  if (Date.now() - entry.timestamp > maxAge) {
    memoryCache.delete(key);
    return null;
  }
  
  entry.accessedAt = Date.now();
  return entry.data;
}

export function setCache(key, data) {
  if (!data) return;
  
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    accessedAt: Date.now(),
    type: getTypeFromKey(key),
  });
  
  pruneCache();
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

export function invalidateCacheByPattern(pattern) {
  const keys = [...memoryCache.keys()].filter(k => k.includes(pattern));
  keys.forEach(k => memoryCache.delete(k));
}

export function getCacheStats() {
  return {
    size: memoryCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

export function getCacheAge(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp;
}