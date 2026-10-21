import React, { useEffect, useState } from 'react';
import { undoManager, type UndoAction } from '../core/undo';
import { RotateCcw, X } from 'lucide-react';

export const UndoToast: React.FC = () => {
  const [activeAction, setActiveAction] = useState<UndoAction | null>(null);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const unsubscribe = undoManager.subscribe(() => {
      const recent = undoManager.getRecentAction();
      if (recent && Date.now() - recent.timestamp < 1000) {
        setActiveAction(recent);
        setProgress(100);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeAction) return;

    const interval = 80; // 100 steps over 8000ms
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setActiveAction(null);
          return 0;
        }
        return prev - 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeAction]);

  if (!activeAction) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-1.5 bg-[#0c0d12] border border-white/[0.08] shadow-2xl rounded-xl p-3 min-w-[280px] max-w-sm text-[#f7f8f8] animate-slide-up backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-medium text-[#f7f8f8]">{activeAction.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await undoManager.undoLatest();
              setActiveAction(null);
            }}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
          >
            Undo
          </button>
          <button
            onClick={() => setActiveAction(null)}
            className="p-1 text-[#626670] hover:text-[#f7f8f8] rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="w-full bg-[#1e2029] h-1 rounded-full overflow-hidden mt-1">
        <div
          className="bg-indigo-500 h-full transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
