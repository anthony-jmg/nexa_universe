import { describe, it, expect } from 'vitest';
import { parseVideoUrl, isValidPresentationVideoUrl, getPresentationVideoUrlError } from '../../lib/videoUrl';

const EMBED = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

describe('parseVideoUrl — formats acceptés', () => {
  it.each([
    ['YouTube watch', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['YouTube watch avec paramètres', 'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s'],
    ['YouTube mobile', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['youtu.be', 'https://youtu.be/dQw4w9WgXcQ?si=abc'],
    ['Shorts', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    ['embed', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['live', 'https://www.youtube.com/live/dQw4w9WgXcQ'],
    ['youtube-nocookie', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ])('%s', (_label, url) => {
    expect(parseVideoUrl(url)).toEqual({ source: 'youtube', embedUrl: EMBED, originalUrl: url });
  });

  it.each([
    ['reel', 'https://www.instagram.com/reel/C1abcdEF/'],
    ['reels', 'https://instagram.com/reels/C1abcdEF'],
    ['post', 'https://www.instagram.com/p/C1abcdEF/'],
    ['tv', 'https://www.instagram.com/tv/C1abcdEF/'],
  ])('Instagram %s', (_label, url) => {
    expect(parseVideoUrl(url)).toEqual({ source: 'instagram', embedUrl: null, originalUrl: url });
  });
});

describe('parseVideoUrl — formats refusés', () => {
  it.each([
    ['page de profil Instagram', 'https://www.instagram.com/nexa.universe/'],
    ['identifiant YouTube trop court', 'https://www.youtube.com/watch?v=abc'],
    ['identifiant YouTube avec caractères invalides', 'https://www.youtube.com/watch?v=abc%22%3E%3Cxxxxx'],
    ['URL sans protocole', 'youtube.com/watch?v=dQw4w9WgXcQ'],
    ['Vimeo', 'https://vimeo.com/123456'],
    ['URL inconnue', 'https://example.com/video'],
    ['javascript:', 'javascript:alert(1)'],
    ['texte', 'pas une url'],
    ['vide', ''],
    ['chaîne YouTube', 'https://www.youtube.com/@nexa'],
  ])('%s', (_label, url) => {
    expect(parseVideoUrl(url).source).toBe('unknown');
    expect(isValidPresentationVideoUrl(url)).toBe(false);
  });
});

describe('getPresentationVideoUrlError (admin)', () => {
  it('accepte une URL valide et ignore une ligne vide', () => {
    expect(getPresentationVideoUrlError('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(getPresentationVideoUrlError('   ')).toBeNull();
  });

  it('explique une URL sans protocole', () => {
    expect(getPresentationVideoUrlError('youtube.com/watch?v=dQw4w9WgXcQ')).toMatch(/https:\/\//);
  });

  it('refuse Vimeo, un profil Instagram et un identifiant YouTube invalide', () => {
    for (const url of ['https://vimeo.com/1', 'https://www.instagram.com/nexa/', 'https://youtu.be/abc']) {
      expect(getPresentationVideoUrlError(url)).toMatch(/seules les vidéos YouTube/);
    }
  });
});
