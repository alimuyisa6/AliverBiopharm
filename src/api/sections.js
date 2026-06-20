import { getAllSiteSections } from './client';

let _cache = (() => {
  try {
    const s = sessionStorage.getItem('siteSections');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
})();

let _promise = null;

export function getSections() {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;

  _promise = getAllSiteSections().then(data => {
    _cache = data;
    try { sessionStorage.setItem('siteSections', JSON.stringify(data)); } catch {}
    _promise = null;
    return data;
  });

  return _promise;
}

export function clearSectionsCache() {
  _cache = null;
  try { sessionStorage.removeItem('siteSections'); } catch {}
}
