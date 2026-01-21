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
        redirectTo: `${window.location.origin}`,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <BackgroundDecor />

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => onNavigate('signin')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </button>
          <button
            onClick={() => onNavigate('landing')}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Accueil
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-center mb-8">
            <img src="/_image.png" alt="NX" className="h-12 w-auto" />
            <span className="ml-3 text-3xl font-light text-gray-900 tracking-wide">NEXA</span>
          </div>

          {!emailSent ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                Mot de passe oublié
              </h2>
              <p className="text-gray-600 mb-8 text-center">
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent transition-all"
                      placeholder="votre@email.com"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Envoi en cours...
                    </span>
                  ) : (
                    'Envoyer le lien'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Email envoyé
              </h2>
              <p className="text-gray-600 mb-6">
                Si un compte existe avec l'email <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Vérifiez votre boîte de réception et vos spams.
              </p>
              <button
                onClick={() => onNavigate('signin')}
                className="text-[#B8913D] hover:underline font-medium"
              >
                Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
