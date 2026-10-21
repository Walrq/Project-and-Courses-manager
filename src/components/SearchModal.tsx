import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { buildSearchIndex, executeSearch, type SearchResultItem } from '../core/search';
import { commandRegistry } from '../commands/registry';
import { matchCommands, type CommandDef } from '../core/commandMatch';
import {
  Search,
  FolderGit2,
  Layers,
  Calendar,
  BrainCircuit,
  Link2,
  X,
  Terminal,
  Keyboard,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type PaletteItem =
  | { kind: 'command'; command: CommandDef }
  | { kind: 'search'; item: SearchResultItem }
  | { kind: 'study'; item: { id: string; title: string; subtitle: string; targetUrl: string } };

const EMPTY: never[] = [];

export const SearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Live query all searchable entities
  const projects = useLiveQuery(() => db.projects.filter((p) => !p.deletedAt).toArray(), []) || EMPTY;
  const sections = useLiveQuery(() => db.sections.filter((s) => !s.deletedAt).toArray(), []) || EMPTY;
  const parts = useLiveQuery(() => db.parts.filter((p) => !p.deletedAt).toArray(), []) || EMPTY;
  const decisions = useLiveQuery(() => db.decisions.filter((d) => !d.deletedAt).toArray(), []) || EMPTY;
  const links = useLiveQuery(() => db.links.filter((l) => !l.deletedAt).toArray(), []) || EMPTY;
  const studyItems = useLiveQuery(() => db.study_items.toArray(), []) || EMPTY;
  const studyUnits = useLiveQuery(() => db.study_units.toArray(), []) || EMPTY;
  const studyTopics = useLiveQuery(() => db.study_topics.toArray(), []) || EMPTY;
  const studyCards = useLiveQuery(() => db.study_cards.toArray(), []) || EMPTY;
  const studyQuizzes = useLiveQuery(() => db.study_quizzes.toArray(), []) || EMPTY;

  // Register standard system commands
  useEffect(() => {
    const defaultCommands: CommandDef[] = [
      {
        id: 'nav_dashboard',
        title: 'Go to Dashboard',
        keywords: ['home', 'projects', 'overview'],
        category: 'navigation',
        run: () => navigate('/'),
      },
      {
        id: 'nav_today',
        title: 'Go to Today\'s Part',
        keywords: ['today', 'execute', 'work'],
        category: 'navigation',
        run: () => navigate('/today'),
      },
      {
        id: 'nav_calendar',
        title: 'Go to Calendar',
        keywords: ['calendar', 'month', 'schedule'],
        category: 'navigation',
        run: () => navigate('/calendar'),
      },
      {
        id: 'nav_stats',
        title: 'Go to Statistics & Effort',
        keywords: ['stats', 'time', 'metrics', 'hours'],
        category: 'navigation',
        run: () => navigate('/stats'),
      },
      {
        id: 'nav_review',
        title: 'Open Weekly Review',
        keywords: ['weekly', 'review', 'retrospective'],
        category: 'navigation',
        run: () => navigate('/review'),
      },
      {
        id: 'nav_templates',
        title: 'Go to Prompt Templates',
        keywords: ['templates', 'prompt', 'custom'],
        category: 'navigation',
        run: () => navigate('/templates'),
      },
      {
        id: 'nav_trash',
        title: 'Open Trash & Soft Delete',
        keywords: ['trash', 'recycle', 'bin', 'restore'],
        category: 'navigation',
        run: () => navigate('/trash'),
      },
      {
        id: 'nav_settings',
        title: 'Go to Settings',
        keywords: ['settings', 'config', 'backup'],
        category: 'navigation',
        run: () => navigate('/settings'),
      },
      { id: 'nav_study', title: 'Open Study Module', keywords: ['study', 'course', 'subject', 'syllabus'], category: 'navigation', run: () => navigate('/study') },
      { id: 'nav_study_today', title: 'Open Study Today', keywords: ['study', 'today', 'revision', 'flashcards'], category: 'navigation', run: () => navigate('/study/today') },
      {
        id: 'show_shortcuts',
        title: 'Show Keyboard Shortcuts (?)',
        keywords: ['help', 'shortcuts', 'keys', '?'],
        category: 'tools',
        run: () => setShowShortcutsHelp(true),
      },
    ];

    commandRegistry.setDefaultCommands(defaultCommands);
  }, [navigate]);

  // Build the search index whenever data changes
  const searchIndex = useMemo(() => {
    return buildSearchIndex({ projects, sections, parts, decisions, links });
  }, [projects, sections, parts, decisions, links]);

  // Match commands
  const allCommands = commandRegistry.getAllCommands();
  const recentIds = commandRegistry.getRecentCommandIds();

  const matchedCommands = useMemo(() => {
    if (!query.trim()) {
      return allCommands.slice(0, 5);
    }
    return matchCommands(query, allCommands, recentIds);
  }, [query, allCommands, recentIds]);

  // Execute search query
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return projects.slice(0, 4).map((p) => ({
        id: `project-${p.id}`,
        entityId: p.id!,
        type: 'project' as const,
        projectId: p.id!,
        projectName: p.name,
        title: p.name,
        subtitle: p.goal || 'Project Overview',
        targetUrl: `/project/${p.id}`,
        score: 1,
      }));
    }
    return executeSearch(searchIndex, query, 8);
  }, [searchIndex, query, projects]);

  const studySearchResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    const results: Array<{ id: string; title: string; subtitle: string; targetUrl: string; score: number }> = [];
    const itemMap = new Map(studyItems.flatMap((item) => item.id ? [[item.id, item] as const] : []));
    const add = (id: string, itemId: number, title: string, subtitle: string, content: string) => {
      const item = itemMap.get(itemId);
      if (!item || item.archived) return;
      const text = `${title} ${subtitle} ${content} ${item.name} ${(item.tags || []).join(' ')}`.toLocaleLowerCase();
      if (text.includes(term)) results.push({ id, title, subtitle: `${item.name} · ${subtitle}`, targetUrl: `/study/${itemId}`, score: title.toLocaleLowerCase().includes(term) ? 3 : 1 });
    };
    studyItems.forEach((item) => { if (item.id) add(`study-item-${item.id}`, item.id, item.name, item.type, `${item.goal || ''} ${item.syllabus || ''} ${(item.tags || []).join(' ')}`); });
    studyUnits.forEach((unit) => add(`study-unit-${unit.id}`, unit.itemId, unit.title, 'Unit', ''));
    studyTopics.forEach((topic) => add(`study-topic-${topic.id}`, topic.itemId, topic.title, 'Topic note', `${topic.notes || ''} ${(topic.tags || []).join(' ')}`));
    studyCards.forEach((card) => add(`study-card-${card.id}`, card.itemId, card.front, 'Flashcard', `${card.back} ${(card.tags || []).join(' ')}`));
    studyQuizzes.forEach((quiz) => quiz.questions.forEach((question, index) => {
      const title = typeof question.question === 'string' ? question.question : `Question ${index + 1}`;
      add(`study-quiz-${quiz.itemId}-${index}`, quiz.itemId, title, 'Quiz question', String(question.explanation || ''));
    }));
    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [query, studyItems, studyUnits, studyTopics, studyCards, studyQuizzes]);

  // Combined palette items
  const combinedItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];
    for (const c of matchedCommands) {
      items.push({ kind: 'command', command: c });
    }
    for (const s of searchResults) {
      items.push({ kind: 'search', item: s });
    }
    for (const s of studySearchResults) items.push({ kind: 'study', item: s });
    return items;
  }, [matchedCommands, searchResults, studySearchResults]);

  const executeItem = useCallback((item: PaletteItem) => {
    if (item.kind === 'command') {
      commandRegistry.recordCommandUsage(item.command.id);
      onClose();
      item.command.run();
    } else {
      onClose();
      navigate(item.item.targetUrl);
    }
  }, [navigate, onClose]);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setShowShortcutsHelp(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !query) {
        e.preventDefault();
        setShowShortcutsHelp((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcutsHelp) setShowShortcutsHelp(false);
        else onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (combinedItems.length > 0 ? (prev + 1) % combinedItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (combinedItems.length > 0 ? (prev - 1 + combinedItems.length) % combinedItems.length : 0));
      } else if (e.key === 'Enter') {
        if (combinedItems.length > 0 && combinedItems[selectedIndex]) {
          e.preventDefault();
          executeItem(combinedItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, combinedItems, selectedIndex, showShortcutsHelp, query, onClose, executeItem]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0e1015]/95 border border-white/[0.1] w-full max-w-2xl rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col text-[#f7f8f8] max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/[0.08] bg-transparent gap-3">
          <Search className="w-4 h-4 text-[#8a8f98] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search projects, parts, decisions... (Press ? for shortcuts)"
            className="flex-1 bg-transparent border-none text-[#f7f8f8] placeholder-[#62666d] text-sm focus:outline-none"
          />
          <button
            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
            className="p-1 text-[#8a8f98] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
            title="Shortcuts Help (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#8a8f98] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Cheat Sheet */}
        {showShortcutsHelp ? (
          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-[#f7f8f8] flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-indigo-400" />
              Global Keyboard Shortcuts
            </h3>
            <div className="divide-y divide-white/[0.06]">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8a8f98]">Open Command Palette / Search</span>
                <kbd className="linear-kbd">Ctrl + K / Cmd + K</kbd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8a8f98]">Undo Last Action</span>
                <kbd className="linear-kbd">Ctrl + Z / Cmd + Z</kbd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8a8f98]">Open Shortcuts Help</span>
                <kbd className="linear-kbd">?</kbd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8a8f98]">Close Active Modal / Palette</span>
                <kbd className="linear-kbd">Escape</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="mt-2 w-full linear-btn-secondary py-2"
            >
              Back to Palette
            </button>
          </div>
        ) : (
          /* Results list */
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {combinedItems.length === 0 ? (
              <div className="py-12 text-center text-[#62666d] text-xs">
                No matching commands or search results found for "{query}".
              </div>
            ) : (
              combinedItems.map((entry, idx) => {
                const isSelected = idx === selectedIndex;

                if (entry.kind === 'command') {
                  const cmd = entry.command;
                  return (
                    <div
                      key={`cmd-${cmd.id}`}
                      onClick={() => executeItem(entry)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'hover:bg-white/[0.04] text-[#8a8f98] hover:text-[#f7f8f8]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Terminal className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-[#62666d]'}`} />
                        <div>
                          <div className="text-xs font-medium text-[#f7f8f8]">{cmd.title}</div>
                          {cmd.keywords && (
                            <div className="text-[10px] text-[#62666d]">{cmd.keywords.join(' · ')}</div>
                          )}
                        </div>
                      </div>
                      <span className="linear-kbd">
                        Command
                      </span>
                    </div>
                  );
                }

                if (entry.kind === 'study') {
                  const study = entry.item;
                  return <div key={`study-${study.id}`} onClick={() => executeItem(entry)} onMouseEnter={() => setSelectedIndex(idx)} className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] text-[#8a8f98] hover:text-[#f7f8f8]'}`}>
                    <div className="flex items-center gap-3"><div className="p-1 rounded bg-teal-500/10 border border-teal-500/20"><BookOpen className="w-3.5 h-3.5 text-teal-400" /></div><div><div className="text-xs font-medium text-[#f7f8f8]">{study.title}</div><div className="text-[10px] text-[#62666d]">{study.subtitle}</div></div></div><span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300">study</span>
                  </div>;
                }
                const s = entry.item;
                return (
                  <div
                    key={`search-${s.id}`}
                    onClick={() => executeItem(entry)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'hover:bg-white/[0.04] text-[#8a8f98] hover:text-[#f7f8f8]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1 rounded bg-white/[0.04] border border-white/[0.06] text-[#8a8f98]">
                        {s.type === 'project' && <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />}
                        {s.type === 'section' && <Layers className="w-3.5 h-3.5 text-sky-400" />}
                        {s.type === 'part' && <Calendar className="w-3.5 h-3.5 text-emerald-400" />}
                        {s.type === 'decision' && <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />}
                        {s.type === 'link' && <Link2 className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[#f7f8f8]">{s.title}</div>
                        <div className="text-[10px] text-[#62666d]">
                          {s.projectName} {s.subtitle ? `· ${s.subtitle}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#8a8f98] border border-white/[0.06]">
                      {s.type}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#090a0d] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#62666d]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="linear-kbd">↑</kbd><kbd className="linear-kbd">↓</kbd> Navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="linear-kbd">↵</kbd> Select</span>
            <span className="flex items-center gap-1.5"><kbd className="linear-kbd">esc</kbd> Close</span>
          </div>
          <span className="text-[10px] text-[#62666d] font-mono">ProjectPilot</span>
        </div>
      </div>
    </div>
  );
};
