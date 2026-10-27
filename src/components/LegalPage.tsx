import { Fragment, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BackgroundDecor } from './BackgroundDecor';
import { useLanguage } from '../contexts/LanguageContext';
import { formatLongDate } from '../lib/locale';

// Mise en page commune des pages juridiques. Les textes sont dans le
// dictionnaire (clés legal.*) en FR et EN ; chaque page ne décrit que sa
// structure (sections, paragraphes, listes).

const LEGAL_LAST_UPDATED = '2026-10-27T12:00:00Z';

export type LegalPageId = 'terms' | 'refund-policy' | 'legal-notice' | 'privacy';

/** Bloc de contenu : chaque valeur est une clé du dictionnaire. */
export type LegalBlock =
  | { p: string }
  | { h3: string }
  | { list: string[] }
  | { callout: string };

export interface LegalSectionDef {
  title: string;
  blocks: LegalBlock[];
}

const LEGAL_PAGES: { page: LegalPageId; label: string }[] = [
  { page: 'terms', label: 'legal.nav.terms' },
  { page: 'refund-policy', label: 'legal.nav.refund' },
  { page: 'legal-notice', label: 'legal.nav.notice' },
  { page: 'privacy', label: 'legal.nav.privacy' },
];

// Mise en forme minimale dans les textes du dictionnaire :
// **gras** · [libellé](terms) lien vers une page juridique · [[libellé]] donnée à compléter.
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((terms|refund-policy|legal-notice|privacy)\)|\[\[(.+?)\]\]/g;

function RichText({ text, onNavigate }: { text: string; onNavigate: (page: string) => void }) {
  const { t } = useLanguage();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    if (match[1] !== undefined) {
      parts.push(<strong key={index} className="text-white">{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(
        <button key={index} onClick={() => onNavigate(match[3])} className="text-[#D4AC5B] hover:underline">
          {match[2]}
        </button>
      );
    } else {
      parts.push(
        <span key={index} className="text-[#D4AC5B]">{t('legal.common.toComplete', { label: match[4] })}</span>
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</>;
}

interface LegalPageProps {
  title: string;
  sections: LegalSectionDef[];
  onNavigate: (page: string) => void;
}

export function LegalPage({ title, sections, onNavigate }: LegalPageProps) {
  const { t } = useLanguage();
  const rich = (key: string) => <RichText text={t(key)} onNavigate={onNavigate} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <BackgroundDecor />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 sm:pt-28 pb-12">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('legal.common.backHome')}</span>
        </button>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 sm:p-8 border border-[#B8913D]/30 break-words">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] bg-clip-text text-transparent">
            {t(title)}
          </h1>
          <p className="text-gray-400 mb-8">
            {t('legal.common.lastUpdated', { date: formatLongDate(LEGAL_LAST_UPDATED) })}
          </p>

          <div className="space-y-8 text-gray-300">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">{t(section.title)}</h2>
                <div className="space-y-4">
                  {section.blocks.map((block, i) =>
                    'p' in block ? (
                      <p key={i}>{rich(block.p)}</p>
                    ) : 'h3' in block ? (
                      <h3 key={i} className="text-lg font-semibold text-white">{t(block.h3)}</h3>
                    ) : 'list' in block ? (
                      <ul key={i} className="list-disc list-outside space-y-2 ml-5">
                        {block.list.map((item) => <li key={item}>{rich(item)}</li>)}
                      </ul>
                    ) : (
                      <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <p>{rich(block.callout)}</p>
                      </div>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>

          <nav className="mt-10 pt-6 border-t border-gray-700 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LEGAL_PAGES.map(({ page, label }) => (
              <button key={page} onClick={() => onNavigate(page)} className="text-gray-400 hover:text-[#D4AC5B] transition-colors">
                {t(label)}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
