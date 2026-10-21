import React from 'react';
import type { Tag } from '../db/schema';

interface TagFilterBarProps {
  availableTags: Tag[];
  selectedTagIds: number[];
  matchMode: 'any' | 'all';
  onTagToggle: (tagId: number) => void;
  onMatchModeToggle: () => void;
  onClear: () => void;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags,
  selectedTagIds,
  matchMode,
  onTagToggle,
  onMatchModeToggle,
  onClear,
}) => {
  if (availableTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-xs">
      <span className="text-[#626670] font-medium text-[11px]">Filter by tag:</span>
      {availableTags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id!);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagToggle(tag.id!)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              isSelected
                ? 'shadow-sm text-white'
                : 'bg-[#14161f] text-[#8a8f98] hover:text-[#f7f8f8] border border-white/[0.08]'
            }`}
            style={{
              backgroundColor: isSelected ? tag.color : undefined,
              borderColor: isSelected ? tag.color : undefined,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isSelected ? '#ffffff' : tag.color }}
            />
            {tag.name}
          </button>
        );
      })}

      {selectedTagIds.length > 1 && (
        <button
          type="button"
          onClick={onMatchModeToggle}
          className="px-2 py-0.5 rounded bg-[#14161f] border border-white/[0.08] text-[10px] text-[#8a8f98] font-mono hover:text-[#f7f8f8] hover:border-white/[0.15]"
        >
          Match: <span className="font-bold uppercase text-indigo-400">{matchMode}</span>
        </button>
      )}

      {selectedTagIds.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-[#626670] hover:text-rose-400 text-[11px] underline ml-1 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
};
