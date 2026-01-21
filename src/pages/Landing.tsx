import { Play, Users, Video, Award, Sparkles, ArrowRight } from 'lucide-react';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { useLanguage } from '../contexts/LanguageContext';

interface LandingProps {
  onNavigate: (page: string) => void;
}

export function Landing({ onNavigate }: LandingProps) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 relative text-white">
      <BackgroundDecor />

      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-center mb-12">
              <img
                src="/nexa-logo.png"
                alt="NEXA"
                className="h-48 w-auto drop-shadow-2xl"
              />
            </div>

            <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gold-500/10 backdrop-blur-sm rounded-full border border-gold-500/30 animate-slide-up">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span className="text-sm font-medium text-gold-300">{t('landing.hero.badge')}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight">
              {t('landing.hero.titleStart')}{' '}
              <span className="text-gradient block sm:inline">{t('landing.hero.titleHighlight')}</span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-300 mb-12 leading-relaxed font-light max-w-3xl mx-auto">
              {t('landing.hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => onNavigate('signup')}
                className="group relative inline-flex items-center px-8 py-5 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-lg font-semibold rounded-2xl hover:shadow-glow-lg transition-all hover:scale-105 shadow-elevated overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Play className="w-5 h-5 mr-2 relative z-10 group-hover:animate-pulse" />
                <span className="relative z-10">{t('landing.hero.ctaPrimary')}</span>
                <ArrowRight className="w-5 h-5 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('academy')}
                className="inline-flex items-center px-8 py-5 bg-white/5 backdrop-blur-sm border border-white/10 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 hover:shadow-lg transition-all hover:scale-105"
              >
                {t('landing.hero.ctaSecondary')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              {t('landing.features.titleStart')} <span className="text-gradient">{t('landing.features.titleHighlight')}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-10 rounded-3xl border border-gray-700/50 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/20 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-2xl flex items-center justify-center mb-6 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <Video className="w-9 h-9 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {t('landing.features.feature1.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  {t('landing.features.feature1.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-10 rounded-3xl border border-gray-700/50 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/20 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-2xl flex items-center justify-center mb-6 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <Users className="w-9 h-9 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {t('landing.features.feature2.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  {t('landing.features.feature2.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-10 rounded-3xl border border-gray-700/50 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/20 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-2xl flex items-center justify-center mb-6 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <Award className="w-9 h-9 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {t('landing.features.feature3.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  {t('landing.features.feature3.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-5xl mx-auto relative">
          <div className="relative bg-gradient-to-br from-[#B8913D] via-[#D4AC5B] to-[#A07F35] rounded-[2.5rem] p-12 sm:p-16 text-center text-white overflow-hidden shadow-elevated">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl animate-pulse-slow"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black opacity-10 rounded-full blur-3xl animate-float"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 mb-6">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold">{t('landing.cta.badge')}</span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                {t('landing.cta.title')}
              </h2>

              <p className="text-xl mb-4 opacity-95 max-w-2xl mx-auto leading-relaxed">
                {t('landing.cta.description')}
              </p>

              <div className="mb-10">
                <div className="inline-block px-6 py-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                  <p className="text-3xl font-bold">
                    {t('landing.cta.pricePrefix')} <span className="text-4xl text-white">8.99€</span>{t('landing.cta.priceSuffix')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('signup')}
                className="group inline-flex items-center px-10 py-5 bg-white text-[#B8913D] text-xl font-bold rounded-2xl hover:bg-gray-100 transition-all hover:scale-105 shadow-2xl"
              >
                {t('landing.cta.button')}
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-16 px-4 sm:px-6 lg:px-8 bg-gray-950/50 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center relative">
          <div className="flex items-center justify-center mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-16 w-auto opacity-70" />
          </div>
          <p className="text-gray-500 font-medium">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
