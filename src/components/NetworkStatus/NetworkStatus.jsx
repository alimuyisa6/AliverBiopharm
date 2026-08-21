import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../Icon/Icon';
import { useAuth } from '../../contexts/AuthContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';

function getFirstName(user) {
  const raw =
    user?.profile?.display_name ||
    user?.profile?.full_name ||
    user?.display_name ||
    user?.full_name ||
    '';

  return raw.trim().split(' ')[0] || '';
}

export default function NetworkStatus() {
  const { status } = useNetworkStatus();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(status);
  const [wasDown, setWasDown] = useState(false);

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

      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }

    setVisible(false);
  }, [status, wasDown]);

  const firstName = getFirstName(user);

  const messages = {
    offline: {
      icon: 'wifi-slash',
      text: "You're offline. Check that mobile data or Wi-Fi is on and airplane mode is off.",
      tone: 'offline'
    },
    slow: {
      icon: 'triangle-exclamation',
      text: 'Slow connection detected. Some content may take longer to load.',
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

  const message = messages[displayStatus];

  if (!message) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`network-status-banner network-status-${message.tone}`}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-live="polite"
        >
          <Icon name={message.icon} />
          <span>{message.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
