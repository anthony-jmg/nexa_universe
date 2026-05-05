import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link2, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface ConnectStatus {
  connected: boolean;
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  platform_fee_percentage: number;
  account_id?: string;
}

interface StripeConnectCardProps {
  userId: string | undefined;
}

export function StripeConnectCard({ userId }: StripeConnectCardProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) {
      loadStatus();
    }
  }, [userId]);

  // Check for return from onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectParam = params.get('connect');
    if (connectParam === 'success' || connectParam === 'refresh') {
      loadStatus();
      const url = new URL(window.location.href);
      url.searchParams.delete('connect');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'get-status' }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setStatus(data);
      } else {
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch (err) {
      setError('Impossible de charger le statut Stripe Connect');
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async () => {
    try {
      setActionLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'create-account' }),
        }
      );

      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Impossible de lancer la configuration');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setActionLoading(false);
    }
  };

  const openDashboard = async () => {
    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'create-login-link' }),
        }
      );

      const data = await response.json();
      if (response.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        setError(data.error || 'Impossible d\'ouvrir le dashboard');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl flex items-center justify-center">
          <Link2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-light text-white">Stripe Connect</h2>
          <p className="text-sm text-gray-400">Recevez vos paiements directement sur votre compte bancaire</p>
        </div>
      </div>

      <div className="bg-gray-900/50 p-6 rounded-xl mb-6 border border-[#B8913D]/20">
        <h3 className="font-medium text-white mb-2">Comment ca marche ?</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
            <span>Connectez votre compte bancaire via Stripe pour recevoir les paiements directement</span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
            <span>Les virements sont effectues automatiquement par Stripe sur votre compte</span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
            <span>La plateforme retient {status?.platform_fee_percentage || 20}% de commission sur chaque vente</span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
            <span>Gerez vos virements, factures et fiscalite depuis votre dashboard Stripe</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!status?.connected ? (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-300 text-sm">Compte non configure</p>
                <p className="text-sm text-yellow-200/80 mt-1">
                  Configurez Stripe Connect pour recevoir vos paiements directement. Sans configuration, les paiements sont traites manuellement.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={startOnboarding}
            disabled={actionLoading}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <span className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Redirection...</span>
              </span>
            ) : (
              <>
                <Link2 className="w-5 h-5" />
                Configurer Stripe Connect
              </>
            )}
          </button>
        </div>
      ) : !status.onboarding_completed ? (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-300 text-sm">Configuration incomplete</p>
                <p className="text-sm text-yellow-200/80 mt-1">
                  Votre compte Stripe Connect a ete cree mais la verification n'est pas terminee. Completez les etapes requises pour activer les paiements.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={startOnboarding}
            disabled={actionLoading}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <span className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Redirection...</span>
              </span>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Reprendre la configuration
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-300 text-sm">Compte actif</p>
                <p className="text-sm text-green-200/80 mt-1">
                  Votre compte Stripe Connect est configure et actif. Les paiements sont automatiquement verses sur votre compte bancaire.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 text-center">
              <p className="text-sm text-gray-400 mb-1">Paiements</p>
              <p className={`text-lg font-semibold ${status.charges_enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                {status.charges_enabled ? 'Actifs' : 'En attente'}
              </p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 text-center">
              <p className="text-sm text-gray-400 mb-1">Virements</p>
              <p className={`text-lg font-semibold ${status.payouts_enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                {status.payouts_enabled ? 'Actifs' : 'En attente'}
              </p>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Commission plateforme</span>
              <span className="text-lg font-semibold text-white">{status.platform_fee_percentage}%</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-400">Votre part</span>
              <span className="text-lg font-semibold text-green-400">{100 - status.platform_fee_percentage}%</span>
            </div>
          </div>

          <button
            onClick={openDashboard}
            disabled={actionLoading}
            className="w-full px-6 py-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <span className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Chargement...</span>
              </span>
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Ouvrir mon dashboard Stripe
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
