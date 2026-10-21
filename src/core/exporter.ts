import type { Project, Section, Part, PartStep, Decision, Memory, Walkthrough } from '../db/schema';
import { formatSecondsToTimestamp } from './chapterParser';

export interface FullProjectExport {
  version: 1 | 2;
  project: Project;
  sections: Section[];
  parts: Array<Part & { steps?: PartStep[] }>;
  decisions: Decision[];
  memory?: Memory;
  walkthroughs?: Walkthrough[];
}

export function exportProjectToMarkdown(data: FullProjectExport): string {
  const lines: string[] = [];
  const { project, sections, parts, decisions, memory, walkthroughs } = data;

  lines.push(`# ${project.name}`);
  if (project.description) lines.push(`\n**Description:** ${project.description}`);
  if (project.goal) lines.push(`**Goal:** ${project.goal}`);
  if (project.constraints) lines.push(`**Constraints:** ${project.constraints}`);
  if (project.aiRules) lines.push(`\n### AI Rules\n${project.aiRules}`);

  if (walkthroughs && walkthroughs.length > 0) {
    lines.push('\n## Walkthrough Sources');
    for (const w of walkthroughs) {
      lines.push(`- **${w.title}** (${w.type})${w.url ? `: ${w.url}` : ''}`);
    }
  }

  if (memory?.rollingSummary) {
    lines.push(`\n## Rolling Memory\n${memory.rollingSummary}`);
  }

  if (decisions.length > 0) {
    lines.push('\n## Architectural Decisions');
    for (const d of decisions) {
      lines.push(`- **${d.text}**${d.reason ? ` — *${d.reason}*` : ''} (${d.active ? 'Active' : 'Inactive'})`);
    }
  }

  if (sections.length > 0) {
    lines.push('\n## Project Sections');
    for (const s of sections) {
      lines.push(`### ${s.title} [Status: ${s.status}]`);
      if (s.description) lines.push(s.description);
    }
  }

  if (parts.length > 0) {
    lines.push('\n## Daily Parts Schedule');
    for (const p of parts) {
      if (p.isRest) {
        lines.push(`- **${p.plannedDate}: REST DAY**`);
      } else {
        lines.push(`- **${p.plannedDate}: ${p.title}** [Status: ${p.status}]`);
        if (p.goal) lines.push(`  Goal: ${p.goal}`);
        if (p.sourceStart !== undefined || p.sourceLabel) {
          const timeRange =
            p.sourceStart !== undefined
              ? ` [${formatSecondsToTimestamp(p.sourceStart)}${p.sourceEnd !== undefined ? ` - ${formatSecondsToTimestamp(p.sourceEnd)}` : ''}]`
              : '';
          lines.push(`  *Source:* ${p.sourceLabel || 'Walkthrough'}${timeRange}`);
        }
        if (p.steps && p.steps.length > 0) {
          for (const st of p.steps) {
            lines.push(`  - [${st.done ? 'x' : ' '}] ${st.text}`);
          }
        }
        if (p.note) lines.push(`  *Summary:* ${p.note}`);
      }
    }
  }

  return lines.join('\n');
}

export function exportProjectToJSON(data: FullProjectExport): string {
  return JSON.stringify(data, null, 2);
}

