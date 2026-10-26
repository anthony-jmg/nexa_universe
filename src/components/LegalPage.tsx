import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BackgroundDecor } from './BackgroundDecor';

// Mise en page commune des pages juridiques (design des anciennes CGV conservé).

const LEGAL_LAST_UPDATED = '26 octobre 2026';

interface LegalPageProps {
  title: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export function LegalPage({ title, onNavigate, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <BackgroundDecor />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 sm:pt-28 pb-12">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour à l’accueil</span>
        </button>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 sm:p-8 border border-[#B8913D]/30 break-words">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-gray-400 mb-8">Dernière mise à jour : {LEGAL_LAST_UPDATED}</p>

          <div className="space-y-8 text-gray-300">{children}</div>

          <LegalLinks onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc list-outside space-y-2 ml-5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export function LegalCallout({ children }: { children: ReactNode }) {
  return <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">{children}</div>;
}

/** Donnée administrative manquante : affichée telle quelle jusqu’à complétion. */
export function ToComplete({ label }: { label: string }) {
  return <span className="text-[#D4AC5B]">[À compléter : {label}]</span>;
}

const LEGAL_PAGES = [
  { page: 'terms', label: 'Conditions générales de vente' },
  { page: 'refund-policy', label: 'Politique de remboursement' },
  { page: 'legal-notice', label: 'Mentions légales' },
  { page: 'privacy', label: 'Politique de confidentialité' },
] as const;

function LegalLinks({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <nav className="mt-10 pt-6 border-t border-gray-700 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {LEGAL_PAGES.map(({ page, label }) => (
        <button key={page} onClick={() => onNavigate(page)} className="text-gray-400 hover:text-[#D4AC5B] transition-colors">
          {label}
        </button>
      ))}
    </nav>
  );
}
