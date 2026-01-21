import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { Calendar, MapPin, Clock, ArrowLeft, Check, Minus, Plus, ShoppingCart } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_type: TicketType;
};

interface EventWithTickets extends Event {
  event_ticket_types: EventTicketType[];
}

interface TicketSelection {
  eventTicketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
}

interface EventDetailProps {
  eventId: string;
  onNavigate: (page: string) => void;
}

export function EventDetail({ eventId, onNavigate }: EventDetailProps) {
  const { user, profile } = useAuth();
  const { addEventTicketToCart } = useCart();
  const { t } = useLanguage();
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<TicketSelection[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const isMember = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_ticket_types (
          *,
          ticket_type:ticket_types (*)
        )
      `)
      .eq('id', eventId)
      .eq('event_status', 'published')
      .eq('is_active', true)
      .single();

    if (!error && data) {
      setEvent(data as any);
    }
    setLoading(false);
  };

  const updateQuantity = (eventTicketTypeId: string, ticketTypeName: string, unitPrice: number, delta: number) => {
    setSelections(prev => {
      const existing = prev.find(s => s.eventTicketTypeId === eventTicketTypeId);

      if (!existing && delta > 0) {
        return [...prev, { eventTicketTypeId, ticketTypeName, quantity: 1, unitPrice }];
      }

      if (existing) {
        const newQuantity = Math.max(0, existing.quantity + delta);
        if (newQuantity === 0) {
          return prev.filter(s => s.eventTicketTypeId !== eventTicketTypeId);
        }
        return prev.map(s =>
          s.eventTicketTypeId === eventTicketTypeId
            ? { ...s, quantity: newQuantity }
            : s
        );
      }

      return prev;
    });
  };

  const getTotalQuantity = () => {
    return selections.reduce((sum, s) => sum + s.quantity, 0);
  };

  const getTotalPrice = () => {
    return selections.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
  };

  const handleAddToCart = async () => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      for (const selection of selections) {
        await addEventTicketToCart(selection.eventTicketTypeId, selection.quantity);
      }

      onNavigate('cart');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 flex items-center justify-center">
        <div className="inline-block w-10 h-10 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-300">Événement non trouvé</p>
          <button
            onClick={() => onNavigate('events')}
            className="mt-4 text-[#B8913D] hover:text-[#D4AC5B]"
          >
            Retour aux événements
          </button>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.start_date);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <button
          onClick={() => onNavigate('events')}
          className="mb-6 flex items-center space-x-2 text-gray-300 hover:text-[#B8913D] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour aux événements</span>
        </button>

        <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 overflow-hidden mb-8">
              {event.image_url && (
                <div className="relative h-80 bg-gray-800">
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                </div>
              )}

              <div className="p-8">
                <h1 className="text-3xl sm:text-4xl font-light text-white mb-6">{event.title}</h1>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3 text-gray-300">
                    <Calendar className="w-5 h-5 text-[#B8913D]" />
                    <span>
                      {eventDate.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-gray-300">
                    <Clock className="w-5 h-5 text-[#B8913D]" />
                    <span>
                      {eventDate.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center space-x-3 text-gray-300">
                      <MapPin className="w-5 h-5 text-[#B8913D]" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>

                <p className="text-gray-300 leading-relaxed">{event.description}</p>
              </div>
            </div>

            <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-8">
              <h2 className="text-2xl font-light text-white mb-6">Sélectionnez vos billets</h2>

              <div className="space-y-4">
                {event.event_ticket_types
                  ?.filter(ett => ett.is_active)
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((ett) => {
                    const price = isMember && ett.member_price > 0 ? ett.member_price : ett.price;
                    const available = ett.quantity_available !== null
                      ? ett.quantity_available - ett.quantity_sold
                      : 999;
                    const selection = selections.find(s => s.eventTicketTypeId === ett.id);
                    const selectedQty = selection?.quantity || 0;

                    return (
                      <div
                        key={ett.id}
                        className="flex items-center justify-between p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700 hover:border-[#B8913D] transition-all"
                      >
                        <div className="flex-1">
                          <h3 className="text-xl font-medium text-white mb-2">
                            {ett.ticket_type.name}
                          </h3>
                          {ett.ticket_type.description && (
                            <p className="text-sm text-gray-400 mb-3">{ett.ticket_type.description}</p>
                          )}
                          {ett.features && Array.isArray(ett.features) && ett.features.length > 0 && (
                            <ul className="space-y-1">
                              {(ett.features as string[]).map((feature, idx) => (
                                <li key={idx} className="flex items-center space-x-2 text-sm text-gray-300">
                                  <Check className="w-4 h-4 text-[#B8913D]" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="text-xs text-gray-500 mt-2">{available} places disponibles</p>
                        </div>

                        <div className="flex items-center space-x-6 ml-6">
                          <div className="text-right">
                            {ett.member_price > 0 && ett.member_price < ett.price ? (
                              <>
                                <div className="text-sm text-gray-400">{ett.price.toFixed(2)}€</div>
                                <div className="text-2xl font-bold text-[#B8913D]">{ett.member_price.toFixed(2)}€</div>
                                <div className="text-xs text-[#B8913D]">avec abonnement</div>
                              </>
                            ) : (
                              <div className="text-2xl font-bold text-[#B8913D]">{ett.price.toFixed(2)}€</div>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 bg-gray-900 rounded-lg p-2">
                            <button
                              onClick={() => updateQuantity(ett.id, ett.ticket_type.name, price, -1)}
                              disabled={selectedQty === 0}
                              className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-white font-medium">{selectedQty}</span>
                            <button
                              onClick={() => updateQuantity(ett.id, ett.ticket_type.name, price, 1)}
                              disabled={selectedQty >= available || selectedQty >= (ett.max_per_order || 10)}
                              className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-900 bg-opacity-40 border border-red-600 border-opacity-40 rounded-lg text-red-300">
                  {error}
                </div>
              )}

              {selections.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-gray-400">Total ({getTotalQuantity()} billets)</p>
                      <p className="text-3xl font-bold text-[#B8913D]">{getTotalPrice().toFixed(2)}€</p>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      disabled={processing}
                      className="px-8 py-4 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span>{processing ? 'Ajout...' : 'Ajouter au panier'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
      </div>
    </div>
  );
}
