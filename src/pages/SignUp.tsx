import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface SignUpProps {
  onNavigate: (page: string) => void;
}

export function SignUp({ onNavigate }: SignUpProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (password.length < 6) {
      const errorMsg = t('signup.errors.passwordTooShort');
      setError(errorMsg);
      showToast(errorMsg, 'error');
      setLoading(false);
      return;
    }

    const { error: signUpError } = await signUp(email, password, fullName);

    if (signUpError) {
      setError(signUpError.message);
      showToast(signUpError.message, 'error');
      setLoading(false);
    } else {
      setSuccess(true);
      showToast('Compte créé avec succès', 'success');
      setLoading(false);
      setTimeout(() => {
        onNavigate('academy');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 relative">
      <BackgroundDecor />
      <div className="max-w-md w-full relative z-10">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-gray-400 hover:text-gold-400 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Retour à l'accueil</span>
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-16 w-auto" />
          </div>
          <h2 className="text-3xl font-light text-white mb-2">{t('signup.header.title')}</h2>
          <p className="text-gray-400">{t('signup.header.subtitle')}</p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start space-x-3 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-400">{t('signup.form.successMessage')}</p>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                {t('signup.form.fullName')}
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                placeholder={t('signup.form.fullNamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                {t('signup.form.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                placeholder={t('signup.form.emailPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                {t('signup.form.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none transition-all text-white placeholder-gray-500"
                placeholder={t('signup.form.passwordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-lg hover:shadow-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('signup.form.creating') : success ? t('signup.form.success') : t('signup.form.createAccount')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              {t('signup.footer.hasAccount')}{' '}
              <button
                onClick={() => onNavigate('signin')}
                className="text-gold-400 font-medium hover:text-gold-300 transition-colors"
              >
                {t('signup.footer.signIn')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
