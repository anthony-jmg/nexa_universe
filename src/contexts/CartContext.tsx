import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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

export interface EventTicketCartItem {
  eventTicketType: EventTicketType & {
    ticket_type: TicketType;
    event: Event;
  };
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  eventTickets: EventTicketCartItem[];
  addToCart: (product: Product, quantity: number, size?: string) => Promise<void>;
  addEventTicketToCart: (eventTicketTypeId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string, size?: string) => Promise<void>;
  removeEventTicketFromCart: (eventTicketTypeId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, size?: string) => Promise<void>;
  updateEventTicketQuantity: (eventTicketTypeId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartTotal: (isMember: boolean) => number;
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
        const formattedEventTickets: EventTicketCartItem[] = cartEventTickets.map((item: any) => ({
          eventTicketType: item.event_ticket_type,
          quantity: item.quantity,
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

  const addEventTicketToCart = async (eventTicketTypeId: string, quantity: number) => {
    if (user) {
      const existingIndex = eventTickets.findIndex(
        item => item.eventTicketType.id === eventTicketTypeId
      );

      if (existingIndex > -1) {
        const newQuantity = eventTickets[existingIndex].quantity + quantity;
        setEventTickets(prev => prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: newQuantity } : item
        ));

        try {
          const { error } = await supabase
            .from('cart_event_tickets')
            .update({ quantity: newQuantity })
            .eq('user_id', user.id)
            .eq('event_ticket_type_id', eventTicketTypeId);
          if (error) throw error;
        } catch (error) {
          console.error('Error updating event ticket:', error);
          await loadEventTicketsFromDatabase();
          throw error;
        }
      } else {
        const { data: eventTicketData, error: fetchError } = await supabase
          .from('event_ticket_types')
          .select(`*, ticket_type:ticket_types (*), event:events (*)`)
          .eq('id', eventTicketTypeId)
          .single();

        if (fetchError || !eventTicketData) throw fetchError;

        const tempItem: EventTicketCartItem = { eventTicketType: eventTicketData as any, quantity };
        setEventTickets(prev => [...prev, tempItem]);

        try {
          const { error } = await supabase
            .from('cart_event_tickets')
            .insert({
              user_id: user.id,
              event_ticket_type_id: eventTicketTypeId,
              quantity,
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
        .select(`*, ticket_type:ticket_types (*), event:events (*)`)
        .eq('id', eventTicketTypeId)
        .single();

      if (eventTicketData) {
        setEventTickets((prev) => {
          const existingIndex = prev.findIndex(
            (item) => item.eventTicketType.id === eventTicketTypeId
          );

          if (existingIndex > -1) {
            const newEventTickets = [...prev];
            newEventTickets[existingIndex].quantity += quantity;
            return newEventTickets;
          }

          return [...prev, { eventTicketType: eventTicketData as any, quantity }];
        });
      }
    }
  };

  const removeEventTicketFromCart = async (eventTicketTypeId: string) => {
    if (user) {
      const previous = eventTickets;
      setEventTickets(prev => prev.filter(item => item.eventTicketType.id !== eventTicketTypeId));

      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .delete()
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId);

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

  const updateEventTicketQuantity = async (eventTicketTypeId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeEventTicketFromCart(eventTicketTypeId);
      return;
    }

    if (user) {
      const previous = eventTickets;
      setEventTickets(prev => prev.map(item =>
        item.eventTicketType.id === eventTicketTypeId ? { ...item, quantity } : item
      ));

      try {
        const { error } = await supabase
          .from('cart_event_tickets')
          .update({ quantity })
          .eq('user_id', user.id)
          .eq('event_ticket_type_id', eventTicketTypeId);

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

  const getCartTotal = (isMember: boolean) => {
    const productTotal = cart.reduce((total, item) => {
      const price = isMember ? item.product.member_price : item.product.price;
      return total + price * item.quantity;
    }, 0);

    const ticketTotal = eventTickets.reduce((total, item) => {
      const price = isMember && item.eventTicketType.member_price > 0
        ? item.eventTicketType.member_price
        : item.eventTicketType.price;
      return total + price * item.quantity;
    }, 0);

    return productTotal + ticketTotal;
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
        clearCart,
        getCartTotal,
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
