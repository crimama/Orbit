"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface ConfirmDialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirmContext(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      "useConfirmContext must be used within ConfirmDialogProvider",
    );
  }
  return ctx;
}

function Dialog({
  state,
  onClose,
}: {
  state: ConfirmDialogState;
  onClose: (result: boolean) => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onClose(true);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const active = document.activeElement;
        if (active === confirmBtnRef.current) {
          cancelBtnRef.current?.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isDanger = state.variant === "danger";
  const confirmLabel = state.confirmLabel ?? (isDanger ? "Delete" : "Confirm");
  const cancelLabel = state.cancelLabel ?? "Cancel";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onClose(false)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <h2
          id="confirm-dialog-title"
          className="mb-1 text-lg font-medium text-neutral-100"
        >
          {state.title}
        </h2>

        {state.description ? (
          <p className="mb-5 text-sm text-neutral-400">{state.description}</p>
        ) : (
          <div className="mb-5" />
        )}

        <div className="flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            onClick={() => onClose(false)}
            className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => onClose(true)}
            className={`rounded px-3 py-1.5 text-sm text-white transition-colors ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-cyan-600 hover:bg-cyan-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(
    null,
  );

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (result: boolean) => {
      dialogState?.resolve(result);
      setDialogState(null);
    },
    [dialogState],
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialogState ? (
        <Dialog state={dialogState} onClose={handleClose} />
      ) : null}
    </ConfirmContext.Provider>
  );
}
