import { supabase } from './supabase';

export interface OrderItem {
  product_id?: string;
  event_ticket_type_id?: string;
  quantity: number;
  selected_size?: string;
}

export interface ShippingInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ValidateAndCreateOrderParams {
  items: OrderItem[];
  shipping_info: ShippingInfo;
}

export interface ValidatedOrderResponse {
  success: boolean;
  order_id: string;
  total_amount: number;
  validated_items: Array<{
    product_id?: string;
    event_ticket_type_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    details: Record<string, any>;
  }>;
}

export async function validateAndCreateOrder(
  params: ValidateAndCreateOrderParams
): Promise<ValidatedOrderResponse> {
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  let session = currentSession;

  if (!session) {
    throw new Error('Vous devez être connecté pour passer commande');
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const isExpiringSoon = expiresAt - Date.now() < 60 * 1000;
  if (isExpiringSoon) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed) {
      session = refreshed;
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiUrl = `${supabaseUrl}/functions/v1/validate-and-create-order`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.details?.join(', ') || 'Erreur lors de la création de la commande');
  }

  if (!data) {
    throw new Error('Aucune réponse reçue de la validation de commande');
  }

  return data;
}
