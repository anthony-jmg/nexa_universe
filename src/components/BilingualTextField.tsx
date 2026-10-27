import { useState } from 'react';
import { translationStatus } from '../lib/localized';

interface BilingualTextFieldProps {
  label: string;
  fr: string;
  en: string;
  onChangeFr: (value: string) => void;
  onChangeEn: (value: string) => void;
  rows?: number;
  placeholderFr?: string;
  placeholderEn?: string;
}

// Champ traduisible de l'Admin (interface en français) : onglets Français /
// English et indicateur de complétude. Une traduction manquante ne bloque
// jamais l'enregistrement : le site affiche alors le français.
export function BilingualTextField({
  label,
  fr,
  en,
  onChangeFr,
  onChangeEn,
  rows = 4,
  placeholderFr,
  placeholderEn,
}: BilingualTextFieldProps) {
  const [tab, setTab] = useState<'fr' | 'en'>('fr');
  const status = translationStatus(fr, en);

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active ? 'bg-[#B8913D] text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        <div className="flex items-center gap-3">
          {status === 'complete' && (
            <span className="text-xs text-green-400">🟢 FR + EN complet</span>
          )}
          {status === 'missing_en' && (
            <span className="text-xs text-orange-400">🟠 Traduction EN manquante</span>
          )}
          <div className="flex gap-1 p-1 bg-gray-900 border border-gray-700 rounded-lg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'fr'} onClick={() => setTab('fr')} className={tabClass(tab === 'fr')}>
              Français
            </button>
            <button type="button" role="tab" aria-selected={tab === 'en'} onClick={() => setTab('en')} className={tabClass(tab === 'en')}>
              English
            </button>
          </div>
        </div>
      </div>
      {tab === 'fr' ? (
        <textarea
          aria-label={`${label} (français)`}
          value={fr}
          onChange={(e) => onChangeFr(e.target.value)}
          rows={rows}
          placeholder={placeholderFr}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
        />
      ) : (
        <>
          <textarea
            aria-label={`${label} (anglais)`}
            value={en}
            onChange={(e) => onChangeEn(e.target.value)}
            rows={rows}
            placeholder={placeholderEn}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Facultatif : si ce champ est vide, la version française est affichée en anglais.</p>
        </>
      )}
    </div>
  );
}
