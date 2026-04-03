import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  X,
  TrendingUp,
  Users,
  Ticket,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  UserCheck,
} from 'lucide-react';

interface EventSalesStatsProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

interface TicketStats {
  ticket_type_name: string;
  price: number;
  member_price: number;
  quantity_available: number | null;
  quantity_sold: number;
  confirmed_count: number;
  pending_count: number;
  checked_in_count: number;
  revenue: number;
}

interface OrderStats {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  member_orders: number;
}

interface RecentAttendee {
  attendee_first_name: string;
  attendee_last_name: string;
  attendee_email: string;
  ticket_type_name: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export function EventSalesStats({ eventId, eventTitle, onClose }: EventSalesStatsProps) {
  const [ticketStats, setTicketStats] = useState<TicketStats[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [recentAttendees, setRecentAttendees] = useState<RecentAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'attendees'>('overview');

  useEffect(() => {
    loadStats();
  }, [eventId]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadTicketStats(), loadOrderStats(), loadRecentAttendees()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketStats = async () => {
    const { data: ettData, error: ettError } = await supabase
      .from('event_ticket_types')
      .select(`
        id,
        price,
        member_price,
        quantity_available,
        quantity_sold,
        ticket_type:ticket_types (name)
      `)
      .eq('event_id', eventId);

    if (ettError) throw ettError;

    const statsPromises = (ettData || []).map(async (ett: any) => {
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('id, checked_in')
        .eq('event_ticket_type_id', ett.id);

      const confirmedCount = attendees?.length || 0;
      const checkedInCount = attendees?.filter((a) => a.checked_in).length || 0;

      const { count: pendingCount } = await supabase
        .from('pending_event_attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_ticket_type_id', ett.id);

      return {
        ticket_type_name: ett.ticket_type?.name || 'Inconnu',
        price: ett.price,
        member_price: ett.member_price,
        quantity_available: ett.quantity_available,
        quantity_sold: ett.quantity_sold || confirmedCount,
        confirmed_count: confirmedCount,
        pending_count: pendingCount || 0,
        checked_in_count: checkedInCount,
        revenue: confirmedCount * ett.price,
      } as TicketStats;
    });

    const stats = await Promise.all(statsPromises);
    setTicketStats(stats);
  };

  const loadOrderStats = async () => {
    const { data: ettIds } = await supabase
      .from('event_ticket_types')
      .select('id')
      .eq('event_id', eventId);

    if (!ettIds || ettIds.length === 0) {
      setOrderStats({
        total_orders: 0,
        paid_orders: 0,
        pending_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
        member_orders: 0,
      });
      return;
    }

    const ettIdList = ettIds.map((e: any) => e.id);

    const { data: attendeeOrders } = await supabase
      .from('event_attendees')
      .select('order_id')
      .in('event_ticket_type_id', ettIdList);

    const orderIds = [...new Set((attendeeOrders || []).map((a: any) => a.order_id))];

    if (orderIds.length === 0) {
      setOrderStats({
        total_orders: 0,
        paid_orders: 0,
        pending_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
        member_orders: 0,
      });
      return;
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total_amount, is_member_order')
      .in('id', orderIds);

    const stats: OrderStats = {
      total_orders: orders?.length || 0,
      paid_orders: orders?.filter((o) => o.status === 'paid' || o.status === 'completed').length || 0,
      pending_orders: orders?.filter((o) => o.status === 'pending').length || 0,
      cancelled_orders: orders?.filter((o) => o.status === 'cancelled').length || 0,
      total_revenue: orders
        ?.filter((o) => o.status === 'paid' || o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      member_orders: orders?.filter((o) => o.is_member_order).length || 0,
    };

    setOrderStats(stats);
  };

  const loadRecentAttendees = async () => {
    const { data: ettData } = await supabase
      .from('event_ticket_types')
      .select('id, ticket_type:ticket_types (name)')
      .eq('event_id', eventId);

    if (!ettData || ettData.length === 0) return;

    const ettIdList = ettData.map((e: any) => e.id);
    const ettMap: Record<string, string> = {};
    ettData.forEach((e: any) => {
      ettMap[e.id] = e.ticket_type?.name || 'Inconnu';
    });

    const { data: attendees, error } = await supabase
      .from('event_attendees')
      .select('attendee_first_name, attendee_last_name, attendee_email, event_ticket_type_id, checked_in, checked_in_at, created_at')
      .in('event_ticket_type_id', ettIdList)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    setRecentAttendees(
      (attendees || []).map((a: any) => ({
        ...a,
        ticket_type_name: ettMap[a.event_ticket_type_id] || 'Inconnu',
      }))
    );
  };

  const totalConfirmed = ticketStats.reduce((s, t) => s + t.confirmed_count, 0);
  const totalPending = ticketStats.reduce((s, t) => s + t.pending_count, 0);
  const totalCheckedIn = ticketStats.reduce((s, t) => s + t.checked_in_count, 0);
  const totalRevenue = orderStats?.total_revenue || 0;
  const totalCapacity = ticketStats.reduce(
    (s, t) => s + (t.quantity_available ?? 0),
    0
  );

  const fillRate =
    totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-[#B8913D] border-opacity-40 w-full max-w-4xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#B8913D] bg-opacity-20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-[#B8913D]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Statistiques de vente</h2>
              <p className="text-sm text-gray-400 mt-0.5">{eventTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B8913D]"></div>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="flex items-center space-x-2 text-red-400 bg-red-900 bg-opacity-20 border border-red-600 border-opacity-30 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Revenus confirmés"
                value={`${totalRevenue.toFixed(2)} €`}
                color="gold"
              />
              <StatCard
                icon={<Ticket className="w-5 h-5" />}
                label="Billets vendus"
                value={totalConfirmed.toString()}
                sub={fillRate !== null ? `${fillRate}% de capacité` : undefined}
                color="blue"
              />
              <StatCard
                icon={<UserCheck className="w-5 h-5" />}
                label="Enregistrés"
                value={totalCheckedIn.toString()}
                sub={totalConfirmed > 0 ? `${Math.round((totalCheckedIn / totalConfirmed) * 100)}% des acheteurs` : undefined}
                color="green"
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="En attente"
                value={totalPending.toString()}
                color="orange"
              />
            </div>

            {orderStats && (
              <div className="bg-gray-800 bg-opacity-60 rounded-xl border border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-[#B8913D]" />
                  <span>Résumé des commandes</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <OrderStat label="Total commandes" value={orderStats.total_orders} />
                  <OrderStat label="Payées" value={orderStats.paid_orders} color="green" />
                  <OrderStat label="En attente" value={orderStats.pending_orders} color="orange" />
                  <OrderStat label="Annulées" value={orderStats.cancelled_orders} color="red" />
                </div>
                {orderStats.member_orders > 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    {orderStats.member_orders} commande{orderStats.member_orders > 1 ? 's' : ''} au tarif membre
                  </p>
                )}
              </div>
            )}

            <div className="bg-gray-800 bg-opacity-60 rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-5 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center space-x-2">
                  <Ticket className="w-4 h-4 text-[#B8913D]" />
                  <span>Détail par type de billet</span>
                </h3>
              </div>
              {ticketStats.length === 0 ? (
                <p className="text-gray-400 text-sm p-5">Aucun type de billet configuré.</p>
              ) : (
                <div className="divide-y divide-gray-700">
                  {ticketStats.map((ts, i) => {
                    const cap = ts.quantity_available;
                    const fill = cap && cap > 0 ? Math.round((ts.confirmed_count / cap) * 100) : null;
                    return (
                      <div key={i} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-white">{ts.ticket_type_name}</p>
                            <p className="text-sm text-gray-400">
                              {ts.price} € &nbsp;·&nbsp; Membre : {ts.member_price} €
                            </p>
                          </div>
                          <span className="text-lg font-semibold text-[#B8913D]">
                            {ts.revenue.toFixed(2)} €
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="text-center bg-gray-900 bg-opacity-50 rounded-lg p-2">
                            <p className="text-xl font-semibold text-white">{ts.confirmed_count}</p>
                            <p className="text-gray-400 text-xs">Confirmés</p>
                          </div>
                          <div className="text-center bg-gray-900 bg-opacity-50 rounded-lg p-2">
                            <p className="text-xl font-semibold text-green-400">{ts.checked_in_count}</p>
                            <p className="text-gray-400 text-xs">Enregistrés</p>
                          </div>
                          <div className="text-center bg-gray-900 bg-opacity-50 rounded-lg p-2">
                            <p className="text-xl font-semibold text-orange-400">{ts.pending_count}</p>
                            <p className="text-gray-400 text-xs">En attente</p>
                          </div>
                        </div>

                        {fill !== null && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Remplissage</span>
                              <span>{ts.confirmed_count} / {ts.quantity_available} places ({fill}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(fill, 100)}%`,
                                  background: fill >= 90
                                    ? '#ef4444'
                                    : fill >= 70
                                    ? '#f97316'
                                    : '#B8913D',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-800 bg-opacity-60 rounded-xl border border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#B8913D]" />
                  <span>Participants récents</span>
                </h3>
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeSection === 'overview' ? 'bg-[#B8913D] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setActiveSection('attendees')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeSection === 'attendees' ? 'bg-[#B8913D] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Enregistrés
                  </button>
                </div>
              </div>

              {recentAttendees.length === 0 ? (
                <p className="text-gray-400 text-sm p-5">Aucun participant pour le moment.</p>
              ) : (
                <div className="divide-y divide-gray-700 max-h-72 overflow-y-auto">
                  {recentAttendees
                    .filter((a) => activeSection === 'overview' || a.checked_in)
                    .map((attendee, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="flex-shrink-0">
                            {attendee.checked_in ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {attendee.attendee_first_name} {attendee.attendee_last_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{attendee.attendee_email}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right ml-4">
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                            {attendee.ticket_type_name}
                          </span>
                          {attendee.checked_in && attendee.checked_in_at && (
                            <p className="text-xs text-green-400 mt-1">
                              {new Date(attendee.checked_in_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: 'gold' | 'blue' | 'green' | 'orange';
}) {
  const colors = {
    gold: 'text-[#B8913D] bg-[#B8913D]',
    blue: 'text-blue-400 bg-blue-400',
    green: 'text-green-400 bg-green-400',
    orange: 'text-orange-400 bg-orange-400',
  };

  return (
    <div className="bg-gray-800 bg-opacity-60 rounded-xl border border-gray-700 p-4">
      <div className={`inline-flex p-2 rounded-lg bg-opacity-10 mb-3 ${colors[color]}`}>
        <span className={colors[color].split(' ')[0]}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function OrderStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'green' | 'orange' | 'red';
}) {
  const textColor = color === 'green'
    ? 'text-green-400'
    : color === 'orange'
    ? 'text-orange-400'
    : color === 'red'
    ? 'text-red-400'
    : 'text-white';

  return (
    <div className="text-center">
      <p className={`text-2xl font-semibold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
