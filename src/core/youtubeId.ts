/**
 * Extracts YouTube video ID from various URL formats or raw ID input.
 * Safe on junk input, never throws.
 */

export interface YouTubeIdResult {
  success: boolean;
  videoId?: string;
  error?: string;
}

// Regex to capture YouTube video ID (11 characters)
// Supports:
// - youtube.com/watch?v=ID
// - youtu.be/ID
// - youtube.com/shorts/ID
// - youtube.com/embed/ID
// - youtube.com/live/ID
// - with query params like &t= or ?list=
// - raw 11-char ID
const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([a-zA-Z0-9_-]{11})/i;

const RAW_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') {
    return null;
  }

  const trimmed = urlOrId.trim();
  if (!trimmed) {
    return null;
  }

  // Check if raw 11-char ID
  if (RAW_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(YOUTUBE_REGEX);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function parseYouTubeUrl(urlOrId: string | null | undefined): YouTubeIdResult {
  const id = extractYouTubeId(urlOrId);
  if (id) {
    return { success: true, videoId: id };
  }

  return {
    success: false,
    error: 'Could not find a valid YouTube video ID in the provided URL. Expected formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., youtube.com/embed/..., or youtube.com/live/...',
  };
}
