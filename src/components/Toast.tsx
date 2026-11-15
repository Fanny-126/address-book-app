import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

const ToastContext = createContext<{ show: (msg: string, kind?: 'info' | 'error') => void }>({
  show: () => {},
});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-root" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.kind === 'error' ? ' err' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
