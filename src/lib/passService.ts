import { supabase } from './supabase';

const BUCKET = 'event-passes';
const MAX_PASS_SIZE = 10 * 1024 * 1024; // 10 Mo

export type PassStatus = 'pending' | 'available';

export const PASS_STATUS_LABELS: Record<PassStatus, string> = {
  pending: 'En attente',
  available: 'Disponible',
};

export function isValidPassStatus(value: unknown): value is PassStatus {
  return value === 'pending' || value === 'available';
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
  attendee: { id: string; user_id: string; pass_file_path: string | null },
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validationError = await validatePassFile(file);
  if (validationError) return { ok: false, error: validationError };

  const path = `${attendee.user_id}/${attendee.id}/pass.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true });

  if (uploadError) return { ok: false, error: "Impossible d'importer le pass. Réessaie." };

  const { error: updateError } = await supabase
    .from('event_attendees')
    .update({
      pass_status: 'available',
      pass_file_path: path,
      pass_uploaded_at: new Date().toISOString(),
    })
    .eq('id', attendee.id);

  if (updateError) {
    return { ok: false, error: "L'import a réussi mais l'enregistrement a échoué. Réessaie." };
  }

  return { ok: true };
}

export async function openPassPdf(attendee: {
  pass_status: string;
  pass_file_path: string | null;
  check_in_status: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attendee.check_in_status === 'awaiting_balance') {
    return { ok: false, error: 'Ton solde doit être réglé avant de accéder au pass.' };
  }
  if (attendee.pass_status !== 'available' || !attendee.pass_file_path) {
    return { ok: false, error: 'Ton pass est en attente. Il apparaîtra ici dès qu’il aura été ajouté.' };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attendee.pass_file_path, 300);

  if (error || !data?.signedUrl) {
    return { ok: false, error: 'Impossible d’ouvrir le pass. Réessaie dans un instant.' };
  }

  window.open(data.signedUrl, '_blank', 'noopener');
  return { ok: true };
}
