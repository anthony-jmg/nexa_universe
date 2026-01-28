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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#reset-password`,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12 md:py-16 relative overflow-hidden">
      <BackgroundDecor />

      <div className="w-full max-w-md lg:max-w-lg relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
          <button
            onClick={() => onNavigate('signin')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base group"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden xs:inline">Retour à la connexion</span>
            <span className="xs:hidden">Retour</span>
          </button>
          <button
            onClick={() => onNavigate('landing')}
            className="text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            Accueil
          </button>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 lg:p-12 border border-gray-100">
          <div className="flex items-center justify-center mb-6 sm:mb-8 md:mb-10">
            <img src="/nexa-logo.png" alt="NEXA" className="h-10 sm:h-12 md:h-14 w-auto drop-shadow-[0_0_10px_rgba(212,172,91,0.3)]" />
          </div>

          {!emailSent ? (
            <>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 text-center">
                Mot de passe oublié
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-10 text-center leading-relaxed">
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 md:space-y-7">
                <div>
                  <label htmlFor="email" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#B8913D] focus:border-transparent transition-all"
                      placeholder="votre@email.com"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white py-3 sm:py-4 text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
            </>
          ) : (
            <div className="text-center py-4 sm:py-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Mail className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-green-600" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
                Email envoyé
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-6 leading-relaxed px-2">
                Si un compte existe avec l'email <strong className="text-gray-900">{email}</strong>, vous recevrez un lien de réinitialisation.
              </p>
              <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-6 sm:mb-8">
                Vérifiez votre boîte de réception et vos spams.
              </p>
              <button
                onClick={() => onNavigate('signin')}
                className="inline-flex items-center text-[#B8913D] hover:text-[#9A7831] font-semibold text-sm sm:text-base transition-colors group"
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
