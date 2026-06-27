 import { getAllSiteSections, getInfoSectionsList, getInfoSection } from './client.js';

let _cache = (() => {
  try {
    const s = sessionStorage.getItem('siteSections');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
})();

let _promise = null;

let _infoListCache = (() => {
  try {
    const s = sessionStorage.getItem('infoSectionsList');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
})();

let _infoListPromise = null;

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
  _infoListCache = null;
  try {
    sessionStorage.removeItem('siteSections');
    sessionStorage.removeItem('infoSectionsList');
  } catch {}
}

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
