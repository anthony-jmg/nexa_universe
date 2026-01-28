import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { BackgroundDecor } from '../components/BackgroundDecor';

interface ResetPasswordProps {
  onNavigate: (page: string) => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    // Wait for Supabase to process the recovery token and establish a session
    const checkSession = async () => {
      try {
        // Give Supabase time to process the URL and establish session
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          showToast('Lien de réinitialisation invalide ou expiré', 'error');
          setTimeout(() => onNavigate('forgot-password'), 2000);
          return;
        }

        if (!session) {
          showToast('Session non trouvée. Veuillez demander un nouveau lien.', 'error');
          setTimeout(() => onNavigate('forgot-password'), 2000);
          return;
        }

        setSessionReady(true);
      } catch (error) {
        console.error('Error checking session:', error);
        showToast('Erreur lors de la vérification de la session', 'error');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [onNavigate, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionReady) {
      showToast('Session non prête. Veuillez patienter...', 'error');
      return;
    }

    if (!password || !confirmPassword) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Le mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      showToast('Mot de passe mis à jour avec succès', 'success');

      setTimeout(() => {
        onNavigate('signin');
      }, 1500);
    } catch (error: any) {
      console.error('Password update error:', error);
      showToast(error.message || 'Erreur lors de la mise à jour du mot de passe', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4">
        <BackgroundDecor />
        <div className="text-center relative z-10">
          <div className="flex items-center justify-center mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-16 w-auto animate-pulse drop-shadow-[0_0_10px_rgba(212,172,91,0.3)]" />
          </div>
          <div className="inline-block w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-400">Vérification de votre lien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 relative">
      <BackgroundDecor />
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-12 sm:h-14 md:h-16 w-auto drop-shadow-[0_0_10px_rgba(212,172,91,0.3)]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-2">
            Nouveau mot de passe
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Choisissez un nouveau mot de passe sécurisé
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl sm:rounded-2xl shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Minimum 6 caractères
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white py-3 rounded-lg font-medium hover:from-gold-600 hover:to-gold-700 transition-all shadow-lg hover:shadow-gold-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Mise à jour...
                </span>
              ) : !sessionReady ? (
                'Vérification en cours...'
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
