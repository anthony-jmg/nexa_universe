import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { X, Lock, AlertCircle, Users } from 'lucide-react';

interface PriceLockRow {
  id: string;
  user_id: string;
  event_ticket_type_id: string;
  locked_price: number;
  deposit_amount: number;
  total_paid: number;
  remaining_amount: number;
  locked_at: string;
  expires_at: string;
  status: string;
  profiles: { full_name: string; email: string } | null;
  event_attendees: {
    attendee_first_name: string | null;
    attendee_last_name: string | null;
    attendee_email: string | null;
    check_in_status: string;
  }[];
}

interface Props {
  eventId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-blue-900/40 text-blue-300 border border-blue-600/40' },
  completed: { label: 'Complété', className: 'bg-green-900/40 text-green-300 border border-green-600/40' },
  expired: { label: 'Expiré', className: 'bg-orange-900/40 text-orange-300 border border-orange-600/40' },
  cancelled: { label: 'Annulé', className: 'bg-red-900/40 text-red-300 border border-red-600/40' },
};

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'completed', label: 'Complétés' },
  { value: 'expired', label: 'Expirés' },
  { value: 'cancelled', label: 'Annulés' },
];

export function PriceLocksList({ eventId, onClose }: Props) {
  const [locks, setLocks] = useState<PriceLockRow[]>([]);
  const [ticketTypeNames, setTicketTypeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    load();
  }, [eventId]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: locksError } = await supabase
        .from('price_locks')
        .select(`
          id, user_id, event_ticket_type_id, locked_price, deposit_amount,
          total_paid, remaining_amount, locked_at, expires_at, status
        `)
        .eq('event_id', eventId)
        .order('locked_at', { ascending: false });

      if (locksError) throw locksError;
      const lockRows = (data as any) || [];

      const userIds = Array.from(new Set(lockRows.map((l: any) => l.user_id).filter(Boolean)));

      const [profilesRes, attendeesRes, ettRes] = await Promise.all([
        userIds.length
          ? supabase.rpc('admin_list_profiles').in('id', userIds).select('id, full_name, email')
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from('event_attendees')
          .select('user_id, attendee_first_name, attendee_last_name, attendee_email, check_in_status')
          .eq('event_id', eventId),
        supabase
          .from('event_ticket_types')
          .select('id, ticket_type:ticket_types (name)')
          .eq('event_id', eventId),
      ]);

      const profilesById = new Map<string, { full_name: string; email: string }>();
      ((profilesRes as any).data || []).forEach((p: any) => {
        if (p?.id) profilesById.set(p.id, { full_name: p.full_name, email: p.email });
      });

      const attendeeByUser = new Map<string, any>();
      ((attendeesRes as any).data || []).forEach((a: any) => {
        if (a?.user_id && !attendeeByUser.has(a.user_id)) attendeeByUser.set(a.user_id, a);
      });

      setLocks(
        lockRows.map((l: any) => ({
          ...l,
          profiles: profilesById.get(l.user_id) ?? null,
          event_attendees: attendeeByUser.has(l.user_id) ? [attendeeByUser.get(l.user_id)] : [],
        }))
      );

      const names: Record<string, string> = {};
      ((ettRes as any).data || []).forEach((e: any) => {
        names[e.id] = e.ticket_type?.name || 'Inconnu';
      });
      setTicketTypeNames(names);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? locks : locks.filter((l) => l.status === filter)),
    [locks, filter]
  );

  const activeCount = locks.filter((l) => l.status === 'active').length;
  const completedCount = locks.filter((l) => l.status === 'completed').length;
  const activeDeposits = locks
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + Number(l.total_paid || 0), 0);

  const statusBadge = (status: string) => {
    const cfg = STATUS_LABELS[status] || { label: status, className: 'bg-gray-700 text-gray-300' };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-[#B8913D] border-opacity-40 w-full max-w-4xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#B8913D] bg-opacity-20 rounded-lg">
              <Lock className="w-6 h-6 text-[#B8913D]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Price Locks</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {activeCount} actif{activeCount !== 1 ? 's' : ''} · {completedCount} complété{completedCount !== 1 ? 's' : ''}
                {activeDeposits > 0 && ` · ${activeDeposits.toFixed(2)} € versés`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 pt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-[#B8913D] text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
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
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Aucun Price Lock {filter !== 'all' ? `« ${FILTERS.find((f) => f.value === filter)?.label} »` : ''} pour cet événement.</p>
          </div>
        ) : (
          <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
            {filtered.map((lock) => {
              const holder = lock.event_attendees?.[0];
              return (
                <div key={lock.id} className="bg-gray-800 bg-opacity-60 rounded-xl border border-gray-700 p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className="w-3.5 h-3.5 text-[#B8913D] flex-shrink-0" />
                        <p className="text-sm font-medium text-white truncate">
                          {lock.profiles?.full_name || 'Utilisateur inconnu'}
                        </p>
                        {statusBadge(lock.status)}
                        {holder && holder.check_in_status === 'awaiting_balance' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-900/40 text-orange-300 border border-orange-600/40">
                            En attente de solde
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">{lock.profiles?.email}</p>
                      {holder && (holder.attendee_first_name || holder.attendee_last_name) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Détenteur : {holder.attendee_first_name} {holder.attendee_last_name}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs space-y-0.5 flex-shrink-0">
                      <p className="text-gray-300 font-medium">{ticketTypeNames[lock.event_ticket_type_id] || 'Billet'}</p>
                      <p className="text-gray-400">Créé le {new Date(lock.locked_at).toLocaleDateString('fr-FR')}</p>
                      <p className="text-gray-400">Expire le {new Date(lock.expires_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-900/60 rounded-lg p-2">
                      <p className="text-sm font-semibold text-white">{Number(lock.locked_price).toFixed(2)} €</p>
                      <p className="text-gray-500">Prix bloqué</p>
                    </div>
                    <div className="bg-gray-900/60 rounded-lg p-2">
                      <p className="text-sm font-semibold text-green-400">{Number(lock.total_paid).toFixed(2)} €</p>
                      <p className="text-gray-500">Versé</p>
                    </div>
                    <div className="bg-gray-900/60 rounded-lg p-2">
                      <p className="text-sm font-semibold text-[#D4AC5B]">{Number(lock.remaining_amount).toFixed(2)} €</p>
                      <p className="text-gray-500">Solde restant</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
