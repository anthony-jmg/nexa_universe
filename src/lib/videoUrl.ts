export type VideoSource = 'youtube' | 'instagram' | 'unknown';

export interface ParsedVideoUrl {
  source: VideoSource;
  embedUrl: string | null;
  originalUrl: string;
}

/**
 * Parse a video URL and return its source + embeddable URL.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, instagram.com/reel/, instagram.com/p/
 */
export function parseVideoUrl(url: string): ParsedVideoUrl {
  const trimmed = url.trim();
  if (!trimmed) return { source: 'unknown', embedUrl: null, originalUrl: trimmed };

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace('www.', '');

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0];
      if (videoId) {
        return { source: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}`, originalUrl: trimmed };
      }
    }

    // youtube.com/watch?v=<id> or youtube.com/shorts/<id> or youtube.com/embed/<id>
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) {
        return { source: 'youtube', embedUrl: `https://www.youtube.com/embed/${watchId}`, originalUrl: trimmed };
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) {
        return { source: 'youtube', embedUrl: `https://www.youtube.com/embed/${parts[1]}`, originalUrl: trimmed };
      }
      if (parts[0] === 'embed' && parts[1]) {
        return { source: 'youtube', embedUrl: `https://www.youtube.com/embed/${parts[1]}`, originalUrl: trimmed };
      }
    }

    // instagram.com/reel/<id>/ or instagram.com/p/<id>/
    if (host === 'instagram.com') {
      return { source: 'instagram', embedUrl: null, originalUrl: trimmed };
    }

    return { source: 'unknown', embedUrl: null, originalUrl: trimmed };
  } catch {
    return { source: 'unknown', embedUrl: null, originalUrl: trimmed };
  }
}

export function isValidPresentationVideoUrl(url: string): boolean {
  const parsed = parseVideoUrl(url);
  return parsed.source === 'youtube' || parsed.source === 'instagram';
}
