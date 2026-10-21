import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Part, Section } from '../db/schema';
import { GripVertical, CheckCircle2, Circle, Calendar, Clock, Trash2, Lock } from 'lucide-react';

interface Props {
  part: Part;
  section?: Section;
  blockedBy?: string[];
  onToggleDone: (part: Part) => void;
  onDelete: (partId: number) => void;
}

export const SortablePartItem: React.FC<Props> = ({ part, section, blockedBy, onToggleDone, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: part.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDone = part.status === 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group px-3.5 py-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
        isDragging ? 'ring-1 ring-indigo-500 shadow-linear-glow z-20 bg-[#14161f]' : ''
      } ${
        isDone
          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
          : 'border-neutral-200 dark:border-white/[0.06] bg-[#0c0d12]/90 hover:bg-[#111318] hover:border-white/[0.1]'
      }`}
    >
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-neutral-500 hover:text-neutral-300 mt-0.5 rounded touch-none opacity-40 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Done toggle checkbox */}
        <button
          type="button"
          onClick={() => onToggleDone(part)}
          className="mt-0.5 text-neutral-500 hover:text-emerald-400 transition-colors shrink-0"
        >
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4 hover:stroke-indigo-400" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-neutral-500">
              #{part.orderNo}
            </span>
            <h4
              className={`font-medium text-xs truncate max-w-md ${
                isDone
                  ? 'line-through text-neutral-500'
                  : 'text-neutral-100'
              }`}
            >
              {part.title}
            </h4>
            {section && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-400 font-normal">
                {section.title}
              </span>
            )}
            <span
              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                part.status === 'done'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : part.status === 'skipped'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
              }`}
            >
              {part.status}
            </span>
            {blockedBy && blockedBy.length > 0 && (
              <span
                className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"
                title={`Blocked by unfinished dependencies: ${blockedBy.join(', ')}`}
              >
                <Lock className="w-2.5 h-2.5 shrink-0" /> Blocked: {blockedBy.join(', ')}
              </span>
            )}
          </div>

          {part.goal && (
            <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
              Goal: {part.goal}
            </p>
          )}

          <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1.5 font-mono">
            <span className="flex items-center gap-1 text-neutral-300">
              <Calendar className="w-3 h-3 text-indigo-400" />
              {part.plannedDate}
            </span>
            {part.estMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {part.estMinutes}m
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => part.id && onDelete(part.id)}
        className="p-1 text-neutral-500 hover:text-rose-400 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        title="Delete part"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
