import { Calendar, Lock, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { formatPrice } from '../lib/formatEuro';

const steps = [
  { icon: Calendar, titleKey: 'priceLock.explainer.step1.title', textKey: 'priceLock.explainer.step1.text' },
  { icon: Lock, titleKey: 'priceLock.explainer.step2.title', textKey: 'priceLock.explainer.step2.text' },
  { icon: CheckCircle, titleKey: 'priceLock.explainer.step3.title', textKey: 'priceLock.explainer.step3.text' },
];

export function PriceLockExplainer() {
  const { t } = useLanguage();
  return (
    <div className="mb-5 sm:mb-8 rounded-2xl bg-gray-900/50 backdrop-blur-sm border border-[#D4AC5B]/20 px-4 sm:px-8 py-6 sm:py-8">
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.22em] text-[#D4AC5B] uppercase">Price Lock</p>
        <h2 className="mt-2 text-lg sm:text-2xl font-light text-white">
          {t('priceLock.explainer.title1')} <span className="text-[#B8913D]">{t('priceLock.explainer.title2')}</span>.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
          {t('priceLock.explainer.intro')}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {steps.map((step, i) => (
          <div
            key={step.titleKey}
            className="rounded-xl bg-gray-950/60 border border-[#D4AC5B]/15 p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D4AC5B]/10 border border-[#D4AC5B]/30 flex items-center justify-center flex-shrink-0">
                <step.icon className="w-4 h-4 text-[#D4AC5B]" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 tracking-widest">{t('priceLock.explainer.step', { n: i + 1 })}</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">{t(step.titleKey)}</h3>
            <p className="mt-1 text-xs text-gray-400 leading-relaxed">{t(step.textKey)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-center gap-2 sm:gap-4">
        <p className="text-[11px] text-gray-500 leading-relaxed sm:max-w-md">
          {t('priceLock.expiryRule')}
        </p>
        <span className="hidden sm:block w-px h-8 bg-[#D4AC5B]/20 flex-shrink-0"></span>
        <p className="text-[11px] text-gray-400 sm:text-right">
          <span className="text-[#D4AC5B] font-semibold">{t('priceLock.explainer.example')}</span>{' '}
          {t('priceLock.explainer.exampleText', { price: formatPrice(75), deposit: formatPrice(20), rest: formatPrice(55) })}
        </p>
      </div>
    </div>
  );
}
