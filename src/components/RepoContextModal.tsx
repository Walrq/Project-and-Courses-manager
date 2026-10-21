import React, { useState, useEffect, useMemo } from 'react';
import { FolderCode, X, Plus, Upload, FileText, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { repoFilesRepo, MAX_PROJECT_REPO_CHARS } from '../db/repos/repoFilesRepo';
import { buildRepoTree } from '../core/repoTree';
import { checkFileSafety } from '../core/secretCheck';
import { estimateTokens } from '../core/tokenEstimate';
import type { RepoFile } from '../db/schema';

interface RepoContextModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onFilesUpdated?: () => void;
}

export const RepoContextModal: React.FC<RepoContextModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [totalChars, setTotalChars] = useState(0);
  const [activeTab, setActiveTab] = useState<'manage' | 'paste' | 'upload'>('manage');

  // Manual paste state
  const [pastePath, setPastePath] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLanguage, setPasteLanguage] = useState('typescript');
  const [pasteError, setPasteError] = useState('');

  const loadFiles = async () => {
    const list = await repoFilesRepo.getByProject(projectId);
    const total = await repoFilesRepo.getTotalCharsForProject(projectId);
    setFiles(list);
    setTotalChars(total);
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleManualAdd = async () => {
    if (!pastePath.trim() || !pasteContent.trim()) {
      setPasteError('Path and file content are required.');
      return;
    }

    const res = await repoFilesRepo.saveFile(
      projectId,
      pastePath.trim(),
      pasteContent,
      pasteLanguage,
      true
    );

    if (!res.success) {
      setPasteError(res.error || 'Failed to save file.');
      return;
    }

    setPastePath('');
    setPasteContent('');
    setPasteError('');
    setActiveTab('manage');
    await loadFiles();
    onFilesUpdated?.();
  };

  const handleDirectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    let addedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const relativePath = (file as any).webkitRelativePath || file.name;

      const safety = checkFileSafety(relativePath);
      if (!safety.isSafe) {
        skippedCount++;
        continue;
      }

      try {
        const text = await file.text();
        const res = await repoFilesRepo.saveFile(projectId, relativePath, text, 'text', true);
        if (res.success) addedCount++;
        else skippedCount++;
      } catch {
        skippedCount++;
      }
    }

    alert(`Imported ${addedCount} files. Skipped ${skippedCount} ignored/secret/binary files.`);
    await loadFiles();
    onFilesUpdated?.();
  };

  const handleDeleteFile = async (id: number) => {
    await repoFilesRepo.deleteFile(id);
    await loadFiles();
    onFilesUpdated?.();
  };

  const treeString = buildRepoTree(files.map((f) => ({ path: f.path, sizeChars: f.sizeChars })));
  const totalTokens = estimateTokens(files.map((f) => f.content).join('\n')).tokens;
  const capacityPct = Math.min(100, Math.round((totalChars / MAX_PROJECT_REPO_CHARS) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0c0d12] border border-white/[0.08] w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f7f8f8]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#08090a]/80">
          <div className="flex items-center gap-2.5">
            <FolderCode className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#f7f8f8]">Repository Context Pack</h2>
              <p className="text-[11px] text-[#8a8f98]">
                Local code storage for prompt injection. Secrets (.env, keys) are strictly excluded.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#626670] hover:text-[#f7f8f8] rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Capacity Meter */}
        <div className="bg-[#111318] px-6 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-[#8a8f98]">Capacity Meter:</span>
            <div className="w-32 bg-[#1e2029] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${capacityPct > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-[#d0d3d8]">
              {(totalChars / 1000).toFixed(1)}k / {(MAX_PROJECT_REPO_CHARS / 1000).toFixed(0)}k chars ({capacityPct}%)
            </span>
          </div>
          <span className="text-[#8a8f98] font-mono text-[11px]">~{totalTokens.toLocaleString()} tokens</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.08] px-6 gap-6 pt-2 bg-[#0c0d12]">
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-[#8a8f98] hover:text-[#f7f8f8]'
            }`}
          >
            File Tree & Files ({files.length})
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-[#8a8f98] hover:text-[#f7f8f8]'
            }`}
          >
            Paste File Manually
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-[#8a8f98] hover:text-[#f7f8f8]'
            }`}
          >
            Folder Upload
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {files.length > 0 && (
                <div>
                  <h3 className="font-semibold text-[#8a8f98] text-[11px] uppercase tracking-wider mb-2">Repository Tree</h3>
                  <pre className="p-3 bg-[#08090a] border border-white/[0.08] rounded-xl font-mono text-[11px] text-indigo-300/90 overflow-x-auto leading-relaxed">
                    {treeString}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-[#8a8f98] text-[11px] uppercase tracking-wider mb-2">Saved Context Files</h3>
                {files.length === 0 ? (
                  <p className="text-[#626670] py-8 text-center">No files saved. Upload a folder or paste a file.</p>
                ) : (
                  <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden bg-[#111318]/40">
                    {files.map((file) => (
                      <div key={file.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#626670]" />
                          <span className="font-mono text-[#f7f8f8] font-medium">{file.path}</span>
                          <span className="text-[#626670] font-mono text-[10px]">
                            ({file.sizeChars.toLocaleString()} chars)
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.id!)}
                          className="text-[#626670] hover:text-rose-400 p-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              {pasteError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  {pasteError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8a8f98] mb-1">File Path (e.g. src/utils/math.ts)</label>
                  <input
                    type="text"
                    value={pastePath}
                    onChange={(e) => setPastePath(e.target.value)}
                    placeholder="src/components/MyComponent.tsx"
                    className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] placeholder-[#626670] font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8a8f98] mb-1">Language</label>
                  <select
                    value={pasteLanguage}
                    onChange={(e) => setPasteLanguage(e.target.value)}
                    className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[#f7f8f8] text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="html">HTML / CSS</option>
                    <option value="json">JSON</option>
                    <option value="text">Plain Text</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8a8f98] mb-1">Content</label>
                <textarea
                  rows={10}
                  placeholder="Paste file source code here..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full bg-[#14161f] border border-white/[0.08] rounded-lg p-2.5 text-[#f7f8f8] placeholder-[#626670] font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleManualAdd}
                  className="linear-btn-primary"
                >
                  Save to Context Pack
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border border-dashed border-white/[0.12] rounded-2xl p-8 text-center space-y-3 bg-[#111318]/40 hover:border-indigo-500/50 transition-colors">
                <Upload className="w-8 h-8 mx-auto text-[#626670]" />
                <div>
                  <h4 className="font-semibold text-[#f7f8f8]">Select Local Directory</h4>
                  <p className="text-[#8a8f98] text-xs mt-1">
                    Browser will read text files locally. Secrets (.env, keys, certs) and binary files are automatically excluded.
                  </p>
                </div>

                <input
                  type="file"
                  id="folder-input"
                  // @ts-expect-error webkitdirectory is standard in browsers
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleDirectoryUpload}
                  className="hidden"
                />

                <label
                  htmlFor="folder-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs cursor-pointer transition-all shadow-md"
                >
                  <FolderCode className="w-4 h-4" />
                  Select Project Folder
                </label>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#8a8f98] bg-[#14161f] p-3 rounded-xl border border-white/[0.08]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Automatic security filter active: node_modules, .git, dist, .env*, and private keys are never stored.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
