import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { ShoppingBag, Calendar, MapPin, Shirt, Check, ShoppingCart, Search, X, Clock, Users, Ticket, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

type Product = Database['public']['Tables']['products']['Row'];
type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_type: TicketType;
};

interface EventWithTickets extends Event {
  event_ticket_types: EventTicketType[];
}

interface ShopProps {
  onNavigate: (page: string) => void;
}

export function Shop({ onNavigate }: ShopProps) {
  const { user, profile } = useAuth();
  const { addToCart, addEventTicketToCart, getCartCount } = useCart();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'merchandise' | 'events'>('merchandise');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithTickets | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [priceRange, setPriceRange] = useState<'all' | 'under25' | '25to50' | 'over50'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const itemsPerPage = 12;

  const isMember = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  useEffect(() => {
    if (filter === 'merchandise') {
      loadProducts();
    } else {
      loadEvents();
    }
  }, [filter, currentPage, debouncedSearchQuery, priceRange]);

  const loadProducts = async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .eq('category', 'merchandise');

    if (debouncedSearchQuery.trim()) {
      query = query.or(`name.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    query = query
      .order('order_index')
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + itemsPerPage - 1);

    const productsResult = await query;

    if (!productsResult.error && productsResult.data) {
      setProducts(productsResult.data);
      setTotalProductsCount(productsResult.count || 0);
    }

    setLoading(false);
  };

  const loadEvents = async () => {
    setLoading(true);

    let query = supabase
      .from('events')
      .select(`
        *,
        event_ticket_types (
          *,
          ticket_type:ticket_types (*)
        )
      `, { count: 'exact' })
      .eq('event_status', 'published')
      .eq('is_active', true)
      .gte('start_date', new Date().toISOString());

    if (debouncedSearchQuery.trim()) {
      query = query.or(`title.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    query = query
      .order('start_date', { ascending: true })
      .range(startIndex, startIndex + itemsPerPage - 1);

    const eventsResult = await query;

    if (!eventsResult.error && eventsResult.data) {
      setEvents(eventsResult.data as any);
      setTotalEventsCount(eventsResult.count || 0);
    }

    setLoading(false);
  };

  const getMinEventPrice = useCallback((event: EventWithTickets) => {
    if (!event.event_ticket_types || event.event_ticket_types.length === 0) return null;

    const prices = event.event_ticket_types
      .filter(ett => ett.is_active)
      .map(ett => ett.price);

    return prices.length > 0 ? Math.min(...prices) : null;
  }, []);

  const getMinMemberPrice = useCallback((event: EventWithTickets) => {
    if (!event.event_ticket_types || event.event_ticket_types.length === 0) return null;

    const memberPrices = event.event_ticket_types
      .filter(ett => ett.is_active && ett.member_price > 0)
      .map(ett => ett.member_price);

    return memberPrices.length > 0 ? Math.min(...memberPrices) : null;
  }, []);

  const getAvailableTickets = useCallback((event: EventWithTickets) => {
    if (!event.event_ticket_types) return 0;

    return event.event_ticket_types
      .filter(ett => ett.is_active)
      .reduce((total, ett) => {
        if (ett.quantity_available === null) return total + 999;
        return total + (ett.quantity_available - ett.quantity_sold);
      }, 0);
  }, []);

  const filteredProducts = useMemo(() => {
    if (filter !== 'merchandise' || priceRange === 'all') return products;

    return products.filter((product) => {
      const price = isMember ? product.member_price : product.price;
      const matchesPrice =
        priceRange === 'all' ||
        (priceRange === 'under25' && price < 25) ||
        (priceRange === '25to50' && price >= 25 && price <= 50) ||
        (priceRange === 'over50' && price > 50);

      return matchesPrice;
    });
  }, [products, filter, isMember, priceRange]);

  const filteredEvents = useMemo(() => {
    if (filter !== 'events' || priceRange === 'all') return events;

    return events.filter((event) => {
      const minPrice = getMinEventPrice(event);
      const matchesPrice =
        priceRange === 'all' ||
        (minPrice !== null && (
          (priceRange === 'under25' && minPrice < 25) ||
          (priceRange === '25to50' && minPrice >= 25 && minPrice <= 50) ||
          (priceRange === 'over50' && minPrice > 50)
        ));

      return matchesPrice;
    });
  }, [events, priceRange, getMinEventPrice, filter]);

  const currentItems = useMemo(() => {
    return filter === 'merchandise' ? filteredProducts : filteredEvents;
  }, [filter, filteredProducts, filteredEvents]);

  const totalPages = useMemo(() => {
    if (filter === 'merchandise') {
      return Math.ceil(totalProductsCount / itemsPerPage);
    }
    return Math.ceil(totalEventsCount / itemsPerPage);
  }, [filter, totalProductsCount, totalEventsCount, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearchQuery, priceRange]);

  const handleAddToCart = (product: Product, size?: string) => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const hasSizes = product.category === 'merchandise' &&
                     product.details &&
                     Array.isArray(product.details.sizes) &&
                     product.details.sizes.length > 0;

    if (hasSizes && !size) {
      setSelectedProduct(product);
      return;
    }

    addToCart(product, quantity, size);
    setSuccess(t('shop.success.addedToCart'));
    setSelectedProduct(null);
    setSelectedSize('');
    setQuantity(1);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleQuickAdd = () => {
    if (selectedProduct && selectedSize) {
      addToCart(selectedProduct, quantity, selectedSize);
      setSuccess(t('shop.success.addedToCart'));
      setSelectedProduct(null);
      setSelectedSize('');
      setQuantity(1);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleAddEventTicketToCart = (event: EventWithTickets, eventTicketTypeId?: string) => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    if (event.event_ticket_types && event.event_ticket_types.length > 1 && !eventTicketTypeId) {
      setSelectedEvent(event);
      setTicketQuantities({});
      return;
    }

    const ticketTypeId = eventTicketTypeId || event.event_ticket_types?.[0]?.id;
    if (ticketTypeId) {
      addEventTicketToCart(ticketTypeId, quantity);
      setSuccess('Billet ajouté au panier');
      setSelectedEvent(null);
      setQuantity(1);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleQuickAddEventTicket = () => {
    if (!selectedEvent) return;

    const ticketsToAdd = Object.entries(ticketQuantities).filter(([_, qty]) => qty > 0);

    if (ticketsToAdd.length === 0) return;

    ticketsToAdd.forEach(([ticketTypeId, qty]) => {
      addEventTicketToCart(ticketTypeId, qty);
    });

    const totalTickets = ticketsToAdd.reduce((sum, [_, qty]) => sum + qty, 0);
    setSuccess(`${totalTickets} billet${totalTickets > 1 ? 's' : ''} ajouté${totalTickets > 1 ? 's' : ''} au panier`);
    setSelectedEvent(null);
    setTicketQuantities({});
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-48 h-48 sm:w-72 sm:h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-48 h-48 sm:w-72 sm:h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-4 sm:mb-8 text-center">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-light text-white mb-1.5 sm:mb-2 px-2">
            {t('shop.header.brand')} <span className="text-[#B8913D]">{t('shop.header.title')}</span>
          </h1>
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-10 sm:w-16 h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-xs sm:text-base text-gray-400 px-2">{t('shop.header.subtitle')}</p>
          {isMember && (
            <div className="mt-2 sm:mt-4 inline-flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1 sm:px-4 sm:py-2 bg-[#B8913D] bg-opacity-10 rounded-full">
              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-[#B8913D]" />
              <span className="text-xs sm:text-sm font-medium text-[#B8913D]">{t('shop.header.memberActive')}</span>
            </div>
          )}
        </div>

        {success && (
          <div className="mb-3 sm:mb-6 p-2.5 sm:p-4 bg-green-900 bg-opacity-40 backdrop-blur-sm border border-green-600 border-opacity-40 rounded-lg sm:rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-400" />
              <p className="text-xs sm:text-sm text-green-300">{success}</p>
            </div>
            <button
              onClick={() => onNavigate('cart')}
              className="w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-xs sm:text-sm rounded-lg hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 sm:space-x-2"
            >
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{t('shop.success.viewCart')} ({getCartCount()})</span>
            </button>
          </div>
        )}

        <div className="mb-4 sm:mb-8 space-y-2.5 sm:space-y-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-2.5 sm:left-4 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] transition-all group-focus-within:text-[#D4AC5B]" />
              <input
                type="text"
                placeholder={t('shop.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-12 pr-9 sm:pr-12 py-2.5 sm:py-4 text-xs sm:text-base bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 rounded-full text-white placeholder-gray-400 focus:ring-2 focus:ring-[#B8913D] focus:border-[#D4AC5B] focus:bg-opacity-80 outline-none shadow-lg hover:border-opacity-50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 sm:right-4 top-1/2 transform -translate-y-1/2 text-[#B8913D] hover:text-[#D4AC5B] transition-colors"
                >
                  <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="inline-flex flex-wrap gap-1 sm:gap-2 justify-center items-center bg-gray-900 bg-opacity-40 backdrop-blur-sm px-2 py-1.5 sm:px-6 sm:py-3 rounded-full border border-[#B8913D] border-opacity-20">
              <span className="text-[10px] sm:text-sm font-medium text-gray-400 mr-0.5 sm:mr-2 w-full sm:w-auto text-center sm:text-left mb-1 sm:mb-0">{t('shop.filters.priceLabel')}</span>
              <button
                onClick={() => setPriceRange('all')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium transition-all ${
                  priceRange === 'all'
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                    : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:text-white hover:bg-opacity-70 border border-[#B8913D] border-opacity-20'
                }`}
              >
                {t('shop.filters.all')}
              </button>
              <button
                onClick={() => setPriceRange('under25')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium transition-all ${
                  priceRange === 'under25'
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                    : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:text-white hover:bg-opacity-70 border border-[#B8913D] border-opacity-20'
                }`}
              >
                {t('shop.filters.under25')}
              </button>
              <button
                onClick={() => setPriceRange('25to50')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium transition-all ${
                  priceRange === '25to50'
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                    : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:text-white hover:bg-opacity-70 border border-[#B8913D] border-opacity-20'
                }`}
              >
                {t('shop.filters.range25to50')}
              </button>
              <button
                onClick={() => setPriceRange('over50')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium transition-all ${
                  priceRange === 'over50'
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                    : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:text-white hover:bg-opacity-70 border border-[#B8913D] border-opacity-20'
                }`}
              >
                {t('shop.filters.over50')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-4 sm:mb-8">
          <div className="inline-flex space-x-1.5 sm:space-x-3 p-1 sm:p-2 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-full shadow-lg border border-[#B8913D] border-opacity-30">
            <button
              onClick={() => setFilter('merchandise')}
              className={`px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1 sm:space-x-2 ${
                filter === 'merchandise'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <Shirt className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{t('shop.tabs.merchandise')}</span>
            </button>
            <button
              onClick={() => setFilter('events')}
              className={`px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1 sm:space-x-2 ${
                filter === 'events'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <Ticket className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Événements</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filter === 'events' ? (
          filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30">
              <Calendar className="w-16 h-16 text-[#B8913D] opacity-50 mx-auto mb-4" />
              <p className="text-gray-300">
                {searchQuery || priceRange !== 'all'
                  ? 'Aucun événement ne correspond à vos filtres'
                  : 'Aucun événement disponible pour le moment'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                {(currentItems as EventWithTickets[]).map((event) => {
                const minPrice = getMinEventPrice(event);
                const minMemberPrice = getMinMemberPrice(event);
                const availableTickets = getAvailableTickets(event);
                const eventDate = new Date(event.start_date);
                const isAlmostFull = event.max_attendees && availableTickets < event.max_attendees * 0.2;

                return (
                  <div
                    key={event.id}
                    className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-[#B8913D] border-opacity-30"
                  >
                    <div className="relative h-48 sm:h-64 bg-gray-800 overflow-hidden">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Calendar className="w-12 h-12 sm:w-20 sm:h-20 text-[#B8913D] opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>

                      {isAlmostFull && (
                        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 px-2.5 py-1 sm:px-4 sm:py-2 bg-red-600 bg-opacity-90 text-white text-xs sm:text-sm font-bold rounded-full shadow-lg">
                          Places limitées
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-6">
                      <h3 className="text-lg sm:text-2xl font-medium text-white mb-2 sm:mb-3 group-hover:text-[#B8913D] transition-colors">
                        {event.title}
                      </h3>

                      <p className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                        {event.description}
                      </p>

                      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                        <div className="flex items-center space-x-2 sm:space-x-3 text-gray-300">
                          <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0" />
                          <span className="text-xs sm:text-sm">
                            {eventDate.toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 sm:space-x-3 text-gray-300">
                          <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0" />
                          <span className="text-xs sm:text-sm">
                            {eventDate.toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {event.location && (
                          <div className="flex items-center space-x-2 sm:space-x-3 text-gray-300">
                            <MapPin className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0" />
                            <span className="text-xs sm:text-sm">{event.location}</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 sm:space-x-3 text-gray-300">
                          <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0" />
                          <span className="text-xs sm:text-sm">
                            {availableTickets > 0 ? `${availableTickets} places disponibles` : 'Complet'}
                          </span>
                        </div>
                      </div>

                      {event.event_ticket_types && event.event_ticket_types.length > 0 && (
                        <div className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2">
                          <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">Types de billets disponibles</p>
                          {event.event_ticket_types.filter(ett => ett.is_active).map((ett) => {
                            const hasDiscount = ett.member_price > 0 && ett.member_price < ett.price;
                            const ticketsLeft = ett.quantity_available === null ? 999 : ett.quantity_available - ett.quantity_sold;

                            return (
                              <div key={ett.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700">
                                <div>
                                  <span className="text-xs sm:text-sm font-medium text-white">{ett.ticket_type.name}</span>
                                  {ticketsLeft < 10 && ticketsLeft > 0 && (
                                    <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs text-red-400">({ticketsLeft} restants)</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end">
                                  {hasDiscount ? (
                                    <>
                                      <span className="text-[10px] sm:text-xs text-gray-400 line-through">
                                        {ett.price.toFixed(2)}€
                                      </span>
                                      <span className="text-sm sm:text-lg font-bold text-[#B8913D]">
                                        {ett.member_price.toFixed(2)}€
                                      </span>
                                      <span className="text-[9px] sm:text-xs text-[#B8913D]">avec abonnement</span>
                                    </>
                                  ) : (
                                    <span className="text-sm sm:text-lg font-bold text-[#B8913D]">
                                      {ett.price.toFixed(2)}€
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-700">
                        <div>
                          {minPrice !== null ? (
                            <>
                              {minMemberPrice && minMemberPrice < minPrice ? (
                                <>
                                  <div className="flex items-baseline space-x-1 sm:space-x-2">
                                    <span className="text-[10px] sm:text-sm text-gray-400">Prix normal:</span>
                                    <span className="text-xs sm:text-base font-medium text-gray-400 line-through">
                                      {minPrice.toFixed(2)}€
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1 sm:space-x-2 mt-0.5 sm:mt-1">
                                    <span className="text-lg sm:text-2xl font-bold text-[#B8913D]">
                                      {minMemberPrice.toFixed(2)}€
                                    </span>
                                    <span className="text-[9px] sm:text-xs text-[#B8913D]">avec abo</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
                                  <span className="text-[10px] sm:text-sm text-gray-400">À partir de</span>
                                  <span className="text-lg sm:text-2xl font-bold text-[#B8913D]">
                                    {minPrice.toFixed(2)}€
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs sm:text-base text-gray-400">Prix à venir</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleAddEventTicketToCart(event)}
                          disabled={availableTickets === 0}
                          className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-medium transition-all flex items-center space-x-1 sm:space-x-2 ${
                            availableTickets === 0
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50 hover:scale-105'
                          }`}
                        >
                          <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{availableTickets === 0 ? 'Complet' : 'Réserver'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-all flex items-center space-x-1"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Précédent</span>
                  </button>

                  <span className="text-white px-2 sm:px-4 text-xs sm:text-base">
                    {currentPage}/{totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center space-x-1"
                  >
                    <span className="hidden sm:inline">Suivant</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              )}
            </>
          )
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30">
            <ShoppingBag className="w-16 h-16 text-[#B8913D] opacity-50 mx-auto mb-4" />
            <p className="text-gray-300">
              {searchQuery || priceRange !== 'all'
                ? t('shop.empty.filtered')
                : `${t('shop.empty.no')} ${filter === 'merchandise' ? t('shop.empty.product') : t('shop.empty.event')} ${t('shop.empty.available')}`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {(currentItems as Product[]).map((product) => {
              const price = isMember ? product.member_price : product.price;
              const originalPrice = product.price;
              const discount = isMember && product.member_price < product.price;

              return (
                <div
                  key={product.id}
                  className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-[#B8913D] border-opacity-30"
                >
                  <div className="relative h-48 sm:h-64 bg-gray-800 overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Shirt className="w-12 h-12 sm:w-16 sm:h-16 text-[#B8913D] opacity-50" />
                      </div>
                    )}
                    {discount && (
                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 px-2 py-0.5 sm:px-3 sm:py-1 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-[10px] sm:text-xs font-bold rounded-full shadow-lg">
                        {t('shop.product.memberBadge')}
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white text-xs sm:text-base font-medium rounded-lg">
                          {t('shop.product.outOfStock')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="mb-1.5 sm:mb-2">
                      <span className="inline-block px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                        {product.type}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-xl font-medium text-white mb-1.5 sm:mb-2">{product.name}</h3>
                    <p className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{product.description}</p>

                    {product.details && Array.isArray(product.details.sizes) && product.details.sizes.length > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">{t('shop.product.availableSizes')}</p>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {product.details.sizes.map((size: string) => (
                            <span
                              key={size}
                              className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gray-800 text-gray-300 text-[10px] sm:text-xs rounded border border-gray-700"
                            >
                              {size}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-end justify-between mb-3 sm:mb-4">
                      <div className="w-full">
                        {product.member_price < product.price ? (
                          <>
                            <div className="flex items-baseline space-x-1 sm:space-x-2">
                              <span className="text-[10px] sm:text-sm text-gray-400">Prix normal:</span>
                              <span className="text-xs sm:text-base font-medium text-gray-400 line-through">
                                {product.price.toFixed(2)}€
                              </span>
                            </div>
                            <div className="flex items-baseline space-x-1 sm:space-x-2 mt-0.5 sm:mt-1">
                              <span className="text-lg sm:text-2xl font-bold text-[#B8913D]">
                                {product.member_price.toFixed(2)}€
                              </span>
                              <span className="text-[9px] sm:text-xs text-[#B8913D]">avec abo</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-baseline space-x-2">
                            <span className="text-lg sm:text-2xl font-bold text-[#B8913D]">
                              {product.price.toFixed(2)}€
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className={`w-full py-2 sm:py-3 rounded-lg text-xs sm:text-base font-medium transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 ${
                        product.stock === 0
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50 hover:scale-105'
                      }`}
                    >
                      <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{product.stock === 0 ? t('shop.product.outOfStock') : t('shop.product.addToCart')}</span>
                    </button>
                  </div>
                </div>
              );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-all flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Précédent</span>
                </button>

                <span className="text-white px-2 sm:px-4 text-xs sm:text-base">
                  {currentPage}/{totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 sm:px-6 sm:py-3 rounded-full text-xs sm:text-base bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-8 border border-[#B8913D] border-opacity-30 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-2xl font-medium text-white mb-1.5 sm:mb-2">{selectedEvent.title}</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6">Sélectionnez les quantités pour chaque type de billet</p>

            <div className="mb-4 sm:mb-6 space-y-2.5 sm:space-y-4">
              {selectedEvent.event_ticket_types?.filter(ett => ett.is_active).map((ett) => {
                const price = isMember && ett.member_price > 0 ? ett.member_price : ett.price;
                const hasDiscount = ett.member_price > 0 && ett.member_price < ett.price;
                const ticketsLeft = ett.quantity_available === null ? 999 : ett.quantity_available - ett.quantity_sold;
                const currentQty = ticketQuantities[ett.id] || 0;

                return (
                  <div
                    key={ett.id}
                    className={`p-3 sm:p-4 rounded-lg border transition-all ${
                      ticketsLeft <= 0
                        ? 'bg-gray-800 bg-opacity-50 border-gray-700 opacity-50'
                        : currentQty > 0
                        ? 'bg-gradient-to-r from-[#B8913D]/20 to-[#A07F35]/20 border-[#B8913D]'
                        : 'bg-gray-800 bg-opacity-50 border-gray-700 hover:border-[#B8913D] hover:border-opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm sm:text-lg">{ett.ticket_type.name}</div>
                        {ett.ticket_type.description && (
                          <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{ett.ticket_type.description}</div>
                        )}
                        {ticketsLeft < 10 && ticketsLeft > 0 && (
                          <div className="text-[10px] sm:text-xs text-red-400 mt-0.5 sm:mt-1">
                            Plus que {ticketsLeft} disponibles
                          </div>
                        )}
                        {ticketsLeft <= 0 && (
                          <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                            Épuisé
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-2 sm:ml-4">
                        {hasDiscount ? (
                          <>
                            <div className="text-[10px] sm:text-xs text-gray-400 line-through">
                              {ett.price.toFixed(2)}€
                            </div>
                            <div className="text-base sm:text-xl font-bold text-[#B8913D]">
                              {ett.member_price.toFixed(2)}€
                            </div>
                            <div className="text-[9px] sm:text-xs text-[#B8913D]">avec abo</div>
                          </>
                        ) : (
                          <div className="text-base sm:text-xl font-bold text-[#B8913D]">
                            {ett.price.toFixed(2)}€
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <label className="text-xs sm:text-sm font-medium text-gray-300 min-w-[50px] sm:min-w-[70px]">
                        Quantité
                      </label>
                      <div className="flex items-center space-x-1.5 sm:space-x-2 flex-1">
                        <button
                          onClick={() => {
                            const newQty = Math.max(0, currentQty - 1);
                            setTicketQuantities(prev => ({
                              ...prev,
                              [ett.id]: newQty
                            }));
                          }}
                          disabled={ticketsLeft <= 0 || currentQty === 0}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-700 text-white text-sm sm:text-base font-bold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(10, ticketsLeft)}
                          value={currentQty}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const newQty = Math.max(0, Math.min(value, Math.min(10, ticketsLeft)));
                            setTicketQuantities(prev => ({
                              ...prev,
                              [ett.id]: newQty
                            }));
                          }}
                          disabled={ticketsLeft <= 0}
                          className="w-14 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-base bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none text-white text-center disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={() => {
                            const newQty = Math.min(Math.min(10, ticketsLeft), currentQty + 1);
                            setTicketQuantities(prev => ({
                              ...prev,
                              [ett.id]: newQty
                            }));
                          }}
                          disabled={ticketsLeft <= 0 || currentQty >= Math.min(10, ticketsLeft)}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-700 text-white text-sm sm:text-base font-bold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          +
                        </button>
                      </div>
                      {currentQty > 0 && (
                        <div className="text-xs sm:text-sm font-medium text-[#B8913D] min-w-[60px] sm:min-w-[80px] text-right">
                          {(price * currentQty).toFixed(2)}€
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.values(ticketQuantities).some(qty => qty > 0) && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-[#B8913D]/20 to-[#A07F35]/20 rounded-lg border border-[#B8913D]">
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm sm:text-base font-semibold">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-[#B8913D]">
                    {selectedEvent.event_ticket_types
                      ?.filter(ett => ett.is_active)
                      .reduce((total, ett) => {
                        const qty = ticketQuantities[ett.id] || 0;
                        const price = isMember && ett.member_price > 0 ? ett.member_price : ett.price;
                        return total + (price * qty);
                      }, 0)
                      .toFixed(2)}€
                  </span>
                </div>
              </div>
            )}

            <div className="flex space-x-2 sm:space-x-3">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setTicketQuantities({});
                }}
                className="flex-1 py-2.5 sm:py-3 text-xs sm:text-base border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleQuickAddEventTicket}
                disabled={!Object.values(ticketQuantities).some(qty => qty > 0)}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                  Object.values(ticketQuantities).some(qty => qty > 0)
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-8 border border-[#B8913D] border-opacity-30 shadow-2xl">
            <h3 className="text-lg sm:text-2xl font-medium text-white mb-3 sm:mb-4">{selectedProduct.name}</h3>

            <div className="mb-4 sm:mb-6">
              {selectedProduct.details && Array.isArray(selectedProduct.details.sizes) && selectedProduct.details.sizes.length > 0 && (
                <>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                    {t('shop.modal.selectSize')}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {selectedProduct.details.sizes.map((size: string) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                          selectedSize === size
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                {t('shop.modal.quantity')}
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct.stock}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none text-white"
              />
            </div>

            <div className="flex space-x-2 sm:space-x-3">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedSize('');
                  setQuantity(1);
                }}
                className="flex-1 py-2.5 sm:py-3 text-xs sm:text-base border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                {t('shop.modal.cancel')}
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={!selectedSize}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                  selectedSize
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {t('shop.product.addToCart')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
