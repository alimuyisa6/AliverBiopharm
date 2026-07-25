import { useState, useEffect } from 'react';

export function useHeroCards() {
  const [spread, setSpread] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsTouch(window.matchMedia('(hover: none)').matches);
  }, []);

  function handleEnter() {
    if (!isTouch) setSpread(true);
  }

  function handleLeave() {
    if (!isTouch) setSpread(false);
  }

  return { spread, isTouch, handleEnter, handleLeave };
}
