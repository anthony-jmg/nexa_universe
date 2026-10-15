import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { currentPrice, nextPrice, nextPriceChangeAt, priceLockDeadline, priceLockAvailable, EttWithPricing } from '../lib/tierPricing';
import { Calendar, MapPin, Clock, ArrowLeft, Check, Minus, Plus, ShoppingCart, Bell, ChevronDown, ChevronUp, Music, ListChecks, Info, Lock } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = EttWithPricing & {
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

const MOCK_PROGRAM = [
  '10h00 — Accueil et remise des Full Pass',
  '11h00 — Cours intensifs avec les professeurs invités',
  '15h00 — Workshops et sessions tous niveaux',
  '21h00 — Soirée festival et shows partenaires',
];

const MOCK_LINEUP = ['Marlon & Cindy', 'Tina & Alex', 'Nexa DJs'];

export function EventDetail({ eventId, onNavigate }: EventDetailProps) {
  const { user } = useAuth();
  const { addEventTicketToCart } = useCart();
  const { t } = useLanguage();
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<TicketSelection[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [lockMode, setLockMode] = useState(false);

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
          ticket_type:ticket_types (*),
          price_tiers:event_ticket_price_tiers (label, price, starts_at, ends_at)
        )
      `)
      .eq('id', eventId)
      .in('event_status', ['published', 'upcoming'])
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      setEvent(data as any);
    }
    setLoading(false);
  };

  const isUpcoming = event?.event_status === 'upcoming';

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

  const getTotalQuantity = () => selections.reduce((sum, s) => sum + s.quantity, 0);
  const getTotalPrice = () => selections.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
  const getLockTotalPrice = () => {
    if (!lockMode || !event) return getTotalPrice();
    return selections.reduce((sum, s) => {
      const ett = event.event_ticket_types?.find(t => t.id === s.eventTicketTypeId);
      const deposit = Number(ett?.price_lock_deposit_amount ?? 20);
      return sum + s.quantity * deposit;
    }, 0);
  };  const descriptionPreview = event?.description && event.description.length > 220
    ? `${event.description.slice(0, 220).trim()}…`
    : event?.description;

  const scrollToPurchase = () => {
    document.getElementById('event-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddToCart = async () => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const purchaseType = lockMode ? 'price_lock_deposit' : 'full_purchase';
      for (const selection of selections) {
        await addEventTicketToCart(selection.eventTicketTypeId, selection.quantity, purchaseType);
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
    <div className={`min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 relative overflow-x-hidden ${isUpcoming ? 'pb-12' : 'pb-28 sm:pb-12'}`}>
      <BackgroundDecor />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <button
          onClick={() => onNavigate('events')}
          className="mb-6 flex items-center space-x-2 text-gray-300 hover:text-[#B8913D] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour aux événements</span>
        </button>

        {isUpcoming && (
          <div className="mb-6 flex items-center space-x-3 px-5 py-4 rounded-xl border border-[#B8913D] border-opacity-40 bg-[#B8913D] bg-opacity-10">
            <Bell className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
            <div>
              <p className="text-[#B8913D] font-semibold text-sm">Bientôt disponible</p>
              <p className="text-gray-400 text-xs mt-0.5">La billetterie pour cet événement n'est pas encore ouverte. Revenez bientôt !</p>
            </div>
          </div>
        )}

        <div className={`bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border overflow-hidden mb-8 ${isUpcoming ? 'border-gray-700' : 'border-[#B8913D] border-opacity-30'}`}>
          {event.thumbnail_url && (
            <div className="relative h-80 bg-gray-800">
              <img
                src={event.thumbnail_url}
                alt={event.title}
                className={`w-full h-full object-cover ${isUpcoming ? 'opacity-60' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
            </div>
          )}

          <div className="p-4 sm:p-8">
            <h1 className="text-2xl sm:text-4xl font-light text-white mb-6">{event.title}</h1>

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

            {!isUpcoming && (() => {
              const tickets = (event.event_ticket_types || []).filter(ett => ett.is_active);
              if (tickets.length === 0) return null;
              const minTicket = tickets.reduce((a, b) => (currentPrice(a) <= currentPrice(b) ? a : b));
              const price = currentPrice(minTicket);
              const next = nextPrice(minTicket);
              const nextAt = nextPriceChangeAt(minTicket);
              const lockDeposit = Number(minTicket.price_lock_deposit_amount ?? 0);
              const lockOk = priceLockAvailable(minTicket);
              const deadline = priceLockDeadline(minTicket);
              const homogeneous = tickets.every(t => currentPrice(t) === currentPrice(minTicket));
              if (!homogeneous) return null;

              return (
              <div className="mb-8 rounded-2xl border border-[#D4AC5B]/35 bg-gradient-to-br from-[#B8913D]/15 via-gray-900/70 to-gray-950/80 p-5 sm:p-7 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-bold tracking-[0.24em] text-[#D4AC5B] uppercase">Full Pass</span>
                      {lockOk && (
                        <span className="rounded-full border border-[#D4AC5B]/45 bg-[#D4AC5B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F0D38A]">Price Lock disponible</span>
                      )}
                    </div>
                    <div className="flex items-end gap-3">
                      <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">{price.toFixed(0)} €</span>
                      <span className="pb-1 text-sm text-gray-400">tarif actuel</span>
                    </div>
                    {next !== null && nextAt && (
                      <p className="mt-2 text-sm text-gray-300">Prochain tarif : <span className="font-semibold text-[#F0D38A]">{next.toFixed(0)} € à partir du {nextAt.toLocaleDateString('fr-FR')}</span></p>
                    )}
                  </div>
                  {lockOk && (
                    <div className="sm:max-w-[240px] sm:text-right">
                      <p className="text-sm font-semibold text-white">Bloque ton tarif actuel avec {lockDeposit.toFixed(0)} €</p>
                      {deadline && <p className="mt-1 text-xs leading-relaxed text-gray-400">Tarif garanti jusqu’au {deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setLockMode(false); scrollToPurchase(); }}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(184,145,61,0.22)] transition-all hover:brightness-110"
                  >
                    Acheter maintenant — {price.toFixed(0)} €
                  </button>
                  {lockOk && (
                    <button
                      type="button"
                      onClick={() => { setLockMode(true); scrollToPurchase(); }}
                      className="inline-flex items-center justify-center rounded-xl border border-[#D4AC5B]/50 bg-[#D4AC5B]/10 px-5 py-3.5 text-sm font-semibold text-[#F0D38A] transition-all hover:bg-[#D4AC5B]/20"
                    >
                      Bloquer mon tarif — {lockDeposit.toFixed(0)} €
                    </button>
                  )}
                </div>
                {lockOk && (
                  <p className="mt-4 text-[11px] leading-relaxed text-gray-500">Les {lockDeposit.toFixed(0)} € sont déduits du prix final. Si le Price Lock expire, la somme déjà versée reste déduite mais le tarif en vigueur s’applique.</p>
                )}
              </div>
              );
            })()}

            <div className="border-t border-gray-800/80 pt-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-medium text-white">À propos du festival</h2>
                {event.description && event.description.length > 220 && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded(prev => !prev)}
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#D4AC5B] transition-colors hover:text-[#F0D38A]"
                  >
                    {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                    {isDescriptionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <p className="mt-3 text-gray-300 leading-relaxed">{isDescriptionExpanded ? event.description : descriptionPreview}</p>
            </div>
          </div>
        </div>

        {isUpcoming ? (
          <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B8913D] bg-opacity-10 border border-[#B8913D] border-opacity-30 mb-5">
              <Bell className="w-8 h-8 text-[#B8913D]" />
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Billetterie bientôt disponible</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Les billets pour cet événement seront disponibles prochainement. Revenez sur cette page pour réserver votre place.
            </p>
            <button
              onClick={() => onNavigate('events')}
              className="inline-flex items-center space-x-2 px-6 py-3 border border-[#B8913D] border-opacity-50 text-[#B8913D] rounded-lg hover:bg-[#B8913D] hover:bg-opacity-10 transition-all text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voir tous les événements</span>
            </button>
          </div>
        ) : (
          <div id="event-purchase" className="scroll-mt-24 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-4 sm:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-[0.2em] text-[#D4AC5B] uppercase">Réservation</span>
                <h2 className="mt-1 text-xl sm:text-2xl font-light text-white">Choisis ton Full Pass</h2>
              </div>
              <span className={`text-sm ${lockMode ? 'text-[#F0D38A]' : 'text-gray-400'}`}>
                {lockMode ? 'Mode Price Lock : seule la caution sera facturée aujourd\u2019hui' : 'Tarif affiché selon la disponibilité'}
              </span>
            </div>

            <div className="space-y-4">
              {event.event_ticket_types
                ?.filter(ett => ett.is_active)
                .sort((a, b) => a.display_order - b.display_order)
                .map((ett) => {
                  const price = currentPrice(ett);
                  const next = nextPrice(ett);
                  const nextAt = nextPriceChangeAt(ett);
                  const lockOk = priceLockAvailable(ett);
                  const lockDeposit = Number(ett.price_lock_deposit_amount ?? 0);
                  const available = ett.quantity_available !== null
                    ? ett.quantity_available - ett.quantity_sold
                    : 999;
                  const selection = selections.find(s => s.eventTicketTypeId === ett.id);
                  const selectedQty = selection?.quantity || 0;

                  return (
                    <div
                      key={ett.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700 hover:border-[#B8913D] transition-all gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-medium text-white mb-2">
                          {ett.ticket_type.name}
                        </h3>
                        {ett.ticket_type.description && (
                          <p className="text-sm text-gray-400 mb-3">{ett.ticket_type.description}</p>
                        )}
                        {ett.features && Array.isArray(ett.features) && ett.features.length > 0 && (
                          <ul className="space-y-1">
                            {(ett.features as string[]).map((feature, idx) => (
                              <li key={idx} className="flex items-center space-x-2 text-sm text-gray-300">
                                <Check className="w-4 h-4 text-[#B8913D] shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                        <div className="text-left sm:text-right">
                          <div className="text-xl font-bold text-[#B8913D]">{price.toFixed(2)}€</div>
                          {next !== null && nextAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              → {next.toFixed(2)}€ le {nextAt.toLocaleDateString('fr-FR')}
                            </p>
                          )}
                          {lockOk && lockDeposit > 0 && (
                            <p className="text-xs text-[#F0D38A] mt-0.5 flex items-center sm:justify-end gap-1">
                              <Lock className="w-3 h-3" /> Price Lock : {lockDeposit.toFixed(0)} €
                            </p>
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
                    <p className="text-gray-400">
                      {lockMode ? `Total aujourd'hui (${getTotalQuantity()} caution${getTotalQuantity() > 1 ? 's' : ''} Price Lock)` : `Total (${getTotalQuantity()} billets)`}
                    </p>
                    <p className="text-3xl font-bold text-[#B8913D]">{getLockTotalPrice().toFixed(2)}€</p>
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
        )}

        {!isUpcoming && (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-[#D4AC5B]" />
                <h2 className="font-semibold text-white">Programme</h2>
              </div>
              <ul className="space-y-2.5 text-sm leading-relaxed text-gray-400">
                {MOCK_PROGRAM.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Music className="h-5 w-5 text-[#D4AC5B]" />
                <h2 className="font-semibold text-white">Line-up</h2>
              </div>
              <ul className="space-y-2.5 text-sm leading-relaxed text-gray-400">
                {MOCK_LINEUP.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Info className="h-5 w-5 text-[#D4AC5B]" />
                <h2 className="font-semibold text-white">Informations pratiques</h2>
              </div>
              <ul className="space-y-2.5 text-sm leading-relaxed text-gray-400">
                <li>Accès Full Pass inclus</li>
                <li>Horaires détaillés communiqués avant l’événement</li>
                <li>Billet nominatif à présenter à l’accueil</li>
              </ul>
            </section>
          </div>
        )}
      </div>

      {!isUpcoming && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4AC5B]/20 bg-gray-950/95 px-4 py-3 backdrop-blur-xl sm:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#D4AC5B] uppercase">Nexa Pass</p>
              <p className="text-lg font-bold text-white">
                {(() => {
                  const tickets = (event.event_ticket_types || []).filter(ett => ett.is_active);
                  if (tickets.length === 0) return null;
                  return `À partir de ${Math.round(Math.min(...tickets.map(t => currentPrice(t))))} €`;
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToPurchase}
              className="rounded-xl bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] px-6 py-3 text-sm font-bold text-white shadow-[0_6px_20px_rgba(184,145,61,0.2)]"
            >
              Réserver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
