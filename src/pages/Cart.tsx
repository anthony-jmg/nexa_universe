import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import {
  ShoppingCart, Trash2, Plus, Minus, ShoppingBag,
  Ticket, Calendar, AlertCircle, ChevronRight, User, CreditCard, ArrowLeft
} from 'lucide-react';
import { handleOrderCheckout } from '../lib/stripe';
import { validateAndCreateOrder } from '../lib/orderService';

interface CartProps {
  onNavigate: (page: string) => void;
}

interface AttendeeInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type Step = 'cart' | 'attendees' | 'contact';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'cart', label: 'Panier', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'attendees', label: 'Participants', icon: <User className="w-4 h-4" /> },
  { id: 'contact', label: 'Paiement', icon: <CreditCard className="w-4 h-4" /> },
];

export function Cart({ onNavigate }: CartProps) {
  const { user, profile } = useAuth();
  const { cart, eventTickets, updateQuantity, updateEventTicketQuantity, removeFromCart, removeEventTicketFromCart, clearCart } = useCart();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('cart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [shippingInfo, setShippingInfo] = useState({
    name: profile?.full_name || '',
    email: profile?.email || '',
    phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (profile) {
      setShippingInfo(prev => ({
        ...prev,
        name: prev.name || profile.full_name || '',
        email: prev.email || profile.email || '',
      }));
    }
  }, [profile]);

  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);

  const isMember = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  const getItemPrice = (item: any) => {
    if (item.product.category === 'event_pass' && item.product.details?.ticket_categories && item.selectedSize) {
      const category = (item.product.details.ticket_categories as any[]).find(
        (cat: any) => cat.name === item.selectedSize
      );
      if (category) {
        return isMember && category.member_price > 0 ? category.member_price : category.price;
      }
    }
    return isMember ? item.product.member_price : item.product.price;
  };

  const productsTotal = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
  const eventTicketsTotal = eventTickets.reduce((sum, ticket) => {
    const price = isMember && ticket.eventTicketType.member_price > 0
      ? ticket.eventTicketType.member_price
      : ticket.eventTicketType.price;
    return sum + price * ticket.quantity;
  }, 0);
  const total = productsTotal + eventTicketsTotal;

  const productsSavings = isMember ? cart.reduce((sum, item) => {
    if (item.product.category === 'event_pass' && item.product.details?.ticket_categories && item.selectedSize) {
      const category = (item.product.details.ticket_categories as any[]).find(
        (cat: any) => cat.name === item.selectedSize
      );
      if (category && category.member_price > 0) {
        return sum + (category.price - category.member_price) * item.quantity;
      }
      return sum;
    }
    return sum + (item.product.price - item.product.member_price) * item.quantity;
  }, 0) : 0;

  const eventTicketsSavings = isMember ? eventTickets.reduce((sum, ticket) => {
    if (ticket.eventTicketType.member_price > 0 && ticket.eventTicketType.member_price < ticket.eventTicketType.price) {
      return sum + (ticket.eventTicketType.price - ticket.eventTicketType.member_price) * ticket.quantity;
    }
    return sum;
  }, 0) : 0;

  const savings = productsSavings + eventTicketsSavings;

  const totalTicketCount = eventTickets.reduce((sum, t) => sum + t.quantity, 0);

  const initAttendees = () => {
    const existing = attendees.length;
    if (existing !== totalTicketCount) {
      setAttendees(Array.from({ length: totalTicketCount }, (_, i) => attendees[i] || {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
      }));
    }
  };

  const goToAttendees = () => {
    if (cart.length === 0 && eventTickets.length === 0) {
      setError(t('cart.errors.empty'));
      return;
    }
    setError('');
    if (eventTickets.length > 0) {
      initAttendees();
      setStep('attendees');
    } else {
      setStep('contact');
    }
  };

  const goToContact = () => {
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      if (!a.firstName.trim() || !a.lastName.trim()) {
        setError(`Veuillez renseigner le prénom et nom du participant ${i + 1}`);
        return;
      }
    }
    setError('');
    setStep('contact');
  };

  const handleUseMyInfo = (index: number) => {
    if (!profile) return;
    const parts = (profile.full_name || '').split(' ');
    const updated = [...attendees];
    updated[index] = {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: profile.email || '',
      phone: '',
    };
    setAttendees(updated);
  };

  const updateAttendee = (index: number, field: keyof AttendeeInfo, value: string) => {
    const updated = [...attendees];
    updated[index] = { ...updated[index], [field]: value };
    setAttendees(updated);
  };

  const handleCheckout = async () => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const requiresShipping = cart.length > 0;

    if (requiresShipping && (!shippingInfo.name || !shippingInfo.email || !shippingInfo.address)) {
      setError(t('cart.errors.shippingRequired'));
      return;
    }

    if (!requiresShipping && (!shippingInfo.name || !shippingInfo.email)) {
      setError('Nom et email requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const items = [
        ...cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          selected_size: item.selectedSize,
        })),
        ...eventTickets.map((ticket) => ({
          event_ticket_type_id: ticket.eventTicketType.id,
          quantity: ticket.quantity,
        })),
      ];

      const orderResponse = await validateAndCreateOrder({
        items,
        shipping_info: {
          name: shippingInfo.name,
          email: shippingInfo.email,
          phone: shippingInfo.phone,
          address: shippingInfo.address,
          notes: shippingInfo.notes,
        },
        attendees_by_ticket: buildAttendeesByTicket(),
      });

      const checkoutItems = orderResponse.validated_items.map((item) => ({
        id: item.product_id || item.event_ticket_type_id || '',
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
        metadata: item.details,
      }));

      localStorage.setItem('pendingOrderId', orderResponse.order_id);
      localStorage.setItem('pendingEventTickets', JSON.stringify(eventTickets));
      localStorage.setItem('pendingAttendees', JSON.stringify(attendees));

      clearCart();
      await handleOrderCheckout(orderResponse.order_id, checkoutItems);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const buildAttendeesByTicket = () => {
    const result: Record<string, AttendeeInfo[]> = {};
    let offset = 0;
    for (const ticket of eventTickets) {
      result[ticket.eventTicketType.id] = attendees.slice(offset, offset + ticket.quantity);
      offset += ticket.quantity;
    }
    return result;
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const visibleSteps = eventTickets.length > 0 ? STEPS : STEPS.filter(s => s.id !== 'attendees');

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-12">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-light text-gray-900 mb-4">{t('cart.notSignedIn.message')}</h2>
          <button
            onClick={() => onNavigate('signin')}
            className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-lg transition-all"
          >
            {t('cart.notSignedIn.button')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-72 h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl" />
      <div className="absolute bottom-40 left-0 w-72 h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            {t('cart.header.your')} <span className="text-[#B8913D]">{t('cart.header.cart')}</span>
          </h1>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full" />
          </div>

          {(cart.length > 0 || eventTickets.length > 0) && (
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              {visibleSteps.map((s, i) => {
                const currentIdx = visibleSteps.findIndex(vs => vs.id === step);
                const isDone = i < currentIdx;
                const isActive = s.id === step;
                return (
                  <div key={s.id} className="flex items-center gap-2 sm:gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#B8913D] text-white'
                        : isDone
                          ? 'bg-green-700 text-white'
                          : 'bg-gray-800 text-gray-400'
                    }`}>
                      {s.icon}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < visibleSteps.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900 bg-opacity-40 border border-red-600 border-opacity-40 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {cart.length === 0 && eventTickets.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">{t('cart.empty.title')}</h3>
            <p className="text-gray-400 mb-6">{t('cart.empty.message')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => onNavigate('shop')}
                className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {t('cart.empty.button')}
              </button>
              <button
                onClick={() => onNavigate('events')}
                className="px-8 py-3 border border-[#B8913D] text-[#B8913D] rounded-lg hover:bg-[#B8913D] hover:text-white transition-all"
              >
                Voir les événements
              </button>
            </div>
          </div>
        ) : (
          <>
            {step === 'cart' && (
              <StepCart
                cart={cart}
                eventTickets={eventTickets}
                isMember={isMember}
                getItemPrice={getItemPrice}
                productsTotal={productsTotal}
                eventTicketsTotal={eventTicketsTotal}
                total={total}
                savings={savings}
                updateQuantity={updateQuantity}
                updateEventTicketQuantity={updateEventTicketQuantity}
                removeFromCart={removeFromCart}
                removeEventTicketFromCart={removeEventTicketFromCart}
                onNext={goToAttendees}
                onNavigate={onNavigate}
                t={t}
              />
            )}

            {step === 'attendees' && (
              <StepAttendees
                eventTickets={eventTickets}
                attendees={attendees}
                onUpdateAttendee={updateAttendee}
                onUseMyInfo={handleUseMyInfo}
                onBack={() => { setError(''); setStep('cart'); }}
                onNext={goToContact}
                error={error}
              />
            )}

            {step === 'contact' && (
              <StepContact
                cart={cart}
                eventTickets={eventTickets}
                isMember={isMember}
                getItemPrice={getItemPrice}
                total={total}
                savings={savings}
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                loading={loading}
                onBack={() => { setError(''); setStep(eventTickets.length > 0 ? 'attendees' : 'cart'); }}
                onCheckout={handleCheckout}
                t={t}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepCart({
  cart, eventTickets, isMember, getItemPrice, productsTotal, eventTicketsTotal, total, savings,
  updateQuantity, updateEventTicketQuantity, removeFromCart, removeEventTicketFromCart, onNext, onNavigate, t
}: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {eventTickets.map((ticket: any) => {
          const price = isMember && ticket.eventTicketType.member_price > 0
            ? ticket.eventTicketType.member_price
            : ticket.eventTicketType.price;

          return (
            <div key={ticket.eventTicketType.id} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-[#B8913D] border-opacity-50">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-7 h-7 text-[#B8913D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#B8913D]" />
                    <span className="text-xs text-[#B8913D] font-medium">Billet d'événement</span>
                  </div>
                  <h3 className="text-base font-medium text-white">{ticket.eventTicketType.event.title}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{ticket.eventTicketType.ticket_type.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(ticket.eventTicketType.event.start_date).toLocaleDateString('fr-FR', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateEventTicketQuantity(ticket.eventTicketType.id, ticket.quantity - 1)}
                        className="p-1.5 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-medium text-white text-sm">{ticket.quantity}</span>
                      <button
                        onClick={() => updateEventTicketQuantity(ticket.eventTicketType.id, ticket.quantity + 1)}
                        className="p-1.5 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeEventTicketFromCart(ticket.eventTicketType.id)}
                        className="p-1.5 text-red-400 hover:bg-red-900 hover:bg-opacity-20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-[#B8913D]">{(price * ticket.quantity).toFixed(2)}€</span>
                      {isMember && ticket.eventTicketType.member_price > 0 && ticket.eventTicketType.member_price < ticket.eventTicketType.price && (
                        <p className="text-xs text-gray-400 line-through">{(ticket.eventTicketType.price * ticket.quantity).toFixed(2)}€</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {cart.map((item: any, index: number) => {
          const price = getItemPrice(item);
          const originalPrice = item.product.category === 'event_pass' && item.product.details?.ticket_categories && item.selectedSize
            ? ((item.product.details.ticket_categories as any[]).find((c: any) => c.name === item.selectedSize)?.price || item.product.price)
            : item.product.price;

          return (
            <div key={item.id || `cart-item-${index}`} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => onNavigate(`shop-${item.product.id}`)}
                  className="w-14 h-14 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                  {item.product.image_url
                    ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-gray-400" /></div>
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onNavigate(`shop-${item.product.id}`)}
                    className="text-base font-medium text-white hover:text-[#B8913D] transition-colors text-left"
                  >
                    {item.product.name}
                  </button>
                  {item.selectedSize && (
                    <p className="text-sm text-gray-400 mt-0.5">
                      {item.product.category === 'event_pass' ? t('cart.item.category') : t('cart.item.size')}: {item.selectedSize}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
                        className="p-1.5 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-medium text-white text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
                        className="p-1.5 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id, item.selectedSize)}
                        className="p-1.5 text-red-400 hover:bg-red-900 hover:bg-opacity-20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-[#B8913D]">{(price * item.quantity).toFixed(2)}€</span>
                      {isMember && originalPrice > price && (
                        <p className="text-xs text-gray-400 line-through">{(originalPrice * item.quantity).toFixed(2)}€</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-gray-400 text-sm">
            <span>Sous-total</span>
            <span>{total.toFixed(2)}€</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-green-400 text-sm">
              <span>Économies membre</span>
              <span>-{savings.toFixed(2)}€</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-gray-700">
            <span>Total</span>
            <span className="text-[#B8913D]">{total.toFixed(2)}€</span>
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-4 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/30 transition-all font-medium flex items-center justify-center gap-2"
        >
          <span>Continuer</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function StepAttendees({ eventTickets, attendees, onUpdateAttendee, onUseMyInfo, onBack, onNext, error: _error }: any) {
  let ticketIndex = 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-gray-400 text-center text-sm">
        Les billets sont nominatifs. Renseignez le nom de chaque participant.
      </p>

      {eventTickets.map((ticket: any) => {
        const slots = Array.from({ length: ticket.quantity }, (_, i) => {
          const idx = ticketIndex + i;
          return { idx, attendee: attendees[idx] || { firstName: '', lastName: '', email: '', phone: '' } };
        });
        ticketIndex += ticket.quantity;

        return (
          <div key={ticket.eventTicketType.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#B8913D] bg-opacity-20 rounded-lg flex items-center justify-center">
                <Ticket className="w-4 h-4 text-[#B8913D]" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{ticket.eventTicketType.event.title}</p>
                <p className="text-gray-400 text-xs">{ticket.eventTicketType.ticket_type.name}</p>
              </div>
            </div>

            {slots.map(({ idx, attendee }) => (
              <div key={idx} className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-700/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#B8913D] bg-opacity-20 flex items-center justify-center">
                      <span className="text-[#B8913D] text-xs font-bold">{idx + 1}</span>
                    </div>
                    <span className="text-white text-sm font-medium">Participant {idx + 1}</span>
                  </div>
                  <button
                    onClick={() => onUseMyInfo(idx)}
                    className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-[#B8913D] text-gray-300 hover:text-white rounded-lg transition-all"
                  >
                    Mes informations
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Prénom <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={attendee.firstName}
                      onChange={(e) => onUpdateAttendee(idx, 'firstName', e.target.value)}
                      placeholder="Prénom"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Nom <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={attendee.lastName}
                      onChange={(e) => onUpdateAttendee(idx, 'lastName', e.target.value)}
                      placeholder="Nom"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={attendee.email}
                      onChange={(e) => onUpdateAttendee(idx, 'email', e.target.value)}
                      placeholder="email@exemple.com"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/30 transition-all font-medium flex items-center justify-center gap-2"
        >
          <span>Continuer</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function StepContact({ cart, eventTickets, isMember, getItemPrice, total, savings, shippingInfo, setShippingInfo, loading, onBack, onCheckout, t }: any) {
  const requiresShipping = cart.length > 0;

  const productsSubtotal = cart.reduce((sum: number, item: any) => sum + getItemPrice(item) * item.quantity, 0);
  const ticketsSubtotal = eventTickets.reduce((sum: number, ticket: any) => {
    const price = isMember && ticket.eventTicketType.member_price > 0
      ? ticket.eventTicketType.member_price
      : ticket.eventTicketType.price;
    return sum + price * ticket.quantity;
  }, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#B8913D]" />
          Vos coordonnées
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nom complet *"
            value={shippingInfo.name}
            onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
          />
          <input
            type="email"
            placeholder="Email *"
            value={shippingInfo.email}
            onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
          />
          <input
            type="tel"
            placeholder="Téléphone"
            value={shippingInfo.phone}
            onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
          />
          {requiresShipping && (
            <textarea
              placeholder="Adresse de livraison *"
              value={shippingInfo.address}
              onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none resize-none"
            />
          )}
          <textarea
            placeholder="Notes (optionnel)"
            value={shippingInfo.notes}
            onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none resize-none"
          />
        </div>
      </div>

      <div className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-medium mb-4">Récapitulatif</h3>
        <div className="space-y-2 text-sm">
          {cart.length > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Produits ({cart.reduce((s: number, i: any) => s + i.quantity, 0)} articles)</span>
              <span>{productsSubtotal.toFixed(2)}€</span>
            </div>
          )}
          {eventTickets.length > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Billets ({eventTickets.reduce((s: number, t: any) => s + t.quantity, 0)} billets)</span>
              <span>{ticketsSubtotal.toFixed(2)}€</span>
            </div>
          )}
          {savings > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Économies membre</span>
              <span>-{savings.toFixed(2)}€</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-gray-700">
            <span>Total</span>
            <span className="text-[#B8913D]">{total.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <button
          onClick={onCheckout}
          disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/30 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>Traitement...</span>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>Payer {total.toFixed(2)}€</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
