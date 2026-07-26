import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DEFAULT_MESSAGES = [
  'Checking your profile',
  'Determining your level',
  'Preparing your dashboard',
  'Loading your progress',
  'Almost ready'
];

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: 'easeInOut' } },
  exit: { opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }
};

export default function SplashScreen({ messages = DEFAULT_MESSAGES }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % messages.length);
        setFading(false);
      }, 260);
    }, 1900);
    return () => clearInterval(interval);
  }, [messages.length]);

  const rows = Array.from({ length: 6 });

  return (
    <motion.div
      className="splash-overlay"
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      role="status"
      aria-live="polite"
    >
      <div className="splash-helix" aria-hidden="true">
        {rows.map((_, i) => (
          <React.Fragment key={i}>
            <span
              className="splash-helix-dot splash-helix-dot-a"
              style={{ top: `${i * 13}px`, animationDelay: `${i * 0.11}s` }}
            />
            <span
              className="splash-helix-dot splash-helix-dot-b"
              style={{ top: `${i * 13}px`, animationDelay: `${i * 0.11 + 0.6}s` }}
            />
          </React.Fragment>
        ))}
      </div>

      <span className="splash-eyebrow">AliverBiopharm</span>

      <div className="splash-message-row">
        <span className={`splash-message${fading ? ' splash-message-fading' : ''}`}>
          {messages[index]}
        </span>
        <span className="splash-dots" aria-hidden="true">
          <span className="splash-dot splash-dot-cyan" />
          <span className="splash-dot splash-dot-magenta" />
          <span className="splash-dot splash-dot-blue" />
        </span>
      </div>
    </motion.div>
  );
}
