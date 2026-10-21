export interface DiffLine {
  type: 'added' | 'removed' | 'same';
  text: string;
}

export interface DiffResult {
  addedCount: number;
  removedCount: number;
  lines: DiffLine[];
}

/**
 * Computes a clean line-by-line diff between original and updated strings.
 */
export function computeLineDiff(original: string, updated: string): DiffResult {
  const origLines = original.replace(/\r\n/g, '\n').split('\n');
  const updateLines = updated.replace(/\r\n/g, '\n').split('\n');

  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;

  let i = 0;
  let j = 0;

  while (i < origLines.length && j < updateLines.length) {
    if (origLines[i] === updateLines[j]) {
      lines.push({ type: 'same', text: origLines[i] });
      i++;
      j++;
    } else {
      // Lookahead to see if next lines match
      const nextMatchInUpdate = updateLines.indexOf(origLines[i], j);
      const nextMatchInOrig = origLines.indexOf(updateLines[j], i);

      if (nextMatchInUpdate !== -1 && (nextMatchInOrig === -1 || nextMatchInUpdate - j <= nextMatchInOrig - i)) {
        while (j < nextMatchInUpdate) {
          lines.push({ type: 'added', text: updateLines[j] });
          addedCount++;
          j++;
        }
      } else if (nextMatchInOrig !== -1) {
        while (i < nextMatchInOrig) {
          lines.push({ type: 'removed', text: origLines[i] });
          removedCount++;
          i++;
        }
      } else {
        lines.push({ type: 'removed', text: origLines[i] });
        removedCount++;
        i++;
        lines.push({ type: 'added', text: updateLines[j] });
        addedCount++;
        j++;
      }
    }
  }

  while (i < origLines.length) {
    lines.push({ type: 'removed', text: origLines[i] });
    removedCount++;
    i++;
  }

  while (j < updateLines.length) {
    lines.push({ type: 'added', text: updateLines[j] });
    addedCount++;
    j++;
  }

  return { addedCount, removedCount, lines };
}
