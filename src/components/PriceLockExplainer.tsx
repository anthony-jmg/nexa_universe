import { Calendar, Lock, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: Calendar,
    title: 'Choisis ton festival',
    text: "Sélectionne ton événement et ton type de Full Pass.",
  },
  {
    icon: Lock,
    title: 'Bloque ton tarif',
    text: 'Verse le montant Price Lock affiché pour conserver le prix actuel.',
  },
  {
    icon: CheckCircle,
    title: 'Paie le solde plus tard',
    text: "Ton prix reste garanti jusqu'à la date indiquée. Le solde est ensuite à régler en une seule fois.",
  },
];

export function PriceLockExplainer() {
  return (
    <div className="mb-5 sm:mb-8 rounded-2xl bg-gray-900/50 backdrop-blur-sm border border-[#D4AC5B]/20 px-4 sm:px-8 py-6 sm:py-8">
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.22em] text-[#D4AC5B] uppercase">Price Lock</p>
        <h2 className="mt-2 text-lg sm:text-2xl font-light text-white">
          Bloque ton prix avant qu'il <span className="text-[#B8913D]">augmente</span>.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Verse seulement le montant demandé aujourd'hui, garde le tarif actuel pendant la période indiquée,
          puis règle le solde plus tard en une seule fois.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="rounded-xl bg-gray-950/60 border border-[#D4AC5B]/15 p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D4AC5B]/10 border border-[#D4AC5B]/30 flex items-center justify-center flex-shrink-0">
                <step.icon className="w-4 h-4 text-[#D4AC5B]" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 tracking-widest">ÉTAPE {i + 1}</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
            <p className="mt-1 text-xs text-gray-400 leading-relaxed">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-center gap-2 sm:gap-4">
        <p className="text-[11px] text-gray-500 leading-relaxed sm:max-w-md">
          Si ton Price Lock expire, les sommes déjà versées restent prises en compte,
          mais le tarif public en vigueur s'applique.
        </p>
        <span className="hidden sm:block w-px h-8 bg-[#D4AC5B]/20 flex-shrink-0"></span>
        <p className="text-[11px] text-gray-400 sm:text-right">
          <span className="text-[#D4AC5B] font-semibold">Exemple :</span> Full Pass à 75 € → 20 € aujourd'hui → 55 € à régler plus tard.
        </p>
      </div>
    </div>
  );
}
