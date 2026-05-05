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

      <section className="relative pt-20 sm:pt-24 md:pt-28 lg:pt-24 xl:pt-28 pb-12 sm:pb-16 md:pb-16 lg:pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-center mb-6 sm:mb-8 md:mb-8 lg:mb-7">
              <img
                src="/nexa-logo.png"
                alt="NEXA"
                className="h-24 sm:h-32 md:h-36 lg:h-28 xl:h-32 w-auto drop-shadow-[0_0_30px_rgba(212,172,91,0.5)]"
              />
            </div>

            <div className="mb-4 sm:mb-5 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gold-500/10 backdrop-blur-sm rounded-full border border-gold-500/30 animate-slide-up">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
              <span className="text-xs sm:text-sm font-medium text-gold-300">{t('landing.hero.badge')}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 sm:mb-5 md:mb-6 lg:mb-5 leading-tight px-2">
              {t('landing.hero.titleStart')}{' '}
              <span className="text-gradient block sm:inline">{t('landing.hero.titleHighlight')}</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl lg:text-base xl:text-lg text-gray-300 mb-6 sm:mb-8 md:mb-9 lg:mb-7 leading-relaxed font-light max-w-3xl mx-auto px-2">
              {t('landing.hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-2 max-w-md sm:max-w-none mx-auto">
              <button
                onClick={() => onNavigate('signup')}
                className="group relative inline-flex items-center justify-center px-5 py-3 sm:px-7 sm:py-3.5 lg:px-6 lg:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base lg:text-sm font-semibold rounded-xl hover:shadow-glow-lg transition-all hover:scale-105 shadow-elevated overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Play className="w-4 h-4 mr-2 relative z-10 group-hover:animate-pulse" />
                <span className="relative z-10">{t('landing.hero.ctaPrimary')}</span>
                <ArrowRight className="w-4 h-4 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('academy')}
                className="inline-flex items-center justify-center px-5 py-3 sm:px-7 sm:py-3.5 lg:px-6 lg:py-3 bg-white/5 backdrop-blur-sm border border-white/10 text-white text-sm sm:text-base lg:text-sm font-semibold rounded-xl hover:bg-white/10 hover:shadow-lg transition-all hover:scale-105"
              >
                {t('landing.hero.ctaSecondary')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-12 sm:py-14 md:py-16 lg:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 md:mb-14 lg:mb-10 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">
              {t('landing.features.titleStart')} <span className="text-gradient">{t('landing.features.titleHighlight')}</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-base xl:text-lg text-gray-400 max-w-2xl mx-auto px-2 font-light">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 md:gap-5 lg:gap-5">
            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-5 sm:p-6 md:p-7 lg:p-5 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-12 lg:h-12 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-4 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 lg:w-6 lg:h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl lg:text-lg font-bold text-white mb-2">
                  {t('landing.features.feature1.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  {t('landing.features.feature1.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-5 sm:p-6 md:p-7 lg:p-5 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-12 lg:h-12 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-4 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <Ticket className="w-6 h-6 sm:w-7 sm:h-7 lg:w-6 lg:h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl lg:text-lg font-bold text-white mb-2">
                  {t('landing.features.feature2.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  {t('landing.features.feature2.description')}
                </p>
              </div>
            </div>

            <div className="card-elevated relative bg-gradient-to-br from-gray-800 to-gray-900 p-5 sm:p-6 md:p-7 lg:p-5 rounded-2xl border border-gray-700/50 overflow-hidden group hover:border-[#B8913D]/30 transition-all md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D4AC5B]/10 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-12 lg:h-12 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-4 shadow-glow group-hover:shadow-glow-lg transition-shadow">
                  <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 lg:w-6 lg:h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl lg:text-lg font-bold text-white mb-2">
                  {t('landing.features.feature3.title')}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm font-light">
                  {t('landing.features.feature3.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-10 sm:py-12 md:py-14 lg:py-10 px-4 sm:px-6 lg:px-8 bg-gray-950/50 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto text-center relative">
          <div className="flex items-center justify-center mb-4 sm:mb-5">
            <img src="/nexa-logo.png" alt="NEXA" className="h-10 sm:h-12 md:h-14 lg:h-10 w-auto opacity-70 drop-shadow-[0_0_10px_rgba(212,172,91,0.2)]" />
          </div>
          <p className="text-xs sm:text-sm lg:text-xs text-gray-500 font-light px-2">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
