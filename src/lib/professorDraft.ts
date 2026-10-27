/**
 * Brouillon du formulaire admin « Ajouter un professeur ». Conservé dans le
 * parent Admin (jamais en base) pour survivre aux changements d'onglet.
 */
export interface ProfessorDraft {
  full_name: string;
  avatar_url: string;
  bio: string;
  bio_en: string;
  specialties: string[];
  experience_years: number;
  website_url: string;
  website_cover_image: string;
  profile_video_urls: string[];
  is_featured: boolean;
  is_active: boolean;
}

export function isProfessorDraftDirty(draft: ProfessorDraft | null): boolean {
  if (!draft) return false;
  return Boolean(
    draft.full_name.trim() || draft.avatar_url || draft.bio.trim() || draft.bio_en.trim() || draft.website_url.trim() ||
    draft.website_cover_image || draft.specialties.length || draft.experience_years ||
    draft.profile_video_urls.some((v) => v.trim()) || draft.is_featured || !draft.is_active
  );
}
