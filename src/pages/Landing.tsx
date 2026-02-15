import { Play, BookOpen, Ticket, ShoppingBag, Sparkles, ArrowRight } from 'lucide-react';
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

      <section className="relative pt-24 sm:pt-28 md:pt-32 lg:pt-32 xl:pt-36 pb-16 sm:pb-20 md:pb-20 lg:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-center mb-8 sm:mb-10 md:mb-10 lg:mb-10">
              <img
                src="/nexa-logo.png"
                alt="NEXA"
                className="h-28 sm:h-36 md:h-40 lg:h-40 xl:h-44 w-auto drop-shadow-[0_0_30px_rgba(212,172,91,0.5)]"
              />
            </div>

            <div className="mb-5 sm:mb-6 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gold-500/10 backdrop-blur-sm rounded-full border border-gold-500/30 animate-slide-up">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
              <span className="text-xs sm:text-sm font-medium text-gold-300">{t('landing.hero.badge')}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-bold text-white mb-5 sm:mb-6 md:mb-7 lg:mb-6 leading-tight px-2">
              {t('landing.hero.titleStart')}{' '}
              <span className="text-gradient block sm:inline">{t('landing.hero.titleHighlight')}</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl lg:text-lg xl:text-xl text-gray-300 mb-8 sm:mb-9 md:mb-10 lg:mb-10 leading-relaxed font-light max-w-3xl mx-auto px-2">
              {t('landing.hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-2 max-w-md sm:max-w-none mx-auto">
              <button
                onClick={() => onNavigate('signup')}
                className="group relative inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-base sm:text-lg font-semibold rounded-xl hover:shadow-glow-lg transition-all hover:scale-105 shadow-elevated overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 relative z-10 group-hover:animate-pulse" />
                <span className="relative z-10">{t('landing.hero.ctaPrimary')}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('academy')}
                className="inline-flex items-center justify-center px-6 py-3.5 sm:px-8 sm:py-4 bg-white/5 backdrop-blur-sm border border-white/10 text-white text-base sm:text-lg font-semibold rounded-xl hover:bg-white/10 hover:shadow-lg transition-all hover:scale-105"
              >
                {t('landing.hero.ctaSecondary')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-18 md:py-20 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-14 md:mb-16 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-bold text-white mb-3 sm:mb-4 px-2">
              {t('landing.features.titleStart')} <span className="text-gradient">{t('landing.features.titleHighlight')}</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-lg xl:text-xl text-gray-400 max-w-2xl mx-auto px-2 font-light">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-6 lg:gap-6 xl:gap-7">
            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-6 sm:p-7 md:p-8 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {t('landing.features.feature1.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base font-light">
                  {t('landing.features.feature1.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-6 sm:p-7 md:p-8 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <Ticket className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {t('landing.features.feature2.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base font-light">
                  {t('landing.features.feature2.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-6 sm:p-7 md:p-8 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {t('landing.features.feature3.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base font-light">
                  {t('landing.features.feature3.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-12 sm:py-14 md:py-16 px-4 sm:px-6 lg:px-8 bg-gray-950/50 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto text-center relative">
          <div className="flex items-center justify-center mb-5 sm:mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-12 sm:h-14 md:h-16 w-auto opacity-70 drop-shadow-[0_0_10px_rgba(212,172,91,0.2)]" />
          </div>
          <p className="text-sm sm:text-base text-gray-500 font-light px-2">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
