 /* components/Toast/Toast.jsx */
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon/Icon';

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: 'circle-check',
  error: 'circle-xmark',
  warning: 'exclamation-triangle',
  info: 'circle-info'
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;

    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}

      {createPortal(
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => removeToast(toast.id)}>
              <Icon name={TOAST_ICONS[toast.type] || 'circle-info'} />
              <span>{toast.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) throw new Error('useToast must be used within ToastProvider');

  return ctx;
}
