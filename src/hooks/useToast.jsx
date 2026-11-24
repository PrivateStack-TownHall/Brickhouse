import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="bh-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`bh-toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} color="#7fd3a8" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
