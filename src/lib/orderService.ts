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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-and-create-order`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create order');
  }

  return await response.json();
}
