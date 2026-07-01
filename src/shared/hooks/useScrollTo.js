// shared/hooks/useScrollTo.js
import { useCallback } from 'react';

export function useScrollTo() {
  const scrollTo = useCallback((selector) => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { scrollTo, scrollToTop };
}
