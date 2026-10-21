import type { Section, SectionDep } from '../db/schema';

export interface SectionDependencyStatus {
  sectionId: number;
  isBlocked: boolean;
  blockingDependencies: Section[];
}

/**
 * Determines whether a section is blocked by any unfinished dependencies.
 * A dependency is unfinished if its status !== 'done'.
 */
export function checkSectionDependencies(
  sectionId: number,
  allSections: Section[],
  allDeps: SectionDep[]
): SectionDependencyStatus {
  const directDepIds = allDeps
    .filter((d) => d.sectionId === sectionId)
    .map((d) => d.dependsOnId);

  const blockingDependencies = allSections.filter(
    (s) => s.id && directDepIds.includes(s.id) && s.status !== 'done'
  );

  return {
    sectionId,
    isBlocked: blockingDependencies.length > 0,
    blockingDependencies,
  };
}

/**
 * Checks whether a part is scheduled before its section's dependency sections have finished.
 */
export function isPartScheduledBeforeDependencies(
  partPlannedDate: string,
  sectionId: number | null | undefined,
  allSections: Section[],
  allDeps: SectionDep[],
  allParts: Array<{ sectionId?: number | null; plannedDate: string; status: string }>
): { hasConflict: boolean; conflictingSectionTitles: string[] } {
  if (!sectionId) return { hasConflict: false, conflictingSectionTitles: [] };

  const depStatus = checkSectionDependencies(sectionId, allSections, allDeps);
  if (!depStatus.isBlocked) return { hasConflict: false, conflictingSectionTitles: [] };

  // Check if any parts of the blocking sections are scheduled on or after this part's date
  const conflictingTitles: string[] = [];
  for (const blockingSec of depStatus.blockingDependencies) {
    const blockingParts = allParts.filter(
      (p) => p.sectionId === blockingSec.id && p.status !== 'done'
    );

    const hasLaterOrSameDatePart = blockingParts.some(
      (p) => p.plannedDate >= partPlannedDate
    );

    if (hasLaterOrSameDatePart) {
      conflictingTitles.push(blockingSec.title);
    }
  }

  return {
    hasConflict: conflictingTitles.length > 0,
    conflictingSectionTitles: conflictingTitles,
  };
}
