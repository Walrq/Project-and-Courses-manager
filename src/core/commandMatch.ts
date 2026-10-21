export interface CommandDef {
  id: string;
  title: string;
  keywords?: string[];
  shortcut?: string;
  category?: 'navigation' | 'actions' | 'tools' | 'settings';
  when?: () => boolean;
  run: () => void | Promise<void>;
}

export interface MatchScoreResult {
  command: CommandDef;
  score: number;
}

/**
 * Computes a relevance score between a query and a command.
 * Higher score = better match. 0 = no match.
 */
export function scoreCommand(
  query: string,
  cmd: CommandDef,
  recentCommandIds: string[] = []
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1; // All commands match empty query

  const title = cmd.title.toLowerCase();
  const keywords = (cmd.keywords || []).map((k) => k.toLowerCase());
  const words = title.split(/\s+/);

  let score = 0;

  // Exact title match
  if (title === q) {
    score += 100;
  }
  // Title starts with query
  else if (title.startsWith(q)) {
    score += 80;
  }
  // Any word in title starts with query
  else if (words.some((w) => w.startsWith(q))) {
    score += 60;
  }
  // Title includes query anywhere
  else if (title.includes(q)) {
    score += 40;
  }

  // Keywords match
  for (const kw of keywords) {
    if (kw === q) {
      score += 50;
    } else if (kw.startsWith(q)) {
      score += 35;
    } else if (kw.includes(q)) {
      score += 20;
    }
  }

  // Fuzzy character subsequence match (e.g. 'gtp' -> 'Generate Today\'s Prompt')
  if (score === 0) {
    let qIdx = 0;
    for (let i = 0; i < title.length && qIdx < q.length; i++) {
      if (title[i] === q[qIdx]) {
        qIdx++;
      }
    }
    if (qIdx === q.length) {
      score += 15;
    }
  }

  // Recent usage boost
  const recentIndex = recentCommandIds.indexOf(cmd.id);
  if (recentIndex !== -1 && score > 0) {
    score += Math.max(5, 20 - recentIndex * 2);
  }

  return score;
}

/**
 * Filters and ranks commands based on query and recency.
 */
export function matchCommands(
  query: string,
  commands: CommandDef[],
  recentCommandIds: string[] = []
): CommandDef[] {
  const scored: MatchScoreResult[] = [];

  for (const cmd of commands) {
    // Check conditional availability
    if (cmd.when && !cmd.when()) {
      continue;
    }

    const score = scoreCommand(query, cmd, recentCommandIds);
    if (score > 0) {
      scored.push({ command: cmd, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.command);
}
