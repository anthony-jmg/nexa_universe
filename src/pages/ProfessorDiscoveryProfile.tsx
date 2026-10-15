import { useEffect, useState } from 'react';
import { ArrowLeft, Award, ExternalLink, GraduationCap, PlayCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAvatarUrl } from '../components/AvatarUpload';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { parseVideoUrl } from '../lib/videoUrl';
import type { Database } from '../lib/database.types';

type Professor = Database['public']['Tables']['professors']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

interface ProfessorDiscoveryProfileProps {
  professorId: string;
  onNavigate: (page: string) => void;
  onBack?: () => void;
}

export function ProfessorDiscoveryProfile({ professorId, onNavigate, onBack }: ProfessorDiscoveryProfileProps) {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfessor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  const fetchProfessor = async () => {
    const { data, error } = await supabase
      .from('professors')
      .select(`*, profiles (*)`)
      .eq('id', professorId)
      .maybeSingle();

    if (!error && data) {
      setProfessor(data as any);
    }
    setLoading(false);
  };

  function trackClick(
    type: 'academy_profile_click' | 'academy_website_click',
    destinationUrl: string | null = null
  ) {
    supabase
      .from('academy_click_tracking')
      .insert({ professor_id: professorId, content_type: type, destination_url: destinationUrl })
      .then(({ error }) => {
        if (error) console.warn('Click tracking failed:', error.message);
      });
  }

  function visitWebsite() {
    if (!professor?.website_url) return;
    window.open(professor.website_url, '_blank', 'noopener,noreferrer');
    trackClick('academy_website_click', professor.website_url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 pb-12 relative">
        <BackgroundDecor />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 pb-12 relative">
        <BackgroundDecor />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center py-12">
            <p className="text-gray-400">Professeur introuvable.</p>
            <button
              onClick={() => onBack ? onBack() : onNavigate('academy')}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white rounded-full hover:shadow-lg transition-all"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fullName = professor.profiles?.full_name || 'Professeur';
  const avatarUrl = getAvatarUrl(professor.profiles?.avatar_url ?? null);
  const specialties = (professor.specialties ?? []).filter(Boolean);
  const bio = professor.bio?.trim();
  const experienceYears = professor.experience_years ?? 0;
  const videoUrls = (professor.profile_video_urls ?? [])
    .filter(Boolean)
    .slice(0, 3);
  const parsedVideos = videoUrls.map(parseVideoUrl).filter(v => v.source !== 'unknown');

  return (
    <div className="min-h-screen bg-gray-950 relative text-white">
      <BackgroundDecor />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        <button
          onClick={() => onBack ? onBack() : onNavigate('academy')}
          className="flex items-center text-gray-400 hover:text-[#B8913D] transition-colors mb-6 ml-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-sm sm:text-base">Retour</span>
        </button>

        {/* Cover */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101e] mb-0">
          {professor.website_cover_image ? (
            <img
              src={professor.website_cover_image}
              alt={fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0c1424] via-[#07101e] to-gray-950">
              <GraduationCap className="w-16 h-16 text-gold-500/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 to-transparent pointer-events-none" />
        </div>

        {/* Avatar + name + specialties */}
        <div className="relative px-2 sm:px-6 -mt-12 sm:-mt-16 z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-gray-950 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-gray-950">{fullName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left mt-3 sm:mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{fullName}</h1>
              {experienceYears > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1.5 text-sm text-gray-400">
                  <Award className="w-4 h-4 text-[#B8913D] flex-shrink-0" />
                  <span>{experienceYears} ans d'expérience</span>
                </div>
              )}
            </div>
          </div>

          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
              {specialties.map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-[#B8913D]/15 text-[#D4AC5B] text-xs font-medium rounded-full border border-[#B8913D]/30"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bio */}
        {bio && (
          <div className="mt-8 px-2 sm:px-6">
            <h2 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-3">Biographie</h2>
            <p className="text-gray-300 leading-relaxed text-sm sm:text-base whitespace-pre-line">{bio}</p>
          </div>
        )}

        {/* Videos */}
        {parsedVideos.length > 0 && (
          <div className="mt-10 px-2 sm:px-6">
            <h2 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4">En vidéo</h2>
            <div className="space-y-5">
              {parsedVideos.map((video, i) => (
                <VideoEmbed key={i} video={video} />
              ))}
            </div>
          </div>
        )}

        {/* CTA: Visiter le site */}
        {professor.website_url && (
          <div className="mt-12 px-2 sm:px-6 text-center">
            <button
              onClick={visitWebsite}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#B8913D]/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              Visiter le site
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoEmbed({ video }: { video: ReturnType<typeof parseVideoUrl> }) {
  if (video.source === 'youtube' && video.embedUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={video.embedUrl}
          title="Vidéo de présentation"
          className="absolute inset-0 w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (video.source === 'instagram') {
    return (
      <a
        href={video.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#0c1424]/95 p-5 hover:border-[#D4AC5B]/50 transition-all group"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#B8913D] to-[#D4AC5B]">
          <PlayCircle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Voir la vidéo sur Instagram</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{video.originalUrl}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-[#D4AC5B] transition-colors flex-shrink-0" />
      </a>
    );
  }

  return null;
}
