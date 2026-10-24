import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAvatarUrl } from '../components/AvatarUpload';
import { BackgroundDecor } from '../components/BackgroundDecor';
import {
  DISCOVERY_PROFESSOR_COLUMNS,
  DiscoveryProfessor,
  isDiscoveryEligible,
  trackAcademyClick,
} from '../lib/academyDiscovery';

interface ProfessorInfo {
  id: string;
  website_url: string;
  website_cover_image: string | null;
  fullName: string;
  avatarUrl: string | null;
  specialties: string[];
  isFeatured: boolean;
}

export default function AcademyDiscovery({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [professors, setProfessors] = useState<ProfessorInfo[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEligibleProfessors();
  }, []);

  async function loadEligibleProfessors() {
    // Fiches Discovery : lues directement sur professors (aucun compte requis).
    const { data, error } = await supabase
      .from('professors')
      .select(DISCOVERY_PROFESSOR_COLUMNS)
      .eq('is_active', true);

    if (error) {
      console.error('Error loading professors:', error);
      setLoading(false);
      return;
    }

    const eligible = ((data ?? []) as unknown as DiscoveryProfessor[])
      .filter(isDiscoveryEligible)
      .map((p) => ({
        id: p.id,
        website_url: p.website_url as string,
        website_cover_image: p.website_cover_image || null,
        fullName: p.full_name || 'Professeur',
        avatarUrl: p.avatar_url ?? null,
        specialties: (p.specialties ?? []).filter(Boolean),
        isFeatured: Boolean(p.is_featured),
      }))
      .sort((a: ProfessorInfo, b: ProfessorInfo) =>
        Number(b.isFeatured) - Number(a.isFeatured) || a.fullName.localeCompare(b.fullName)
      );

    setProfessors(eligible);
    setLoading(false);
  }

  const displayProfessors = professors;

  function scrollToProfessors() {
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function viewProfile(professor: ProfessorInfo) {
    trackAcademyClick(professor.id, 'academy_profile_click');
    onNavigate(`professor-discovery-${professor.id}`);
  }

  function visitWebsite(professor: ProfessorInfo) {
    window.open(professor.website_url, '_blank', 'noopener,noreferrer');
    trackAcademyClick(professor.id, 'academy_website_click', professor.website_url);
  }

  return (
    <div className="min-h-screen bg-gray-950 relative text-white">
      <BackgroundDecor />

      <main className="relative">
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-14 sm:top-14 lg:top-12 bottom-0 z-0">
            <img
              src="/Cours_de_danse_latin_en_studio_chaleureux.webp"
              alt=""
              className="w-full h-full object-cover object-top bg-[#070d18]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950/70 via-gray-950/50 to-gray-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 to-transparent" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-44 sm:pt-44 md:pt-48 pb-16 sm:pb-20">
            <div className="max-w-2xl">
              <div className="mb-5 sm:mb-6 animate-hero-rise">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] text-gold-400 uppercase">
                  NEXA ACADEMY
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-gold-500/60 uppercase ml-2">
                  — APPRENDS AUPRES DES ARTISTES
                </span>
              </div>

              <h1 className="text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-black text-white mb-5 sm:mb-6 leading-[1.05] animate-hero-rise delay-100">
                Progresse avec les artistes
                <br />
                <span className="text-gradient">qui font vivre la danse.</span>
              </h1>

              <p className="text-lg sm:text-xl text-white/90 font-semibold mb-2 animate-hero-rise delay-200">
                Découvre leurs formations et accède directement à leur univers.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-hero-rise delay-400">
                <button
                  onClick={scrollToProfessors}
                  className="group relative inline-flex items-center justify-center px-7 py-4 sm:px-8 sm:py-4 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base font-semibold rounded-xl hover:shadow-glow-lg transition-all hover:scale-[1.03] shadow-[0_8px_30px_rgba(184,145,61,0.25)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <GraduationCap className="w-4 h-4 mr-2 relative z-10" />
                  <span className="relative z-10">Découvrir les formations</span>
                  <ArrowRight className="w-4 h-4 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-950 to-transparent z-20 pointer-events-none" />
        </section>

        <div ref={listRef} className="relative scroll-mt-24 px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0c1424]/95 animate-pulse"
                  >
                    <div className="aspect-[16/10] bg-white/[0.04]" />
                    <div className="p-6 space-y-3">
                      <div className="h-5 w-2/3 rounded bg-white/[0.06]" />
                      <div className="h-3 w-1/3 rounded bg-white/[0.05]" />
                      <div className="flex gap-3 pt-3">
                        <div className="h-10 flex-1 rounded-xl bg-white/[0.05]" />
                        <div className="h-10 flex-1 rounded-xl bg-white/[0.04]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : displayProfessors.length === 0 ? (
              <div className="rounded-[20px] border border-white/[0.08] bg-[#0c1424]/95 px-6 py-16 text-center">
                <GraduationCap className="w-10 h-10 text-gold-500/40 mx-auto mb-4" />
                <p className="text-sm sm:text-base text-gray-300 font-medium">
                  Les prochaines formations arrivent bientôt.
                </p>
                <p className="text-xs text-gray-500 mt-1.5">
                  Reviens prochainement pour découvrir les premiers professeurs partenaires.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayProfessors.map((professor) => (
                  <article
                    key={professor.id}
                    className="group flex flex-col overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0c1424] transition-all duration-500 hover:-translate-y-1 hover:border-[#D4AC5B]/50 hover:shadow-[0_22px_55px_rgba(0,0,0,0.28),0_0_26px_rgba(184,145,61,0.08)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#07101e]">
                      {professor.website_cover_image ? (
                        <img
                          src={professor.website_cover_image}
                          alt={professor.fullName}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0c1424] via-[#07101e] to-gray-950">
                          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
                          <GraduationCap className="w-12 h-12 text-gold-500/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c1424]/80 via-transparent to-transparent pointer-events-none" />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] ring-2 ring-gold-500/40">
                          {getAvatarUrl(professor.avatarUrl) ? (
                            <img
                              src={getAvatarUrl(professor.avatarUrl)!}
                              alt={professor.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-base font-bold text-gray-950">
                              {professor.fullName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-white truncate leading-tight">
                            {professor.fullName}
                          </h2>
                          {professor.specialties.length > 0 && (
                            <p className="mt-0.5 text-xs text-gold-400/90 truncate">
                              {professor.specialties.slice(0, 2).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-1 items-end gap-3">
                        <button
                          onClick={() => viewProfile(professor)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/25 active:scale-95"
                        >
                          <User className="w-4 h-4" />
                          Voir le profil
                        </button>
                        <button
                          onClick={() => visitWebsite(professor)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-glow hover:brightness-105 active:scale-95"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Visiter le site
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {!loading && displayProfessors.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 pb-24">
            <div className="mx-auto max-w-3xl rounded-[20px] border border-[#B8913D]/20 bg-[#B8913D]/5 p-8 text-center">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Prêt à passer au niveau supérieur ?
              </h2>
              <p className="mt-2 text-sm text-gray-300" style={{ lineHeight: '150%' }}>
                Rejoins les formations des artistes qui font vivre la danse au quotidien.
              </p>
              <button
                onClick={scrollToProfessors}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-glow hover:brightness-105 active:scale-95"
              >
                Découvrir les formations
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="relative border-t border-white/[0.06] bg-[#070d18] px-4 py-8 text-center">
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} Nexa — Tous droits réservés</p>
      </footer>
    </div>
  );
}
