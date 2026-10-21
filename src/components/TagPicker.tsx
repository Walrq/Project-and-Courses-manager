import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, Check, X } from 'lucide-react';
import { tagRepo } from '../db/repos/tagRepo';
import type { Tag, Tagging } from '../db/schema';

interface TagPickerProps {
  entityType: Tagging['entityType'];
  entityId: number;
  onTagsChanged?: () => void;
}

const PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4'];

export const TagPicker: React.FC<TagPickerProps> = ({ entityType, entityId, onTagsChanged }) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [assignedTags, setAssignedTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const loadTags = async () => {
    const all = await tagRepo.getAll();
    const assigned = await tagRepo.getTaggingsForEntity(entityType, entityId);
    setAllTags(all);
    setAssignedTags(assigned);
  };

  useEffect(() => {
    loadTags();
  }, [entityType, entityId]);

  const handleToggleTag = async (tag: Tag) => {
    if (!tag.id) return;
    const isAssigned = assignedTags.some((t) => t.id === tag.id);
    let nextIds: number[];

    if (isAssigned) {
      nextIds = assignedTags.filter((t) => t.id !== tag.id).map((t) => t.id!);
    } else {
      nextIds = [...assignedTags.map((t) => t.id!), tag.id];
    }

    await tagRepo.setTagsForEntity(entityType, entityId, nextIds);
    await loadTags();
    onTagsChanged?.();
  };

  const handleCreateTag = async () => {
    if (!search.trim()) return;
    const newId = await tagRepo.create(search.trim(), newColor);
    const nextIds = [...assignedTags.map((t) => t.id!), newId];
    await tagRepo.setTagsForEntity(entityType, entityId, nextIds);
    setSearch('');
    await loadTags();
    onTagsChanged?.();
  };

  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-block">
      {/* Tag Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{
              backgroundColor: `${t.color}20`,
              color: t.color,
              border: `1px solid ${t.color}40`,
            }}
          >
            {t.name}
          </span>
        ))}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
          title="Add or manage tags"
        >
          <TagIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-[#0c0d12] border border-white/[0.08] rounded-xl shadow-2xl p-3 text-[#f7f8f8] animate-fade-in backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
            <span className="text-[11px] font-semibold text-[#8a8f98] uppercase tracking-wider">Tags</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#626670] hover:text-[#f7f8f8]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Search or new tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500 mb-2"
          />

          {/* Color palette selector for new tag */}
          {search.trim() && !allTags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase()) && (
            <div className="flex items-center justify-between gap-1 mb-2 bg-[#14161f] p-1.5 rounded-lg border border-white/[0.04]">
              <span className="text-[10px] text-[#8a8f98]">Color:</span>
              <div className="flex gap-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className="w-3.5 h-3.5 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateTag}
                className="flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-medium shadow-sm"
              >
                <Plus className="w-2.5 h-2.5" /> Add
              </button>
            </div>
          )}

          {/* Tag List */}
          <div className="max-h-36 overflow-y-auto space-y-1">
            {filteredTags.map((tag) => {
              const isChecked = assignedTags.some((t) => t.id === tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.04] text-xs text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-[#d0d3d8]">{tag.name}</span>
                  </div>
                  {isChecked && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              );
            })}
            {filteredTags.length === 0 && !search.trim() && (
              <p className="text-[11px] text-[#626670] text-center py-2">No tags yet. Type to create one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
