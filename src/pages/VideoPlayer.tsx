import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, PlayCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import CloudflareVideoPlayer from '../components/CloudflareVideoPlayer';
import ReviewList from '../components/ReviewList';
import type { Database } from '../lib/database.types';

type Video = Database['public']['Tables']['videos']['Row'] & {
  cloudflare_video_id?: string;
};

interface VideoProgress {
  progress_percentage: number;
  last_position_seconds: number;
  completed: boolean;
}

interface VideoPlayerProps {
  videoId: string;
  onNavigate: (page: string) => void;
  onBack?: () => void;
}

export function VideoPlayer({ videoId, onNavigate, onBack }: VideoPlayerProps) {
  const { user } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [accessType, setAccessType] = useState<'free' | 'platform' | 'professor' | 'purchased' | 'locked'>('locked');
  const [showPrice, setShowPrice] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchVideo();
    fetchProgress();
  }, [videoId]);

  const fetchVideo = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .maybeSingle();

    if (!error && data) {
      setVideo(data);
      await checkAccess(data);
    }
    setLoading(false);
  };

  const checkAccess = async (videoData: Video) => {
    if (videoData.visibility === 'public') {
      if (!user) {
        setCanAccess(false);
        setAccessType('locked');
        return;
      }
      setCanAccess(true);
      setAccessType('free');
      return;
    }

    if (videoData.visibility === 'private') {
      setCanAccess(false);
      setAccessType('locked');
      return;
    }

    if (videoData.visibility === 'subscribers_only') {
      if (!user || !videoData.professor_id) {
        setCanAccess(false);
        setAccessType('locked');
        return;
      }

      const { data: subData } = await supabase
        .from('professor_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('professor_id', videoData.professor_id)
        .eq('status', 'active')
        .maybeSingle();

      if (subData) {
        setCanAccess(true);
        setAccessType('professor');
        return;
      }

      setCanAccess(false);
      setAccessType('locked');
      return;
    }

    if (videoData.visibility === 'paid') {
      if (!user) {
        setCanAccess(false);
        setAccessType('locked');
        return;
      }

      if (videoData.program_id) {
        const { data: purchaseData } = await supabase
          .from('program_purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('program_id', videoData.program_id)
          .eq('status', 'active')
          .maybeSingle();

        if (purchaseData) {
          setCanAccess(true);
          setAccessType('purchased');
          return;
        }

        if (videoData.professor_id) {
          const { data: subData } = await supabase
            .from('professor_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('professor_id', videoData.professor_id)
            .eq('status', 'active')
            .maybeSingle();

          if (subData) {
            setCanAccess(true);
            setAccessType('professor');
            return;
          }
        }
      } else {
        const { data: purchaseData } = await supabase
          .from('video_purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('video_id', videoData.id)
          .eq('status', 'active')
          .maybeSingle();

        if (purchaseData) {
          setCanAccess(true);
          setAccessType('purchased');
          return;
        }
      }

      setCanAccess(false);
      setAccessType('locked');
      return;
    }

    setCanAccess(false);
    setAccessType('locked');
  };

  const fetchProgress = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('video_views')
      .select('progress_percentage, last_position_seconds, completed')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .order('last_watched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setProgress(data);
    }
  };

  const markAsComplete = async () => {
    if (!user) return;

    await supabase
      .from('video_views')
      .upsert({
        user_id: user.id,
        video_id: videoId,
        progress_percentage: 100,
        completed: true,
        last_watched_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,video_id'
      });

    fetchProgress();
  };

  const handlePurchase = async () => {
    if (!user || !video) return;

    setPurchasing(true);
    setError('');
    setSuccess('');

    try {
      const { error: purchaseError } = await supabase
        .from('video_purchases')
        .insert([{
          user_id: user.id,
          video_id: video.id,
          amount_paid: Number(video.price),
          status: 'active',
          purchased_at: new Date().toISOString(),
        }]);

      if (purchaseError) throw purchaseError;

      setSuccess('Vidéo achetée avec succès !');
      await checkAccess(video);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurchasing(false);
    }
  };

  const getAccessMessage = () => {
    if (!video) return '';

    if (video.visibility === 'public' && !user) {
      return 'Vous devez être connecté pour accéder à ce contenu gratuit.';
    }

    if (video.visibility === 'private') {
      return 'Ce contenu est privé et n\'est pas accessible.';
    }

    if (video.visibility === 'subscribers_only') {
      return 'Ce contenu est réservé aux abonnés du professeur.';
    }

    if (video.visibility === 'paid') {
      if (video.program_id) {
        return 'Ce contenu fait partie d\'un programme payant.';
      }
      return 'Cette vidéo est disponible à l\'achat.';
    }

    return 'Ce contenu est verrouillé.';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Video not found</p>
          <button
            onClick={() => onBack ? onBack() : onNavigate('academy')}
            className="text-[#B8913D] hover:text-[#A07F35] font-medium"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative">
      <BackgroundDecor />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <button
          onClick={() => onBack ? onBack() : onNavigate('academy')}
          className="flex items-center text-gray-400 hover:text-[#B8913D] mb-6 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700/50 mb-8">
          {!canAccess ? (
            <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <div className="absolute inset-0 bg-[#B8913D] opacity-10"></div>
              <div className="relative text-center p-8">
                <Lock className="w-20 h-20 text-[#B8913D] mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">
                  Contenu verrouillé
                </h3>
                <p className="text-gray-300 mb-6 leading-relaxed max-w-md mx-auto">
                  {getAccessMessage()}
                </p>

                {video?.visibility === 'public' && !user && (
                  <button
                    onClick={() => onNavigate('signin')}
                    className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all font-medium"
                  >
                    Se connecter
                  </button>
                )}

                {video?.visibility === 'subscribers_only' && video?.professor_id && (
                  <button
                    onClick={() => onNavigate(`professor-${video.professor_id}`)}
                    className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all font-medium"
                  >
                    S'abonner au professeur
                  </button>
                )}

                {video?.visibility === 'paid' && video?.program_id && (
                  <button
                    onClick={() => onNavigate(`program-${video.program_id}`)}
                    className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all font-medium"
                  >
                    Voir le programme
                  </button>
                )}

                {video?.visibility === 'paid' && !video?.program_id && !showPrice && (
                  <button
                    onClick={() => setShowPrice(true)}
                    className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all font-medium"
                  >
                    Acheter cette vidéo
                  </button>
                )}

                {video?.visibility === 'paid' && !video?.program_id && showPrice && (
                  <div>
                    <div className="text-4xl font-bold text-[#B8913D] mb-6">
                      {Number(video.price).toFixed(2)}€
                    </div>
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="px-8 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Achat en cours...</span>
                        </span>
                      ) : (
                        'Acheter maintenant'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center relative">
                {video.cloudflare_video_id ? (
                  <CloudflareVideoPlayer
                    videoId={video.id}
                    cloudflareVideoId={video.cloudflare_video_id}
                    onComplete={() => {
                      markAsComplete();
                      fetchProgress();
                    }}
                  />
                ) : video.video_url ? (
                  <video
                    src={video.video_url}
                    controls
                    className="w-full h-full"
                  />
                ) : (
                  <div className="text-center text-white">
                    <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Video player placeholder</p>
                    <p className="text-sm opacity-75 mt-2">
                      Connect to your video streaming provider
                    </p>
                  </div>
                )}
              </div>

              {progress && !progress.completed && progress.progress_percentage > 0 && (
                <div className="h-2 bg-gray-200">
                  <div
                    className="h-full bg-[#B8913D] transition-all"
                    style={{ width: `${progress.progress_percentage}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-700/50 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-light text-white mb-2">
                {video.title}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span className="px-3 py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full font-medium capitalize">{video.level}</span>
                <span className="flex items-center">
                  <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                  {video.duration_minutes} minutes
                </span>
              </div>
            </div>

            {canAccess && (
              <>
                {progress?.completed ? (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-full">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={markAsComplete}
                    className="px-6 py-2 bg-[#B8913D] text-white font-medium rounded-full hover:bg-[#A07F35] transition-colors whitespace-nowrap"
                  >
                    Mark Complete
                  </button>
                )}
              </>
            )}
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-300 leading-relaxed">
              {video.description || 'No description available.'}
            </p>
          </div>
        </div>

        <div>
          <ReviewList itemType="video" itemId={video.id} />
        </div>
      </div>
    </div>
  );
}
