import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Check, X, Calendar, Eye, Plus } from 'lucide-react';

interface Professor {
  id: string;
  bio: string;
  specialties: string[];
  experience_years: number;
  subscription_price: number;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string;
  };
}

interface ProfessorRevenue {
  professor_id: string;
  professor_name: string;
  professor_email: string;
  video_sales: number;
  program_sales: number;
  subscription_sales: number;
  total_unpaid: number;
  sale_count: number;
}

interface Payment {
  id: string;
  professor_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  professors: {
    profiles: {
      full_name: string;
    };
  };
}

interface PaymentLineItem {
  id: string;
  item_type: string;
  item_id: string;
  amount: number;
  sale_date: string;
}

export default function ProfessorPayments() {
  const [revenues, setRevenues] = useState<ProfessorRevenue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState<string | null>(null);
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState<string | null>(null);
  const [paymentLineItems, setPaymentLineItems] = useState<PaymentLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPayment, setNewPayment] = useState({
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRevenues(),
        loadPayments()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenues = async () => {
    const { data: professors, error: profError } = await supabase
      .from('professors')
      .select(`
        id,
        profiles!inner(full_name, email)
      `);

    if (profError) throw profError;

    const revenueData: ProfessorRevenue[] = [];

    for (const prof of professors || []) {
      const { data: videoSales } = await supabase
        .from('order_items')
        .select('price_paid, orders!inner(status)')
        .eq('item_type', 'video')
        .eq('orders.status', 'completed')
        .in('item_id',
          (await supabase
            .from('videos')
            .select('id')
            .eq('professor_id', prof.id)
          ).data?.map(v => v.id) || []
        );

      const { data: programSales } = await supabase
        .from('order_items')
        .select('price_paid, orders!inner(status)')
        .eq('item_type', 'program')
        .eq('orders.status', 'completed')
        .in('item_id',
          (await supabase
            .from('programs')
            .select('id')
            .eq('professor_id', prof.id)
          ).data?.map(p => p.id) || []
        );

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('price_paid')
        .eq('professor_id', prof.id)
        .eq('status', 'active');

      const { data: paidAmounts } = await supabase
        .from('professor_payments')
        .select('amount')
        .eq('professor_id', prof.id)
        .eq('status', 'paid');

      const videoTotal = videoSales?.reduce((sum, item) => sum + parseFloat(item.price_paid), 0) || 0;
      const programTotal = programSales?.reduce((sum, item) => sum + parseFloat(item.price_paid), 0) || 0;
      const subscriptionTotal = subscriptions?.reduce((sum, sub) => sum + parseFloat(sub.price_paid), 0) || 0;
      const paidTotal = paidAmounts?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;

      const totalRevenue = videoTotal + programTotal + subscriptionTotal;
      const totalUnpaid = totalRevenue - paidTotal;

      if (totalRevenue > 0) {
        revenueData.push({
          professor_id: prof.id,
          professor_name: prof.profiles.full_name,
          professor_email: prof.profiles.email,
          video_sales: videoTotal,
          program_sales: programTotal,
          subscription_sales: subscriptionTotal,
          total_unpaid: totalUnpaid,
          sale_count: (videoSales?.length || 0) + (programSales?.length || 0) + (subscriptions?.length || 0)
        });
      }
    }

    setRevenues(revenueData);
  };

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from('professor_payments')
      .select(`
        *,
        professors!inner(
          profiles!inner(full_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPayments(data || []);
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

  const createPayment = async () => {
    if (!selectedProfessor) return;

    const revenue = revenues.find(r => r.professor_id === selectedProfessor);
    if (!revenue || revenue.total_unpaid <= 0) return;

    try {
      const { data: payment, error: paymentError } = await supabase
        .from('professor_payments')
        .insert({
          professor_id: selectedProfessor,
          period_start: newPayment.period_start,
          period_end: newPayment.period_end,
          amount: revenue.total_unpaid,
          notes: newPayment.notes || null
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: videoSales } = await supabase
        .from('order_items')
        .select('id, item_id, price_paid, orders!inner(created_at, status)')
        .eq('item_type', 'video')
        .eq('orders.status', 'completed')
        .gte('orders.created_at', newPayment.period_start)
        .lte('orders.created_at', newPayment.period_end)
        .in('item_id',
          (await supabase
            .from('videos')
            .select('id')
            .eq('professor_id', selectedProfessor)
          ).data?.map(v => v.id) || []
        );

      const { data: programSales } = await supabase
        .from('order_items')
        .select('id, item_id, price_paid, orders!inner(created_at, status)')
        .eq('item_type', 'program')
        .eq('orders.status', 'completed')
        .gte('orders.created_at', newPayment.period_start)
        .lte('orders.created_at', newPayment.period_end)
        .in('item_id',
          (await supabase
            .from('programs')
            .select('id')
            .eq('professor_id', selectedProfessor)
          ).data?.map(p => p.id) || []
        );

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('id, price_paid, created_at')
        .eq('professor_id', selectedProfessor)
        .eq('status', 'active')
        .gte('created_at', newPayment.period_start)
        .lte('created_at', newPayment.period_end);

      const lineItems = [
        ...(videoSales || []).map(sale => ({
          payment_id: payment.id,
          item_type: 'video_purchase',
          item_id: sale.item_id,
          order_item_id: sale.id,
          amount: sale.price_paid,
          sale_date: sale.orders.created_at
        })),
        ...(programSales || []).map(sale => ({
          payment_id: payment.id,
          item_type: 'program_purchase',
          item_id: sale.item_id,
          order_item_id: sale.id,
          amount: sale.price_paid,
          sale_date: sale.orders.created_at
        })),
        ...(subscriptions || []).map(sub => ({
          payment_id: payment.id,
          item_type: 'subscription',
          item_id: sub.id,
          subscription_id: sub.id,
          amount: sub.price_paid,
          sale_date: sub.created_at
        }))
      ];

      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('payment_line_items')
          .insert(lineItems);

        if (lineItemsError) throw lineItemsError;
      }

      await loadData();
      setShowCreatePayment(false);
      setSelectedProfessor(null);
      setNewPayment({
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Erreur lors de la création du paiement');
    }
  };

  const markAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('professor_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      alert('Erreur lors de la mise à jour du paiement');
    }
  };

  const cancelPayment = async (paymentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce paiement ?')) return;

    try {
      const { error } = await supabase
        .from('professor_payments')
        .update({ status: 'cancelled' })
        .eq('id', paymentId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      alert('Erreur lors de l\'annulation du paiement');
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Paiements Professeurs</h2>
        <button
          onClick={() => setShowCreatePayment(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          <Plus className="w-4 h-4" />
          Créer un paiement
        </button>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Revenus à payer</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-6 py-3 font-medium">Professeur</th>
                <th className="px-6 py-3 font-medium">Ventes Vidéos</th>
                <th className="px-6 py-3 font-medium">Ventes Programmes</th>
                <th className="px-6 py-3 font-medium">Abonnements</th>
                <th className="px-6 py-3 font-medium">Total non payé</th>
                <th className="px-6 py-3 font-medium">Nb. ventes</th>
              </tr>
            </thead>
            <tbody>
              {revenues.map((revenue) => (
                <tr key={revenue.professor_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-white">{revenue.professor_name}</div>
                      <div className="text-sm text-gray-400">{revenue.professor_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{formatCurrency(revenue.video_sales)}</td>
                  <td className="px-6 py-4 text-gray-300">{formatCurrency(revenue.program_sales)}</td>
                  <td className="px-6 py-4 text-gray-300">{formatCurrency(revenue.subscription_sales)}</td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-red-400">{formatCurrency(revenue.total_unpaid)}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{revenue.sale_count}</td>
                </tr>
              ))}
              {revenues.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Aucun revenu à afficher
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Historique des paiements</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-6 py-3 font-medium">Professeur</th>
                <th className="px-6 py-3 font-medium">Période</th>
                <th className="px-6 py-3 font-medium">Montant</th>
                <th className="px-6 py-3 font-medium">Statut</th>
                <th className="px-6 py-3 font-medium">Date paiement</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-6 py-4 text-white">{payment.professors.profiles.full_name}</td>
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadPaymentDetails(payment.id)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {payment.status === 'pending' && (
                        <>
                          <button
                            onClick={() => markAsPaid(payment.id)}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition"
                            title="Marquer comme payé"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => cancelPayment(payment.id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Aucun paiement enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreatePayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Créer un paiement</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Professeur
                </label>
                <select
                  value={selectedProfessor || ''}
                  onChange={(e) => setSelectedProfessor(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <option value="">Sélectionner un professeur</option>
                  {revenues.filter(r => r.total_unpaid > 0).map((revenue) => (
                    <option key={revenue.professor_id} value={revenue.professor_id}>
                      {revenue.professor_name} - {formatCurrency(revenue.total_unpaid)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date début période
                </label>
                <input
                  type="date"
                  value={newPayment.period_start}
                  onChange={(e) => setNewPayment({ ...newPayment, period_start: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date fin période
                </label>
                <input
                  type="date"
                  value={newPayment.period_end}
                  onChange={(e) => setNewPayment({ ...newPayment, period_end: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  placeholder="Notes sur le paiement..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createPayment}
                disabled={!selectedProfessor}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer
              </button>
              <button
                onClick={() => {
                  setShowCreatePayment(false);
                  setSelectedProfessor(null);
                }}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

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
