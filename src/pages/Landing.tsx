import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, MapPin, Calendar, Users, Lock,
  GraduationCap, ChevronLeft, ChevronRight,
  Ticket, Heart, CheckCircle, ChevronDown,
  Music, Compass
} from 'lucide-react';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { currentPrice, nextPrice, nextPriceChangeAt, priceLockAvailable, minEventPrice, minNextEventPrice, EttWithPricing } from '../lib/tierPricing';
interface LandingProps {
  onNavigate: (page: string, eventId?: string) => void;
}

type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_type: TicketType;
};

interface EventWithTickets extends Event {
  event_ticket_types: EventTicketType[];
}

interface LandingFestival {
  id: string;
  festival: string;
  image: string | null;
  dateRange: string;
  location: string;
  currentPrice: number | null;
  nextPrice: number | null;
  increaseIn: string | null;
  priceLockActive: boolean;
  lockAmount: number | null;
}

const formatDateShort = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function buildDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates à venir';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  if (!endDate || startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  return `${formatDateShort(startDate)} — ${formatDateShort(endDate)}`;
}

function buildIncreaseIn(changeAt: Date | null): string | null {
  if (!changeAt) return null;
  const days = Math.ceil((changeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days <= 1 ? 'très bientôt' : `dans ${days} jours`;
}

const INCLUSIONS = [
  { icon: Ticket, label: 'Full Pass officiel' },
  { icon: Lock, label: 'Price Lock' },
  { icon: CheckCircle, label: 'Paiement progressif' },
  { icon: Calendar, label: 'Festivals partenaires' },
];

const PRICE_LOCK_FAQ = [
  {
    question: "Qu’est-ce qu’un Price Lock ?",
    answer: "Le Price Lock te permet de bloquer le prix actuel d’un Full Pass pendant une durée limitée avec un premier versement.",
  },
  {
    question: "Combien de temps mon prix est-il bloqué ?",
    answer: "Chaque festival possède sa propre date limite. Cette date est affichée avant que tu confirmes ton Price Lock.",
  },
  {
    question: "Que se passe-t-il si le prix du festival augmente pendant mon Price Lock ?",
    answer: "Tant que ton Price Lock est actif, tu conserves le tarif que tu as bloqué, même si le prix public augmente.",
  },
  {
    question: "Que se passe-t-il si mon Price Lock expire ?",
    answer: "Les sommes déjà versées ne sont pas perdues. En revanche, le tarif bloqué expire et le prix public actuel s’applique.",
    example: true,
  },
  {
    question: "Puis-je payer mon Full Pass en plusieurs fois ?",
    answer: "Oui. Après le premier versement, tous les paiements suivants viennent simplement réduire le montant restant à payer.",
  },
  {
    question: "Puis-je avoir plusieurs Price Locks ?",
    answer: "Oui, sur plusieurs festivals différents, dans la limite prévue par ton offre Nexa. Un seul Price Lock est possible par personne et par festival.",
  },
  {
    question: "Quand mon Full Pass est-il confirmé ?",
    answer: "Ton Full Pass est confirmé une fois que le montant total a été réglé.",
  },
];

function FestivalCard({ festival, onNavigate }: { festival: LandingFestival; onNavigate: (page: string, eventId?: string) => void }) {
  const openDetail = () => onNavigate(`shop-${festival.id}`);
  return (
    <div
      onClick={openDetail}
      className="group relative h-full min-h-[366px] sm:min-h-[392px] bg-[#0c1424]/95 rounded-[20px] border border-white/[0.08] overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.18)] transition-all duration-500 hover:-translate-y-1 hover:border-[#D4AC5B]/45 hover:shadow-[0_22px_55px_rgba(0,0,0,0.28),0_0_24px_rgba(184,145,61,0.08)] flex flex-col cursor-pointer"
    >
      <div className="relative h-52 sm:h-56 overflow-hidden">
        {festival.image ? (
          <img
            src={festival.image}
            alt={festival.festival}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#101a30] to-[#0a1120] flex items-center justify-center">
            <Music className="w-12 h-12 text-gold-500/25" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1424] via-[#0c1424]/15 to-transparent" />
        {festival.priceLockActive && (
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-500/90 text-white text-[10px] font-semibold tracking-wide shadow-lg">
              <Lock className="w-3 h-3" />
              Price Lock disponible
            </span>
          </div>
        )}
        <div className="absolute bottom-4 left-5 right-5">
          <h3 className="text-lg font-bold text-white leading-tight drop-shadow-lg">{festival.festival}</h3>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-4 pb-4 border-b border-white/[0.07]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gold-400/80" />
            {festival.dateRange}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gold-400/80" />
            {festival.location}
          </span>
        </div>

        <div className="mb-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-gold-400 uppercase">Full Pass</span>
          {festival.currentPrice != null ? (
            <>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-[27px] leading-none font-bold text-white">À partir de {festival.currentPrice}&nbsp;€</span>
              </div>
              {festival.nextPrice != null && (
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <span className="text-gray-500">Prochain tarif :</span>
                  <span className="text-gold-400 font-semibold">{festival.nextPrice}&nbsp;€</span>
                  {festival.increaseIn && <span className="text-gray-500">{festival.increaseIn}</span>}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 text-sm text-gray-400">Tarifs bientôt disponibles</div>
          )}
        </div>

        {festival.currentPrice != null && festival.lockAmount != null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-300 mb-5">
            <Lock className="w-3.5 h-3.5 text-gold-400" />
            <span>Bloque {festival.currentPrice}&nbsp;€ avec {festival.lockAmount}&nbsp;€</span>
          </div>
        )}

        <div className="flex items-end justify-end mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); openDetail(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-xs font-semibold rounded-xl hover:shadow-glow transition-all hover:brightness-105"
          >
            Voir le festival
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileFestivalsCarousel({ festivals, onNavigate }: { festivals: LandingFestival[]; onNavigate: (page: string, eventId?: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.getBoundingClientRect().width || 300;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -(cardWidth + 16) : (cardWidth + 16), behavior: 'smooth' });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const cardWidth = el.firstElementChild?.getBoundingClientRect().width || 300;
      setActiveIndex(Math.min(Math.round(el.scrollLeft / (cardWidth + 16)), festivals.length - 1));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [festivals.length]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide animate-nudge"
      >
        {festivals.map((festival) => (
          <div key={festival.id} className="snap-start shrink-0 w-[88vw] max-w-[340px]">
            <FestivalCard festival={festival} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3">
        <button onClick={() => scroll('left')} className="p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-gold-500/30 transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5">
          {festivals.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-gold-400 w-5 shadow-[0_0_8px_rgba(212,172,91,0.5)]' : 'bg-gray-600 w-1.5'}`} />
          ))}
        </div>
        <button onClick={() => scroll('right')} className="p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-gold-500/30 transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function Landing({ onNavigate }: LandingProps) {
  const { t } = useLanguage();

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [festivals, setFestivals] = useState<LandingFestival[]>([]);
  const [loadingFestivals, setLoadingFestivals] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadFestivals = async () => {
      setLoadingFestivals(true);

      // Même source que la Boutique (Nexa Pass) : événements publiés/upcoming,
      // actifs, à venir, avec billets actifs, paliers tarifaires et lock.
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_date,
          end_date,
          location,
          thumbnail_url,
          event_status,
          event_ticket_types (
            *,
            ticket_type:ticket_types (*),
            price_tiers:event_ticket_price_tiers (label, price, starts_at, ends_at)
          )
        `)
        .in('event_status', ['published', 'upcoming'])
        .eq('is_active', true)
        .eq('is_test', false)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(3);

      if (cancelled) return;

      if (error || !data) {
        setFestivals([]);
        setLoadingFestivals(false);
        return;
      }

      const mapped: LandingFestival[] = (data as unknown as EventWithTickets[])
        .map((event) => {
          const activeTickets = (event.event_ticket_types || []).filter(tt => tt.is_active);
          if (activeTickets.length === 0) return null;

          const firstActive = activeTickets[0];
          const lockAvailable = activeTickets.some(tt => priceLockAvailable(tt as EttWithPricing));
          const lockAmount = lockAvailable
            ? Math.min(...activeTickets
                .filter(tt => priceLockAvailable(tt as EttWithPricing))
                .map(tt => Number(tt.price_lock_deposit_amount ?? 0)))
            : null;
          const nextConsistent = minNextEventPrice(event as any);

          return {
            id: event.id,
            festival: event.title,
            image: event.thumbnail_url,
            dateRange: buildDateRange(event.start_date, event.end_date),
            location: event.location || 'Lieu à venir',
            currentPrice: minEventPrice(event as any),
            nextPrice: nextConsistent?.price ?? null,
            increaseIn: buildIncreaseIn(nextConsistent?.changeAt ?? null),
            priceLockActive: lockAvailable,
            lockAmount,
          } as LandingFestival;
        })
        .filter((f): f is LandingFestival => f !== null);

      setFestivals(mapped);
      setLoadingFestivals(false);
    };

    loadFestivals();
    return () => { cancelled = true; };
  }, []);

  const steps = [
    { num: '01', title: 'Choisis ton festival', desc: 'Découvre les festivals partenaires disponibles sur Nexa.', icon: Compass },
    { num: '02', title: 'Bloque ton tarif', desc: 'Verse une première partie et conserve le prix actuel jusqu’à la date indiquée.', icon: Lock, note: 'Tarif garanti jusqu’au XX/XX' },
    { num: '03', title: 'Paie le reste plus tard', desc: 'Complète ton Full Pass avant la date limite pour conserver ton tarif bloqué.', icon: Ticket },
    { num: '04', title: 'Profite du festival', desc: 'Une fois ton Full Pass soldé, ta réservation est confirmée.', icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-gray-950 relative text-white">
      <BackgroundDecor />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden">
        {/* Full-bleed background image */}
        <div className="absolute inset-x-0 top-14 sm:top-14 lg:top-12 bottom-0 z-0">
          <img
            src="/hero-mobile.png"
            alt=""
            className="w-full h-full object-cover object-top bg-[#070d18] md:hidden"
          />
          <img
            src="/nexa-hero.png"
            alt=""
            className="hidden w-full h-full object-cover object-top bg-[#070d18] md:block"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/70 via-gray-950/50 to-gray-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-44 sm:pt-44 md:pt-48 pb-16 sm:pb-20">
          <div className="absolute md:hidden top-[180px] right-[-60px] w-48 h-48 bg-gold-500/[0.04] rounded-full blur-3xl pointer-events-none"></div>
          <div className="max-w-2xl">
            <div className="mb-5 sm:mb-6 animate-hero-rise">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] text-gold-400 uppercase">
                NEXA UNIVERSE
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-gold-500/60 uppercase ml-2">
                — VIVEZ LA DANSE AUTREMENT
              </span>
            </div>

            <h1 className="text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-black text-white mb-5 sm:mb-6 leading-[1.05] animate-hero-rise delay-100">
              Apprenez. Réservez.<br />
              <span className="text-gradient">Vivez la danse.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/90 font-semibold mb-2 animate-hero-rise delay-200">
              Progressez auprès de professeurs reconnus. Réservez vos Full Pass partenaires et bloquez votre tarif avant qu’il augmente.
            </p>
            <p className="text-sm sm:text-base text-gray-300/80 mb-8 sm:mb-10 leading-relaxed max-w-lg font-light animate-hero-rise delay-300">
              De l'apprentissage aux festivals, Nexa Universe réunit tout ce qui nourrit votre passion pour la danse.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-hero-rise delay-400">
              <button
                onClick={() => onNavigate('shop')}
                className="group relative inline-flex items-center justify-center px-7 py-4 sm:px-8 sm:py-4 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base font-semibold rounded-xl hover:shadow-glow-lg transition-all hover:scale-[1.03] shadow-[0_8px_30px_rgba(184,145,61,0.25)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] opacity-0 group-hover:opacity-100 transition-opacity" />
                <Ticket className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">Découvrir Nexa Pass</span>
                <ArrowRight className="w-4 h-4 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onNavigate('academy')}
                className="inline-flex items-center justify-center px-7 py-4 sm:px-8 sm:py-4 bg-white/[0.06] backdrop-blur-md border border-white/15 text-white text-sm sm:text-base font-semibold rounded-xl hover:bg-white/10 hover:border-white/25 transition-all"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Découvrir l'Academy
              </button>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-950 to-transparent z-20 pointer-events-none" />
      </section>

      {/* ═══════════ PROCHAINS NEXA TRIPS ═══════════ */}
      <section className="relative pt-12 sm:pt-14 md:pt-16 pb-5 sm:pb-7 md:pb-9 px-4 sm:px-6 lg:px-8">
        <div className="md:hidden absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold-500/15 to-transparent"></div>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-7 sm:mb-8 gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-gold-400 uppercase block mb-2">
                FESTIVALS PARTENAIRES
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                <span className="text-gradient">Nexa Pass</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1.5 font-light max-w-md">
                Réserve ton Full Pass avant la prochaine hausse de prix.
              </p>
            </div>
            <button
              onClick={() => onNavigate('shop')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-300 transition-colors shrink-0"
            >
              Voir tous les festivals
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:grid lg:grid-cols-3 gap-6 items-stretch">
            {loadingFestivals
              ? [0, 1, 2].map(i => (
                  <div key={i} className="h-[392px] bg-[#0c1424]/95 rounded-[20px] border border-white/[0.08] animate-pulse" />
                ))
              : festivals.map((festival) => (
                  <FestivalCard key={festival.id} festival={festival} onNavigate={onNavigate} />
                ))}
          </div>

          <div className="hidden md:grid md:grid-cols-2 gap-6 lg:hidden">
            {(loadingFestivals ? [0, 1] : festivals.slice(0, 2)).map((festival, i) => (
              loadingFestivals ? (
                <div key={i} className="h-[392px] bg-[#0c1424]/95 rounded-[20px] border border-white/[0.08] animate-pulse" />
              ) : (
                <FestivalCard key={(festival as LandingFestival).id} festival={festival as LandingFestival} onNavigate={onNavigate} />
              )
            ))}
          </div>

          <div className="md:hidden">
            {loadingFestivals ? (
              <div className="h-[392px] bg-[#0c1424]/95 rounded-[20px] border border-white/[0.08] animate-pulse" />
            ) : festivals.length > 0 ? (
              <MobileFestivalsCarousel festivals={festivals} onNavigate={onNavigate} />
            ) : null}
          </div>

          {!loadingFestivals && festivals.length === 0 && (
            <div className="mt-6 rounded-[20px] border border-white/[0.08] bg-[#0c1424]/95 px-6 py-10 text-center">
              <Ticket className="w-8 h-8 text-gold-500/40 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-medium">De nouveaux festivals arrivent bientôt.</p>
              <p className="text-xs text-gray-500 mt-1">Reviens prochainement pour découvrir les prochaines éditions.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ LES 2 UNIVERS ═══════════ */}
      <section className="relative pt-8 sm:pt-10 md:pt-12 pb-14 sm:pb-20 md:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <span className="text-[11px] sm:text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase block mb-3">
              Nexa, plus qu'une plateforme
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              Réserve. Danse. <span className="text-gradient">Progresse.</span>
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mt-3 font-light max-w-lg mx-auto">
              Une seule plateforme pour réserver tes festivals et faire évoluer ta danse.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-stretch relative">
            <div className="md:hidden absolute top-1/2 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold-500/15 to-transparent -translate-y-1/2 pointer-events-none"></div>
            {/* NEXA PASS */}
            <div className="group relative min-h-[340px] sm:min-h-[380px] rounded-[20px] overflow-hidden border border-white/[0.09] bg-[#0c1424] hover:border-[#D4AC5B]/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.28),0_0_26px_rgba(184,145,61,0.08)]">
              <div className="absolute inset-0">
                <img
                  src="/nexa_pass_festival.webp"
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#07101e]/95 via-[#07101e]/72 to-[#07101e]/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07101e]/90 via-transparent to-[#07101e]/20" />
              </div>
              <div className="relative z-10 p-7 sm:p-9 flex flex-col justify-end h-full">
                <div className="w-10 h-10 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-6 shadow-glow">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold tracking-[0.24em] text-gold-400 uppercase mb-2">
                  Nexa Pass
                </span>
                <h3 className="text-2xl sm:text-[27px] font-bold text-white mb-2 leading-tight">
                  Vis tes festivals autrement.
                </h3>
                <p className="text-sm text-gray-200/90 leading-relaxed font-light mb-7 max-w-sm">
                  Réserve tes Full Pass partenaires, bloque ton tarif avant qu'il augmente et paie le reste plus tard.
                </p>
                <button
                  onClick={() => onNavigate('shop')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm font-semibold rounded-xl hover:shadow-glow transition-all hover:brightness-105 self-start"
                >
                  Découvrir Nexa Pass
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* NEXA ACADEMY */}
            <div className="group relative min-h-[340px] sm:min-h-[380px] rounded-[20px] overflow-hidden border border-white/[0.09] bg-[#0c1424] hover:border-[#D4AC5B]/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.28),0_0_26px_rgba(184,145,61,0.08)]">
              <div className="absolute inset-0">
                <img
                  src="/nexa_academy.webp"
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#07101e]/95 via-[#07101e]/72 to-[#07101e]/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07101e]/90 via-transparent to-[#07101e]/20" />
              </div>
              <div className="relative z-10 p-7 sm:p-9 flex flex-col justify-end h-full">
                <div className="w-10 h-10 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl flex items-center justify-center mb-6 shadow-glow">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold tracking-[0.24em] text-gold-400 uppercase mb-2 block">
                  Nexa Academy
                </span>
                <h3 className="text-2xl sm:text-[27px] font-bold text-white mb-2 leading-tight">
                  Fais évoluer ta danse.
                </h3>
                <p className="text-sm text-gray-200/90 leading-relaxed font-light mb-7 max-w-sm">
                  Apprends auprès de professeurs reconnus grâce à des programmes et cours structurés.
                </p>
                <button
                  onClick={() => onNavigate('academy')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm font-semibold rounded-xl hover:shadow-glow transition-all hover:brightness-105 self-start"
                >
                  Découvrir l'Academy
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ COMMENT CA MARCHE ═══════════ */}
      <section className="relative pt-10 sm:pt-14 md:pt-16 pb-12 sm:pb-16 md:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 md:mb-14">
            <span className="text-[11px] sm:text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase block mb-3">
              SIMPLE, FLEXIBLE, TRANSPARENT
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              Comment ça <span className="text-gradient">marche ?</span>
            </h2>
          </div>

          {/* Desktop: horizontal steps with gold line */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-0 relative">
            {/* Gold connecting line */}
            <div className="absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-gold-500/10 via-gold-500/35 to-gold-500/10" />
            {steps.map((step) => (
              <div key={step.num} className="relative flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 rounded-full bg-[#0c1424] border border-gold-500/30 flex items-center justify-center shrink-0 mb-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] relative z-10">
                  <step.icon className="w-7 h-7 text-gold-400" />
                </div>
                <span className="text-gold-500 text-base font-bold mb-2 block">{step.num}</span>
                <h3 className="text-lg font-bold text-white mb-1.5">{step.title}</h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed max-w-[200px]">{step.desc}</p>
                {step.note && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gold-400 mt-3">
                    <Lock className="w-3 h-3" />
                    {step.note}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Mobile / tablet: vertical timeline with gold line */}
          <div className="lg:hidden relative pl-8 sm:pl-10">
            <div className="absolute left-3 sm:left-4 top-6 bottom-6 w-px bg-gradient-to-b from-gold-500/30 via-gold-500/20 to-gold-500/5" />
            <div className="space-y-5 sm:space-y-8">
              {steps.map((step) => (
                <div key={step.num} className="relative flex items-start gap-4 sm:gap-5">
                  <div className="absolute -left-[1.65rem] sm:-left-[2.15rem] w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0c1424] border border-gold-500/30 flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(0,0,0,0.2),0_0_12px_rgba(184,145,61,0.08)] z-10">
                    <step.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gold-400" />
                  </div>
                  <div className="pt-1 bg-white/[0.02] backdrop-blur-sm rounded-xl px-4 py-3 border border-white/[0.05] flex-1">
                    <span className="text-gold-500 text-sm font-bold mb-0.5 block">{step.num}</span>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-gray-400 font-light leading-relaxed">{step.desc}</p>
                    {step.note && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-gold-400 mt-2">
                        <Lock className="w-3 h-3" />
                        {step.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reassurance strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-2.5 mt-10 sm:mt-12 pt-8 border-t border-white/[0.06]">
            {INCLUSIONS.map(({ icon: Icon, label }, i) => (
              <div key={label} className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
                <Icon className="w-3.5 h-3.5 text-gold-500/60" />
                <span>{label}</span>
                {i < INCLUSIONS.length - 1 && <span className="hidden sm:inline text-gray-700 ml-5 sm:ml-7">·</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ PRICE LOCK ═══════════ */}
      <section className="relative pb-14 sm:pb-20 md:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Tout savoir sur le <span className="text-gradient">Price Lock</span>
            </h2>
            <p className="text-sm text-gray-400 mt-2 font-light">
              Le fonctionnement en quelques réponses.
            </p>
          </div>

          <div className="max-w-3xl mx-auto border-t border-white/[0.08]">
            {PRICE_LOCK_FAQ.map((item, index) => {
              const isOpen = openFaqIndex === index;

              return (
                <div key={item.question} className="border-b border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm sm:text-base font-medium text-white hover:text-gold-300 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />
                      {item.question}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gold-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="pb-5 pl-5 sm:pl-7 text-sm text-gray-400 font-light leading-relaxed">
                        <p>{item.answer}</p>
                        {item.example && (
                          <div className="mt-4 pl-4 border-l border-gold-500/30 text-xs sm:text-sm text-gray-300 space-y-1">
                            <p><span className="text-gray-500">Prix bloqué :</span> 75 €</p>
                            <p><span className="text-gray-500">Déjà payé :</span> 20 €</p>
                            <p className="pt-1 text-gray-400">Si le prix actuel passe à 90 € après expiration :</p>
                            <p className="text-gold-400 font-medium">Nouveau solde : 70 €.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="relative pt-12 sm:pt-14 pb-8 sm:pb-10 px-4 sm:px-6 lg:px-8 bg-[#070d18] border-t border-white/[0.06]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/20 to-transparent"></div>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="flex items-center justify-center mb-4">
              <img src="/nexa-logo.png" alt="NEXA" className="h-10 sm:h-10 w-auto opacity-80 drop-shadow-[0_0_12px_rgba(212,172,91,0.25)]" />
            </div>
            <p className="text-sm text-gray-400 font-light tracking-wide mb-7 sm:mb-8">
              Apprenez. Voyagez. <span className="text-gold-400/90">Vivez la danse.</span>
            </p>

            <nav className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-2.5 mb-6 sm:mb-6">
              <button onClick={() => onNavigate('academy')} className="text-xs sm:text-sm text-gray-400 hover:text-gold-400 transition-colors">Academy</button>
              <span className="text-gray-700 hidden sm:inline">•</span>
              <button onClick={() => onNavigate('professors')} className="text-xs sm:text-sm text-gray-400 hover:text-gold-400 transition-colors">Professeurs</button>
              <span className="text-gray-700 hidden sm:inline">•</span>
              <button onClick={() => onNavigate('shop')} className="text-xs sm:text-sm text-gray-400 hover:text-gold-400 transition-colors">Nexa Pass</button>
              <span className="text-gray-700 hidden sm:inline">•</span>
              <span className="text-xs sm:text-sm text-gray-500 cursor-default">Contact</span>
            </nav>

            <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-2 mb-8 sm:mb-9">
              <span className="text-[11px] sm:text-xs text-gray-600 hover:text-gray-500 transition-colors cursor-default">Mentions légales</span>
              <span className="text-gray-800">·</span>
              <span className="text-[11px] sm:text-xs text-gray-600 hover:text-gray-500 transition-colors cursor-default">CGV</span>
              <span className="text-gray-800">·</span>
              <span className="text-[11px] sm:text-xs text-gray-600 hover:text-gray-500 transition-colors cursor-default">Confidentialité</span>
            </div>

            <p className="text-[11px] sm:text-xs text-gray-600 font-light">
              {t('landing.footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
