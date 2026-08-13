/* hooks/useSecurityUiLock.js */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequest } from '../api/client';

export function useSecurityUiLock() {
  const { user, isAuthenticated } = useAuth();
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const checkLock = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setLocked(false);
      setReason(null);
      setExpiresAt(null);
      return;
    }

    try {
      const data = await getRequest('security', 'ui_lock');

      setLocked(!!data?.locked);
      setReason(data?.reason || null);
      setExpiresAt(data?.expires_at || null);
    } catch {
      setLocked(false);
      setReason(null);
      setExpiresAt(null);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    checkLock();
  }, [checkLock]);

  return {
    locked,
    reason,
    expiresAt,
    refresh: checkLock
  };
}
