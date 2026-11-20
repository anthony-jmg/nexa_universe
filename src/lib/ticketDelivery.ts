// Liste Admin des billets officiels (voir TicketDeliveryList).

export const PAGE_SIZE = 20;

export interface DeliveryRow {
  id: string;
  user_id: string;
  qr_code: string;
  check_in_status: string;
  purchased_at: string | null;
  pass_status: string;
  pass_file_path: string | null;
  pass_uploaded_at: string | null;
  attendee_first_name: string | null;
  attendee_last_name: string | null;
  attendee_email: string | null;
  events: { title: string; start_date: string; event_status: string } | null;
  event_ticket_types: { ticket_types: { name: string } | null } | null;
}

// Référence d'achat lisible à partir du code du billet.
export function purchaseReference(qrCode: string): string {
  const order = qrCode.match(/^EVT-([0-9a-f]{8})/i);
  if (order) return `Commande ${order[1].toUpperCase()}`;
  if (qrCode.startsWith('PLR-')) return 'Rachat Price Lock';
  if (qrCode.startsWith('PL-')) return 'Price Lock soldé';
  return '—';
}

