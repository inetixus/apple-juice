"use client";
import { useEffect, useState, useCallback } from "react";
import { Check, X, Info } from "lucide-react";

export type ToastData = { id: string; message: string; type: "success" | "error" | "info"; };

const icons = { success: Check, error: X, info: Info };
const colors = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-[#ccff00]/30 bg-[#ccff00]/10 text-[#ccff00]",
};

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 400); }, 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const Icon = icons[toast.type];
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-400 ${colors[toast.type]} ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
    >
      <Icon className="h-4.5 w-4.5 flex-shrink-0" />
      <p className="text-sm font-medium">{toast.message}</p>
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const show = useCallback((message: string, type: ToastData["type"] = "info") => {
    setToasts((p) => [...p, { id: crypto.randomUUID(), message, type }]);
  }, []);
  const dismiss = useCallback((id: string) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);
  return { toasts, show, dismiss };
}
