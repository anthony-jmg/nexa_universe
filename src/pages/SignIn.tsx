import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface SignInProps {
  onNavigate: (page: string) => void;
}

export function SignIn({ onNavigate }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      showToast(signInError.message, 'error');
      setLoading(false);
    } else {
      showToast('Connexion réussie', 'success');
      onNavigate('academy');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
      <BackgroundDecor />
      <div className="max-w-md w-full relative z-10">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-gray-400 hover:text-gold-400 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Retour à l'accueil</span>
        </button>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-12 sm:h-14 md:h-16 w-auto drop-shadow-[0_0_10px_rgba(212,172,91,0.3)]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-2">{t('signin.header.title')}</h2>
          <p className="text-sm sm:text-base text-gray-400">{t('signin.header.subtitle')}</p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl sm:rounded-2xl shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                {t('signin.form.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                placeholder={t('signin.form.emailPlaceholder')}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  {t('signin.form.password')}
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
                >
                  Mot de passe oublié?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                placeholder={t('signin.form.passwordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-lg hover:shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('signin.form.signingIn') : t('signin.form.signIn')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              {t('signin.footer.noAccount')}{' '}
              <button
                onClick={() => onNavigate('signup')}
                className="text-gold-400 font-medium hover:text-gold-300 transition-colors"
              >
                {t('signin.footer.signUp')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
