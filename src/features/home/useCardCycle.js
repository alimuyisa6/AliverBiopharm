import { useState, useEffect, useRef } from 'react';

export function useCardCycle(frames, index, intervalMs = 2400) {
  const [frameIndex, setFrameIndex] = useState(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (frames.length <= 1 || reducedMotion.current) return;
    const stagger = (index % 5) * 350;
    const startTimeout = setTimeout(() => {
      const id = setInterval(() => {
        setFrameIndex(prev => (prev + 1) % frames.length);
      }, intervalMs);
      return () => clearInterval(id);
    }, stagger);
    return () => clearTimeout(startTimeout);
  }, [frames.length, index, intervalMs]);

  return frames[frameIndex] || frames[0];
}
