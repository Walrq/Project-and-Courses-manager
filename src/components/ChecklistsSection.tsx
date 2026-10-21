import React, { useState, useEffect } from 'react';
import { checklistRepo } from '../db/repos/checklistRepo';
import type { Checklist, ChecklistItem, ChecklistTemplate } from '../db/schema';
import { CheckSquare, Plus, Check, Trash2, ListChecks, ChevronDown, ChevronRight } from 'lucide-react';

interface ChecklistsSectionProps {
  projectId: number;
  partId?: number;
}

export const ChecklistsSection: React.FC<ChecklistsSectionProps> = ({ projectId, partId }) => {
  const [checklists, setChecklists] = useState<Array<Checklist & { items: ChecklistItem[] }>>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [newItemTexts, setNewItemTexts] = useState<Record<number, string>>({});

  const loadData = async () => {
    const lists = partId
      ? await checklistRepo.getChecklistsForPart(partId)
      : await checklistRepo.getChecklistsForProject(projectId);
    const tmpls = await checklistRepo.getTemplates();
    setChecklists(lists);
    setTemplates(tmpls);
  };

  useEffect(() => {
    loadData();
  }, [projectId, partId]);

  const handleCreateFromTemplate = async () => {
    if (selectedTemplateId) {
      await checklistRepo.createFromTemplate(Number(selectedTemplateId), projectId, partId);
    } else if (newTitle.trim()) {
      await checklistRepo.createChecklist({ projectId, partId, name: newTitle.trim() });
    }
    setNewTitle('');
    setSelectedTemplateId('');
    setShowAddModal(false);
    await loadData();
  };

  const handleToggleItem = async (itemId: number, done: boolean) => {
    await checklistRepo.toggleItem(itemId, done);
    await loadData();
  };

  const handleAddItem = async (checklistId: number) => {
    const text = (newItemTexts[checklistId] || '').trim();
    if (!text) return;
    await checklistRepo.addItem(checklistId, text);
    setNewItemTexts((prev) => ({ ...prev, [checklistId]: '' }));
    await loadData();
  };

  const handleDeleteChecklist = async (id: number) => {
    await checklistRepo.deleteChecklist(id);
    await loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-indigo-400" />
          Checklists {partId ? 'for this Part' : 'for Project'}
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="linear-btn-secondary"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          Add Checklist
        </button>
      </div>

      {showAddModal && (
        <div className="bg-[#0c0d12] border border-white/[0.08] rounded-xl p-4 space-y-3 animate-fade-in text-xs shadow-xl">
          <h4 className="font-semibold text-[#f7f8f8]">New Checklist</h4>
          <div>
            <label className="block text-[11px] text-[#8a8f98] mb-1">From Starter Template:</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value ? Number(e.target.value) : '');
                if (e.target.value) setNewTitle('');
              }}
              className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Or enter custom title below --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.items.length} items)
                </option>
              ))}
            </select>
          </div>

          {!selectedTemplateId && (
            <div>
              <label className="block text-[11px] text-[#8a8f98] mb-1">Custom Checklist Title:</label>
              <input
                type="text"
                placeholder="e.g. Pre-flight Testing"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] placeholder-[#626670] text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAddModal(false)}
              className="linear-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFromTemplate}
              className="linear-btn-primary"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Checklist Cards */}
      <div className="space-y-3">
        {checklists.map((cl) => {
          const doneCount = cl.items.filter((i) => i.done).length;
          const totalCount = cl.items.length;
          const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

          return (
            <div key={cl.id} className="bg-[#0c0d12] border border-white/[0.08] rounded-xl p-4 space-y-3 shadow-sm hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#f7f8f8]">{cl.name}</h4>
                  <div className="text-[10px] text-[#8a8f98] font-mono mt-0.5">
                    {doneCount} of {totalCount} completed ({pct}%)
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-20 bg-[#1e2029] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    onClick={() => handleDeleteChecklist(cl.id!)}
                    className="p-1 text-[#626670] hover:text-rose-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 text-xs">
                {cl.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 text-[#d0d3d8] cursor-pointer group hover:text-[#f7f8f8] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.done)}
                      onChange={(e) => handleToggleItem(item.id!, e.target.checked)}
                      className="mt-0.5 rounded border-white/[0.12] bg-[#14161f] text-indigo-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className={item.done ? 'line-through text-[#626670]' : ''}>{item.text}</span>
                  </label>
                ))}
              </div>

              {/* Add item input */}
              <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                <input
                  type="text"
                  placeholder="Add item..."
                  value={newItemTexts[cl.id!] || ''}
                  onChange={(e) => setNewItemTexts((prev) => ({ ...prev, [cl.id!]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(cl.id!)}
                  className="flex-1 bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-[#f7f8f8] placeholder-[#626670] focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleAddItem(cl.id!)}
                  className="linear-btn-secondary text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}

        {checklists.length === 0 && !showAddModal && (
          <p className="text-xs text-[#626670] text-center py-6">No checklists attached yet.</p>
        )}
      </div>
    </div>
  );
};
