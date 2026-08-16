/* src/components/PageTransition.jsx */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('pageIn');
  const [isBack, setIsBack] = useState(false);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      // Check if going back
      const navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type;
      setIsBack(navigationType === 'back_forward');
      
      setTransitionStage('pageOut');
      setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage('pageIn');
      }, 300); // Half of transition duration
    }
  }, [location, displayLocation]);

  return (
    <div
      className={`page-transition ${
        transitionStage === 'pageOut' 
          ? isBack ? 'page-out-back' : 'page-out-forward'
          : isBack ? 'page-in-back' : 'page-in-forward'
      }`}
    >
      {children}
    </div>
  );
}

export default PageTransition;
