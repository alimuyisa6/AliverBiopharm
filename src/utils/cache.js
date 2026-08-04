 const CACHE_CONFIG = {
  sections: 60 * 60 * 1000,
  flashcards: 30 * 60 * 1000,
  notes: 15 * 60 * 1000,
  stats: 5 * 60 * 1000,
  bootstrap: 60 * 60 * 1000,
  default: 30 * 60 * 1000,
};

const PERSIST_PREFIXES = ['bootstrap_', 'site_sections', 'section_headings'];
const STORAGE_PREFIX = 'acache:v1:';
const STORAGE_INDEX_KEY = 'acache:v1:__index';
const MAX_STORAGE_ENTRIES = 30;

const memoryCache = new Map();
const MAX_CACHE_SIZE = 50;

const hasWindow = typeof window !== 'undefined';
const hasStorage = hasWindow && (() => {
  try {
    const testKey = '__acache_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
})();

function getTypeFromKey(key) {
  if (key.startsWith('bootstrap_')) return 'bootstrap';
  if (key.includes('section')) return 'sections';
  if (key.includes('flashcard')) return 'flashcards';
  if (key.includes('note')) return 'notes';
  if (key.includes('stats') || key.includes('activity')) return 'stats';
  return 'default';
}

function isPersistable(key) {
  return PERSIST_PREFIXES.some((prefix) => key.startsWith(prefix) || key === prefix);
}

function readStorageIndex() {
  if (!hasStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorageIndex(index) {
  if (!hasStorage) return;
  try {
    window.localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  } catch {
  }
}

function touchStorageIndex(key) {
  const index = readStorageIndex().filter((k) => k !== key);
  index.push(key);
  if (index.length > MAX_STORAGE_ENTRIES) {
    const overflow = index.length - MAX_STORAGE_ENTRIES;
    const evicted = index.splice(0, overflow);
    evicted.forEach((evictedKey) => {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + evictedKey);
      } catch {
      }
    });
  }
  writeStorageIndex(index);
}

function removeFromStorageIndex(key) {
  const index = readStorageIndex().filter((k) => k !== key);
  writeStorageIndex(index);
}

function readFromStorage(key) {
  if (!hasStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(key, entry) {
  if (!hasStorage) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({
      data: entry.data,
      timestamp: entry.timestamp,
    }));
    touchStorageIndex(key);
  } catch (err) {
    if (err && err.name === 'QuotaExceededError') {
      const index = readStorageIndex();
      const toEvict = index.slice(0, Math.ceil(index.length / 2));
      toEvict.forEach((evictedKey) => {
        try {
          window.localStorage.removeItem(STORAGE_PREFIX + evictedKey);
        } catch {
        }
      });
      writeStorageIndex(index.slice(toEvict.length));
    }
  }
}

function removeFromStorage(key) {
  if (!hasStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
  }
  removeFromStorageIndex(key);
}

function clearStorage(pattern = null) {
  if (!hasStorage) return;
  const index = readStorageIndex();
  const toRemove = pattern ? index.filter((k) => k.includes(pattern)) : index;
  toRemove.forEach((key) => {
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
    }
  });
  writeStorageIndex(pattern ? index.filter((k) => !toRemove.includes(k)) : []);
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
  const type = getTypeFromKey(key);
  const maxAge = CACHE_CONFIG[type] || CACHE_CONFIG.default;

  if (entry) {
    if (Date.now() - entry.timestamp > maxAge) {
      memoryCache.delete(key);
    } else {
      entry.accessedAt = Date.now();
      return entry.data;
    }
  }

  if (isPersistable(key)) {
    const stored = readFromStorage(key);
    if (stored) {
      if (Date.now() - stored.timestamp > maxAge) {
        removeFromStorage(key);
        return null;
      }
      memoryCache.set(key, {
        data: stored.data,
        timestamp: stored.timestamp,
        accessedAt: Date.now(),
        type,
      });
      return stored.data;
    }
  }

  return null;
}

export function getCachedStale(key) {
  const entry = memoryCache.get(key);
  if (entry) return entry.data;
  if (isPersistable(key)) {
    const stored = readFromStorage(key);
    if (stored) return stored.data;
  }
  return null;
}

export function setCache(key, data) {
  if (!data) return;

  const entry = {
    data,
    timestamp: Date.now(),
    accessedAt: Date.now(),
    type: getTypeFromKey(key),
  };

  memoryCache.set(key, entry);
  pruneCache();

  if (isPersistable(key)) {
    writeToStorage(key, entry);
  }
}

export function clearCache(pattern = null) {
  if (!pattern) {
    memoryCache.clear();
    clearStorage(null);
    return;
  }
  const keys = [...memoryCache.keys()].filter((k) => k.includes(pattern));
  keys.forEach((k) => memoryCache.delete(k));
  clearStorage(pattern);
}

export function invalidateCache(key) {
  memoryCache.delete(key);
  if (isPersistable(key)) removeFromStorage(key);
}

export function invalidateCacheByPattern(pattern) {
  const keys = [...memoryCache.keys()].filter((k) => k.includes(pattern));
  keys.forEach((k) => memoryCache.delete(k));
  clearStorage(pattern);
}

export function getCacheStats() {
  return {
    size: memoryCache.size,
    maxSize: MAX_CACHE_SIZE,
    persistedSize: hasStorage ? readStorageIndex().length : 0,
    persistedMax: MAX_STORAGE_ENTRIES,
    storageAvailable: hasStorage,
  };
}

export function getCacheAge(key) {
  const entry = memoryCache.get(key);
  if (entry) return Date.now() - entry.timestamp;
  if (isPersistable(key)) {
    const stored = readFromStorage(key);
    if (stored) return Date.now() - stored.timestamp;
  }
  return null;
}
