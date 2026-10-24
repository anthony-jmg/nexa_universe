export type VideoSource = 'youtube' | 'instagram' | 'unknown';

export interface ParsedVideoUrl {
  source: VideoSource;
  embedUrl: string | null;
  originalUrl: string;
}

const YOUTUBE_HOSTS = ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
// Contenus Instagram lisibles comme vidéo / publication (pas une page de profil).
const INSTAGRAM_CONTENT_PATHS = ['reel', 'reels', 'p', 'tv'];
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]+$/;

const unknown = (originalUrl: string): ParsedVideoUrl => ({ source: 'unknown', embedUrl: null, originalUrl });

function youtube(videoId: string | null | undefined, originalUrl: string): ParsedVideoUrl {
  if (!videoId || !YOUTUBE_ID.test(videoId)) return unknown(originalUrl);
  return { source: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}`, originalUrl };
}

/**
 * Parse a video URL and return its source + embeddable URL.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, /embed/, /live/,
 * youtube-nocookie.com/embed/, instagram.com/reel/, /p/, /tv/.
 * Identifiant YouTube vérifié (11 caractères) ; tout le reste est 'unknown'.
 */
export function parseVideoUrl(url: string): ParsedVideoUrl {
  const trimmed = url.trim();
  if (!trimmed) return unknown(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return unknown(trimmed);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return unknown(trimmed);

  const host = parsed.hostname.replace(/^www\./, '');
  const parts = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return youtube(parts[0], trimmed);
  }

  if (YOUTUBE_HOSTS.includes(host)) {
    if (parts[0] === 'watch') return youtube(parsed.searchParams.get('v'), trimmed);
    if (['shorts', 'embed', 'live'].includes(parts[0])) return youtube(parts[1], trimmed);
    return unknown(trimmed);
  }

  if (host === 'instagram.com') {
    if (INSTAGRAM_CONTENT_PATHS.includes(parts[0]) && parts[1] && INSTAGRAM_CODE.test(parts[1])) {
      return { source: 'instagram', embedUrl: null, originalUrl: trimmed };
    }
    return unknown(trimmed);
  }

  return unknown(trimmed);
}

export function isValidPresentationVideoUrl(url: string): boolean {
  const parsed = parseVideoUrl(url);
  return parsed.source === 'youtube' || parsed.source === 'instagram';
}

/** Message d'erreur lisible pour l'admin, ou null si l'URL est acceptée. */
export function getPresentationVideoUrlError(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isValidPresentationVideoUrl(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `« ${trimmed} » : l'URL doit commencer par https://`;
  }
  return `« ${trimmed} » : seules les vidéos YouTube (watch, youtu.be, shorts, embed, live) et les publications Instagram (reel, p, tv) sont acceptées`;
}
