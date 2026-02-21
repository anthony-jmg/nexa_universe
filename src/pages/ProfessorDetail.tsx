import { useEffect, useState } from 'react';
import { ArrowLeft, Award, PlayCircle, Lock, CheckCircle, Sparkles, BookOpen, ShoppingBag, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { FavoriteButton } from '../components/FavoriteButton';
import { getAvatarUrl } from '../components/AvatarUpload';
import { handleProfessorSubscriptionCheckout } from '../lib/stripe';
import LazyImage from '../components/LazyImage';
import type { Database } from '../lib/database.types';

type Professor = Database['public']['Tables']['professors']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

type Video = Database['public']['Tables']['videos']['Row'];
type Program = Database['public']['Tables']['programs']['Row'];

interface ProfessorDetailProps {
  professorId: string;
  onNavigate: (page: string) => void;
  onBack?: () => void;
}

export function ProfessorDetail({ professorId, onNavigate, onBack }: ProfessorDetailProps) {
  const { user } = useAuth();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [showSubscriptionPrice, setShowSubscriptionPrice] = useState(false);
  const [purchasedPrograms, setPurchasedPrograms] = useState<Set<string>>(new Set());
  const [purchasedVideos, setPurchasedVideos] = useState<Set<string>>(new Set());
  const [priceVisibility, setPriceVisibility] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchProfessorData();
  }, [professorId, user]);

  const fetchProfessorData = async () => {
    const { data: profData, error: profError } = await supabase
      .from('professors')
      .select(`
        *,
        profiles (*)
      `)
      .eq('id', professorId)
      .maybeSingle();

    if (profError) {
      console.error('Error fetching professor:', profError);
    } else if (profData) {
      setProfessor(profData as any);
    }

    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false });

    if (videoError) {
      console.error('Error fetching videos:', videoError);
    } else if (videoData) {
      setVideos(videoData);
    }

    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select(`
        *,
        videos!program_id(
          duration_minutes
        )
      `)
      .eq('professor_id', professorId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (programError) {
      console.error('Error fetching programs:', programError);
    } else if (programData) {
      const programsWithCounts = programData.map(program => {
        const videos = (program as any).videos || [];
        return {
          ...program,
          video_count: videos.length,
          duration_total_minutes: videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0)
        };
      });
      setPrograms(programsWithCounts);
    }

    if (user) {
      const { data: subData } = await supabase
        .from('professor_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('professor_id', professorId)
        .eq('status', 'active')
        .maybeSingle();

      setSubscribed(!!subData);

      const { data: programPurchases } = await supabase
        .from('program_purchases')
        .select('program_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (programPurchases) {
        setPurchasedPrograms(new Set(programPurchases.map(p => p.program_id)));
      }

      const { data: videoPurchases } = await supabase
        .from('video_purchases')
        .select('video_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (videoPurchases) {
        setPurchasedVideos(new Set(videoPurchases.map(v => v.video_id)));
      }
    }

    setLoading(false);
  };

  const handleSubscribe = async () => {
    if (!user) {
      onNavigate('signup');
      return;
    }

    if (!professor) return;

    if (subscribed) {
      onNavigate('account');
      return;
    }

    if (professor.subscription_price === 0) {
      try {
        const { error } = await supabase
          .from('professor_subscriptions')
          .insert({
            user_id: user.id,
            professor_id: professor.id,
            status: 'active',
            price_paid: 0,
          });

        if (error) throw error;
        setSubscribed(true);
      } catch (error) {
        console.error('Failed to subscribe:', error);
        alert('Échec de l\'abonnement. Veuillez réessayer.');
      }
      return;
    }

    try {
      await handleProfessorSubscriptionCheckout(
        professor.id,
        professor.profiles?.full_name || 'Professor',
        professor.subscription_price
      );
    } catch (error) {
      console.error('Failed to start checkout:', error);
      alert('Échec du démarrage du paiement. Veuillez réessayer.');
    }
  };

  const handleVideoClick = (video: Video) => {
    if (!user) {
      onNavigate('signup');
      return;
    }
    onNavigate(`video-${video.id}`);
  };

  const handleProgramClick = (program: Program) => {
    if (!user) {
      onNavigate('signup');
      return;
    }
    onNavigate(`program-${program.id}`);
  };

  const togglePriceVisibility = (id: string) => {
    setPriceVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const publicPrograms = programs.filter(p => p.visibility === 'public');
  const publicVideos = videos.filter(v => v.visibility === 'public' && !v.program_id);

  // Professors can always access their own content
  const isProfessorOwner = user?.id === professorId;

  const subscriberPrograms = programs.filter(p => p.visibility === 'subscribers_only');
  const subscriberVideos = videos.filter(v => v.visibility === 'subscribers_only' && !v.program_id);

  const paidPrograms = programs.filter(p => p.visibility === 'paid');
  const paidVideos = videos.filter(v => v.visibility === 'paid' && !v.program_id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative">
        <BackgroundDecor />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative">
        <BackgroundDecor />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center py-12">
            <p className="text-gray-400">Professor not found.</p>
            <button
              onClick={() => onBack ? onBack() : onNavigate('professors')}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative">
      <BackgroundDecor />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <button
          onClick={() => onBack ? onBack() : onNavigate('professors')}
          className="flex items-center text-gray-400 hover:text-[#B8913D] transition-colors mb-4 sm:mb-6 ml-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-sm sm:text-base">Retour</span>
        </button>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 border border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
            <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center shadow-xl mb-4 md:mb-0 mx-auto md:mx-0 flex-shrink-0 overflow-hidden">
              {professor.profiles?.avatar_url ? (
                <img
                  src={getAvatarUrl(professor.profiles.avatar_url) || ''}
                  alt={professor.profiles.full_name || 'Professor'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full bg-gradient-to-br from-[#B8913D] to-[#A07F35] flex items-center justify-center text-white text-4xl font-medium">
                  <div className="absolute inset-0 bg-white opacity-10 blur"></div>
                  <span className="relative z-10">{professor.profiles?.full_name?.charAt(0) || '?'}</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-white">
                  {professor.profiles?.full_name || 'Unknown'}
                </h1>
                <FavoriteButton type="professor" itemId={professor.id} size="md" />
              </div>
              <div className="flex items-center justify-center md:justify-start text-gray-400 mb-3 text-xs sm:text-sm md:text-base">
                <Award className="w-4 h-4 mr-1.5 text-[#B8913D] flex-shrink-0" />
                <span>{professor.experience_years} years of teaching experience</span>
              </div>

              {professor.specialties && professor.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 justify-center md:justify-start">
                  {professor.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 bg-[#B8913D] bg-opacity-20 text-[#B8913D] text-xs font-medium rounded border border-[#B8913D] border-opacity-30"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-gray-300 leading-relaxed mb-5 text-sm sm:text-base">
                {professor.bio || 'No biography available.'}
              </p>

              {(subscriberPrograms.length > 0 || subscriberVideos.length > 0 || professor.subscription_price >= 0) && (
                <div className={`rounded-xl p-4 sm:p-6 backdrop-blur-sm border ${professor.subscription_price === 0 ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-green-500/30' : 'bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-[#B8913D]/30'}`}>
                  {subscribed ? (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                      <div>
                        <div className="text-base sm:text-lg text-white mb-1.5 flex items-center justify-center md:justify-start space-x-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <span className="font-medium">Abonné à ce professeur</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400">
                          Accès à tout le contenu exclusif pour abonnés
                        </p>
                      </div>
                      <button
                        onClick={handleSubscribe}
                        className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium rounded-full hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all whitespace-nowrap"
                      >
                        Gérer l'abonnement
                      </button>
                    </div>
                  ) : professor.subscription_price === 0 ? (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-6">
                      <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                          <Gift className="w-5 h-5 text-green-400" />
                          <span className="text-base sm:text-lg font-medium text-green-400">Abonnement gratuit</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                          L'abonnement à ce professeur est gratuit. Abonnez-vous pour accéder à son contenu réservé aux abonnés.
                          {paidPrograms.length > 0 || paidVideos.length > 0 ? (
                            <span className="block mt-1 text-gray-400">Certains contenus restent disponibles à l'achat individuel.</span>
                          ) : null}
                        </p>
                        <div className="mt-2 inline-flex items-center space-x-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
                          <span className="text-xl sm:text-2xl font-bold text-green-400">0€</span>
                          <span className="text-xs text-green-400/70">/mois</span>
                        </div>
                      </div>
                      <button
                        onClick={handleSubscribe}
                        className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm sm:text-base font-medium rounded-full hover:shadow-lg hover:shadow-green-500/40 transition-all whitespace-nowrap"
                      >
                        {user ? 'S\'abonner gratuitement' : 'Se connecter pour s\'abonner'}
                      </button>
                    </div>
                  ) : !showSubscriptionPrice ? (
                    <div className="text-center">
                      <p className="text-gray-300 mb-4 leading-relaxed text-sm sm:text-base">
                        Accédez à tout le contenu exclusif de ce professeur avec un abonnement mensuel.
                      </p>
                      <button
                        onClick={() => setShowSubscriptionPrice(true)}
                        className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium rounded-full hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all"
                      >
                        S'abonner à ce professeur
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                      <div className="text-center md:text-left">
                        <div className="text-2xl sm:text-3xl font-light text-white mb-1.5">
                          {professor.subscription_price}€
                          <span className="text-sm sm:text-base text-gray-400 font-normal">/mois</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400">
                          Accès illimité au contenu exclusif pour abonnés
                        </p>
                      </div>
                      <button
                        onClick={handleSubscribe}
                        className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium rounded-full hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all whitespace-nowrap"
                      >
                        {user ? 'Confirmer l\'abonnement' : 'Se connecter'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {(publicPrograms.length > 0 || publicVideos.length > 0) && (
          <div className="mb-8 sm:mb-12">
            <div className="flex items-start space-x-2.5 sm:space-x-3 mb-5 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-light text-white leading-tight">
                  Découvrez <span className="text-[#B8913D]">{professor.profiles?.full_name || 'ce professeur'}</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Contenus publics et gratuits</p>
              </div>
            </div>

            {publicPrograms.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Programmes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {publicPrograms.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      hasAccess={true}
                      subscribed={subscribed}
                      onClick={() => handleProgramClick(program)}
                      showPrice={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {publicVideos.length > 0 && (
              <div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Vidéos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {publicVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      hasAccess={true}
                      subscribed={subscribed}
                      onClick={() => handleVideoClick(video)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(subscriberPrograms.length > 0 || subscriberVideos.length > 0) && (
          <div className="mb-8 sm:mb-12">
            <div className="flex items-start space-x-2.5 sm:space-x-3 mb-5 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-light text-white leading-tight">
                  Contenu <span className="text-[#B8913D]">Exclusif Abonnés</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Accessible avec l'abonnement au professeur</p>
              </div>
            </div>

            {subscriberPrograms.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Programmes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {subscriberPrograms.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      hasAccess={isProfessorOwner || subscribed || purchasedPrograms.has(program.id)}
                      subscribed={subscribed}
                      onClick={() => handleProgramClick(program)}
                      showPrice={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {subscriberVideos.length > 0 && (
              <div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Vidéos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {subscriberVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      hasAccess={isProfessorOwner || subscribed || purchasedVideos.has(video.id)}
                      subscribed={subscribed}
                      onClick={() => handleVideoClick(video)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(paidPrograms.length > 0 || paidVideos.length > 0) && (
          <div className="mb-8 sm:mb-12">
            <div className="flex items-start space-x-2.5 sm:space-x-3 mb-5 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-light text-white leading-tight">
                  Pour aller <span className="text-[#B8913D]">plus loin</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Contenu payant - Accès permanent</p>
              </div>
            </div>

            {paidPrograms.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Programmes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {paidPrograms.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      hasAccess={isProfessorOwner || subscribed || purchasedPrograms.has(program.id)}
                      subscribed={subscribed}
                      onClick={() => handleProgramClick(program)}
                      showPrice={priceVisibility[program.id]}
                      onTogglePrice={() => togglePriceVisibility(program.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {paidVideos.length > 0 && (
              <div>
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4 px-1">Vidéos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                  {paidVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      hasAccess={isProfessorOwner || subscribed || purchasedVideos.has(video.id)}
                      subscribed={subscribed}
                      onClick={() => handleVideoClick(video)}
                      showPrice={priceVisibility[video.id]}
                      onTogglePrice={() => togglePriceVisibility(video.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface VideoCardProps {
  video: Video;
  hasAccess: boolean;
  subscribed: boolean;
  onClick: () => void;
  showPrice?: boolean;
  onTogglePrice?: () => void;
}

function VideoCard({ video, hasAccess, subscribed, onClick, showPrice, onTogglePrice }: VideoCardProps) {
  const getCategoryBadge = () => {
    if (video.category === 'teaser') {
      return (
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-green-500 text-white text-xs font-medium rounded-full">
          Aperçu
        </div>
      );
    }
    if (hasAccess && subscribed) {
      return (
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#B8913D] text-white text-xs font-medium rounded-full flex items-center space-x-1">
          <CheckCircle className="w-3 h-3" />
          <span>Accès</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl shadow-sm hover:shadow-xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-gray-700/50 hover:border-[#B8913D]/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
        {video.thumbnail_url && video.thumbnail_url.trim() !== '' ? (
          <LazyImage
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {hasAccess ? (
              <PlayCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white opacity-75 group-hover:opacity-100 transition-opacity" />
            ) : (
              <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-white opacity-75" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {hasAccess ? (
            <PlayCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          ) : (
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          )}
        </div>
        {getCategoryBadge()}
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
          <FavoriteButton type="video" itemId={video.id} size="sm" />
        </div>
      </div>

      <div className="p-3.5 sm:p-5">
        <h3 className="text-base sm:text-lg font-medium text-white mb-1.5 sm:mb-2 line-clamp-2">
          {video.title}
        </h3>
        {video.description && (
          <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 mb-2.5 sm:mb-3">
            {video.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-500">
            {video.duration_minutes} min
          </span>
          {!hasAccess && video.price > 0 && onTogglePrice && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePrice();
              }}
              className="text-[#D4AC5B] font-medium hover:text-[#B8913D] transition-colors"
            >
              {showPrice ? `${video.price}€` : 'Voir le prix'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProgramCardProps {
  program: Program;
  hasAccess: boolean;
  subscribed: boolean;
  onClick: () => void;
  showPrice?: boolean;
  onTogglePrice?: () => void;
}

function ProgramCard({ program, hasAccess, subscribed, onClick, showPrice, onTogglePrice }: ProgramCardProps) {
  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl shadow-sm hover:shadow-xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-gray-700/50 hover:border-[#B8913D]/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
        {program.thumbnail_url && program.thumbnail_url.trim() !== '' ? (
          <LazyImage
            src={program.thumbnail_url}
            alt={program.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {hasAccess ? (
              <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-white opacity-75 group-hover:opacity-100 transition-opacity" />
            ) : (
              <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-white opacity-75" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {hasAccess ? (
            <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          ) : (
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          )}
        </div>
        {hasAccess && subscribed && (
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#B8913D] text-white text-xs font-medium rounded-full flex items-center space-x-1">
            <CheckCircle className="w-3 h-3" />
            <span>Accès</span>
          </div>
        )}
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
          <FavoriteButton type="program" itemId={program.id} size="sm" />
        </div>
      </div>

      <div className="p-3.5 sm:p-5">
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-2">
          <span className="px-2 py-0.5 sm:py-1 bg-[#B8913D]/20 text-[#D4AC5B] text-xs font-medium rounded border border-[#B8913D]/30">
            Programme
          </span>
          <span className="px-2 py-0.5 sm:py-1 bg-gray-700/50 text-gray-300 text-xs rounded">
            {program.level}
          </span>
        </div>
        <h3 className="text-base sm:text-lg font-medium text-white mb-1.5 sm:mb-2 line-clamp-2">
          {program.title}
        </h3>
        {program.description && (
          <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 mb-2.5 sm:mb-3">
            {program.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-500">
            {program.duration_total_minutes} min
          </span>
          {!hasAccess && program.price > 0 && onTogglePrice && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePrice();
              }}
              className="text-[#D4AC5B] font-medium hover:text-[#B8913D] transition-colors"
            >
              {showPrice ? `${program.price}€` : 'Voir le prix'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
