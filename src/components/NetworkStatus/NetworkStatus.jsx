 import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../Icon/Icon';
import { useAuth } from '../../contexts/AuthContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const MIN_READ_MS = 3500;
const MS_PER_WORD = 320;

function getFirstName(user) {
  const raw =
    user?.profile?.display_name ||
    user?.profile?.full_name ||
    user?.display_name ||
    user?.full_name ||
    '';

  return raw.trim().split(' ')[0] || '';
}

function getReadDuration(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(MIN_READ_MS, words * MS_PER_WORD);
}

export default function NetworkStatus() {
  const { status, effectiveType, downlink, rtt } = useNetworkStatus();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(status);
  const [wasDown, setWasDown] = useState(false);

  const firstName = getFirstName(user);

  const messages = {
    offline: {
      icon: 'wifi-slash',
      text: firstName
        ? `${firstName}, you're offline — check that mobile data or Wi-Fi is on and airplane mode is off.`
        : "You're offline. Check that mobile data or Wi-Fi is on and airplane mode is off.",
      tone: 'offline'
    },
    slow: {
      icon: 'triangle-exclamation',
      text: firstName
        ? `${firstName}, your connection looks slow. Some content may take longer to load.`
        : 'Slow connection detected. Some content may take longer to load.',
      tone: 'slow'
    },
    good: {
      icon: 'wifi',
      text: firstName
        ? `${firstName}, your network is back — continue browsing. Enjoy your studies at AliverBiopharm. Thanks!`
        : "Your network is back — continue browsing. Enjoy your studies at AliverBiopharm. Thanks!",
      tone: 'good'
    }
  };

  useEffect(() => {
    if (status === 'offline' || status === 'slow') {
      setDisplayStatus(status);
      setVisible(true);
      setWasDown(true);
      return;
    }

    if (status === 'good' && wasDown) {
      setDisplayStatus('good');
      setVisible(true);
      setWasDown(false);

      const duration = getReadDuration(messages.good.text);
      const timer = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(timer);
    }

    setVisible(false);
  }, [status, wasDown]);

  const message = messages[displayStatus];

  const showDebug =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === 'network';

  return (
    <>
      <AnimatePresence>
        {visible && message && (
          <motion.div
            className={`network-status-banner network-status-${message.tone}`}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="status"
            aria-live="polite"
            onClick={() => setVisible(false)}
          >
            <Icon name={message.icon} />
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {showDebug && (
        <div className="network-status-debug">
          status: {status} | online: {String(typeof navigator !== 'undefined' && navigator.onLine)} | effectiveType: {String(effectiveType)} | downlink: {String(downlink)} | rtt: {String(rtt)}
        </div>
      )}
    </>
  );
}
