import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Eye, Calendar, Check, Clock, X } from 'lucide-react';

interface Payment {
  id: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface PaymentLineItem {
  id: string;
  item_type: string;
  item_id: string;
  amount: number;
  sale_date: string;
}

interface RevenueStats {
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  videoSales: number;
  programSales: number;
  subscriptionSales: number;
}

export default function ProfessorPaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0,
    videoSales: 0,
    programSales: 0,
    subscriptionSales: 0
  });
  const [showPaymentDetails, setShowPaymentDetails] = useState<string | null>(null);
  const [paymentLineItems, setPaymentLineItems] = useState<PaymentLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPayments(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('professor_payments')
      .select('*')
      .eq('professor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading payments:', error);
      return;
    }

    setPayments(data || []);
  };

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const videoIds = (await supabase
      .from('videos')
      .select('id')
      .eq('professor_id', user.id)
    ).data?.map(v => v.id) || [];

    const { data: rawVideoSales } = videoIds.length > 0 ? await supabase
      .from('order_items')
      .select('price_paid, orders!inner(status)')
      .eq('item_type', 'video')
      .in('item_id', videoIds) : { data: [] };

    const videoSales = (rawVideoSales || []).filter(
      item => (item.orders as any)?.status === 'completed'
    );

    const programIds = (await supabase
      .from('programs')
      .select('id')
      .eq('professor_id', user.id)
    ).data?.map(p => p.id) || [];

    const { data: rawProgramSales } = programIds.length > 0 ? await supabase
      .from('order_items')
      .select('price_paid, orders!inner(status)')
      .eq('item_type', 'program')
      .in('item_id', programIds) : { data: [] };

    const programSales = (rawProgramSales || []).filter(
      item => (item.orders as any)?.status === 'completed'
    );

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('price_paid')
      .eq('professor_id', user.id)
      .eq('status', 'active');

    const { data: paidPayments } = await supabase
      .from('professor_payments')
      .select('amount')
      .eq('professor_id', user.id)
      .eq('status', 'paid');

    const { data: pendingPayments } = await supabase
      .from('professor_payments')
      .select('amount')
      .eq('professor_id', user.id)
      .eq('status', 'pending');

    const videoTotal = videoSales?.reduce((sum, item) => sum + parseFloat(item.price_paid), 0) || 0;
    const programTotal = programSales?.reduce((sum, item) => sum + parseFloat(item.price_paid), 0) || 0;
    const subscriptionTotal = subscriptions?.reduce((sum, sub) => sum + parseFloat(sub.price_paid), 0) || 0;
    const paidTotal = paidPayments?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;
    const pendingTotal = pendingPayments?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;

    setStats({
      totalRevenue: videoTotal + programTotal + subscriptionTotal,
      totalPaid: paidTotal,
      totalPending: pendingTotal,
      videoSales: videoTotal,
      programSales: programTotal,
      subscriptionSales: subscriptionTotal
    });
  };

  const loadPaymentDetails = async (paymentId: string) => {
    const { data, error } = await supabase
      .from('payment_line_items')
      .select('*')
      .eq('payment_id', paymentId)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error loading payment details:', error);
      return;
    }

    setPaymentLineItems(data || []);
    setShowPaymentDetails(paymentId);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Mes Revenus</h2>
        <p className="text-gray-400">Suivez vos revenus et paiements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-green-300">Total Payé</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalPaid)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-yellow-300">En Attente</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalPending)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-300">Revenu Total</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Ventes Vidéos</p>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.videoSales)}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Ventes Programmes</p>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.programSales)}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Abonnements</p>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.subscriptionSales)}</p>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Historique des Paiements</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-6 py-3 font-medium">Période</th>
                <th className="px-6 py-3 font-medium">Montant</th>
                <th className="px-6 py-3 font-medium">Statut</th>
                <th className="px-6 py-3 font-medium">Date Paiement</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-6 py-4 text-gray-300">
                    {formatDate(payment.period_start)} - {formatDate(payment.period_end)}
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{formatCurrency(parseFloat(payment.amount.toString()))}</td>
                  <td className="px-6 py-4">
                    {payment.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">
                        <Check className="w-4 h-4" />
                        Payé
                      </span>
                    )}
                    {payment.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm">
                        <Calendar className="w-4 h-4" />
                        En attente
                      </span>
                    )}
                    {payment.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded-lg text-sm">
                        <X className="w-4 h-4" />
                        Annulé
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => loadPaymentDetails(payment.id)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Aucun paiement enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPaymentDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Détails du paiement</h3>

            <div className="space-y-2">
              {paymentLineItems.map((item) => (
                <div key={item.id} className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">
                      {item.item_type === 'video_purchase' && 'Achat vidéo'}
                      {item.item_type === 'program_purchase' && 'Achat programme'}
                      {item.item_type === 'subscription' && 'Abonnement'}
                    </div>
                    <div className="text-sm text-gray-400">{formatDate(item.sale_date)}</div>
                  </div>
                  <div className="text-white font-semibold">{formatCurrency(parseFloat(item.amount.toString()))}</div>
                </div>
              ))}
              {paymentLineItems.length === 0 && (
                <div className="text-center text-gray-400 py-8">Aucun détail disponible</div>
              )}
            </div>

            <button
              onClick={() => {
                setShowPaymentDetails(null);
                setPaymentLineItems([]);
              }}
              className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition mt-6"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
