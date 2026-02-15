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
  const { data, error } = await supabase.functions.invoke('validate-and-create-order', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Failed to create order');
  }

  if (!data) {
    throw new Error('No response received from order validation');
  }

  return data;
}
