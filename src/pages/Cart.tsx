import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { ShoppingCart, Trash2, Plus, Minus, Check, AlertCircle, ShoppingBag, Ticket, Calendar } from 'lucide-react';
import { handleOrderCheckout } from '../lib/stripe';
import { validateAndCreateOrder } from '../lib/orderService';

interface CartProps {
  onNavigate: (page: string) => void;
}

export function Cart({ onNavigate }: CartProps) {
  const { user, profile } = useAuth();
  const { cart, eventTickets, updateQuantity, updateEventTicketQuantity, removeFromCart, removeEventTicketFromCart, clearCart, getCartTotal } = useCart();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [shippingInfo, setShippingInfo] = useState({
    name: profile?.full_name || '',
    email: profile?.email || '',
    phone: '',
    address: '',
    notes: '',
  });

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

  const handleCheckout = async () => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    if (cart.length === 0 && eventTickets.length === 0) {
      setError(t('cart.errors.empty'));
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
      });

      const checkoutItems = orderResponse.validated_items.map((item) => ({
        id: item.product_id || item.event_ticket_type_id || '',
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
        metadata: item.details,
      }));

      clearCart();
      await handleOrderCheckout(orderResponse.order_id, checkoutItems);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

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

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-light text-gray-900 mb-4">{t('cart.success.title')}</h2>
            <p className="text-gray-600 mb-8">
              {t('cart.success.message')}
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => onNavigate('shop')}
                className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('cart.success.continueShopping')}
              </button>
              <button
                onClick={() => onNavigate('account')}
                className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {t('cart.success.viewOrders')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-72 h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-72 h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            {t('cart.header.your')} <span className="text-[#B8913D]">{t('cart.header.cart')}</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {cart.length === 0 && eventTickets.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">{t('cart.empty.title')}</h3>
            <p className="text-gray-400 mb-6">{t('cart.empty.message')}</p>
            <div className="flex justify-center space-x-4">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {eventTickets.map((ticket) => {
                const price = isMember && ticket.eventTicketType.member_price > 0
                  ? ticket.eventTicketType.member_price
                  : ticket.eventTicketType.price;
                const itemTotal = price * ticket.quantity;

                return (
                  <div
                    key={ticket.eventTicketType.id}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-[#B8913D] border-opacity-50"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-24 h-24 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <Ticket className="w-12 h-12 text-[#B8913D]" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Calendar className="w-4 h-4 text-[#B8913D]" />
                          <span className="text-sm text-[#B8913D]">Billet d'événement</span>
                        </div>
                        <h3 className="text-lg font-medium text-white">{ticket.eventTicketType.event.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {ticket.eventTicketType.ticket_type.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(ticket.eventTicketType.event.start_date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <div className="mt-2">
                          <span className="text-lg font-bold text-[#B8913D]">
                            {price.toFixed(2)}€
                          </span>
                          {isMember && ticket.eventTicketType.member_price > 0 && ticket.eventTicketType.member_price < ticket.eventTicketType.price && (
                            <span className="ml-2 text-sm text-gray-400 line-through">
                              {ticket.eventTicketType.price.toFixed(2)}€
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateEventTicketQuantity(ticket.eventTicketType.id, ticket.quantity - 1)}
                          className="p-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium text-white">{ticket.quantity}</span>
                        <button
                          onClick={() => updateEventTicketQuantity(ticket.eventTicketType.id, ticket.quantity + 1)}
                          className="p-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeEventTicketFromCart(ticket.eventTicketType.id)}
                          className="p-2 text-red-400 hover:bg-red-900 hover:bg-opacity-20 rounded-lg transition-colors ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                      <span className="text-sm text-gray-400">{t('cart.item.subtotal')}</span>
                      <span className="text-lg font-bold text-white">{itemTotal.toFixed(2)}€</span>
                    </div>
                  </div>
                );
              })}

              {cart.map((item, index) => {
                const price = getItemPrice(item);
                const itemTotal = price * item.quantity;
                let originalPrice = item.product.price;

                if (item.product.category === 'event_pass' && item.product.details?.ticket_categories && item.selectedSize) {
                  const category = (item.product.details.ticket_categories as any[]).find(
                    (cat: any) => cat.name === item.selectedSize
                  );
                  if (category) {
                    originalPrice = category.price;
                  }
                }

                return (
                  <div
                    key={item.id || `cart-item-${index}`}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-white">{item.product.name}</h3>
                        {item.selectedSize && (
                          <p className="text-sm text-gray-400 mt-1">
                            {item.product.category === 'event_pass' ? t('cart.item.category') : t('cart.item.size')}: {item.selectedSize}
                          </p>
                        )}
                        <div className="mt-2">
                          <span className="text-lg font-bold text-[#B8913D]">
                            {price.toFixed(2)}€
                          </span>
                          {isMember && originalPrice > price && (
                            <span className="ml-2 text-sm text-gray-400 line-through">
                              {originalPrice.toFixed(2)}€
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
                          className="p-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
                          className="p-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedSize)}
                          className="p-2 text-red-400 hover:bg-red-900 hover:bg-opacity-20 rounded-lg transition-colors ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                      <span className="text-sm text-gray-400">{t('cart.item.subtotal')}</span>
                      <span className="text-lg font-bold text-white">{itemTotal.toFixed(2)}€</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50 sticky top-24">
                <h3 className="text-xl font-medium text-white mb-6">{t('cart.summary.title')}</h3>

                <div className="space-y-3 mb-6 pb-6 border-b border-gray-700/50">
                  <div className="flex justify-between text-gray-400">
                    <span>{t('cart.summary.subtotal')}</span>
                    <span>{total.toFixed(2)}€</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('cart.summary.memberSavings')}</span>
                      <span>-{savings.toFixed(2)}€</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-xl font-bold text-white mb-6">
                  <span>{t('cart.summary.total')}</span>
                  <span className="text-[#B8913D]">{total.toFixed(2)}€</span>
                </div>

                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    placeholder={t('cart.summary.fullName')}
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                  />
                  <input
                    type="email"
                    placeholder={t('cart.summary.email')}
                    value={shippingInfo.email}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                  />
                  <input
                    type="tel"
                    placeholder={t('cart.summary.phone')}
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                  />
                  {cart.length > 0 && (
                    <textarea
                      placeholder={t('cart.summary.shippingAddress')}
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    />
                  )}
                  <textarea
                    placeholder={t('cart.summary.orderNotes')}
                    value={shippingInfo.notes}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                  />
                </div>

                {eventTickets.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-900 bg-opacity-30 border border-blue-600 border-opacity-40 rounded-lg">
                    <p className="text-sm text-blue-300">
                      Vous devrez fournir les informations des participants après le paiement.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('cart.summary.processing') : t('cart.summary.placeOrder')}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  {t('cart.summary.manualNote')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
