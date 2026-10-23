import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { ShoppingBag, Calendar, MapPin, Shirt, Check, CheckCircle, ShoppingCart, Search, X, Clock, Users, Ticket, AlertCircle, ChevronLeft, ChevronRight, Images, Lock } from 'lucide-react';
import { PriceLockModal } from '../components/PriceLockModal';
import { PriceLockExplainer } from '../components/PriceLockExplainer';
import { fetchPriceLockSummary, fetchUserPriceLock, verifyPriceLockPayment, PriceLockSummary, PriceLockRecord } from '../lib/priceLock';
import { currentPrice, nextPrice, nextPriceChangeAt, priceLockDeadline, priceLockAvailable, minEventPrice, minNextEventPrice } from '../lib/tierPricing';

const PRICE_LOCK_DEPOSIT = 20;
const PRICE_INCREASE_STEP = 15;

const getPriceLockMinimum = (event: EventWithTickets, ticket: EventTicketType): number => {
  const configuredMinimum = Number(ticket.price_lock_deposit_amount);
  return event.is_test ? configuredMinimum : Math.max(configuredMinimum, PRICE_LOCK_DEPOSIT);
};
const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateShort = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

type Product = Database['public']['Tables']['products']['Row'];
type ProductSize = Database['public']['Tables']['product_sizes']['Row'];
type ProductImage = Database['public']['Tables']['product_images']['Row'];
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
  initialProductId?: string;
}

export function Shop({ onNavigate, initialProductId }: ShopProps) {
  const { user, profile } = useAuth();
  const { addToCart, addEventTicketToCart, getCartCount } = useCart();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [productSizesMap, setProductSizesMap] = useState<Record<string, ProductSize[]>>({});
  const [productImagesMap, setProductImagesMap] = useState<Record<string, ProductImage[]>>({});
  const [activeImageIndex, setActiveImageIndex] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<{ images: { image_url: string }[]; index: number } | null>(null);
  const lightboxTouchX = useRef<number | null>(null);
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'merchandise' | 'events'>('events');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithTickets | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [soldOutInterest, setSoldOutInterest] = useState<Record<string, 'saving' | 'done' | 'error'>>({});
  const [priceLockDeposits, setPriceLockDeposits] = useState<Record<string, string>>({});
  const [validPriceLockDeposits, setValidPriceLockDeposits] = useState<Record<string, number>>({});
  const [quickAddLockMode, setQuickAddLockMode] = useState(false);
  const [balancePaymentMode, setBalancePaymentMode] = useState<'manual' | 'automatic' | null>(null);
  const [autoBalanceConsent, setAutoBalanceConsent] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [quickAddNotice, setQuickAddNotice] = useState('');
  const [eventLockExists, setEventLockExists] = useState(false);
  const [success, setSuccess] = useState('');
  const [detailEvent, setDetailEvent] = useState<EventWithTickets | null>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [priceLockModal, setPriceLockModal] = useState<{ event: EventWithTickets; ticketTypeId?: string } | null>(null);
  const [priceLockPickerEvent, setPriceLockPickerEvent] = useState<EventWithTickets | null>(null);
  const [priceLockSummary, setPriceLockSummary] = useState<PriceLockSummary | null>(null);
  const [priceLockExisting, setPriceLockExisting] = useState<PriceLockRecord | null>(null);
  const [priceLockChecking, setPriceLockChecking] = useState(false);
  const [priceLockError, setPriceLockError] = useState('');
  const [priceLockResult, setPriceLockResult] = useState<{ status: 'success' | 'cancelled'; lock: PriceLockRecord | null } | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const priceLockStatus = urlParams.get('price_lock');
    const sessionId = urlParams.get('session_id');

    if (priceLockStatus === 'success' && sessionId) {
      (async () => {
        const lock = await verifyPriceLockPayment(sessionId);
        setPriceLockResult({ status: lock ? 'success' : 'cancelled', lock });
        window.history.replaceState({}, '', window.location.pathname);
      })();
    } else if (priceLockStatus === 'cancelled') {
      setPriceLockResult({ status: 'cancelled', lock: null });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [priceRange, setPriceRange] = useState<'all' | 'under25' | '25to50' | 'over50'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    if (filter === 'merchandise') {
      loadProducts();
    } else {
      loadEvents();
    }
  }, [filter, currentPage, debouncedSearchQuery, priceRange]);

  useEffect(() => {
    if (!initialProductId) return;
    const openInitialProduct = async () => {
      const { data: product } = await supabase.from('products').select('*').eq('id', initialProductId).maybeSingle();
      if (!product) {
        // Deep-link festival depuis la Landing : on retrouvera la carte dans la
        // liste une fois les événements chargés (voir l'effet de scroll ci-dessous).
        setPendingEventId(initialProductId);
        return;
      }
      const [sizesResult, imagesResult] = await Promise.all([
        supabase.from('product_sizes').select('*').eq('product_id', initialProductId).order('order_index'),
        supabase.from('product_images').select('*').eq('product_id', initialProductId).order('order_index'),
      ]);
      if (sizesResult.data) {
        setProductSizesMap(prev => ({ ...prev, [initialProductId]: sizesResult.data! }));
      }
      if (imagesResult.data) {
        setProductImagesMap(prev => ({ ...prev, [initialProductId]: imagesResult.data! }));
      }
      setSelectedProduct(product);
      setSelectedSize('');
      setQuantity(1);
    };
    openInitialProduct();
  }, [initialProductId]);

  // Scroll fluide vers la carte du festival ciblé + mise en évidence temporaire.
  useEffect(() => {
    if (loading || !pendingEventId) return;
    const card = document.getElementById(`event-card-${pendingEventId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedEventId(pendingEventId);
      const t = setTimeout(() => setHighlightedEventId(null), 3000);
      setPendingEventId(null);
      return () => clearTimeout(t);
    }
    // Événement non présent (filtre, page, indisponible) : Nexa Pass s'affiche
    // normalement, on consomme simplement l'ID transmis.
    setPendingEventId(null);
  }, [loading, pendingEventId, filter]);

  const loadProducts = async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

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

      const productIds = productsResult.data.map(p => p.id);
      if (productIds.length > 0) {
        const [sizesResult, imagesResult] = await Promise.all([
          supabase.from('product_sizes').select('*').in('product_id', productIds).order('order_index'),
          supabase.from('product_images').select('*').in('product_id', productIds).order('order_index'),
        ]);

        if (sizesResult.data) {
          const sizesMap: Record<string, ProductSize[]> = {};
          sizesResult.data.forEach(size => {
            if (!sizesMap[size.product_id]) sizesMap[size.product_id] = [];
            sizesMap[size.product_id].push(size);
          });
          setProductSizesMap(sizesMap);
        }

        if (imagesResult.data) {
          const imagesMap: Record<string, ProductImage[]> = {};
          imagesResult.data.forEach(img => {
            if (!imagesMap[img.product_id]) imagesMap[img.product_id] = [];
            imagesMap[img.product_id].push(img);
          });
          setProductImagesMap(imagesMap);
        }
      }
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
          ticket_type:ticket_types (*),
          price_tiers:event_ticket_price_tiers (label, price, starts_at, ends_at)
        )
      `, { count: 'exact' })
      .in('event_status', ['published', 'upcoming'])
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
    return minEventPrice(event as any);
  }, []);

  const getAvailableTickets = useCallback((event: EventWithTickets) => {
    if (!event.event_ticket_types) return 0;

    return event.event_ticket_types
      .filter(ett => ett.is_active)
      .reduce((total, ett) => {
        if (ett.quantity_available === null) return total + 999;
        return total + Math.max(0, ett.quantity_available - ett.quantity_sold);
      }, 0);
  }, []);

  const eventHasStock = useCallback((event: EventWithTickets) => {
    if (!event.event_ticket_types) return false;
    return event.event_ticket_types
      .filter(ett => ett.is_active)
      .some(ett => ett.quantity_available === null || ett.quantity_available - ett.quantity_sold > 0);
  }, []);

  const registerSoldOutInterest = async (eventId: string, eventTicketTypeId: string) => {
    setSoldOutInterest(prev => ({ ...prev, [eventTicketTypeId]: 'saving' }));
    const { error } = await supabase
      .from('event_sold_out_interests')
      .insert({ event_id: eventId, event_ticket_type_id: eventTicketTypeId });
    // 23505 : déjà enregistré pour cet utilisateur, on affiche la confirmation sans recompter
    const ok = !error || error.code === '23505';
    setSoldOutInterest(prev => ({ ...prev, [eventTicketTypeId]: ok ? 'done' : 'error' }));
  };

  const getPriceLockInfo = useCallback((event: EventWithTickets) => {
    const activeEtts = (event.event_ticket_types || []).filter(ett => ett.is_active);
    const lockEligible = activeEtts.filter(ett => priceLockAvailable(ett as any));
    if (lockEligible.length === 0) return null;

    const minNext = minNextEventPrice(event as any);
    const cheapest = activeEtts.reduce((a, b) => (currentPrice(b as any) < currentPrice(a as any) ? b : a));
    const deadline = priceLockDeadline(cheapest as any);
    return {
      lockAvailable: true,
      deposit: Number(cheapest.price_lock_deposit_amount ?? PRICE_LOCK_DEPOSIT),
      nextPrice: minNext?.price ?? null,
      increaseDate: minNext ? formatDateShort(minNext.changeAt) : null,
      guaranteeEnd: deadline ? formatDateShort(deadline) : null,
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (filter !== 'merchandise' || priceRange === 'all') return products;

    return products.filter((product) => {
      const price = product.price;
      const matchesPrice =
        priceRange === 'all' ||
        (priceRange === 'under25' && price < 25) ||
        (priceRange === '25to50' && price >= 25 && price <= 50) ||
        (priceRange === 'over50' && price > 50);

      return matchesPrice;
    });
  }, [products, filter, priceRange]);

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

  const openPriceLockModal = async (event: EventWithTickets, eventTicketTypeId?: string) => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const eligible = (event.event_ticket_types || []).filter(ett =>
      ett.is_active && priceLockAvailable(ett as any)
    );
    const target = eventTicketTypeId
      ? eligible.find(ett => ett.id === eventTicketTypeId)
      : eligible.length === 1
        ? eligible[0]
        : undefined;

    if (!target) {
      if (eligible.length > 1) {
        setPriceLockPickerEvent(event);
        return;
      }
      setPriceLockError('Le Price Lock n’est pas disponible pour ce festival.');
      return;
    }

    setPriceLockChecking(true);
    setPriceLockError('');
    setPriceLockModal({ event, ticketTypeId: target.id });

    const [summaryResult, existingLock] = await Promise.all([
      fetchPriceLockSummary(event.id, event.title, target.id),
      fetchUserPriceLock(target.id),
    ]);

    if ('error' in summaryResult) {
      setPriceLockError(summaryResult.error);
      setPriceLockChecking(false);
      return;
    }

    setPriceLockSummary(summaryResult);
    setPriceLockExisting(existingLock);
    setPriceLockChecking(false);
  };

  const closePriceLockModal = () => {
    setPriceLockModal(null);
    setPriceLockSummary(null);
    setPriceLockExisting(null);
    setPriceLockError('');
  };

  const handleAddToCart = (product: Product, size?: string) => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const sizes = productSizesMap[product.id] || [];
    const hasSizes = sizes.length > 1 || (sizes.length === 1 && sizes[0].name.toLowerCase() !== 'unique');

    if (hasSizes && !size) {
      setSelectedProduct(product);
      setSelectedSize('');
      return;
    }

    const sizeToUse = size || (sizes.length === 1 ? sizes[0].name : undefined);
    addToCart(product, quantity, sizeToUse);
    setSuccess(t('shop.success.addedToCart'));
    setSelectedProduct(null);
    setSelectedSize('');
    setQuantity(1);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleQuickAdd = () => {
    if (selectedProduct && (selectedSize || (productSizesMap[selectedProduct.id] || []).length === 0)) {
      addToCart(selectedProduct, quantity, selectedSize || undefined);
      setSuccess(t('shop.success.addedToCart'));
      setSelectedProduct(null);
      setSelectedSize('');
      setQuantity(1);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  // Modale de choix « Acheter maintenant / Price Lock » : rien n'est ajouté au
  // panier avant que l'utilisateur ait choisi et validé (handleQuickAddEventTicket).
  const openTicketChoiceModal = (event: EventWithTickets) => {
    setSelectedEvent(event);
    setTicketQuantities({});
    setPriceLockDeposits({});
    setValidPriceLockDeposits({});
    setQuickAddError('');
    setQuickAddNotice('');
    setBalancePaymentMode(null);
    setAutoBalanceConsent(false);
    setEventLockExists(false);
    if (user) {
      supabase
        .from('price_locks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('event_id', event.id)
        .eq('status', 'active')
        .then(({ count }) => setEventLockExists((count ?? 0) > 0));
    }
  };

  // CTA « Acheter ou réserver » : ouvre toujours la modale de choix, même
  // quand l'événement n'a qu'un seul type de billet.
  const handleBuyOrReserve = (event: EventWithTickets) => {
    if (!user) {
      onNavigate('signin');
      return;
    }
    openTicketChoiceModal(event);
  };

  const handleAddEventTicketToCart = (event: EventWithTickets, eventTicketTypeId?: string, purchaseType: 'full_purchase' | 'price_lock_deposit' = 'full_purchase') => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const allSoldOut = !event.event_ticket_types?.some(ett =>
      ett.is_active && (ett.quantity_available === null || ett.quantity_available - ett.quantity_sold > 0)
    );
    if (allSoldOut || (event.event_ticket_types && event.event_ticket_types.length > 1 && !eventTicketTypeId)) {
      openTicketChoiceModal(event);
      return;
    }

    const ticketTypeId = eventTicketTypeId || event.event_ticket_types?.[0]?.id;
    if (ticketTypeId) {
      addEventTicketToCart(ticketTypeId, quantity, purchaseType);
      setSuccess('Billet ajouté au panier');
      setSelectedEvent(null);
      setQuantity(1);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleQuickAddEventTicket = async () => {
    if (!selectedEvent) return;

    const ticketsToAdd = Object.entries(ticketQuantities).filter(([_, qty]) => qty > 0);

    if (ticketsToAdd.length === 0) return;

    const purchaseType = quickAddLockMode ? 'price_lock_deposit' : 'full_purchase';
    // Le mode de règlement du solde est obligatoire pour un Price Lock, choisi ici,
    // AVANT l'ajout au panier. Il n'est jamais demandé après.
    if (quickAddLockMode && !balancePaymentMode) {
      setQuickAddError('Choisis d’abord comment tu régleras le reste.');
      return;
    }
    if (quickAddLockMode && balancePaymentMode === 'automatic' && !autoBalanceConsent) {
      setQuickAddError('Coche la case de consentement pour le prélèvement automatique.');
      return;
    }

    if (quickAddLockMode) {
      const invalidDeposit = ticketsToAdd.some(([ticketTypeId]) => {
        const ticket = selectedEvent.event_ticket_types?.find(ett => ett.id === ticketTypeId);
        if (!ticket) return true;
        const amount = Number((priceLockDeposits[ticketTypeId] || '').replace(',', '.'));
        const minimum = getPriceLockMinimum(selectedEvent, ticket);
        return !Number.isFinite(amount) || amount < minimum || amount >= currentPrice(ticket as any);
      });
      if (invalidDeposit) {
        setQuickAddError('Le montant choisi doit être au moins égal au minimum et inférieur au prix bloqué.');
        return;
      }
    }

    try {
      for (const [ticketTypeId, qty] of ticketsToAdd) {
        const ticket = selectedEvent.event_ticket_types?.find(ett => ett.id === ticketTypeId);
        const depositAmount = ticket
          ? Number((priceLockDeposits[ticketTypeId] ?? '').replace(',', '.'))
          : undefined;
        await addEventTicketToCart(
          ticketTypeId,
          quickAddLockMode ? 1 : qty,
          purchaseType,
          quickAddLockMode ? { balancePaymentMode, depositAmount } : undefined
        );
      }
    } catch (error: any) {
      setQuickAddError(error?.message || 'Impossible d’ajouter ce billet au panier.');
      return;
    }

    const totalTickets = ticketsToAdd.reduce((sum, [_, qty]) => sum + qty, 0);
    setSuccess(`${totalTickets} billet${totalTickets > 1 ? 's' : ''} ajouté${totalTickets > 1 ? 's' : ''} au panier`);
    setSelectedEvent(null);
    setTicketQuantities({});
    setPriceLockDeposits({});
    setValidPriceLockDeposits({});
    setBalancePaymentMode(null);
    setAutoBalanceConsent(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const displayedPriceLockDeposit = (ticket: EventTicketType): number => {
    if (!selectedEvent) return Number(ticket.price_lock_deposit_amount);
    const minimum = getPriceLockMinimum(selectedEvent, ticket);
    const entered = priceLockDeposits[ticket.id] ?? '';
    const amount = Number(entered.replace(',', '.'));
    const price = currentPrice(ticket as any);
    const isValid = entered.trim() !== '' && Number.isFinite(amount) && amount >= minimum && amount < price;
    return isValid ? amount : (validPriceLockDeposits[ticket.id] ?? minimum);
  };

  const hasInvalidPriceLockDeposit = Boolean(
    quickAddLockMode && selectedEvent?.event_ticket_types?.some(ticket => {
      if ((ticketQuantities[ticket.id] || 0) <= 0 || !priceLockAvailable(ticket as any)) return false;
      const minimum = getPriceLockMinimum(selectedEvent, ticket);
      const entered = priceLockDeposits[ticket.id] ?? '';
      const amount = Number(entered.replace(',', '.'));
      return entered.trim() === '' || !Number.isFinite(amount) || amount < minimum || amount >= currentPrice(ticket as any);
    })
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-14 sm:pt-16 lg:pt-14 pb-6 sm:pb-10 lg:pb-6 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-48 h-48 sm:w-72 sm:h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-48 h-48 sm:w-72 sm:h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-4 sm:mb-7 lg:mb-4 text-center">
          <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl font-light text-white mb-1.5 sm:mb-2 lg:mb-1.5 px-2">
            NEXA <span className="text-[#B8913D]">PASS</span>
          </h1>
          <div className="flex justify-center mb-2 sm:mb-3 lg:mb-2">
            <div className="w-10 sm:w-16 lg:w-12 h-0.5 sm:h-1 lg:h-0.5 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-xs sm:text-base lg:text-sm text-gray-400 px-2">Réserve tes festivals avant que les prix augmentent.</p>
        </div>

        <PriceLockExplainer />

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

        </div>

        <div className="flex justify-center mb-4 sm:mb-8">
          <div className="inline-flex space-x-1.5 sm:space-x-3 p-1 sm:p-2 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-full shadow-lg border border-[#B8913D] border-opacity-30">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {(currentItems as EventWithTickets[]).map((event) => {
                const minPrice = getMinEventPrice(event);
                const availableTickets = getAvailableTickets(event);
                const eventDate = new Date(event.start_date);
                const isUpcoming = event.event_status === 'upcoming';
                const isFull = !isUpcoming && !eventHasStock(event);
                const priceLock = getPriceLockInfo(event);

                return (
                  <div
                    key={event.id}
                    id={`event-card-${event.id}`}
                    className={`bg-gray-900/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:shadow-[#B8913D]/20 hover:border-[#D4AC5B]/60 transition-all overflow-hidden group border flex flex-col ${
                      highlightedEventId === event.id
                        ? 'border-[#D4AC5B] shadow-[0_0_24px_rgba(212,172,91,0.35)]'
                        : 'border-[#D4AC5B]/30'
                    }`}
                  >
                    <div className="relative h-36 sm:h-40 bg-gray-800 overflow-hidden flex-shrink-0">
                      {(event as any).thumbnail_url ? (
                        <img
                          src={(event as any).thumbnail_url}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                          <Calendar className="w-10 h-10 text-[#B8913D] opacity-40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/85 via-transparent to-gray-950/25"></div>
                      {(event as any).thumbnail_url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLightboxImage((event as any).thumbnail_url); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                          title="Voir la photo"
                        >
                          <Images className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="absolute top-2 left-2">
                        {isUpcoming ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-950/85 backdrop-blur-sm text-gray-300 text-[10px] font-semibold rounded-full border border-gray-600">
                            <Clock className="w-2.5 h-2.5" />
                            Bientôt disponible
                          </span>
                        ) : isFull ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-950/90 text-gray-300 text-[10px] font-semibold rounded-full border border-gray-700">
                            Complet
                          </span>
                        ) : priceLock?.lockAvailable ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-950/85 backdrop-blur-sm text-[#F0D38A] text-[10px] font-semibold rounded-full border border-[#D4AC5B]/50">
                            <Lock className="w-2.5 h-2.5" />
                            Price Lock disponible
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#D4AC5B] transition-colors">
                        {event.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#B8913D] flex-shrink-0" />
                          {eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {event.location && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-[#B8913D] flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                      </div>

                      <div className="my-3 h-px bg-gradient-to-r from-transparent via-[#D4AC5B]/25 to-transparent"></div>

                      <div>
                        <span className="text-[10px] font-bold tracking-[0.18em] text-[#D4AC5B] uppercase">Prix actuel</span>
                        {isUpcoming ? (
                          <div className="mt-1">
                            <span className="text-sm font-medium text-[#B8913D]">Tarif à venir</span>
                            <p className="mt-0.5 text-[11px] text-gray-400">Les ventes ouvriront prochainement.</p>
                          </div>
                        ) : minPrice !== null ? (
                          <div className="mt-0.5 text-3xl font-bold tracking-tight text-white">
                            {Math.round(minPrice)}&nbsp;<span className="text-xl">€</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm font-medium text-gray-400">Prix à venir</div>
                        )}
                        {priceLock?.nextPrice != null && !isUpcoming && (
                          <>
                            <p className="mt-1 text-xs text-gray-400">
                              Prochain tarif : <span className="font-semibold text-gray-200">{priceLock.nextPrice} €</span>
                            </p>
                            <p className="text-[11px] text-gray-400">À partir du {priceLock.increaseDate}</p>
                          </>
                        )}
                      </div>

                      {priceLock?.lockAvailable && !isUpcoming && (
                        <div className="mt-3 rounded-xl border border-[#D4AC5B]/30 bg-[#D4AC5B]/[0.06] px-3 py-2.5">
                          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-[#D4AC5B] uppercase">
                            <Lock className="w-2.5 h-2.5" />
                            Price Lock
                          </p>
                          <p className="mt-1 text-xs font-semibold text-white">Verse {priceLock.deposit} € pour bloquer ce tarif</p>
                          <p className="text-[11px] text-gray-400">{Math.round(minPrice)} € garanti jusqu’au {priceLock.guaranteeEnd}</p>
                          <p className="text-[11px] text-gray-400">{PRICE_LOCK_DEPOSIT} € déduits du montant final.</p>
                        </div>
                      )}

                      {isUpcoming ? (
                        <button
                          onClick={() => setDetailEvent(event)}
                          className="mt-auto w-full px-3 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all"
                        >
                          Voir les détails
                        </button>
                      ) : (
                        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                          <button
                            onClick={() => handleBuyOrReserve(event)}
                            className={`px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                              isFull
                                ? 'border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                                : 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white hover:shadow-lg hover:shadow-[#B8913D]/40'
                            }`}
                          >
                            {isFull ? 'Complet' : 'Acheter ou réserver'}
                          </button>
                          <button
                            onClick={() => setDetailEvent(event)}
                            className="px-2 py-2.5 rounded-xl text-xs font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
                          >
                            Voir les détails
                          </button>
                        </div>
                      )}
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
              {searchQuery
                ? 'Aucun événement ne correspond à votre recherche'
                : 'Aucun événement disponible pour le moment'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {(currentItems as Product[]).map((product) => {

              return (
                <div
                  key={product.id}
                  className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-[#B8913D] border-opacity-30"
                >
                  {(() => {
                    const imgs = productImagesMap[product.id] || [];
                    const hasImages = imgs.length > 0;
                    const displayImages = hasImages ? imgs : (product.image_url ? [{ id: 'fallback', image_url: product.image_url, product_id: product.id, order_index: 0, created_at: '' }] : []);
                    const currentIdx = activeImageIndex[product.id] || 0;
                    const safeIdx = Math.min(currentIdx, Math.max(0, displayImages.length - 1));
                    const currentImage = displayImages[safeIdx];

                    return (
                      <div className="relative h-48 sm:h-64 bg-gray-900 overflow-hidden">
                        {currentImage ? (
                          <img
                            src={currentImage.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                            onClick={(e) => { e.stopPropagation(); setLightbox({ images: displayImages, index: safeIdx }); }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shirt className="w-12 h-12 sm:w-16 sm:h-16 text-[#B8913D] opacity-50" />
                          </div>
                        )}

                        {displayImages.length > 1 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIndex(prev => ({ ...prev, [product.id]: safeIdx === 0 ? displayImages.length - 1 : safeIdx - 1 }));
                              }}
                              className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 z-10"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIndex(prev => ({ ...prev, [product.id]: safeIdx === displayImages.length - 1 ? 0 : safeIdx + 1 }));
                              }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all opacity-0 group-hover:opacity-100 z-10"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                              {displayImages.map((_, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => ({ ...prev, [product.id]: i })); }}
                                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIdx ? 'bg-[#B8913D] w-3' : 'bg-white bg-opacity-60 hover:bg-opacity-90'}`}
                                />
                              ))}
                            </div>
                            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black bg-opacity-50 rounded-full">
                              <Images className="w-3 h-3 text-white opacity-70" />
                              <span className="text-[10px] text-white opacity-70">{displayImages.length}</span>
                            </div>
                          </>
                        )}

                        {(productSizesMap[product.id] || []).every(s => s.stock_quantity === 0) && (productSizesMap[product.id] || []).length > 0 && (
                          <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600 text-white text-xs sm:text-base font-medium rounded-lg">
                              {t('shop.product.outOfStock')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="p-4 sm:p-6">
                    <h3 className="text-base sm:text-xl font-medium text-white mb-1.5 sm:mb-2">{product.name}</h3>
                    <p className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{product.description}</p>

                    {(productSizesMap[product.id] || []).length > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">{t('shop.product.availableSizes')}</p>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {(productSizesMap[product.id] || []).map((size) => (
                            <span
                              key={size.id}
                              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs rounded border ${
                                size.stock_quantity === 0
                                  ? 'bg-gray-900 text-gray-600 border-gray-800 line-through'
                                  : 'bg-gray-800 text-gray-300 border-gray-700'
                              }`}
                            >
                              {size.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-end justify-between mb-3 sm:mb-4">
                      <div className="w-full">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-lg sm:text-2xl font-bold text-[#B8913D]">
                            {product.price.toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const sizes = productSizesMap[product.id] || [];
                      const isOutOfStock = sizes.length > 0 && sizes.every(s => s.stock_quantity === 0);
                      return (
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={isOutOfStock}
                          className={`w-full py-2 sm:py-3 rounded-lg text-xs sm:text-base font-medium transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 ${
                            isOutOfStock
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50 hover:scale-105'
                          }`}
                        >
                          <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{isOutOfStock ? t('shop.product.outOfStock') : t('shop.product.addToCart')}</span>
                        </button>
                      );
                    })()}
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

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Affiche de l'événement"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {detailEvent && (() => {
        const isDetailUpcoming = detailEvent.event_status === 'upcoming';
        return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-lg w-full border border-[#B8913D] border-opacity-30 shadow-2xl max-h-[90vh] overflow-y-auto">
            {(detailEvent as any).thumbnail_url && (
              <div className="relative h-48 sm:h-56 overflow-hidden rounded-t-xl sm:rounded-t-2xl">
                <img
                  src={(detailEvent as any).thumbnail_url}
                  alt={detailEvent.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                <button
                  onClick={() => setDetailEvent(null)}
                  className="absolute top-3 right-3 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="absolute bottom-3 left-4 right-4 text-lg sm:text-2xl font-semibold text-white leading-tight">
                  {detailEvent.title}
                </h3>
              </div>
            )}

            <div className="p-4 sm:p-6">
              {!(detailEvent as any).thumbnail_url && (
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg sm:text-2xl font-semibold text-white leading-tight flex-1 pr-4">{detailEvent.title}</h3>
                  <button
                    onClick={() => setDetailEvent(null)}
                    className="p-1.5 bg-gray-800 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-all flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-gray-300">
                  <Calendar className="w-4 h-4 text-[#B8913D] flex-shrink-0" />
                  <span className="text-sm">
                    {new Date(detailEvent.start_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })} à {new Date(detailEvent.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {detailEvent.location && (
                  <div className="flex items-center space-x-2 text-gray-300">
                    <MapPin className="w-4 h-4 text-[#B8913D] flex-shrink-0" />
                    <span className="text-sm">{detailEvent.location}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-gray-300">
                  <Users className="w-4 h-4 text-[#B8913D] flex-shrink-0" />
                  <span className="text-sm">
                    {getAvailableTickets(detailEvent) > 0
                      ? `${getAvailableTickets(detailEvent)} places disponibles`
                      : 'Complet'}
                  </span>
                </div>
              </div>

              {detailEvent.description && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-[#B8913D] uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{detailEvent.description}</p>
                </div>
              )}

              {!isDetailUpcoming && detailEvent.event_ticket_types && detailEvent.event_ticket_types.filter(ett => ett.is_active).length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-[#B8913D] uppercase tracking-wider mb-2">Tarifs</h4>
                  <div className="space-y-2">
                    {detailEvent.event_ticket_types.filter(ett => ett.is_active).map((ett) => {
                      const ticketsLeft = ett.quantity_available === null ? null : ett.quantity_available - ett.quantity_sold;
                      return (
                        <div key={ett.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 bg-opacity-60 rounded-lg">
                          <div>
                            <span className="text-sm text-white font-medium">{ett.ticket_type.name}</span>
                            {ett.ticket_type.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{ett.ticket_type.description}</p>
                            )}
                            {ticketsLeft !== null && ticketsLeft < 10 && ticketsLeft > 0 && (
                              <p className="text-xs text-red-400 mt-0.5">Plus que {ticketsLeft} disponibles</p>
                            )}
                            {ticketsLeft !== null && ticketsLeft <= 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">Épuisé</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-base font-bold text-[#B8913D]">{currentPrice(ett as any).toFixed(2)}€</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isDetailUpcoming && (
                <div className="mb-5 p-3 bg-[#B8913D] bg-opacity-10 border border-[#B8913D] border-opacity-30 rounded-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#B8913D] flex-shrink-0" />
                  <p className="text-sm text-[#B8913D] font-medium">Les billets seront bientôt disponibles à la vente.</p>
                </div>
              )}

              <div className="flex space-x-2 sm:space-x-3">
                <button
                  onClick={() => setDetailEvent(null)}
                  className="flex-1 py-2.5 text-sm border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Fermer
                </button>
                {!isDetailUpcoming && (
                  <button
                    onClick={() => {
                      handleAddEventTicketToCart(detailEvent, undefined, 'full_purchase');
                      setDetailEvent(null);
                    }}
                    className={`flex-1 py-2.5 text-sm rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                      eventHasStock(detailEvent)
                        ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40'
                        : 'border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{eventHasStock(detailEvent) ? 'Réserver' : 'Complet'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl max-w-xl w-full p-4 sm:p-6 border border-[#D4AC5B]/25 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-1">{selectedEvent.title}</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-5">Choisis ton mode de réservation et le montant de ton premier versement.</p>

            {quickAddError && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-600/40 rounded-lg">
                <p className="text-xs text-red-300 leading-relaxed">{quickAddError}</p>
              </div>
            )}

            {quickAddNotice && !quickAddError && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700/40 rounded-lg">
                <p className="text-xs text-blue-200 leading-relaxed whitespace-pre-line">{quickAddNotice}</p>
              </div>
            )}

            {eventLockExists && (
              <div className="mb-4 p-3 bg-[#B8913D]/[0.08] border border-[#D4AC5B]/30 rounded-xl">
                <p className="text-xs text-[#F0D38A] font-medium">Tu as déjà un Price Lock actif pour ce festival.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Un seul Price Lock est autorisé par compte et par événement. Le mode achat comptant reste disponible.</p>
              </div>
            )}

            <div className="mb-4 sm:mb-5">
              <h4 className="text-sm sm:text-base font-semibold tracking-tight text-white mb-2.5">Comment souhaites-tu réserver ton pass ?</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  onClick={() => {
                    setQuickAddLockMode(false);
                    setQuickAddNotice('');
                  }}
                  className={`flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all border ${
                    !quickAddLockMode
                      ? 'border-[#D4AC5B] bg-[#D4AC5B]/15 shadow-lg shadow-[#D4AC5B]/10'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <ShoppingBag className={`w-5 h-5 flex-shrink-0 mt-0.5 ${!quickAddLockMode ? 'text-[#D4AC5B]' : 'text-gray-400'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white">Acheter maintenant</span>
                    <span className="block text-[11px] sm:text-xs text-gray-400 mt-0.5">Paie ton Full Pass en totalité aujourd’hui.</span>
                  </span>
                  {!quickAddLockMode && <CheckCircle className="w-5 h-5 text-[#D4AC5B] flex-shrink-0" />}
                </button>
                <button
                  onClick={() => {
                    setQuickAddLockMode(true);
                    setPriceLockDeposits(Object.fromEntries(
                      (selectedEvent.event_ticket_types || [])
                        .filter(t => t.is_active && priceLockAvailable(t as any))
                        .map(t => [t.id, String(getPriceLockMinimum(selectedEvent, t))])
                    ));
                    setValidPriceLockDeposits(Object.fromEntries(
                      (selectedEvent.event_ticket_types || [])
                        .filter(t => t.is_active && priceLockAvailable(t as any))
                        .map(t => [t.id, getPriceLockMinimum(selectedEvent, t)])
                    ));
                    setTicketQuantities(prev => {
                      const next: Record<string, number> = {};
                      let kept = false;
                      selectedEvent.event_ticket_types?.forEach(t => {
                        if (t.is_active && priceLockAvailable(t as any)) {
                          const q = Math.min(1, prev[t.id] || 0);
                          if (q > 0 && !kept) {
                            next[t.id] = 1;
                            kept = true;
                          }
                        }
                      });
                      return next;
                    });
                    setQuickAddNotice('Comment fonctionne Price Lock ?\nTu verses une partie aujourd’hui pour bloquer ton tarif, puis tu règles le reste en une seule fois avant la date indiquée.\nUn seul Price Lock peut être actif par festival.');
                  }}
                  className={`flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all border ${
                    quickAddLockMode
                      ? 'border-[#D4AC5B] bg-[#D4AC5B]/15 shadow-lg shadow-[#D4AC5B]/10'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Lock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${quickAddLockMode ? 'text-[#D4AC5B]' : 'text-gray-400'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white">Price Lock</span>
                    <span className="block text-[11px] sm:text-xs text-gray-400 mt-0.5">Verse une partie aujourd’hui pour garder ce tarif. Tu règleras le montant restant en une seule fois avant la date limite.</span>
                  </span>
                  {quickAddLockMode && <CheckCircle className="w-5 h-5 text-[#D4AC5B] flex-shrink-0" />}
                </button>
              </div>
            </div>

            <div className="mb-4 sm:mb-5 space-y-2.5 sm:space-y-3">
              {selectedEvent.event_ticket_types?.filter(ett => ett.is_active).map((ett) => {
                const price = currentPrice(ett as any);
                const ticketsLeft = ett.quantity_available === null ? 999 : ett.quantity_available - ett.quantity_sold;
                const currentQty = ticketQuantities[ett.id] || 0;
                const lockEligible = priceLockAvailable(ett as any);
                const showLock = quickAddLockMode && lockEligible && ticketsLeft > 0;
                const minimumDeposit = getPriceLockMinimum(selectedEvent, ett);
                const enteredDeposit = priceLockDeposits[ett.id] ?? '';
                const parsedDeposit = Number(enteredDeposit.replace(',', '.'));
                const amountIsValid = enteredDeposit.trim() !== '' && Number.isFinite(parsedDeposit) && parsedDeposit >= minimumDeposit && parsedDeposit < price;
                const selectedDeposit = amountIsValid ? parsedDeposit : (validPriceLockDeposits[ett.id] ?? minimumDeposit);
                const depositError = enteredDeposit.trim() === '' || !Number.isFinite(parsedDeposit) || parsedDeposit < minimumDeposit
                  ? `Le versement minimum pour ce Price Lock est de ${minimumDeposit.toFixed(2)} €.`
                  : parsedDeposit >= price
                    ? 'Pour payer la totalité du pass, choisis Acheter maintenant.'
                    : '';
                const maxQty = showLock ? 1 : Math.min(10, ticketsLeft);
                const otherTypeSelected = quickAddLockMode && currentQty === 0 && Object.entries(ticketQuantities).some(([id, q]) => q > 0 && id !== ett.id);
                const priceLockUnavailable = quickAddLockMode && (eventLockExists || !lockEligible);
                const qtyControlsDisabled = priceLockUnavailable || otherTypeSelected;

                return (
                  <div
                    key={ett.id}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                      ticketsLeft <= 0
                        ? 'bg-gray-800 bg-opacity-50 border-gray-700'
                        : qtyControlsDisabled
                        ? 'bg-gray-800 bg-opacity-50 border-gray-700 opacity-60 cursor-not-allowed'
                        : currentQty > 0
                        ? 'bg-gradient-to-r from-[#B8913D]/20 to-[#A07F35]/20 border-[#B8913D]'
                        : 'bg-gray-800 bg-opacity-50 border-gray-700 hover:border-[#B8913D] hover:border-opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex-1">
                        <div className="font-semibold text-white text-base sm:text-lg leading-snug">{ett.ticket_type.name}</div>
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
                      <div className="text-right w-[48%] sm:w-auto shrink-0">
                        {quickAddLockMode && !lockEligible ? (
                          <div className="text-[11px] sm:text-xs text-gray-400 mt-1">Price Lock indisponible</div>
                        ) : showLock ? (
                          <>
                            <div className="text-[10px] uppercase tracking-wide text-gray-400">Prix bloqué</div>
                            <div className="text-base sm:text-xl font-bold text-[#B8913D]">{price.toFixed(2)}€</div>
                            <div className="text-[11px] sm:text-xs text-gray-300 mt-1">
                              Aujourd’hui : <span className="font-semibold text-white">{selectedDeposit.toFixed(2)} €</span>
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={enteredDeposit}
                              min={minimumDeposit}
                              max={Math.max(0, price - 0.01)}
                              step="0.01"
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.,]/g, '');
                                const amount = Number(value.replace(',', '.'));
                                setPriceLockDeposits(prev => ({ ...prev, [ett.id]: value }));
                                if (value.trim() !== '' && Number.isFinite(amount) && amount >= minimumDeposit && amount < price) {
                                  setValidPriceLockDeposits(prev => ({ ...prev, [ett.id]: amount }));
                                }
                                setQuickAddError('');
                              }}
                              placeholder={`Autre montant · min. ${minimumDeposit.toFixed(2)} €`}
                              aria-label={`Montant du dépôt pour ${ett.ticket_type.name}`}
                              aria-invalid={Boolean(depositError)}
                              className={`mt-2 w-full max-w-[150px] px-2 py-1.5 text-right text-xs bg-gray-900 rounded-lg text-white placeholder-gray-500 focus:ring-1 outline-none ${depositError ? 'border border-red-500/70 focus:ring-red-500' : 'border border-gray-700 focus:ring-[#B8913D]'}`}
                            />
                            {depositError && (
                              <p className="mt-1 max-w-[180px] text-[10px] leading-snug text-red-300">{depositError}</p>
                            )}
                            {(() => {
                              const payDeadline = priceLockDeadline(ett as any);
                              return (
                                <div className="text-[11px] sm:text-xs text-gray-300 leading-snug">
                                  {payDeadline ? (
                                    <>
                                      Reste à payer avant le {payDeadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} :{' '}
                                      <span className="font-semibold text-[#F0D38A]">{Math.max(0, price - selectedDeposit).toFixed(2)} €</span>
                                    </>
                                  ) : (
                                    <>
                                      Reste à payer : <span className="font-semibold text-[#F0D38A]">{Math.max(0, price - selectedDeposit).toFixed(2)} €</span>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] uppercase tracking-wide text-gray-400">Prix</div>
                            <div className="text-base sm:text-xl font-bold text-[#B8913D]">{price.toFixed(2)}€</div>
                            <div className="text-[11px] sm:text-xs text-gray-300 mt-1">
                              À payer aujourd’hui : <span className="font-semibold text-white">{price.toFixed(0)} €</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {showLock && (() => {
                      const deadline = priceLockDeadline(ett as any);
                      if (!deadline) return null;
                      return (
                        <div className="mb-2 sm:mb-3 flex items-center gap-1.5 text-[11px] text-[#F0D38A]">
                          <Lock className="w-3 h-3 flex-shrink-0" />
                          <span>Ton prix de {price.toFixed(0)} € est garanti jusqu’au {deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      );
                    })()}

                    {ticketsLeft <= 0 ? (
                      soldOutInterest[ett.id] === 'done' ? (
                        <div className="w-full py-2.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 text-sm font-medium flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          Intérêt enregistré
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => registerSoldOutInterest(selectedEvent.id, ett.id)}
                            disabled={soldOutInterest[ett.id] === 'saving'}
                            className="w-full py-2.5 rounded-lg border border-[#B8913D]/60 text-[#F0D38A] text-sm font-medium hover:bg-[#B8913D]/15 transition-all disabled:opacity-60 disabled:cursor-wait"
                          >
                            {soldOutInterest[ett.id] === 'saving' ? 'Enregistrement...' : 'Je suis intéressé'}
                          </button>
                          {soldOutInterest[ett.id] === 'error' && (
                            <p className="mt-1.5 text-[11px] text-red-300">Impossible d'enregistrer ton intérêt pour le moment. Réessaie.</p>
                          )}
                        </>
                      )
                    ) : (
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
                          disabled={ticketsLeft <= 0 || currentQty === 0 || qtyControlsDisabled}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-700 text-white text-sm sm:text-base font-bold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={maxQty}
                          value={currentQty}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            if (showLock && value > 1) {
                              setTicketQuantities(prev => ({ ...prev, [ett.id]: 1 }));
                              setQuickAddNotice('Un seul Price Lock est autorisé par compte et par festival. Pour bloquer un autre pass pour ce festival, l\u2019autre participant doit utiliser son propre compte Nexa.');
                              return;
                            }
                            const newQty = Math.max(0, Math.min(value, maxQty));
                            setTicketQuantities(prev => ({
                              ...prev,
                              [ett.id]: newQty
                            }));
                          }}
                          disabled={ticketsLeft <= 0 || qtyControlsDisabled}
                          className="w-14 sm:w-20 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-base bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none text-white text-center disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={() => {
                            const newQty = Math.min(maxQty, currentQty + 1);
                            setTicketQuantities(prev => ({
                              ...prev,
                              [ett.id]: newQty
                            }));
                          }}
                          disabled={ticketsLeft <= 0 || currentQty >= maxQty || qtyControlsDisabled}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-700 text-white text-sm sm:text-base font-bold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          +
                        </button>
                      </div>
                      {currentQty > 0 && (
                        <div className="text-xs sm:text-sm font-medium text-[#B8913D] min-w-[60px] sm:min-w-[80px] text-right">
                          {((showLock ? selectedDeposit : price) * currentQty).toFixed(2)}€
                        </div>
                      )}
                    </div>
                    )}
                    {otherTypeSelected && (
                      <p className="mt-2 text-[11px] text-gray-400">Un Price Lock est déjà sélectionné pour ce festival</p>
                    )}
                  </div>
                );
              })}
            </div>

            {quickAddLockMode && Object.values(ticketQuantities).some(qty => qty > 0) && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border border-[#D4AC5B]/40 bg-[#D4AC5B]/[0.05]">
                <p className="text-sm font-semibold text-white">Comment veux-tu régler le reste ?</p>
                <div className="mt-2.5 space-y-2">
                  <button
                    onClick={() => { setBalancePaymentMode('manual'); setQuickAddError(''); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      balancePaymentMode === 'manual'
                        ? 'border-[#B8913D] bg-[#B8913D]/15'
                        : 'border-gray-700 bg-gray-800/60 hover:border-[#B8913D]/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">Je paierai moi-même</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Tu pourras régler le montant restant depuis Nexa avant le {(() => {
                        const firstSelected = selectedEvent.event_ticket_types?.find(e => (ticketQuantities[e.id] || 0) > 0);
                        const dl = firstSelected ? priceLockDeadline(firstSelected as any) : null;
                        return dl ? dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'la date limite';
                      })()}.
                    </p>
                  </button>
                  <button
                    onClick={() => { setBalancePaymentMode('automatic'); setQuickAddError(''); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      balancePaymentMode === 'automatic'
                        ? 'border-[#B8913D] bg-[#B8913D]/15'
                        : 'border-gray-700 bg-gray-800/60 hover:border-[#B8913D]/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">Prélèvement automatique</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Le montant restant de {(() => {
                        const firstSelected = selectedEvent.event_ticket_types?.find(e => (ticketQuantities[e.id] || 0) > 0);
                        if (!firstSelected) return '…';
                        const p = currentPrice(firstSelected as any);
                        const deposit = displayedPriceLockDeposit(firstSelected);
                        return Math.max(0, p - deposit).toFixed(2);
                      })()} € sera débité automatiquement le {(() => {
                        const firstSelected = selectedEvent.event_ticket_types?.find(e => (ticketQuantities[e.id] || 0) > 0);
                        const dl = firstSelected ? priceLockDeadline(firstSelected as any) : null;
                        return dl ? dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'la date limite';
                      })()} si tu ne l’as pas réglé avant.
                    </p>
                  </button>
                </div>
                {balancePaymentMode === 'automatic' && (
                  <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoBalanceConsent}
                      onChange={(e) => setAutoBalanceConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#B8913D]"
                    />
                    <span className="text-[11px] text-gray-300 leading-snug">
                      J’autorise Nexa à débiter automatiquement le montant restant de mon pass à la date indiquée. Si je règle le solde avant cette date, aucun autre débit ne sera effectué.
                    </span>
                  </label>
                )}
                {quickAddError && <p className="mt-2.5 text-[11px] text-red-400">{quickAddError}</p>}
              </div>
            )}

            {Object.values(ticketQuantities).some(qty => qty > 0) && (
              <div className="mb-4 sm:mb-5 p-3 sm:p-3.5 bg-[#B8913D]/[0.08] rounded-xl border border-[#D4AC5B]/40">
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm sm:text-base font-semibold">
                    {quickAddLockMode ? 'À payer aujourd’hui (versements)' : 'À payer aujourd’hui'}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-[#B8913D]">
                    {selectedEvent.event_ticket_types
                      ?.filter(ett => ett.is_active)
                      .reduce((total, ett) => {
                        const qty = ticketQuantities[ett.id] || 0;
                        const unit = quickAddLockMode && (ett as any).price_lock_enabled
                          ? displayedPriceLockDeposit(ett)
                          : currentPrice(ett as any);
                        return total + (unit * qty);
                      }, 0)
                      .toFixed(2)}€
                  </span>
                </div>
                {quickAddLockMode && (
                  <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">Le reste à payer sera à régler en une seule fois, avant la date de garantie.</p>
                )}
              </div>
            )}

            <div className="flex space-x-2 sm:space-x-3">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setTicketQuantities({});
                  setPriceLockDeposits({});
                  setValidPriceLockDeposits({});
                  setQuickAddError('');
                  setQuickAddNotice('');
                }}
                className="flex-1 py-2.5 sm:py-3 text-xs sm:text-base border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleQuickAddEventTicket}
                disabled={!Object.values(ticketQuantities).some(qty => qty > 0) || hasInvalidPriceLockDeposit || (quickAddLockMode && (!balancePaymentMode || (balancePaymentMode === 'automatic' && !autoBalanceConsent)))}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                  Object.values(ticketQuantities).some(qty => qty > 0) && !hasInvalidPriceLockDeposit
                    ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                <span>
                  {quickAddLockMode
                    ? `Ajouter le Price Lock au panier — ${selectedEvent.event_ticket_types
                        ?.filter(ett => ett.is_active && priceLockAvailable(ett as any))
                        .reduce((total, ett) => {
                          const deposit = displayedPriceLockDeposit(ett);
                          return total + deposit * (ticketQuantities[ett.id] || 0);
                        }, 0)
                        .toFixed(2)}€`
                    : `Ajouter au panier — ${selectedEvent.event_ticket_types
                        ?.filter(ett => ett.is_active)
                        .reduce((total, ett) => total + currentPrice(ett as any) * (ticketQuantities[ett.id] || 0), 0)
                        .toFixed(2)}€`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-8 border border-[#B8913D] border-opacity-30 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-2xl font-medium text-white mb-3 sm:mb-4">{selectedProduct.name}</h3>

            {(() => {
              const imgs = productImagesMap[selectedProduct.id] || [];
              const displayImages = imgs.length > 0 ? imgs : (selectedProduct.image_url ? [{ id: 'fallback', image_url: selectedProduct.image_url, product_id: selectedProduct.id, order_index: 0, created_at: '' }] : []);
              const modalIdx = activeImageIndex[`modal_${selectedProduct.id}`] || 0;
              const safeModalIdx = Math.min(modalIdx, Math.max(0, displayImages.length - 1));
              const currentModalImage = displayImages[safeModalIdx];

              if (!currentModalImage) return null;

              return (
                <div className="relative mb-4 rounded-lg overflow-hidden bg-gray-800 aspect-square">
                  <img
                    src={currentModalImage.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain cursor-zoom-in"
                    onClick={() => setLightbox({ images: displayImages, index: safeModalIdx })}
                  />
                  {displayImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImageIndex(prev => ({ ...prev, [`modal_${selectedProduct.id}`]: safeModalIdx === 0 ? displayImages.length - 1 : safeModalIdx - 1 }))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setActiveImageIndex(prev => ({ ...prev, [`modal_${selectedProduct.id}`]: safeModalIdx === displayImages.length - 1 ? 0 : safeModalIdx + 1 }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                        {displayImages.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImageIndex(prev => ({ ...prev, [`modal_${selectedProduct.id}`]: i }))}
                            className={`h-1.5 rounded-full transition-all ${i === safeModalIdx ? 'bg-[#B8913D] w-4' : 'bg-white bg-opacity-50 w-1.5 hover:bg-opacity-80'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <div className="mb-4 sm:mb-6">
              {(productSizesMap[selectedProduct.id] || []).length > 0 && (
                <>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                    {t('shop.modal.selectSize')}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {(productSizesMap[selectedProduct.id] || []).map((size) => (
                      <button
                        key={size.id}
                        onClick={() => size.stock_quantity > 0 && setSelectedSize(size.name)}
                        disabled={size.stock_quantity === 0}
                        className={`py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                          size.stock_quantity === 0
                            ? 'bg-gray-900 text-gray-600 cursor-not-allowed line-through border border-gray-800'
                            : selectedSize === size.name
                              ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        }`}
                      >
                        {size.name}
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
                max={selectedSize ? (productSizesMap[selectedProduct.id] || []).find(s => s.name === selectedSize)?.stock_quantity ?? 99 : 99}
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
                disabled={!selectedSize && (productSizesMap[selectedProduct.id] || []).length > 0}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-all ${
                  !selectedSize && (productSizesMap[selectedProduct.id] || []).length > 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50'
                }`}
              >
                {t('shop.product.addToCart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex items-center justify-center touch-none"
          onClick={() => setLightbox(null)}
          onTouchStart={(e) => { lightboxTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (lightboxTouchX.current === null) return;
            const diff = lightboxTouchX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 40) {
              if (diff > 0) {
                setLightbox(prev => prev ? { ...prev, index: prev.index === prev.images.length - 1 ? 0 : prev.index + 1 } : null);
              } else {
                setLightbox(prev => prev ? { ...prev, index: prev.index === 0 ? prev.images.length - 1 : prev.index - 1 } : null);
              }
            }
            lightboxTouchX.current = null;
          }}
        >
          <button
            className="absolute top-4 right-4 p-2.5 text-white bg-black bg-opacity-60 rounded-full hover:bg-opacity-90 transition-all z-10"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <X className="w-5 h-5" />
          </button>

          {lightbox.images.length > 1 && (
            <button
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 text-white bg-black bg-opacity-60 rounded-full hover:bg-opacity-90 transition-all z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(prev => prev ? { ...prev, index: prev.index === 0 ? prev.images.length - 1 : prev.index - 1 } : null);
              }}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          <div
            className="w-full h-full flex items-center justify-center px-14 sm:px-20 py-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.images[lightbox.index].image_url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>

          {lightbox.images.length > 1 && (
            <button
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 text-white bg-black bg-opacity-60 rounded-full hover:bg-opacity-90 transition-all z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(prev => prev ? { ...prev, index: prev.index === prev.images.length - 1 ? 0 : prev.index + 1 } : null);
              }}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {lightbox.images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {lightbox.images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: i } : null); }}
                  className={`h-2 rounded-full transition-all ${i === lightbox.index ? 'bg-[#B8913D] w-6' : 'bg-white bg-opacity-50 w-2 hover:bg-opacity-80'}`}
                />
              ))}
            </div>
          )}

          <div className="absolute bottom-5 right-4 text-white text-xs bg-black bg-opacity-60 px-2.5 py-1 rounded-full">
            {lightbox.index + 1} / {lightbox.images.length}
          </div>
        </div>
      )}
      {priceLockResult && (() => {
        const isSuccess = priceLockResult.status === 'success' && priceLockResult.lock;
        const lock = priceLockResult.lock;
        const lockPrice = lock ? lock.locked_price : 0;
        const totalPaid = lock ? lock.total_paid : 0;
        const remaining = lock ? lock.remaining_amount : 0;
        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-[#B8913D]/30 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="p-5 sm:p-7">
                {isSuccess ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/40">
                        <Check className="w-4 h-4 text-green-400" />
                      </span>
                      <p className="text-base sm:text-lg font-semibold text-white">Prix bloqué avec succès</p>
                    </div>
                    <p className="mt-3 text-sm text-gray-300 leading-relaxed">
                      Ton billet reste à <span className="font-semibold text-white">{lockPrice} €</span> jusqu’au {lock ? new Date(lock.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}.
                    </p>
                    <div className="mt-5 rounded-xl border border-[#D4AC5B]/25 bg-[#D4AC5B]/[0.05] px-4 py-4 space-y-3">
                      {[
                        ['Déjà payé', `${Math.round(totalPaid)} €`],
                        ['Reste à payer', `${Math.round(remaining)} €`],
                        ['Ton prix bloqué', `${Math.round(lockPrice)} €`],
                        ['Date limite', lock ? new Date(lock.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">{label}</span>
                          <span className="text-sm font-semibold text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-2">
                      <button
                        onClick={() => { setPriceLockResult(null); onNavigate('events'); }}
                        className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all"
                      >
                        Voir mes festivals
                      </button>
                      <button
                        onClick={() => setPriceLockResult(null)}
                        className="w-full py-3 rounded-xl text-sm font-medium border border-[#D4AC5B]/50 text-[#F0D38A] hover:bg-[#D4AC5B]/15 transition-all"
                      >
                        Payer une autre partie
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/40">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </span>
                      <p className="text-base sm:text-lg font-semibold text-white">Paiement non abouti</p>
                    </div>
                    <p className="mt-3 text-sm text-gray-300 leading-relaxed">
                      Le paiement a été annulé ou n’a pas abouti. Aucun prix n’a été bloqué et aucun versement n’a été encaissé.
                    </p>
                    <div className="mt-5 space-y-2">
                      <button
                        onClick={() => setPriceLockResult(null)}
                        className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all"
                      >
                        Réessayer
                      </button>
                      <button
                        onClick={() => setPriceLockResult(null)}
                        className="w-full py-3 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {priceLockModal && (
        priceLockChecking || !priceLockSummary ? (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center">
            <div className="w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-[#B8913D]/30 shadow-2xl">
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="inline-block w-9 h-9 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm text-gray-300">Chargement des données Price Lock…</p>
                {priceLockError && (
                  <div className="mt-6 w-full max-w-xs p-3 rounded-lg bg-red-900/40 border border-red-600/40 text-center">
                    <p className="text-xs text-red-300 leading-relaxed">{priceLockError}</p>
                    <button
                      onClick={closePriceLockModal}
                      className="mt-3 w-full py-2.5 rounded-lg text-xs font-semibold border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : priceLockError ? (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center">
            <div className="w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-[#B8913D]/30 shadow-2xl">
              <div className="flex flex-col items-center justify-center py-14 px-6">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <p className="mt-4 text-sm text-red-300 text-center leading-relaxed">{priceLockError}</p>
                <div className="mt-6 w-full max-w-xs space-y-2">
                  <button
                    onClick={() => openPriceLockModal(priceLockModal.event, priceLockModal.ticketTypeId)}
                    className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all"
                  >
                    Réessayer
                  </button>
                  <button
                    onClick={closePriceLockModal}
                    className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PriceLockModal
            summary={priceLockSummary}
            existingLock={priceLockExisting}
            onClose={closePriceLockModal}
            onViewEvents={() => {
              closePriceLockModal();
              onNavigate('events');
            }}
            onPayOtherPart={() => {
              closePriceLockModal();
              setDetailEvent(priceLockModal.event);
            }}
          />
        )
      )}

      {priceLockPickerEvent && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPriceLockPickerEvent(null)}
        >
          <div
            className="w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-[#B8913D]/30 shadow-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#B8913D]/15 border border-[#B8913D]/40">
                    <Lock className="w-4 h-4 text-[#D4AC5B]" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.22em] text-[#D4AC5B] uppercase">Price Lock</p>
                    <h3 className="text-base sm:text-lg font-semibold text-white leading-tight">{priceLockPickerEvent.title}</h3>
                  </div>
                </div>
                <button
                  onClick={() => setPriceLockPickerEvent(null)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="mt-4 text-sm text-gray-300">
                Quel pass veux-tu bloquer au tarif actuel ?
              </p>

              <div className="mt-4 space-y-2">
                {priceLockPickerEvent.event_ticket_types
                  .filter(ett => ett.is_active && priceLockAvailable(ett as any) && (ett.quantity_available === null || ett.quantity_available - ett.quantity_sold > 0))
                  .map((ett) => {
                    const changeAt = nextPriceChangeAt(ett as any);
                    return (
                      <button
                        key={ett.id}
                        onClick={() => {
                          setPriceLockPickerEvent(null);
                          openPriceLockModal(priceLockPickerEvent, ett.id);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#D4AC5B]/25 bg-[#D4AC5B]/[0.05] hover:bg-[#D4AC5B]/15 hover:border-[#D4AC5B]/50 transition-all text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{ett.ticket_type.name}</p>
                          {ett.ticket_type.description && (
                            <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{ett.ticket_type.description}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {changeAt ? `Hausse le ${changeAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-bold text-white">{Math.round(currentPrice(ett as any))} €</p>
                          {nextPrice(ett as any) != null && (
                            <p className="text-[11px] text-gray-400">Puis {Math.round(nextPrice(ett as any) as number)} €</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>

              <button
                onClick={() => setPriceLockPickerEvent(null)}
                className="mt-5 w-full py-3 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
