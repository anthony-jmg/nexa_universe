import { supabase } from './supabase';

/**
 * Fiche professeur Academy Discovery : contenu géré par l'admin, sans compte
 * utilisateur. Seules les colonnes publiques de `professors` sont lues
 * (jamais `profiles`).
 */
export interface DiscoveryProfessor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  website_url: string | null;
  website_cover_image: string | null;
  profile_video_urls: string[] | null;
  is_featured: boolean | null;
}

export const DISCOVERY_PROFESSOR_COLUMNS =
  'id, full_name, avatar_url, bio, specialties, experience_years, website_url, website_cover_image, profile_video_urls, is_featured';

export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Visible publiquement : fiche active (filtrée en base) avec un site valide. */
export function isDiscoveryEligible(professor: Pick<DiscoveryProfessor, 'website_url'>): boolean {
  return isValidHttpUrl(professor.website_url);
}

export type AcademyClickType = 'academy_profile_click' | 'academy_website_click';

/**
 * Suivi des clics : jamais bloquant. user_id est rempli en base
 * (auth.uid(), null pour un visiteur).
 */
export function trackAcademyClick(
  professorId: string,
  type: AcademyClickType,
  destinationUrl: string | null = null
): void {
  try {
    Promise.resolve(
      supabase
        .from('academy_click_tracking')
        .insert({ professor_id: professorId, content_type: type, destination_url: destinationUrl })
    ).then(
      ({ error }) => {
        if (error) console.warn('Click tracking failed:', error.message);
      },
      () => {}
    );
  } catch {
    // Le tracking ne doit jamais empêcher la navigation.
  }
}
