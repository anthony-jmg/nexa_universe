import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Ticket,
  MapPin,
  Lock,
  X,
  XCircle
} from 'lucide-react';
import {
  getPriceLockRepurchaseQuote,
  startPriceLockBalanceCheckout,
  startPriceLockRepurchaseCheckout,
  type PriceLockRepurchaseQuote,
} from '../lib/priceLock';
import { formatPrice } from '../lib/formatEuro';
import { formatDate, formatLongDate } from '../lib/locale';
import { priceLockErrorMessage } from '../lib/purchaseErrors';

interface AttendeeWithDetails {
  id: string;
  event_id: string;
  user_id: string;
  event_ticket_type_id: string | null;
  qr_code: string;
  check_in_status: string;
  checked_in_at: string | null;
  purchased_at: string | null;
  created_at: string | null;
  pass_status: 'pending' | 'available';
  pass_file_path: string | null;
  weezevent_sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
  attendee_first_name: string | null;
  attendee_last_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  event_ticket_types: {
    id: string;
    price: number;
    ticket_types: {
      name: string;
    };
  } | null;
  events: {
    id: string;
    title: string;
    location: string;
    start_date: string;
    end_date: string | null;
    thumbnail_url: string | null;
  };
}

interface PriceLockWithEvent {
  id: string;
  event_id: string;
  locked_price: number;
  deposit_amount: number;
  total_paid: number;
  remaining_amount: number;
  expires_at: string | null;
  status: string;
  balance_payment_mode: 'manual' | 'automatic';
  auto_balance_payment_at: string | null;
  auto_balance_payment_status: string | null;
  event_ticket_types: {
    id: string;
    ticket_types: { name: string } | null;
  } | null;
  events: {
    id: string;
    title: string;
    start_date: string;
  } | null;
}

// Événement d'un pass renvoyé par get_my_pass_events : reste lisible quand il
// est annulé (la RLS publique le masque), avec le montant réellement payé par
// billet (attendee_amounts, clé = id du billet).
interface PassEvent {
  event_id: string;
  title: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  thumbnail_url: string | null;
  event_status: string;
  is_active: boolean;
  attendee_amounts: Record<string, number | string> | null;
}

// Expiré dès la date limite dépassée, même avant le passage du cron serveur.
const isLockExpired = (lock: PriceLockWithEvent) =>
  lock.status === 'expired' || (lock.expires_at != null && new Date(lock.expires_at).getTime() <= Date.now());

const CANCELLED_BADGE = 'bg-red-900 bg-opacity-40 text-red-400 border-red-600 border-opacity-40';
const REFUND_NOTICE = 'mt-3 rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-xs sm:text-sm text-red-200';

// Clés du dictionnaire par statut d'offre de rachat (aucun bouton d'achat).
const REPURCHASE_MESSAGES: Partial<Record<PriceLockRepurchaseQuote['status'], string>> = {
  contact_us: 'myPasses.repurchase.contactUs',
  sold_out: 'myPasses.repurchase.soldOut',
  unavailable: 'myPasses.repurchase.unavailable',
};

interface MyPurchasesProps {
  onNavigate: (page: string, params?: any) => void;
}

export function MyPurchases({ onNavigate }: MyPurchasesProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { clearCart } = useCart();
  const [tickets, setTickets] = useState<AttendeeWithDetails[]>([]);
  const [priceLocks, setPriceLocks] = useState<PriceLockWithEvent[]>([]);
  const [passEvents, setPassEvents] = useState<Record<string, PassEvent>>({});
  const [payingLockId, setPayingLockId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<AttendeeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [errorPay, setErrorPay] = useState<{ lockId: string; message: string } | null>(null);
  // Price Locks expirés : offre de rachat calculée côté serveur (prix actuel − versement).
  const [repurchaseQuotes, setRepurchaseQuotes] = useState<Record<string, PriceLockRepurchaseQuote | null>>({});

  useEffect(() => {
    if (!user) {
      onNavigate('signin');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (payment === 'success' && sessionId) {
      clearCart();
      verifyPayment(sessionId);
    } else if (payment === 'cancelled') {
      cancelPendingOrder();
    } else {
      loadData();
    }
  }, [user]);

  const cancelPendingOrder = async () => {
    const pendingOrderId = localStorage.getItem('pendingOrderId');
    localStorage.removeItem('pendingOrderId');
    localStorage.removeItem('pendingEventTickets');
    localStorage.removeItem('pendingAttendees');

    if (pendingOrderId) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', pendingOrderId)
        .eq('user_id', user!.id)
        .eq('status', 'pending');

      await supabase.rpc('release_stock_reservation', { p_order_id: pendingOrderId });
    }

    await loadData();
    window.history.replaceState({}, '', window.location.pathname);
  };

  const verifyPayment = async (sessionId: string) => {
    setVerifyingPayment(true);
    setLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      await response.json();
    } catch (err) {
      console.error('Payment verification error:', err);
    } finally {
      setVerifyingPayment(false);
      await loadData();
    }
  };

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    await Promise.all([
      loadTickets(),
      loadPriceLocks()
    ]);
    setLoading(false);
  };

  const loadTickets = async () => {
    if (!user) return;

    const [{ data, error }, { data: hiddenIds }, { data: passEventRows }] = await Promise.all([
      supabase
        .from('event_attendees')
        .select(`
          *,
          event_ticket_types (
            id,
            price,
            ticket_types (name)
          ),
          events (
            id,
            title,
            location,
            start_date,
            end_date,
            thumbnail_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      // Réservations annulées à l'expiration d'un Price Lock : remplacées par
      // le rachat ou sans valeur pour le client. Masquées ici uniquement
      // (données conservées, visibles côté admin). En cas d'erreur : rien masqué.
      supabase.rpc('get_my_expired_price_lock_reservation_ids'),
      // Événements de mes pass, y compris annulés. En cas d'erreur : comportement précédent.
      supabase.rpc('get_my_pass_events'),
    ]);

    const events: Record<string, PassEvent> = {};
    for (const event of (passEventRows as PassEvent[] | null) ?? []) events[event.event_id] = event;
    setPassEvents(events);

    if (!error && data) {
      const hidden = new Set((hiddenIds as string[] | null) ?? []);
      // Événement dépublié (brouillon) : masqué par RLS, il revient à null.
      // On n'affiche pas ces billets plutôt que de faire planter la page.
      // Événement annulé : repris de get_my_pass_events, le billet reste visible.
      setTickets(
        (data as unknown as AttendeeWithDetails[])
          .map((ticket) => {
            const event = events[ticket.event_id];
            if (ticket.events || !event) return ticket;
            return {
              ...ticket,
              events: {
                id: event.event_id,
                title: event.title,
                location: event.location ?? '',
                start_date: event.start_date,
                end_date: event.end_date,
                thumbnail_url: event.thumbnail_url,
              },
            };
          })
          .filter((ticket) => ticket.events && !hidden.has(ticket.id))
      );
    }
  };

  const loadPriceLocks = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('price_locks')
      .select(`
        id,
        event_id,
        locked_price,
        deposit_amount,
        total_paid,
        remaining_amount,
        expires_at,
        status,
        balance_payment_mode,
        auto_balance_payment_at,
        auto_balance_payment_status,
        event_ticket_types (
          id,
          ticket_types (name)
        ),
        events (id, title, start_date)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'expired'])
      // Crédit déjà utilisé : le pass apparaît dans « Mes billets ».
      .is('credit_consumed_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const locks = data as unknown as PriceLockWithEvent[];
      setPriceLocks(locks);
      const expired = locks.filter(isLockExpired);
      const quotes = await Promise.all(expired.map((lock) => getPriceLockRepurchaseQuote(lock.id)));
      setRepurchaseQuotes(Object.fromEntries(expired.map((lock, i) => [lock.id, quotes[i]])));
    }
  };

  const handlePayBalance = async (lock: PriceLockWithEvent) => {
    setPayingLockId(lock.id);
    setErrorPay(null);
    try {
      const checkoutUrl = await startPriceLockBalanceCheckout(lock);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setErrorPay({ lockId: lock.id, message: priceLockErrorMessage(err, t) });
      setPayingLockId(null);
    }
  };

  // Nouvel achat au prix public actuel, versement du Price Lock expiré déduit.
  const handleRepurchase = async (lock: PriceLockWithEvent, amountDue: number) => {
    setPayingLockId(lock.id);
    setErrorPay(null);
    try {
      const checkoutUrl = await startPriceLockRepurchaseCheckout(lock.id, amountDue);
      window.location.href = checkoutUrl;
    } catch (err) {
      setErrorPay({ lockId: lock.id, message: priceLockErrorMessage(err, t) });
      setPayingLockId(null);
    }
  };

  const cancelTicket = async (ticketId: string) => {
    if (!confirm(t('myPasses.ticket.cancelConfirm'))) {
      return;
    }

    const { error } = await supabase
      .from('event_attendees')
      .update({ check_in_status: 'cancelled' })
      .eq('id', ticketId)
      .eq('check_in_status', 'not_checked_in');

    if (!error) {
      loadTickets();
      setSelectedTicket(null);
    }
  };

  // Événement annulé : aucun paiement possible, sommes encaissées remboursées.
  const isEventCancelled = (eventId: string) => passEvents[eventId]?.event_status === 'cancelled';

  // Montant réellement payé pour ce billet (commande ou Price Lock), jamais le prix actuel.
  const getAmountPaid = (ticket: AttendeeWithDetails): number | null => {
    const amount = passEvents[ticket.event_id]?.attendee_amounts?.[ticket.id];
    return amount == null ? null : Number(amount);
  };

  // Statut lisible du billet : paiement du solde, puis émission du billet
  // officiel (Weezevent). Aucune erreur technique n'est affichée au client.
  const getTicketStatusBadge = (ticket: AttendeeWithDetails) => {
    const badge = (className: string, Icon: typeof Clock, label: string) => (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm border ${className}`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </span>
    );
    const gold = 'bg-[#D4AC5B] bg-opacity-20 text-[#F0D38A] border-[#D4AC5B] border-opacity-50';
    const green = 'bg-green-900 bg-opacity-40 text-green-400 border-green-600 border-opacity-40';

    if (isEventCancelled(ticket.event_id)) {
      return badge(CANCELLED_BADGE, XCircle, t('myPasses.cancelled.badge'));
    }
    switch (ticket.check_in_status) {
      case 'cancelled':
        return badge(CANCELLED_BADGE, XCircle, t('myPasses.status.cancelled'));
      case 'checked_in':
        return badge('bg-blue-900 bg-opacity-40 text-blue-400 border-blue-600 border-opacity-40', CheckCircle, t('myPasses.status.used'));
      case 'awaiting_balance':
        return badge(gold, Clock, t('myPasses.status.awaitingBalance'));
    }
    if (ticket.weezevent_sync_status === 'failed') {
      return badge('bg-orange-900 bg-opacity-40 text-orange-400 border-orange-600 border-opacity-40', AlertCircle, t('myPasses.status.issueFailed'));
    }
    if (ticket.weezevent_sync_status === 'synced') {
      return badge(green, CheckCircle, t('myPasses.status.sent'));
    }
    if (ticket.weezevent_sync_status === 'skipped') {
      // Pas d'émission Weezevent prévue pour ce billet : on ne promet rien.
      return badge(green, CheckCircle, t('myPasses.status.confirmed'));
    }
    return badge(gold, Clock, t('myPasses.status.pendingIssue'));
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-96 h-96 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-96 h-96 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mb-2 px-2">
            {t('purchases.title')}
          </h1>
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-sm sm:text-base text-gray-400 px-4">{t('purchases.subtitle')}</p>
        </div>

        {loading ? (
          <div className="text-center py-16 sm:py-20">
            <div className="inline-block w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
            {verifyingPayment && (
              <p className="mt-4 text-gray-400 text-sm">{t('payment.verifying')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
          <section className="space-y-4 sm:space-y-6">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-medium text-white">
              <Lock className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
              <span>{t('myPasses.locks.title')}</span>
            </h2>
            {priceLocks.length === 0 && (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <p className="text-sm sm:text-base text-gray-400">{t('myPasses.locks.empty')}</p>
              </div>
            )}
            {priceLocks.map((lock) => {
              const isExpired = isLockExpired(lock);
              const quote = isExpired ? repurchaseQuotes[lock.id] : undefined;
              // Événement annulé : visible, sans paiement ni rachat, sommes encaissées remboursées.
              const cancelled = isEventCancelled(lock.event_id) || quote?.status === 'event_cancelled';

              return (
              <div
                key={`lock-${lock.id}`}
                className="bg-gradient-to-br from-[#D4AC5B]/10 to-gray-900/60 backdrop-blur-sm border border-[#D4AC5B]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 w-full min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-[#F0D38A] flex-shrink-0" />
                      <h3 className="text-base sm:text-lg font-medium text-white">{isExpired ? t('myPasses.lock.expiredTitle') : 'Price Lock'}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        cancelled
                          ? 'border-red-600/50 bg-red-900/30 text-red-300'
                          : isExpired
                          ? 'border-gray-500/50 bg-gray-500/10 text-gray-300'
                          : 'border-[#D4AC5B]/50 bg-[#D4AC5B]/10 text-[#F0D38A]'
                      }`}>
                        {cancelled
                          ? t('myPasses.cancelled.badge')
                          : isExpired ? t('myPasses.lock.badgeExpired') : t('myPasses.lock.badgeActive')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">{lock.events?.title ?? passEvents[lock.event_id]?.title ?? quote?.event_title}</p>
                    {lock.event_ticket_types?.ticket_types?.name && (
                      <p className="text-xs sm:text-sm font-medium text-[#B8913D] mb-1">{lock.event_ticket_types.ticket_types.name}</p>
                    )}
                    {lock.expires_at && !(cancelled && !isExpired) && (
                      <p className="text-xs text-gray-400">
                        {isExpired
                          ? t('myPasses.lock.expiredOn', { date: formatLongDate(lock.expires_at) })
                          : t('myPasses.lock.guaranteedUntil', { date: formatLongDate(lock.expires_at) })}
                      </p>
                    )}
                    {cancelled ? (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-400 mt-2">
                          {!isExpired && (
                            <span>{t('myPasses.lock.lockedPrice')} <span className="text-white font-medium">{formatPrice(lock.locked_price)}</span></span>
                          )}
                          <span>{t('myPasses.lock.alreadyPaid')} <span className="text-white font-medium">{formatPrice(lock.total_paid)}</span></span>
                          {/* Solde affiché à titre informatif uniquement : plus payable. */}
                          {!isExpired && Number(lock.remaining_amount) > 0 && (
                            <span>{t('myPasses.lock.balance')} <span className="text-gray-300 font-medium">{formatPrice(lock.remaining_amount)}</span></span>
                          )}
                        </div>
                        <p className={REFUND_NOTICE}>{t('myPasses.lock.eventCancelled')}</p>
                      </>
                    ) : isExpired && quote?.status === 'credit_lapsed' ? (
                      // Fin de validité atteinte : montant définitivement inutilisable.
                      <p className="mt-3 rounded-lg border border-gray-600/50 bg-gray-800/60 px-3 py-2 text-xs sm:text-sm text-gray-300">
                        {t(quote.lapsed_reason === 'sales_closed' ? 'myPasses.lock.lapsedSalesClosed' : 'myPasses.lock.lapsedEventStarted', { amount: formatPrice(lock.total_paid) })}
                      </p>
                    ) : isExpired ? (
                      <>
                        <p className="text-sm text-gray-300 mt-2">{t('myPasses.lock.noLongerGuaranteed')}</p>
                        <p className="text-sm text-gray-300">
                          {t('myPasses.lock.deductible', { amount: formatPrice(lock.total_paid) })}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-400 mt-2">
                          <span>{t('myPasses.lock.currentPrice')} <span className="text-white font-medium">{quote?.current_price != null ? formatPrice(quote.current_price) : '—'}</span></span>
                          <span>{t('myPasses.lock.alreadyPaidExpired')} <span className="text-white font-medium">{formatPrice(lock.total_paid)}</span></span>
                          {quote?.status === 'available' && quote.amount_due != null && (
                            <span>{t('myPasses.lock.leftToPay')} <span className="text-[#F0D38A] font-semibold">{formatPrice(quote.amount_due)}</span></span>
                          )}
                        </div>
                        {quote && quote.status !== 'available' && REPURCHASE_MESSAGES[quote.status] && (
                          <p className="mt-3 rounded-lg border border-gray-600/50 bg-gray-800/60 px-3 py-2 text-xs sm:text-sm text-gray-300">
                            {t(REPURCHASE_MESSAGES[quote.status] as string)}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-400 mt-2">
                        <span>{t('myPasses.lock.lockedPrice')} <span className="text-white font-medium">{formatPrice(lock.locked_price)}</span></span>
                        <span>{t('myPasses.lock.alreadyPaid')} <span className="text-white font-medium">{formatPrice(lock.total_paid)}</span></span>
                        <span>{t('myPasses.lock.balance')} <span className="text-[#F0D38A] font-semibold">{formatPrice(lock.remaining_amount)}</span></span>
                      </div>
                    )}
                    {!isExpired && !cancelled && lock.balance_payment_mode === 'automatic' && !lock.auto_balance_payment_status && lock.auto_balance_payment_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {t('myPasses.lock.autoScheduled', { date: formatLongDate(lock.auto_balance_payment_at) })}
                      </p>
                    )}
                    {!isExpired && !cancelled && lock.auto_balance_payment_status === 'failed' && (
                      // Raison technique (Stripe) volontairement non affichée au client.
                      <p className="mt-3 rounded-lg border border-[#D4AC5B]/40 bg-[#D4AC5B]/10 px-3 py-2 text-xs sm:text-sm text-[#F0D38A]">
                        {t('myPasses.lock.autoFailed')}
                      </p>
                    )}
                  </div>
                  {cancelled ? null : isExpired ? (
                    quote?.status === 'available' && quote.amount_due != null && (
                      <button
                        onClick={() => handleRepurchase(lock, Number(quote.amount_due))}
                        disabled={payingLockId === lock.id}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] text-gray-950 text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#D4AC5B]/30 transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        {payingLockId === lock.id ? t('myPasses.lock.redirecting') : t('myPasses.lock.buyAtCurrentPrice', { amount: formatPrice(quote.amount_due) })}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handlePayBalance(lock)}
                      disabled={payingLockId === lock.id || Number(lock.remaining_amount) <= 0}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] text-gray-950 text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#D4AC5B]/30 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {payingLockId === lock.id ? t('myPasses.lock.redirecting') : t('myPasses.lock.payBalance', { amount: formatPrice(lock.remaining_amount) })}
                    </button>
                  )}
                </div>
                {errorPay?.lockId === lock.id && (
                  <p className="mt-3 text-xs sm:text-sm text-red-400">{errorPay.message}</p>
                )}
              </div>
              );
            })}
          </section>

          <section className="space-y-4 sm:space-y-6">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-medium text-white">
              <Ticket className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
              <span>{t('myPasses.tickets.title')}</span>
            </h2>
            {tickets.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <p className="text-sm sm:text-base text-gray-400 mb-4">{t('myPasses.tickets.empty')}</p>
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  {t('myPasses.tickets.discover')}
                </button>
              </div>
            ) : (
              <>
                {Object.values(
                  tickets.reduce((acc, ticket) => {
                    const eventId = ticket.event_id;
                    if (!acc[eventId]) {
                      acc[eventId] = {
                        event: ticket.events,
                        tickets: []
                      };
                    }
                    acc[eventId].tickets.push(ticket);
                    return acc;
                  }, {} as Record<string, { event: AttendeeWithDetails['events']; tickets: AttendeeWithDetails[] }>)
                ).map(({ event, tickets: eventTickets }) => {
                  const eventDate = new Date(event.start_date);
                  const isPast = eventDate < new Date();
                  const eventCancelled = isEventCancelled(event.id);

                  return (
                    <div
                      key={event.id}
                      className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden"
                    >
                      <div className="p-4 sm:p-6 border-b border-gray-700">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                          <div className="w-full">
                            <h2 className="text-lg sm:text-xl md:text-2xl font-medium text-white mb-2 sm:mb-3">{event.title}</h2>
                            <div className="space-y-1.5 sm:space-y-2">
                              <div className="flex items-center space-x-2 text-gray-300">
                                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8913D] flex-shrink-0" />
                                <span className="text-xs sm:text-sm">
                                  {formatDate(eventDate, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center space-x-2 text-gray-300">
                                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8913D] flex-shrink-0" />
                                  <span className="text-xs sm:text-sm truncate">{event.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {eventCancelled ? (
                            <span className={`px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap border ${CANCELLED_BADGE}`}>
                              {t('myPasses.cancelled.badge')}
                            </span>
                          ) : isPast && (
                            <span className="px-2.5 sm:px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-xs sm:text-sm whitespace-nowrap">
                              {t('myPasses.tickets.past')}
                            </span>
                          )}
                        </div>
                        {eventCancelled && <p className={REFUND_NOTICE}>{t('myPasses.lock.eventCancelled')}</p>}
                      </div>

                      <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {eventTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-3 sm:p-4 bg-gray-800 bg-opacity-50 rounded-lg sm:rounded-xl border border-gray-700 hover:border-[#B8913D] transition-all cursor-pointer active:scale-95"
                              onClick={() => setSelectedTicket(ticket)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  {ticket.event_ticket_types?.ticket_types && (
                                    <p className="text-xs sm:text-sm font-medium text-[#B8913D] mb-1 truncate">
                                      {ticket.event_ticket_types.ticket_types.name}
                                    </p>
                                  )}
                                  {(ticket.attendee_first_name || ticket.attendee_last_name) && (
                                    <p className="text-xs sm:text-sm text-white font-medium truncate">
                                      {[ticket.attendee_first_name, ticket.attendee_last_name].filter(Boolean).join(' ')}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {ticket.purchased_at
                                      ? t('myPasses.tickets.purchasedOn', { date: formatDate(ticket.purchased_at) })
                                      : ''}
                                  </p>
                                  {eventCancelled && getAmountPaid(ticket) != null && (
                                    <p className="text-xs text-gray-300 mt-1">
                                      {t('myPasses.cancelled.amountPaid')} <span className="text-white font-medium">{formatPrice(getAmountPaid(ticket) as number)}</span>
                                    </p>
                                  )}
                                </div>
                                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0 ml-2" />
                              </div>

                              <div className="mt-3 pt-3 border-t border-gray-700">
                                {getTicketStatusBadge(ticket)}
                              </div>

                              {ticket.check_in_status === 'checked_in' && ticket.checked_in_at && (
                                <p className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {t('myPasses.tickets.scannedOn', {
                                      date: formatDate(ticket.checked_in_at, {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }),
                                    })}
                                  </span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </section>
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-md w-full p-5 sm:p-8 border border-[#B8913D] border-opacity-30 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTicket(null)}
              aria-label={t('myPasses.modal.close')}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <h3 className="text-xl sm:text-2xl font-medium text-white mb-5 sm:mb-6 text-center pr-8">Pass</h3>

            <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">{t('myPasses.modal.event')}</p>
                <p className="text-sm sm:text-base text-white font-medium">{selectedTicket.events.title}</p>
              </div>

              {selectedTicket.event_ticket_types?.ticket_types && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-400">{t('myPasses.modal.ticketType')}</p>
                  <p className="text-sm sm:text-base text-[#B8913D] font-medium">{selectedTicket.event_ticket_types.ticket_types.name}</p>
                </div>
              )}

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-2">{t('myPasses.modal.status')}</p>
                {getTicketStatusBadge(selectedTicket)}
              </div>

              {(selectedTicket.attendee_first_name || selectedTicket.attendee_last_name || selectedTicket.attendee_email || selectedTicket.attendee_phone) && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs sm:text-sm text-gray-400 mb-2">{t('myPasses.modal.participant')}</p>
                  <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                    {(selectedTicket.attendee_first_name || selectedTicket.attendee_last_name) && (
                      <p className="text-white font-medium text-sm sm:text-base">
                        {[selectedTicket.attendee_first_name, selectedTicket.attendee_last_name].filter(Boolean).join(' ')}
                      </p>
                    )}
                    {selectedTicket.attendee_email && (
                      <p className="text-gray-400 text-xs sm:text-sm">{selectedTicket.attendee_email}</p>
                    )}
                    {selectedTicket.attendee_phone && (
                      <p className="text-gray-400 text-xs sm:text-sm">{selectedTicket.attendee_phone}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isEventCancelled(selectedTicket.event_id) && (
              <div className="pt-1">
                {getAmountPaid(selectedTicket) != null && (
                  <p className="text-sm text-gray-300">
                    {t('myPasses.cancelled.amountPaid')} <span className="text-white font-medium">{formatPrice(getAmountPaid(selectedTicket) as number)}</span>
                  </p>
                )}
                <p className={REFUND_NOTICE}>{t('myPasses.lock.eventCancelled')}</p>
              </div>
            )}

            {!isEventCancelled(selectedTicket.event_id) && selectedTicket.check_in_status === 'awaiting_balance' && (
              <div className="text-center py-2">
                <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-orange-400 font-medium mb-1">{t('myPasses.status.awaitingBalance')}</p>
                <p className="text-xs text-gray-400">{t('myPasses.modal.awaitingBalanceText')}</p>
              </div>
            )}

            {/* Billet officiel = billet Weezevent uniquement : l'ancien PDF importé
                par l'admin (pass_file_path) n'est plus proposé ici. Données conservées. */}

            {!isEventCancelled(selectedTicket.event_id) && selectedTicket.check_in_status === 'not_checked_in' && (
              selectedTicket.weezevent_sync_status === 'synced' ? (
                <div className="text-center py-2">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-sm sm:text-base text-green-400 font-medium mb-1">{t('myPasses.status.sent')}</p>
                  <p className="text-xs text-gray-400">{t('myPasses.modal.sentText')}</p>
                </div>
              ) : selectedTicket.weezevent_sync_status === 'failed' ? (
                <div className="text-center py-2">
                  <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400 mx-auto mb-3" />
                  <p className="text-sm sm:text-base text-orange-400 font-medium mb-1">{t('myPasses.status.issueFailed')}</p>
                  <p className="text-xs text-gray-400">
                    {t('myPasses.modal.issueFailedText')}
                  </p>
                </div>
              ) : selectedTicket.weezevent_sync_status === 'skipped' ? (
                <div className="text-center py-2">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-sm sm:text-base text-green-400 font-medium mb-1">{t('myPasses.status.confirmed')}</p>
                  <p className="text-xs text-gray-400">{t('myPasses.modal.confirmedText')}</p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-[#D4AC5B] mx-auto mb-3" />
                  <p className="text-sm sm:text-base text-[#F0D38A] font-medium mb-1">{t('myPasses.status.pendingIssue')}</p>
                  <p className="text-xs text-gray-400">
                    {t('myPasses.modal.pendingIssueText')}
                  </p>
                </div>
              )
            )}

            {!isEventCancelled(selectedTicket.event_id) && selectedTicket.check_in_status === 'not_checked_in' && (
              <button
                onClick={() => cancelTicket(selectedTicket.id)}
                className="w-full mt-2 py-2.5 border border-red-600 text-red-400 text-sm sm:text-base rounded-lg hover:bg-red-900 hover:bg-opacity-20 transition-colors"
              >
                {t('myPasses.modal.cancelTicket')}
              </button>
            )}

            {selectedTicket.check_in_status === 'checked_in' && (
              <div className="text-center">
                <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-green-400 font-medium mb-2">{t('myPasses.modal.used')}</p>
                {selectedTicket.checked_in_at && (
                  <p className="text-xs sm:text-sm text-gray-400">
                    {t('myPasses.tickets.scannedOn', {
                      date: formatDate(selectedTicket.checked_in_at, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }),
                    })}
                  </p>
                )}
              </div>
            )}

            {selectedTicket.check_in_status === 'cancelled' && (
              <div className="text-center">
                <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-red-400 font-medium">{t('myPasses.modal.cancelled')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
