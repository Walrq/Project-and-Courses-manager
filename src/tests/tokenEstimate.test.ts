import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../core/tokenEstimate';

describe('Token Estimator', () => {
  it('estimates ceil(characters / 4)', () => {
    expect(estimateTokens('').tokens).toBe(0);
    expect(estimateTokens('abcd').tokens).toBe(1);
    expect(estimateTokens('abcde').tokens).toBe(2);
    expect(estimateTokens('a'.repeat(400)).tokens).toBe(100);
  });

  it('calculates color correctly: green < 60%, yellow 60-90%, red > 90%', () => {
    // limit 1000 tokens (4000 characters)
    // 50% = 500 tokens (2000 chars) -> green
    const greenResult = estimateTokens('a'.repeat(2000), 1000);
    expect(greenResult.color).toBe('green');

    // 75% = 750 tokens (3000 chars) -> yellow
    const yellowResult = estimateTokens('a'.repeat(3000), 1000);
    expect(yellowResult.color).toBe('yellow');

    // 95% = 950 tokens (3800 chars) -> red
    const redResult = estimateTokens('a'.repeat(3800), 1000);
    expect(redResult.color).toBe('red');
  });
});
