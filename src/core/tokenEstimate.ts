export interface TokenEstimateResult {
  tokens: number;
  characters: number;
  limit: number;
  percentage: number;
  color: 'green' | 'yellow' | 'red';
}

export const TOKEN_LIMIT_PRESETS = [4000, 8000, 32000, 128000, 200000] as const;

export function estimateTokens(text: string, limit: number = 8000): TokenEstimateResult {
  const characters = text.length;
  const tokens = Math.ceil(characters / 4);
  const percentage = limit > 0 ? (tokens / limit) * 100 : 0;

  let color: 'green' | 'yellow' | 'red' = 'green';
  if (percentage > 90) {
    color = 'red';
  } else if (percentage >= 60) {
    color = 'yellow';
  }

  return {
    tokens,
    characters,
    limit,
    percentage,
    color,
  };
}
