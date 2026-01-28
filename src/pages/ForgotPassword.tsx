import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { BackgroundDecor } from '../components/BackgroundDecor';

interface ForgotPasswordProps {
  onNavigate: (page: string) => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      showToast('Veuillez entrer votre email', 'error');
      return;
    }

    setLoading(true);

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl,
      });

      if (error) throw error;

      setEmailSent(true);
      showToast('Email de réinitialisation envoyé', 'success');
    } catch (error: any) {
      console.error('Password reset error:', error);
      showToast(error.message || 'Erreur lors de l\'envoi de l\'email', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 relative">
      <BackgroundDecor />
      <div className="max-w-md w-full relative z-10">
        <button
          onClick={() => onNavigate('signin')}
          className="flex items-center space-x-2 text-gray-400 hover:text-gold-400 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Retour à la connexion</span>
        </button>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-12 sm:h-14 md:h-16 w-auto drop-shadow-[0_0_10px_rgba(212,172,91,0.3)]" />
          </div>

          {!emailSent ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-light text-white mb-2">
                Mot de passe oublié
              </h2>
              <p className="text-sm sm:text-base text-gray-400">
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-green-500/30">
                <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-white mb-2">
                Email envoyé
              </h2>
              <p className="text-sm sm:text-base text-gray-400">
                Si un compte existe avec l'email <strong className="text-white">{email}</strong>, vous recevrez un lien de réinitialisation.
              </p>
            </>
          )}
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl sm:rounded-2xl shadow-sm p-6 sm:p-8">
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                    placeholder="votre@email.com"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white py-3 rounded-lg font-medium hover:from-gold-600 hover:to-gold-700 transition-all shadow-lg hover:shadow-gold-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Envoi en cours...
                  </span>
                ) : (
                  'Envoyer le lien de réinitialisation'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs sm:text-sm text-gray-400 mb-6">
                Vérifiez votre boîte de réception et vos spams.
              </p>
              <button
                onClick={() => onNavigate('signin')}
                className="inline-flex items-center text-gold-400 hover:text-gold-300 font-medium text-sm transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
