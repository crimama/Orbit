import { useToastContext } from "@/components/ui/ToastProvider";
import type { ToastType } from "@/components/ui/Toast";

interface UseToastReturn {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export function useToast(): UseToastReturn {
  const { showToast } = useToastContext();

  return {
    toast: showToast,
    success: (message) => showToast(message, "success"),
    error: (message) => showToast(message, "error"),
    warning: (message) => showToast(message, "warning"),
    info: (message) => showToast(message, "info"),
  };
}
