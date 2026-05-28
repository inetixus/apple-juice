"use client";
import { useEffect, useCallback, useState } from "react";
import { Check, X, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastData = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

const icons = { success: Check, error: X, info: Info };
const colors = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00]",
};

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9, y: 0 }}
            animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="pointer-events-auto"
          >
            <ToastItem toast={t} onDismiss={onDismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const Icon = icons[toast.type];
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl ${colors[toast.type]}`}
    >
      <Icon className="h-4.5 w-4.5 flex-shrink-0" />
      <p className="text-sm font-medium">{toast.message}</p>
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const show = useCallback(
    (message: string, type: ToastData["type"] = "info") => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
      setToasts((p) => [...p, { id, message, type }]);
    },
    [],
  );
  const dismiss = useCallback((id: string) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);
  return { toasts, show, dismiss };
}
