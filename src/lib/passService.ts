import { supabase } from './supabase';

const BUCKET = 'event-passes';
const MAX_PASS_SIZE = 10 * 1024 * 1024; // 10 Mo (aussi limité côté bucket)
// Lien signé de courte durée : la règle d'accès est revérifiée à chaque lien.
const SIGNED_URL_SECONDS = 60;

export type PassStatus = 'pending' | 'available';

export const PASS_STATUS_LABELS: Record<PassStatus, string> = {
  pending: 'En attente',
  available: 'Disponible',
};

export function isValidPassStatus(value: unknown): value is PassStatus {
  return value === 'pending' || value === 'available';
}

interface PassAttendee {
  pass_status: string;
  pass_file_path: string | null;
  check_in_status: string;
}

/**
 * Billet officiel délivrable : achat intégralement payé, non annulé, avec un
 * fichier enregistré. La base applique la même règle (ajout du fichier et
 * création des liens de téléchargement).
 */
export function isPassDelivered(attendee: PassAttendee): boolean {
  return attendee.check_in_status === 'not_checked_in'
    && attendee.pass_status === 'available'
    && !!attendee.pass_file_path;
}

/** Billet payé et valide, en attente du fichier officiel. */
export function isPassAwaitingFile(attendee: PassAttendee): boolean {
  return attendee.check_in_status === 'not_checked_in' && !isPassDelivered(attendee);
}

export async function validatePassFile(file: File): Promise<string | null> {
  if (!file) return 'Aucun fichier sélectionné.';
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Le pass doit être un fichier PDF.';
  }
  if (file.size === 0) return 'Le fichier est vide.';
  if (file.size > MAX_PASS_SIZE) return 'Le PDF dépasse la taille maximale de 10 Mo.';
  return null;
}

export async function importPassPdf(
  attendee: { id: string; user_id: string; pass_file_path: string | null; check_in_status: string },
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attendee.check_in_status !== 'not_checked_in') {
    return { ok: false, error: 'Billet non éligible : achat non intégralement payé ou annulé.' };
  }
  const validationError = await validatePassFile(file);
  if (validationError) return { ok: false, error: validationError };

  const path = `${attendee.user_id}/${attendee.id}/pass.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true });

  // Fichier non enregistré : le billet reste « en attente », rien n'est délivré.
  if (uploadError) return { ok: false, error: "Impossible d'importer le pass. Réessaie." };

  // La base refuse « disponible » si le fichier est absent ou le billet non éligible.
  const { error: updateError } = await supabase
    .from('event_attendees')
    .update({
      pass_status: 'available',
      pass_file_path: path,
      pass_uploaded_at: new Date().toISOString(),
    })
    .eq('id', attendee.id);

  if (updateError) {
    const reason = /non éligible|invalide|introuvable/.test(updateError.message) ? ` (${updateError.message})` : '';
    return { ok: false, error: `Le fichier n'a pas été rattaché au billet${reason}. Réessaie.` };
  }

  return { ok: true };
}

/**
 * Lien signé de courte durée vers le billet officiel. Refusé par la base si le
 * billet n'appartient pas à l'utilisateur, est annulé ou remboursé, ou si
 * l'événement est annulé (même si un fichier existe).
 */
export async function getPassDownloadUrl(
  attendee: PassAttendee,
  options: { download?: string } = {}
): Promise<{ ok: true; url: string } | { ok: false; reason: 'not_available' | 'failed' }> {
  if (!isPassDelivered(attendee)) return { ok: false, reason: 'not_available' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attendee.pass_file_path as string, SIGNED_URL_SECONDS, options);

  if (error || !data?.signedUrl) return { ok: false, reason: 'failed' };
  return { ok: true, url: data.signedUrl };
}

export async function openPassPdf(attendee: PassAttendee): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attendee.check_in_status === 'awaiting_balance') {
    return { ok: false, error: 'Ton solde doit être réglé avant de accéder au pass.' };
  }
  const result = await getPassDownloadUrl(attendee);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === 'not_available'
        ? 'Ton pass est en attente. Il apparaîtra ici dès qu’il aura été ajouté.'
        : 'Impossible d’ouvrir le pass. Réessaie dans un instant.',
    };
  }

  window.open(result.url, '_blank', 'noopener');
  return { ok: true };
}
