import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import ReviewList from '../components/ReviewList';
import { Database } from '../lib/database.types';
import { Clock, Video, ArrowLeft, Lock, Check, PlayCircle, Eye, EyeOff } from 'lucide-react';

type Program = Database['public']['Tables']['programs']['Row'];
type VideoType = Database['public']['Tables']['videos']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProgramWithDetails extends Program {
  professor?: {
    profiles: Pick<Profile, 'full_name'>;
    subscriber_discount_percentage: number;
  };
  videos?: VideoType[];
}

interface ProgramDetailProps {
  programId: string;
  onNavigate: (page: string) => void;
  onBack?: () => void;
}

export function ProgramDetail({ programId, onNavigate, onBack }: ProgramDetailProps) {
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<ProgramWithDetails | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    loadProgramDetails();
  }, [programId]);

  const loadProgramDetails = async () => {
    setLoading(true);

    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select(`
        *,
        professor:professors!inner(
          profiles!inner(full_name),
          subscriber_discount_percentage
        )
      `)
      .eq('id', programId)
      .single();

    if (programError || !programData) {
      setError('Programme non trouvé');
      setLoading(false);
      return;
    }

    const { data: videosData } = await supabase
      .from('videos')
      .select('*')
      .eq('program_id', programId)
      .order('program_order_index');

    setProgram({
      ...programData,
      videos: videosData || []
    });

    if (user) {
      const { data: purchaseData } = await supabase
        .from('program_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('program_id', programId)
        .eq('status', 'active')
        .maybeSingle();

      setHasPurchased(!!purchaseData);

      const { data: subData } = await supabase
        .from('professor_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('professor_id', programData.professor_id)
        .eq('status', 'active')
        .maybeSingle();

      setHasSubscription(!!subData);

      if (subData && programData.professor?.subscriber_discount_percentage) {
        setDiscountPercentage(programData.professor.subscriber_discount_percentage);
      }
    }

    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!user || !program) return;

    setPurchasing(true);
    setError('');
    setSuccess('');

    try {
      const finalPrice = hasSubscription && discountPercentage > 0
        ? Number(program.price) * (1 - discountPercentage / 100)
        : Number(program.price);

      const { error: purchaseError } = await supabase
        .from('program_purchases')
        .insert([{
          user_id: user.id,
          program_id: programId,
          price_paid: finalPrice,
          status: 'active',
          purchased_at: new Date().toISOString(),
        }]);

      if (purchaseError) throw purchaseError;

      setSuccess('Programme acheté avec succès !');
      setHasPurchased(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurchasing(false);
    }
  };

  const canAccess = () => {
    if (!program) return false;

    if (program.visibility === 'public' && user) return true;
    if (program.visibility === 'subscribers_only' && hasSubscription) return true;
    if (program.visibility === 'paid' && (hasPurchased || hasSubscription)) return true;
    if (program.visibility === 'platform') {
      const hasPlatformAccess = profile?.platform_subscription_status === 'active' &&
        profile?.platform_subscription_expires_at &&
        new Date(profile.platform_subscription_expires_at) > new Date();
      return hasPlatformAccess;
    }

    return false;
  };

  const hasAccess = canAccess();

  const getPrice = () => {
    if (!program) return { original: 0, final: 0, hasDiscount: false };

    const originalPrice = Number(program.price);

    if (hasSubscription && discountPercentage > 0) {
      const finalPrice = originalPrice * (1 - discountPercentage / 100);
      return {
        original: originalPrice,
        final: finalPrice,
        hasDiscount: true
      };
    }

    return {
      original: originalPrice,
      final: originalPrice,
      hasDiscount: false
    };
  };

  const price = getPrice();

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-20 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-white pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Programme non trouvé</p>
          <button
            onClick={() => onBack ? onBack() : onNavigate('academy')}
            className="px-6 py-3 bg-[#B8913D] text-white rounded-full hover:bg-[#A07F35] transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'beginner': return 'Débutant';
      case 'intermediate': return 'Intermédiaire';
      case 'advanced': return 'Avancé';
      case 'all_levels': return 'Tous niveaux';
      default: return level;
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Eye className="w-4 h-4" />;
      case 'private':
        return <EyeOff className="w-4 h-4" />;
      case 'subscribers_only':
        return <Lock className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <button
          onClick={() => onBack ? onBack() : onNavigate('academy')}
          className="flex items-center space-x-2 text-gray-600 hover:text-[#B8913D] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start space-x-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700/50">
              {program.thumbnail_url ? (
                <img
                  src={program.thumbnail_url}
                  alt={program.title}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-[#B8913D] to-[#A07F35] flex items-center justify-center">
                  <Video className="w-16 h-16 text-white opacity-50" />
                </div>
              )}

              <div className="p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                    program.level === 'beginner' ? 'bg-green-100 text-green-800' :
                    program.level === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                    program.level === 'advanced' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getLevelLabel(program.level)}
                  </span>
                  <span className="flex items-center space-x-1 px-4 py-2 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-sm font-medium">
                    {getVisibilityIcon(program.visibility)}
                    <span>
                      {program.visibility === 'public' ? 'Public' :
                       program.visibility === 'private' ? 'Privé' :
                       'Abonnés uniquement'}
                    </span>
                  </span>
                </div>

                <h1 className="text-3xl font-light text-white mb-4">{program.title}</h1>

                <div className="flex items-center space-x-2 text-gray-400 mb-6">
                  <span>Par</span>
                  <button
                    onClick={() => onNavigate(`professor-${program.professor_id}`)}
                    className="text-[#B8913D] hover:underline font-medium"
                  >
                    {program.professor?.profiles?.full_name || 'Professeur'}
                  </button>
                </div>

                <div className="flex items-center space-x-6 mb-6 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4" />
                    <span>{program.videos?.length || 0} vidéos</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{program.videos?.reduce((sum, v) => sum + (v.duration_minutes || 0), 0) || 0} minutes</span>
                  </div>
                </div>

                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {program.description}
                </p>
              </div>
            </div>

            <div className="mt-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50">
              <h2 className="text-2xl font-light text-white mb-6">Contenu du Programme</h2>

              {!program.videos || program.videos.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Aucune vidéo dans ce programme</p>
              ) : (
                <div className="space-y-3">
                  {program.videos.map((video, index) => (
                    <div
                      key={video.id}
                      className={`flex items-center justify-between p-4 rounded-lg border border-gray-700/50 transition-all ${
                        hasAccess ? 'hover:border-[#B8913D] hover:shadow-sm cursor-pointer bg-gray-800/40' : 'opacity-60 bg-gray-800/20'
                      }`}
                      onClick={() => hasAccess && onNavigate(`video-${video.id}`)}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 bg-[#B8913D] bg-opacity-10 rounded-full flex items-center justify-center flex-shrink-0">
                          {hasAccess ? (
                            <PlayCircle className="w-5 h-5 text-[#B8913D]" />
                          ) : (
                            <Lock className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">#{index + 1}</span>
                            <h3 className="font-medium text-white truncate">{video.title}</h3>
                          </div>
                          <p className="text-sm text-gray-400">{video.duration_minutes} min</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
              <ReviewList itemType="program" itemId={program.id} />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50 sticky top-24">
              {program.visibility === 'public' && user ? (
                <>
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 py-3 rounded-lg mb-4">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Contenu gratuit</span>
                    </div>
                  </div>
                  <button
                    onClick={() => program.videos && program.videos.length > 0 && onNavigate(`video-${program.videos[0].id}`)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    Commencer le programme
                  </button>
                </>
              ) : program.visibility === 'public' && !user ? (
                <div className="text-center">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    Connectez-vous pour accéder à ce programme gratuit.
                  </p>
                  <button
                    onClick={() => onNavigate('signin')}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    Se connecter
                  </button>
                </div>
              ) : program.visibility === 'subscribers_only' && hasSubscription ? (
                <>
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center space-x-2 text-[#B8913D] bg-[#B8913D] bg-opacity-10 py-3 rounded-lg mb-4">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Inclus dans votre abonnement</span>
                    </div>
                  </div>
                  <button
                    onClick={() => program.videos && program.videos.length > 0 && onNavigate(`video-${program.videos[0].id}`)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    Commencer le programme
                  </button>
                </>
              ) : program.visibility === 'subscribers_only' && !hasSubscription ? (
                <div className="text-center">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    Ce programme est réservé aux abonnés du professeur.
                  </p>
                  <button
                    onClick={() => onNavigate(`professor-${program.professor_id}`)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    S'abonner au professeur
                  </button>
                </div>
              ) : program.visibility === 'paid' && (hasPurchased || hasSubscription) ? (
                <>
                  <div className="text-center mb-6">
                    {program.price > 0 && (
                      <div className="text-4xl font-bold text-[#B8913D] mb-2">
                        {price.final.toFixed(2)}€
                      </div>
                    )}
                    <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 py-3 rounded-lg">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">
                        {hasPurchased ? 'Programme acheté' : 'Inclus dans votre abonnement'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => program.videos && program.videos.length > 0 && onNavigate(`video-${program.videos[0].id}`)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    Commencer le programme
                  </button>
                </>
              ) : program.visibility === 'paid' && !showPrice ? (
                <div className="text-center">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    Ce programme est disponible à l'achat.
                  </p>
                  <button
                    onClick={() => setShowPrice(true)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all"
                  >
                    Débloquer
                  </button>
                </div>
              ) : program.visibility === 'paid' && showPrice ? (
                <>
                  <div className="text-center mb-6">
                    {price.hasDiscount ? (
                      <>
                        <div className="text-2xl text-gray-400 line-through mb-1">
                          {price.original.toFixed(2)}€
                        </div>
                        <div className="text-4xl font-bold text-[#B8913D] mb-2">
                          {price.final.toFixed(2)}€
                        </div>
                        <div className="inline-flex items-center space-x-2 bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium mb-2 border border-green-500/30">
                          <span>-{discountPercentage}% réduction abonné</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-4xl font-bold text-[#B8913D] mb-2">
                        {price.final.toFixed(2)}€
                      </div>
                    )}
                    <p className="text-sm text-gray-400">Accès à vie au programme</p>
                    {!hasSubscription && discountPercentage > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Abonnez-vous au professeur pour obtenir -{discountPercentage}%
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !user}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? (
                      <span className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Achat en cours...</span>
                      </span>
                    ) : !user ? (
                      'Se connecter pour acheter'
                    ) : (
                      'Acheter le programme'
                    )}
                  </button>
                </>
              ) : program.visibility === 'private' ? (
                <div className="text-center">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">Ce programme est privé</p>
                </div>
              ) : null}

              <div className="mt-8 pt-8 border-t border-gray-700/50">
                <h3 className="font-medium text-white mb-4">Ce programme inclut :</h3>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>{program.videos?.length || 0} vidéos de haute qualité</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Accès à vie au contenu</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>{program.videos?.reduce((sum, v) => sum + (v.duration_minutes || 0), 0) || 0} minutes de contenu</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Progression sauvegardée</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
