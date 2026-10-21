import React, { useState, useEffect } from 'react';
import { trashRepo, type TrashBatch } from '../db/repos/trashRepo';
import { Trash2, RotateCcw, AlertTriangle, Clock, Layers } from 'lucide-react';

export const TrashPage: React.FC = () => {
  const [batches, setBatches] = useState<TrashBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = async () => {
    setLoading(true);
    const data = await trashRepo.getTrashBatches();
    setBatches(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (batchId: string) => {
    await trashRepo.restoreBatch(batchId);
    await loadTrash();
  };

  const handlePurge = async (batchId: string) => {
    if (confirm('Permanently delete this batch? This action cannot be undone.')) {
      await trashRepo.purgeBatch(batchId);
      await loadTrash();
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm('Are you sure you want to permanently delete ALL items in the trash?')) {
      await trashRepo.emptyTrash();
      await loadTrash();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5 tracking-tight">
            <Trash2 className="w-6 h-6 text-rose-400" />
            Trash & Soft Delete
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Items in trash are grouped by deletion batch and automatically purged after 30 days.
          </p>
        </div>

        {batches.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="linear-btn-secondary !text-rose-400 !border-rose-500/20 hover:!bg-rose-500/10 !text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Empty Trash
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-500 text-xs font-mono">Loading trash contents...</div>
      ) : batches.length === 0 ? (
        <div className="linear-card p-12 text-center text-neutral-400 space-y-2">
          <Trash2 className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
          <h3 className="text-sm font-semibold text-neutral-200">Trash is empty</h3>
          <p className="text-xs text-neutral-500">No soft-deleted projects or items.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div
              key={batch.deleteBatchId}
              className="linear-card-hover p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.06] pb-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-neutral-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-200">
                      Deletion Batch ({batch.items.length} item{batch.items.length > 1 ? 's' : ''})
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-0.5 font-mono">
                      <span>Deleted: {batch.deletedAt.split('T')[0]}</span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-3 h-3" />
                        {batch.daysRemaining} days until auto-purge
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(batch.deleteBatchId)}
                    className="linear-btn-secondary !text-emerald-400 !border-emerald-500/20 hover:!bg-emerald-500/10 !text-xs !py-1 !px-2.5"
                  >
                    <RotateCcw className="w-3 h-3 text-emerald-400" />
                    Restore Batch
                  </button>
                  <button
                    onClick={() => handlePurge(batch.deleteBatchId)}
                    className="linear-btn-secondary !text-rose-400 !border-rose-500/20 hover:!bg-rose-500/10 !text-xs !py-1 !px-2.5"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    Delete Forever
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-white/[0.04] text-xs">
                {batch.items.map((item) => (
                  <div key={`${item.entityType}_${item.id}`} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 uppercase tracking-wider text-[9px] rounded bg-white/[0.04] border border-white/[0.06] text-neutral-400 font-mono">
                        {item.entityType}
                      </span>
                      <span className="text-neutral-200 font-medium">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
