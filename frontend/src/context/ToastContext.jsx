import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = "info", duration = 5000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, message, type };
    
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            error: "bg-red-50 dark:bg-red-950/90 border-red-500 text-red-900 dark:text-red-200",
            warning: "bg-amber-50 dark:bg-amber-950/90 border-amber-500 text-amber-900 dark:text-amber-200",
            urgent: "bg-rose-600 text-white border-rose-700 shadow-xl shadow-rose-500/30 animate-bounce",
            success: "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500 text-emerald-900 dark:text-emerald-200",
            info: "bg-sky-50 dark:bg-sky-950/90 border-sky-500 text-sky-900 dark:text-sky-200",
          }[toast.type] || "bg-white dark:bg-slate-800 border-slate-300 text-slate-900 dark:text-slate-100";

          const icons = {
            error: "🚨",
            warning: "⚠️",
            urgent: "🔥",
            success: "✅",
            info: "ℹ️",
          }[toast.type] || "🔔";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border rounded-xl p-3.5 shadow-lg flex items-start gap-3 transition-all duration-300 transform translate-y-0 ${typeStyles}`}
            >
              <span className="text-xl shrink-0 mt-0.5">{icons}</span>
              <div className="flex-1 min-w-0">
                {toast.title && <h4 className="font-bold text-sm leading-tight">{toast.title}</h4>}
                <p className="text-xs mt-0.5 opacity-90 break-words">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-xs opacity-60 hover:opacity-100 px-1 font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
}
