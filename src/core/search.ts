import MiniSearch from 'minisearch';
import type { Project, Section, Part, Decision, Link } from '../db/schema';

export interface SearchDoc {
  id: string; // formatted e.g. "project-1", "part-42"
  entityId: number;
  type: 'project' | 'section' | 'part' | 'decision' | 'link';
  projectId: number;
  projectName: string;
  title: string;
  subtitle?: string;
  content: string;
  targetUrl: string;
}

export interface SearchResultItem {
  id: string;
  entityId: number;
  type: 'project' | 'section' | 'part' | 'decision' | 'link';
  projectId: number;
  projectName: string;
  title: string;
  subtitle?: string;
  targetUrl: string;
  score: number;
}

/**
 * Creates and populates a MiniSearch index with all searchable project entities.
 */
export function buildSearchIndex(data: {
  projects: Project[];
  sections: Section[];
  parts: Part[];
  decisions: Decision[];
  links: Link[];
}): MiniSearch<SearchDoc> {
  const miniSearch = new MiniSearch<SearchDoc>({
    fields: ['title', 'subtitle', 'content', 'projectName'],
    storeFields: ['entityId', 'type', 'projectId', 'projectName', 'title', 'subtitle', 'targetUrl'],
    searchOptions: {
      boost: { title: 3, projectName: 2, subtitle: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const projectMap = new Map<number, string>();
  for (const p of data.projects) {
    if (p.id) projectMap.set(p.id, p.name);
  }

  const docs: SearchDoc[] = [];

  // Index Projects
  for (const p of data.projects) {
    if (!p.id) continue;
    docs.push({
      id: `project-${p.id}`,
      entityId: p.id,
      type: 'project',
      projectId: p.id,
      projectName: p.name,
      title: p.name,
      subtitle: p.goal || p.description || 'Project Overview',
      content: [p.name, p.description, p.goal, p.constraints, p.aiRules].filter(Boolean).join(' '),
      targetUrl: `/project/${p.id}`,
    });
  }

  // Index Sections
  for (const s of data.sections) {
    if (!s.id) continue;
    const projName = projectMap.get(s.projectId) || 'Project';
    docs.push({
      id: `section-${s.id}`,
      entityId: s.id,
      type: 'section',
      projectId: s.projectId,
      projectName: projName,
      title: s.title,
      subtitle: `Section (${s.status.replace('_', ' ')}) • Priority ${s.priority}`,
      content: [s.title, s.description].filter(Boolean).join(' '),
      targetUrl: `/project/${s.projectId}?tab=sections`,
    });
  }

  // Index Parts
  for (const p of data.parts) {
    if (!p.id) continue;
    // Find project ID via section or fallback
    const sec = data.sections.find((s) => s.id === p.sectionId);
    const projId = sec ? sec.projectId : (data.projects[0]?.id || 1);
    const projName = projectMap.get(projId) || 'Project';

    docs.push({
      id: `part-${p.id}`,
      entityId: p.id,
      type: 'part',
      projectId: projId,
      projectName: projName,
      title: p.title,
      subtitle: `Part #${p.orderNo} (${p.status}) • ${p.plannedDate}`,
      content: [p.title, p.goal, p.note].filter(Boolean).join(' '),
      targetUrl: `/project/${projId}?tab=plan`,
    });
  }

  // Index Decisions
  for (const d of data.decisions) {
    if (!d.id) continue;
    const projName = projectMap.get(d.projectId) || 'Project';
    docs.push({
      id: `decision-${d.id}`,
      entityId: d.id,
      type: 'decision',
      projectId: d.projectId,
      projectName: projName,
      title: d.text,
      subtitle: d.reason ? `Reason: ${d.reason}` : 'Active Architectural Decision',
      content: [d.text, d.reason].filter(Boolean).join(' '),
      targetUrl: `/project/${d.projectId}?tab=memory`,
    });
  }

  // Index Links & Pasted Docs
  for (const l of data.links) {
    if (!l.id) continue;
    const projName = projectMap.get(l.projectId) || 'Project';
    docs.push({
      id: `link-${l.id}`,
      entityId: l.id,
      type: 'link',
      projectId: l.projectId,
      projectName: projName,
      title: l.title || l.url,
      subtitle: l.url ? l.url : 'Pasted Reference Document',
      content: [l.title, l.url, l.note, l.pastedText ? l.pastedText.slice(0, 1000) : ''].filter(Boolean).join(' '),
      targetUrl: `/project/${l.projectId}?tab=links`,
    });
  }

  miniSearch.addAll(docs);
  return miniSearch;
}

/**
 * Searches the MiniSearch index and returns structured search results.
 */
export function executeSearch(
  index: MiniSearch<SearchDoc>,
  query: string,
  limit: number = 10
): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = index.search(trimmed);
  return results.slice(0, limit).map((r) => ({
    id: r.id as string,
    entityId: r.entityId as number,
    type: r.type as SearchDoc['type'],
    projectId: r.projectId as number,
    projectName: r.projectName as string,
    title: r.title as string,
    subtitle: r.subtitle as string | undefined,
    targetUrl: r.targetUrl as string,
    score: r.score,
  }));
}
