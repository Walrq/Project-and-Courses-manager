import { describe, it, expect } from 'vitest';
import { extractYouTubeId, parseYouTubeUrl } from '../core/youtubeId';

describe('youtubeId extractor', () => {
  it('extracts ID from standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('http://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from shorts URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from live URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('handles extra query parameters (&t=, &list=, &feature=)', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456&index=1')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=45')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts raw 11-char ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null and clear error message for invalid inputs without throwing', () => {
    expect(extractYouTubeId('')).toBeNull();
    expect(extractYouTubeId(null as any)).toBeNull();
    expect(extractYouTubeId(undefined as any)).toBeNull();
    expect(extractYouTubeId('https://vimeo.com/12345678')).toBeNull();
    expect(extractYouTubeId('just some random plain text')).toBeNull();
    expect(extractYouTubeId('https://google.com')).toBeNull();

    const res = parseYouTubeUrl('https://example.com/not-youtube');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();

    const validRes = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(validRes.success).toBe(true);
    expect(validRes.videoId).toBe('dQw4w9WgXcQ');
  });
});
