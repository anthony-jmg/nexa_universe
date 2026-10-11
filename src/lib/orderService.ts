import { supabase } from './supabase';

export interface OrderItem {
  product_id?: string;
  event_ticket_type_id?: string;
  quantity: number;
  selected_size?: string;
  price_snapshot?: number | null;
  deposit_amount?: number | null;
}

export interface ShippingInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface AttendeeInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ValidateAndCreateOrderParams {
  items: OrderItem[];
  shipping_info: ShippingInfo;
  attendees_by_ticket?: Record<string, AttendeeInfo[]>;
}

export interface PriceChangeInfo {
  event_ticket_type_id: string;
  cart_price: number;
  current_price: number;
  ticket_name?: string;
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
  const isExpired = expiresAt < Date.now();
  const isExpiringSoon = expiresAt - Date.now() < 5 * 60 * 1000;
  if (isExpired || isExpiringSoon) {
    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed) {
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }
    session = refreshed;
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
    // Cas structurés : le serveur a relu le palier actif et a détecté une
    // dérive — le panier doit être corrigé puis confirmé, pas une erreur brute.
    if (data?.code === 'PRICE_CHANGED') {
      const err = new Error(data.error) as Error & { code: string; priceChange: PriceChangeInfo };
      err.code = 'PRICE_CHANGED';
      err.priceChange = {
        event_ticket_type_id: data.event_ticket_type_id,
        cart_price: Number(data.cart_price),
        current_price: Number(data.current_price),
        ticket_name: data.ticket_name,
      };
      throw err;
    }
    if (data?.code === 'PRICE_LOCK_CLOSED') {
      const err = new Error(data.error) as Error & { code: string; ticketTypeId: string; currentPrice?: number };
      err.code = 'PRICE_LOCK_CLOSED';
      err.ticketTypeId = data.event_ticket_type_id;
      err.currentPrice = data.current_price != null ? Number(data.current_price) : undefined;
      throw err;
    }
    const errorMsg = data.error === 'Validation failed' && data.details?.length
      ? data.details.join(', ')
      : data.error || 'Erreur lors de la création de la commande';
    throw new Error(errorMsg);
  }

  if (!data) {
    throw new Error('Aucune réponse reçue de la validation de commande');
  }

  return data;
}
