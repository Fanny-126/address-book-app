import { createContext, useContext } from 'react';

export interface ToastApi {
  show: (message: string, kind?: 'info' | 'error') => void;
}

export const ToastContext = createContext<ToastApi>({
  show: () => {},
});

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
