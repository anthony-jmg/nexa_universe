import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Loader2,
  Play,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../components/AvatarUpload';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Header } from '../components/Header';

type Level = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

interface ProfessorInfo {
  id: string;
  website_url: string | null;
  fullName: string;
  avatarUrl: string | null;
  specialties: string[];
}

interface DiscoveryItem {
  contentType: 'program' | 'video';
  id: string;
  title: string;
  description: string;
  level: Level;
  price: number;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  destinationUrl: string;
  professor: ProfessorInfo;
}

const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  all_levels: 'Tous niveaux',
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AcademyDiscovery({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDiscoveryContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDiscoveryContent() {
    const { data: professorsData, error: profError } = await supabase
      .from('professors')
      .select(
        'id, website_url, specialties, profiles!inner(full_name, avatar_url)'
      );

    if (profError) {
      console.error('Error loading professors:', profError);
      setLoading(false);
      return;
    }

    const eligibleProfessors = (professorsData ?? []).filter(
      (p: any) => p.website_url && isValidHttpUrl(p.website_url)
    );

    if (eligibleProfessors.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const eligibleIds = eligibleProfessors.map((p: any) => p.id);

    const { data: programsData, error: progError } = await supabase
      .from('programs')
      .select('id, title, description, level, price, thumbnail_url, external_url, professor_id')
      .eq('is_active', true)
      .in('professor_id', eligibleIds);

    const { data: videosData, error: vidError } = await supabase
      .from('videos')
      .select('id, title, description, level, price, thumbnail_url, external_url, professor_id')
      .is('program_id', null)
      .in('professor_id', eligibleIds);

    if (progError) console.error('Error loading programs:', progError);
    if (vidError) console.error('Error loading videos:', vidError);

    const profMap = new Map<string, ProfessorInfo>();
    for (const p of eligibleProfessors) {
      profMap.set(p.id, {
        id: p.id,
        website_url: p.website_url,
        fullName: p.profiles?.full_name ?? 'Professeur',
        avatarUrl: p.profiles?.avatar_url ?? null,
        specialties: p.specialties ?? [],
      });
    }

    const allItems: DiscoveryItem[] = [];

    for (const prog of programsData ?? []) {
      const prof = profMap.get(prog.professor_id);
      if (!prof) continue;
      const external =
        prog.external_url && isValidHttpUrl(prog.external_url)
          ? prog.external_url
          : null;
      allItems.push({
        contentType: 'program',
        id: prog.id,
        title: prog.title,
        description: prog.description ?? '',
        level: prog.level,
        price: prog.price,
        thumbnailUrl: prog.thumbnail_url,
        externalUrl: external,
        destinationUrl: external ?? prof.website_url!,
        professor: prof,
      });
    }

    for (const vid of videosData ?? []) {
      const prof = vid.professor_id ? profMap.get(vid.professor_id) : null;
      if (!prof) continue;
      const external =
        vid.external_url && isValidHttpUrl(vid.external_url)
          ? vid.external_url
          : null;
      allItems.push({
        contentType: 'video',
        id: vid.id,
        title: vid.title,
        description: vid.description ?? '',
        level: vid.level,
        price: vid.price,
        thumbnailUrl: vid.thumbnail_url,
        externalUrl: external,
        destinationUrl: external ?? prof.website_url!,
        professor: prof,
      });
    }

    allItems.sort((a, b) => a.professor.fullName.localeCompare(b.professor.fullName));

    setItems(allItems);
    setLoading(false);
  }

  async function trackClick(item: DiscoveryItem) {
    try {
      await supabase.from('academy_click_tracking').insert({
        professor_id: item.professor.id,
        content_type: item.contentType,
        content_id: item.id,
        destination_url: item.destinationUrl,
        user_id: user?.id ?? null,
      });
    } catch (err) {
      console.error('Error tracking click:', err);
    }
  }

  async function handleSeeFormation(item: DiscoveryItem) {
    await trackClick(item);
    window.open(item.destinationUrl, '_blank', 'noopener,noreferrer');
  }

  function scrollToFormations() {
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const professorsWithItems = new Map<string, DiscoveryItem[]>();
  for (const item of items) {
    const list = professorsWithItems.get(item.professor.id) ?? [];
    list.push(item);
    professorsWithItems.set(item.professor.id, list);
  }

  return (
    <div className="min-h-screen bg-gray-950 relative text-white">
      <BackgroundDecor />
      <Header currentPage="academy-discovery" onNavigate={onNavigate} />

      <main className="relative">
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-14 sm:top-14 lg:top-12 bottom-0 z-0">
            <img
              src="/Cours_de_danse_latin_en_studio_chaleureux.png"
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
                  onClick={scrollToFormations}
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

        <div ref={listRef} className="relative scroll-mt-24 px-4 pb-24">
          <div className="mx-auto max-w-6xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#D4AC5B]" />
                <p className="text-sm text-gray-400">Chargement des formations…</p>
              </div>
            ) : professorsWithItems.size === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
                <GraduationCap className="mx-auto mb-4 h-10 w-10 text-[#B8913D]/60" />
                <p className="text-base text-gray-300">Les prochaines formations arrivent bientôt.</p>
              </div>
            ) : (
              <div className="space-y-16">
                {[...professorsWithItems.entries()].map(([profId, profItems]) => {
                  const prof = profItems[0].professor;
                  return (
                    <div key={profId}>
                      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] ring-2 ring-[#B8913D]/40">
                          {getAvatarUrl(prof.avatarUrl) ? (
                            <img
                              src={getAvatarUrl(prof.avatarUrl)!}
                              alt={prof.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-gray-950">
                              {prof.fullName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-center sm:text-left">
                          <h2 className="text-xl font-bold text-white sm:text-2xl">{prof.fullName}</h2>
                          {prof.specialties.length > 0 && (
                            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                              {prof.specialties.slice(0, 4).map((s) => (
                                <span
                                  key={s}
                                  className="rounded-full border border-[#B8913D]/30 bg-[#B8913D]/10 px-3 py-1 text-xs font-medium text-[#D4AC5B]"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {profItems.map((item) => (
                          <article
                            key={`${item.contentType}-${item.id}`}
                            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-[#B8913D]/40 hover:shadow-xl hover:shadow-black/40"
                          >
                            <div className="relative aspect-video overflow-hidden bg-gray-900">
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                                  <Play className="h-10 w-10 text-[#B8913D]/50" />
                                </div>
                              )}
                              <span className="absolute left-3 top-3 rounded-full bg-gray-950/80 px-3 py-1 text-xs font-medium text-[#D4AC5B] backdrop-blur-sm">
                                {LEVEL_LABELS[item.level] ?? item.level}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col p-5">
                              <h3 className="text-base font-semibold text-white" style={{ lineHeight: '120%' }}>
                                {item.title}
                              </h3>
                              <p className="mt-1 text-sm text-[#D4AC5B]">
                                Par {item.professor.fullName}
                              </p>
                              {item.description && (
                                <p className="mt-3 text-sm text-gray-400 line-clamp-3" style={{ lineHeight: '150%' }}>
                                  {item.description}
                                </p>
                              )}
                              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="h-3.5 w-3.5" />
                                <span>
                                  {item.contentType === 'program' ? 'Formation complète' : 'Cours à la carte'}
                                </span>
                              </div>

                              <div className="mt-5 flex flex-1 items-end justify-between gap-3">
                                <div>
                                  {item.price > 0 && (
                                    <span className="text-lg font-bold text-[#D4AC5B]">
                                      {(item.price / 100).toFixed(2)} €
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleSeeFormation(item)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition-all duration-200 hover:bg-gradient-to-r hover:from-[#B8913D] hover:to-[#D4AC5B] hover:text-gray-950 hover:ring-[#B8913D] active:scale-95"
                                >
                                  Voir la formation
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!loading && professorsWithItems.size > 0 && (
          <section className="px-4 pb-24">
            <div className="mx-auto max-w-3xl rounded-2xl border border-[#B8913D]/20 bg-[#B8913D]/5 p-8 text-center">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Prêt à passer au niveau supérieur ?
              </h2>
              <p className="mt-2 text-sm text-gray-300" style={{ lineHeight: '150%' }}>
                Rejoins les formations des artistes qui font vivre la danse au quotidien.
              </p>
              <button
                onClick={scrollToFormations}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] px-6 py-3 text-sm font-semibold text-gray-950 transition-all duration-200 hover:brightness-110 active:scale-95"
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
