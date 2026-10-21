import React from 'react';
import { useUIStore } from '../store/uiStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useUIStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
  };

  const borderStyles = {
    success: 'border-emerald-500/30 bg-[#0c0d12]/95 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    error: 'border-rose-500/30 bg-[#0c0d12]/95 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    info: 'border-indigo-500/30 bg-[#0c0d12]/95 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
  };

  const styleType = toast.type || 'success';

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${borderStyles[styleType]}`}
    >
      {icons[styleType]}
      <span className="text-xs font-medium text-[#f7f8f8]">{toast.message}</span>
      <button
        onClick={clearToast}
        className="ml-2 p-1 text-[#626670] hover:text-[#f7f8f8] rounded-md transition-colors"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
