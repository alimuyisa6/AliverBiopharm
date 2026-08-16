/* src/components/ScrollMemory.jsx */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = {};

function ScrollMemory() {
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      scrollPositions[location.pathname] = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    const savedPosition = scrollPositions[location.pathname];
    
    if (savedPosition && location.state?.fromBack) {
      // Restore position when coming back
      window.scrollTo(0, savedPosition);
      delete scrollPositions[location.pathname];
    } else {
      // New navigation - start at top
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return null;
}

export default ScrollMemory;
