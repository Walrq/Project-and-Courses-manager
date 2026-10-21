import React, { useState } from 'react';
import { Copy, Check, X, Sparkles } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  promptText: string;
}

export const PromptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  description,
  promptText,
}) => {
  const { showToast } = useUIStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = promptText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast('Prompt copied to clipboard! Paste into ChatGPT, Claude, or Gemini.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#0c0d12] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> {title}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          readOnly
          rows={14}
          value={promptText}
          className="w-full p-3.5 text-xs font-mono rounded-xl border border-white/[0.08] bg-[#0a0b0f] text-[#f7f8f8] leading-relaxed resize-none focus:outline-none"
        />

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-neutral-500 font-mono">
            Copy prompt &rarr; Paste in LLM &rarr; Paste result back
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="linear-btn-secondary !text-xs"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="linear-btn-primary !text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
