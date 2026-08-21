 import { getPlatformSections, getInfoSectionsList, getInfoSection } from './client.js';

const _cache = new Map();
const _promises = new Map();

export function getSections(levelId) {
  const key = levelId || 'default';

  if (_cache.has(key)) return Promise.resolve(_cache.get(key));
  if (_promises.has(key)) return _promises.get(key);

  const promise = getPlatformSections(levelId).then((data) => {
    _cache.set(key, data);
    _promises.delete(key);

    try {
      sessionStorage.setItem(`platformSections:${key}`, JSON.stringify(data));
    } catch {}

    return data;
  }).catch((err) => {
    _promises.delete(key);
    throw err;
  });

  _promises.set(key, promise);

  return promise;
}

export function clearSectionsCache() {
  _cache.clear();
  _promises.clear();

  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('platformSections:'))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

let _infoListCache = (() => {
  try {
    const s = sessionStorage.getItem('infoSectionsList');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
})();

let _infoListPromise = null;

export function getInfoSectionsForNav() {
  if (_infoListCache) return Promise.resolve(_infoListCache);
  if (_infoListPromise) return _infoListPromise;

  _infoListPromise = getInfoSectionsList().then(data => {
    _infoListCache = data;
    try { sessionStorage.setItem('infoSectionsList', JSON.stringify(data)); } catch {}
    _infoListPromise = null;
    return data;
  });

  return _infoListPromise;
}

export async function getInfoSectionData(sectionSlug) {
  try {
    return await getInfoSection(sectionSlug);
  } catch (err) {
    console.error(`[SectionLoader] Failed to load section "${sectionSlug}":`, err.message);
    return null;
  }
}

export function getCategoryIcon(category) {
  const map = {
    biology: 'fa-microscope',
    pharmacy: 'fa-capsules',
    safety: 'fa-shield-halved',
    study: 'fa-book-open',
    exam: 'fa-file-pen',
    clinical: 'fa-hospital',
    calculations: 'fa-calculator',
    general: 'fa-file-lines'
  };
  return map[category] || 'fa-file-lines';
}

export function getCategoryLabel(category) {
  const map = {
    biology: 'Biology',
    pharmacy: 'Pharmacy',
    safety: 'Safety',
    study: 'Study Guide',
    exam: 'Exam Prep',
    clinical: 'Clinical Practice',
    calculations: 'Calculations',
    general: 'Resource'
  };
  return map[category] || 'Resource';
}
