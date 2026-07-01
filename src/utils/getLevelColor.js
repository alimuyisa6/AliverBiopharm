// shared/utils/getLevelColor.js
export function getLevelColor(level) {
  if (level === 'O-Level') return '#0ab5b5';
  if (level === 'A-Level') return '#b8873a';
  if (level === 'Pharmacy') return '#10b981';
  return 'var(--clr-cyan)';
}
