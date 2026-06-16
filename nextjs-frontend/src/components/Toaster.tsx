"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastOptions {
  type?: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  duration?: number; // ms, default 4000
}

interface ToastItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (opts: ToastOptions) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((opts: ToastOptions) => {
    const id = `${Date.now()}${Math.random()}`;
    const duration = opts.duration ?? 4000;
    const item: ToastItem = {
      id,
      type: opts.type ?? "info",
      title: opts.title,
      description: opts.description,
      duration,
    };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return { toast: ctx.toast };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Type style map ───────────────────────────────────────────────────────────

const TYPE_STYLES = {
  success: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    progressColor: "bg-emerald-400",
  },
  error: {
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    progressColor: "bg-red-400",
  },
  warning: {
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    progressColor: "bg-amber-400",
  },
  info: {
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    progressColor: "bg-blue-400",
  },
} as const;

// ─── Toast card ───────────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const styles = TYPE_STYLES[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95, filter: "blur(2px)" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="min-w-[300px] max-w-[380px] rounded-xl border border-[rgba(255,255,255,0.09)] bg-[#18181b] shadow-2xl shadow-black/60 overflow-hidden"
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconColor}`}
        >
          {item.type === "success" && <SuccessIcon />}
          {item.type === "error" && <ErrorIcon />}
          {item.type === "warning" && <WarningIcon />}
          {item.type === "info" && <InfoIcon />}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[13px] font-semibold text-[#f4f3f0] leading-snug">
            {item.title}
          </p>
          {item.description && (
            <p className="text-[12px] text-[#5c5a6b] mt-0.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-5 h-5 rounded-md flex items-center justify-center text-[#5c5a6b] hover:text-[#928f9e] hover:bg-white/5 transition-colors shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
          >
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-white/5">
        <motion.div
          className={`h-full rounded-full ${styles.progressColor}`}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: item.duration / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

// ─── Toaster (portal) ─────────────────────────────────────────────────────────

export function Toaster() {
  const ctx = useContext(ToastContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !ctx) return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {ctx.toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastCard item={item} onDismiss={() => ctx.dismiss(item.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
