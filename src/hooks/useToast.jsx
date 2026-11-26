import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNotifications } from './useNotifications';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { notify } = useNotifications();
  const toast = useCallback((message, type = 'success', meta = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    if (type === 'error' && !meta?.skipNotification) {
      const to = meta?.to ?? (typeof window !== 'undefined' ? window.location.pathname : null);
      notify({
        kind: meta?.kind || 'error',
        tone: 'danger',
        title: meta?.title || 'Action failed',
        message: String(message || 'An unexpected error occurred.'),
        to,
      });
    }
  }, [notify]);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="bh-toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`bh-toast ${t.type === 'error' ? 'error' : ''}`}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.92 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {t.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} color="#7fd3a8" />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
