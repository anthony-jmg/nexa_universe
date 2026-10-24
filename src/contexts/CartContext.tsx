import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { currentPrice } from '../lib/tierPricing';

type Product = Database['public']['Tables']['products']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type Event = Database['public']['Tables']['events']['Row'];

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
}

export type EventTicketPurchaseType = 'full_purchase' | 'price_lock_deposit';

export interface EventTicketCartItem {
  id?: string;
  eventTicketType: EventTicketType & {
    ticket_type: TicketType;
    event: Event;
  };
  quantity: number;
  purchaseType: EventTicketPurchaseType;
  priceSnapshot?: number;
  depositAmount?: number;
  amountDueNow?: number;
  balancePaymentMode?: 'manual' | 'automatic';
}

interface CartContextType {
  cart: CartItem[];
  eventTickets: EventTicketCartItem[];
  addToCart: (product: Product, quantity: number, size?: string) => Promise<void>;
  addEventTicketToCart: (eventTicketTypeId: string, quantity: number, purchaseType?: EventTicketPurchaseType, options?: { balancePaymentMode?: 'manual' | 'automatic'; depositAmount?: number }) => Promise<void>;
  removeFromCart: (productId: string, size?: string) => Promise<void>;
  removeEventTicketFromCart: (eventTicketTypeId: string, purchaseType?: EventTicketPurchaseType) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, size?: string) => Promise<void>;
  updateEventTicketQuantity: (eventTicketTypeId: string, quantity: number, purchaseType?: EventTicketPurchaseType) => Promise<void>;
  updateEventTicketBalanceMode: (eventTicketTypeId: string, balancePaymentMode: 'manual' | 'automatic') => Promise<void>;
  updateEventTicketPricing: (eventTicketTypeId: string, purchaseType: EventTicketPurchaseType, updates: { priceSnapshot?: number; depositAmount?: number; amountDueNow?: number }) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartCount: () => number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [eventTickets, setEventTickets] = useState<EventTicketCartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCartFromDatabase();
      loadEventTicketsFromDatabase();
    } else {
      loadCartFromLocalStorage();
      loadEventTicketsFromLocalStorage();
    }
  }, [user]);

  const loadCartFromDatabase = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: cartItems, error } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      if (cartItems) {
        const formattedCart: CartItem[] = cartItems.map((item: any) => ({
          id: item.id,
          product: item.products,
          quantity: item.quantity,
          selectedSize: item.selected_size || undefined,
        }));
        setCart(formattedCart);
      }
    } catch (error) {
      console.error('Error loading cart from database:', error);
      loadCartFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadEventTicketsFromDatabase = async () => {
    if (!user) return;

    try {
      const { data: cartEventTickets, error } = await supabase
        .from('cart_event_tickets')
        .select(`
          *,
          event_ticket_type:event_ticket_types (
            *,
            ticket_type:ticket_types (*),
            event:events (*)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      if (cartEventTickets) {
        // Événement dépublié (brouillon) : masqué par RLS, il revient à null.
        // L'article est ignoré (ni affiché ni envoyé au paiement) pour ne pas
        // faire planter le panier.
        const visibleCartEventTickets = cartEventTickets.filter(
          (item: { event_ticket_type?: { event?: unknown } | null }) => item.event_ticket_type?.event
        );
        const formattedEventTickets: EventTicketCartItem[] = visibleCartEventTickets.map((item: any) => ({
          id: item.id,
          eventTicketType: item.event_ticket_type,
          quantity: item.quantity,
          purchaseType: (item.purchase_type || 'full_purchase') as EventTicketPurchaseType,
          priceSnapshot: item.price_snapshot ?? undefined,
          depositAmount: item.deposit_amount ?? undefined,
          amountDueNow: item.amount_due_now ?? undefined,
          balancePaymentMode: item.balance_payment_mode ?? undefined,
        }));
        setEventTickets(formattedEventTickets);
      }
    } catch (error) {
      console.error('Error loading event tickets from database:', error);
    }
  };

  const loadCartFromLocalStorage = () => {
    const savedCart = localStorage.getItem('cart');
    setCart(savedCart ? JSON.parse(savedCart) : []);
    setLoading(false);
  };

  const loadEventTicketsFromLocalStorage = () => {
    const savedEventTickets = localStorage.getItem('eventTickets');
    setEventTickets(savedEventTickets ? JSON.parse(savedEventTickets) : []);
  };

  useEffect(() => {
    if (!user) {
      localStorage.setItem('cart', JSON.stringify(cart));
      localStorage.setItem('eventTickets', JSON.stringify(eventTickets));
    }
  }, [cart, eventTickets, user]);

  const addToCart = async (product: Product, quantity: number, size?: string) => {
    if (user) {
      const existingIndex = cart.findIndex(
        item => item.product.id === product.id && item.selectedSize === size
      );

      if (existingIndex > -1) {
        const newQuantity = cart[existingIndex].quantity + quantity;
        const itemId = cart[existingIndex].id;
        setCart(prev => prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: newQuantity } : item
        ));

        try {
          const { error } = await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', itemId);
          if (error) throw error;
        } catch (error) {
          console.error('Error updating cart:', error);
          await loadCartFromDatabase();
        }
      } else {
        const tempItem: CartItem = { product, quantity, selectedSize: size };
        setCart(prev => [...prev, tempItem]);

        try {
          const { data, error } = await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              product_id: product.id,
              quantity,
              selected_size: size || null,
            })
            .select()
            .single();

          if (error) throw error;
          setCart(prev => prev.map(item =>
            item === tempItem ? { ...item, id: data.id } : item
          ));
        } catch (error) {
          console.error('Error adding to cart:', error);
          setCart(prev => prev.filter(item => item !== tempItem));
        }
      }
    } else {
      setCart((prevCart) => {
        const existingItemIndex = prevCart.findIndex(
          (item) => item.product.id === product.id && item.selectedSize === size
        );

        if (existingItemIndex > -1) {
          const newCart = [...prevCart];
          newCart[existingItemIndex].quantity += quantity;
          return newCart;
        }

        return [...prevCart, { product, quantity, selectedSize: size }];
      });
    }
  };

  const removeFromCart = async (productId: string, size?: string) => {
    if (user) {
      const previous = cart;
      setCart(prev => prev.filter(
        item => !(item.product.id === productId && item.selectedSize === size)
      ));

      try {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .eq('selected_size', size || null);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing from cart:', error);
        setCart(previous);
      }
    } else {
      setCart((prevCart) =>
        prevCart.filter(
          (item) => !(item.product.id === productId && item.selectedSize === size)
        )
      );
    }
  };

  const updateQuantity = async (productId: string, quantity: number, size?: string) => {
    if (quantity <= 0) {
      await removeFromCart(productId, size);
      return;
    }

    if (user) {
      const previous = cart;
      setCart(prev => prev.map(item =>
        item.product.id === productId && item.selectedSize === size
          ? { ...item, quantity }
          : item
      ));

      try {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity })
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .eq('selected_size', size || null);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating quantity:', error);
        setCart(previous);
      }
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.product.id === productId && item.selectedSize === size
            ? { ...item, quantity }
            : item
        )
      );
    }
  };

  const addEventTicketToCart = async (
    eventTicketTypeId: string,
    quantity: number,
    purchaseType: EventTicketPurchaseType = 'full_purchase',
    options?: { balancePaymentMode?: 'manual' | 'automatic'; depositAmount?: number }
  ) => {
    const isDeposit = purchaseType === 'price_lock_deposit';
    const qty = isDeposit ? 1 : quantity;

    if (isDeposit) {
      const { data: depositTarget } = await supabase
        .from('event_ticket_types')
        .select('event_id')
        .eq('id', eventTicketTypeId)
        .maybeSingle();

      if (depositTarget?.event_id) {
        const conflictInCart = eventTickets.some(
          item =>
            item.purchaseType === 'price_lock_deposit' &&
            (item.eventTicketType as any).event?.id === depositTarget.event_id
        );
        if (conflictInCart) {
          throw new Error('Tu as déjà un Price Lock pour ce festival. Un seul Price Lock est autorisé par festival.');
        }

        if (user) {
          const { count: activeForEvent } = await supabase
            .from('price_locks')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('event_id', depositTarget.event_id)
            .eq('status', 'active');
          if ((activeForEvent ?? 0) > 0) {
            throw new Error('Tu as déjà un Price Lock actif pour ce festival.');
          }
        }
      }
    }

    const matches = (item: EventTicketCartItem) =>
      item.eventTicketType.id === eventTicketTypeId && item.purchaseType === purchaseType;

    if (user) {
      const existingIndex = eventTickets.findIndex(matches);

      if (existingIndex > -1) {
        const newQuantity = eventTickets[existingIndex].quantity + qty;
        setEventTickets(prev => prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: newQuantity } : item
        ));

        try {
          const { error } = await supabase
            .from('cart_event_tickets')
            .update({ quantity: newQuantity })
            .eq('user_id', user.id)
            .eq('event_ticket_type_id', eventTicketTypeId)
            .eq('purchase_type', purchaseType);
          if (error) throw error;
        } catch (error) {
          console.error('Error updating event ticket:', error);
          await loadEventTicketsFromDatabase();
          throw error;
        }
      } else {
        const { data: eventTicketData, error: fetchError } = await supabase
          .from('event_ticket_types')
          .select(`*, ticket_type:ticket_types (*), event:events (*), price_tiers:event_ticket_price_tiers (label, price, starts_at, ends_at)`)
          .eq('id', eventTicketTypeId)
          .single();

        if (fetchError || !eventTicketData) throw fetchError;

        const ticket = eventTicketData as any;
        // Prix issu du palier actif (source de vérité) ; le montant est
        // revalidé côté serveur au checkout.
        const price = currentPrice(ticket);
        const deposit = options?.depositAmount ?? Number(ticket.price_lock_deposit_amount);
        const amountDueNow = purchaseType === 'price_lock_deposit' ? deposit : price;

        const tempItem: EventTicketCartItem = {
          eventTicketType: eventTicketData as any,
          quantity: qty,
          purchaseType,
          priceSnapshot: price,
          depositAmount: purchaseType === 'price_lock_deposit' ? deposit : undefined,
          amountDueNow,
          balancePaymentMode: purchaseType === 'price_lock_deposit' ? options?.balancePaymentMode : undefined,
        };
        setEventTickets(prev => [...prev, tempItem]);

        try {
          const { error } = await supabase
            .from('cart_event_tickets')
            .insert({
              user_id: user.id,
              event_ticket_type_id: eventTicketTypeId,
              quantity: qty,
              purchase_type: purchaseType,
              price_snapshot: price,
              deposit_amount: purchaseType === 'price_lock_deposit' ? deposit : null,
              amount_due_now: amountDueNow,
              balance_payment_mode: purchaseType === 'price_lock_deposit' ? options?.balancePaymentMode ?? 'manual' : null,
            });

          if (error) throw error;
        } catch (error) {
          console.error('Error adding event ticket to cart:', error);
          setEventTickets(prev => prev.filter(item => item !== tempItem));
          throw error;
        }
      }
    } else {
      const { data: eventTicketData } = await supabase
        .from('event_ticket_types')
        .select(`*, ticket_type:ticket_types (*), event:events (*), price_tiers:event_ticket_price_tiers (label, price, starts_at, ends_at)`)
        .eq('id', eventTicketTypeId)
        .single();

      if (eventTicketData) {
        const ticket = eventTicketData as any;
        const price = currentPrice(ticket);
        const deposit = options?.depositAmount ?? Number(ticket.price_lock_deposit_amount);
        const amountDueNow = purchaseType === 'price_lock_deposit' ? deposit : price;

        setEventTickets((prev) => {
          const existingIndex = prev.findIndex(matches);

          if (existingIndex > -1) {
            const newEventTickets = [...prev];
            newEventTickets[existingIndex].quantity += qty;
            newEventTickets[existingIndex].depositAmount = purchaseType === 'price_lock_deposit' ? deposit : undefined;
            newEventTickets[existingIndex].amountDueNow = amountDueNow;
            return newEventTickets;
          }

          return [...prev, {
            eventTicketType: eventTicketData as any,
            quantity: qty,
            purchaseType,
            priceSnapshot: price,
            depositAmount: purchaseType === 'price_lock_deposit' ? deposit : undefined,
            amountDueNow,
          }];
        });
      }
    }
  };

  const removeEventTicketFromCart = async (
    eventTicketTypeId: string,
    purchaseType: EventTicketPurchaseType = 'full_purchase'
  ) => {
    if (user) {
      const previous = eventTickets;
      setEventTickets(prev => prev.filter(item =>
        !(item.eventTicketType.id === eventTicketTypeId && item.purchaseType === purchaseType)
      ));

      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .delete()
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId)
          .eq('purchase_type', purchaseType);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing event ticket from cart:', error);
        setEventTickets(previous);
      }
    } else {
      setEventTickets((prev) =>
        prev.filter((item) => item.eventTicketType.id !== eventTicketTypeId)
      );
    }
  };

  const updateEventTicketQuantity = async (
    eventTicketTypeId: string,
    quantity: number,
    purchaseType: EventTicketPurchaseType = 'full_purchase'
  ) => {
    if (quantity <= 0) {
      await removeEventTicketFromCart(eventTicketTypeId, purchaseType);
      return;
    }

    // Un Price Lock reste toujours à quantité 1, quel que soit l'appelant
    if (purchaseType === 'price_lock_deposit') {
      quantity = 1;
    }

    if (user) {
      const previous = eventTickets;
      setEventTickets(prev => prev.map(item =>
        item.eventTicketType.id === eventTicketTypeId && item.purchaseType === purchaseType
          ? { ...item, quantity } : item
      ));

      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .update({ quantity })
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId)
          .eq('purchase_type', purchaseType);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating event ticket quantity:', error);
        setEventTickets(previous);
      }
    } else {
      setEventTickets((prev) =>
        prev.map((item) =>
          item.eventTicketType.id === eventTicketTypeId
            ? { ...item, quantity }
            : item
        )
      );
    }
  };

  const updateEventTicketPricing = async (
    eventTicketTypeId: string,
    purchaseType: EventTicketPurchaseType,
    updates: { priceSnapshot?: number; depositAmount?: number; amountDueNow?: number }
  ) => {
    setEventTickets(prev => prev.map(item =>
      item.eventTicketType.id === eventTicketTypeId && item.purchaseType === purchaseType
        ? {
            ...item,
            priceSnapshot: updates.priceSnapshot ?? item.priceSnapshot,
            depositAmount: updates.depositAmount ?? item.depositAmount,
            amountDueNow: updates.amountDueNow ?? item.amountDueNow,
          }
        : item
    ));

    if (user) {
      const patch: Record<string, number> = {};
      if (updates.priceSnapshot != null) patch.price_snapshot = updates.priceSnapshot;
      if (updates.depositAmount != null) patch.deposit_amount = updates.depositAmount;
      if (updates.amountDueNow != null) patch.amount_due_now = updates.amountDueNow;
      if (Object.keys(patch).length === 0) return;

      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .update(patch)
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId)
          .eq('purchase_type', purchaseType);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating event ticket pricing:', error);
        await loadEventTicketsFromDatabase();
      }
    }
  };

  const updateEventTicketBalanceMode = async (
    eventTicketTypeId: string,
    balancePaymentMode: 'manual' | 'automatic'
  ) => {
    setEventTickets(prev => prev.map(item =>
      item.eventTicketType.id === eventTicketTypeId && item.purchaseType === 'price_lock_deposit'
        ? { ...item, balancePaymentMode }
        : item
    ));

    if (user) {
      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .update({ balance_payment_mode: balancePaymentMode })
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId)
          .eq('purchase_type', 'price_lock_deposit');
        if (error) throw error;
      } catch (error) {
        console.error('Error updating balance payment mode:', error);
        await loadEventTicketsFromDatabase();
      }
    }
  };

  const clearCart = async () => {
    if (user) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);

        await supabase
          .from('cart_event_tickets')
          .delete()
          .eq('user_id', user.id);

        setCart([]);
        setEventTickets([]);
      } catch (error) {
        console.error('Error clearing cart:', error);
      }
    } else {
      setCart([]);
      setEventTickets([]);
      localStorage.removeItem('cart');
      localStorage.removeItem('eventTickets');
    }
  };

  const getCartCount = () => {
    const productCount = cart.reduce((count, item) => count + item.quantity, 0);
    const ticketCount = eventTickets.reduce((count, item) => count + item.quantity, 0);
    return productCount + ticketCount;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        eventTickets,
        addToCart,
        addEventTicketToCart,
        removeFromCart,
        removeEventTicketFromCart,
        updateQuantity,
        updateEventTicketQuantity,
        updateEventTicketPricing,
        updateEventTicketBalanceMode,
        clearCart,
        getCartCount,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
