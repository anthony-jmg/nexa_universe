import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { ImageUpload } from '../components/ImageUpload';
import { VideoUpload } from '../components/VideoUpload';
import { ProgramEditForm } from '../components/ProgramEditForm';
import { VideoEditForm } from '../components/VideoEditForm';
import LazyImage from '../components/LazyImage';
import { Database } from '../lib/database.types';
import { Video, Folder, Plus, Edit2, Trash2, X, Check, AlertCircle, Eye, EyeOff, Lock, Settings, Percent, ChevronUp, ChevronDown, List, BarChart3, Users, Play, DollarSign, TrendingUp } from 'lucide-react';

type Video = Database['public']['Tables']['videos']['Row'];
type Program = Database['public']['Tables']['programs']['Row'];

interface ProgramFormData {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  price: number;
  thumbnail_url: string;
  visibility: 'public' | 'private' | 'subscribers_only' | 'paid' | 'platform';
}

interface VideoFormData {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  cloudflare_video_id: string;
  thumbnail_url: string;
  program_id: string | null;
  visibility: 'public' | 'private' | 'subscribers_only' | 'paid' | 'platform';
  program_order_index: number;
}

interface ProfessorDashboardProps {
  onNavigate: (page: string) => void;
}

async function ensureProfessorExists(userId: string): Promise<void> {
  const { data: professorExists } = await supabase
    .from('professors')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!professorExists) {
    const { error } = await supabase
      .from('professors')
      .insert([{
        id: userId,
        bio: '',
        specialties: [],
        experience_years: 0,
        profile_video_url: '',
        is_featured: false,
        subscription_price: 0
      }]);

    if (error) throw new Error(`Erreur lors de la création du profil professeur: ${error.message}`);
  }
}

export function ProfessorDashboard({ onNavigate }: ProfessorDashboardProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'videos' | 'programs' | 'settings' | 'stats'>('stats');
  const [videos, setVideos] = useState<Video[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [managingProgramId, setManagingProgramId] = useState<string | null>(null);
  const [programVideos, setProgramVideos] = useState<Video[]>([]);
  const [subscriberDiscount, setSubscriberDiscount] = useState(0);
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [stats, setStats] = useState({
    totalSubscribers: 0,
    totalViews: 0,
    totalRevenue: 0,
    topVideos: [] as { title: string; views: number; video_id: string }[],
    topPrograms: [] as { title: string; purchases: number; revenue: number; program_id: string }[]
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const [programForm, setProgramForm] = useState<ProgramFormData>({
    title: '',
    description: '',
    level: 'beginner',
    price: 0,
    thumbnail_url: '',
    visibility: 'public',
  });

  const [videoForm, setVideoForm] = useState<VideoFormData>({
    title: '',
    description: '',
    level: 'beginner',
    duration_minutes: 0,
    cloudflare_video_id: '',
    thumbnail_url: '',
    program_id: null,
    visibility: 'public',
    program_order_index: 0,
  });

  useEffect(() => {
    console.log('ProfessorDashboard - User:', user?.id);
    console.log('ProfessorDashboard - Profile role:', profile?.role);

    if (profile?.role !== 'professor' && profile?.role !== 'admin') {
      onNavigate('academy');
      return;
    }
    loadData();
  }, [profile, user, onNavigate]);

  useEffect(() => {
    if (activeTab === 'stats' && user?.id) {
      loadStatistics();
    }
  }, [activeTab, user?.id, programs, videos]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadVideos(), loadPrograms(), loadProfessorSettings()]);
    setLoading(false);
  };

  const loadProfessorSettings = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('professors')
      .select('subscriber_discount_percentage, subscription_price')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading professor settings:', error);
      setError('Impossible de charger les paramètres du professeur');
      return;
    }

    if (!data) {
      setError('Profil professeur non trouvé');
      return;
    }

    setSubscriberDiscount(data.subscriber_discount_percentage || 0);
    setSubscriptionPrice(Number(data.subscription_price) || 0);
  };

  const loadStatistics = async () => {
    if (!user?.id) return;

    setLoadingStats(true);
    try {
      // Get video IDs for this professor
      const professorVideoIds = videos.map(v => v.id);

      const [subscribersData, viewsData, revenueData, topVideosData, programPurchasesData] = await Promise.all([
        supabase
          .from('professor_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('professor_id', user.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString()),

        professorVideoIds.length > 0
          ? supabase
              .from('video_views')
              .select('*', { count: 'exact', head: true })
              .in('video_id', professorVideoIds)
          : { count: 0 },

        supabase
          .from('stripe_payments')
          .select('amount')
          .eq('status', 'succeeded')
          .or(`metadata->>professor_id.eq.${user.id}`),

        professorVideoIds.length > 0
          ? supabase
              .from('video_views')
              .select('video_id, videos(title)')
              .in('video_id', professorVideoIds)
          : { data: [] },

        programs.length > 0
          ? supabase
              .from('program_purchases')
              .select('program_id, price_paid, programs(title)')
              .eq('status', 'active')
              .in('program_id', programs.map(p => p.id))
          : { data: [] }
      ]);

      const totalSubscribers = subscribersData.count || 0;
      const totalViews = viewsData.count || 0;

      let totalRevenue = 0;
      if (revenueData.data) {
        totalRevenue = revenueData.data.reduce((sum, payment) => sum + Number(payment.amount), 0);
      }

      const videoViewCounts = new Map<string, { title: string; count: number }>();
      if (topVideosData.data) {
        topVideosData.data.forEach((view: any) => {
          if (view.videos && view.video_id) {
            const existing = videoViewCounts.get(view.video_id);
            if (existing) {
              existing.count++;
            } else {
              videoViewCounts.set(view.video_id, {
                title: view.videos.title,
                count: 1
              });
            }
          }
        });
      }

      const topVideos = Array.from(videoViewCounts.entries())
        .map(([video_id, { title, count }]) => ({
          video_id,
          title,
          views: count
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

      const programStats = new Map<string, { title: string; purchases: number; revenue: number }>();
      if (programPurchasesData.data) {
        programPurchasesData.data.forEach((purchase: any) => {
          if (purchase.programs && purchase.program_id) {
            const existing = programStats.get(purchase.program_id);
            if (existing) {
              existing.purchases++;
              existing.revenue += Number(purchase.price_paid);
            } else {
              programStats.set(purchase.program_id, {
                title: purchase.programs.title,
                purchases: 1,
                revenue: Number(purchase.price_paid)
              });
            }
          }
        });
      }

      const topPrograms = Array.from(programStats.entries())
        .map(([program_id, { title, purchases, revenue }]) => ({
          program_id,
          title,
          purchases,
          revenue
        }))
        .sort((a, b) => b.purchases - a.purchases)
        .slice(0, 5);

      setStats({
        totalSubscribers,
        totalViews,
        totalRevenue,
        topVideos,
        topPrograms
      });
    } catch (err: any) {
      console.error('Error loading statistics:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoadingStats(false);
    }
  };

  const loadVideos = async () => {
    if (!user?.id) {
      console.log('loadVideos: No user ID');
      return;
    }

    console.log('Loading videos for professor:', user.id);
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('professor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading videos:', error);
      setError(`Erreur lors du chargement des vidéos: ${error.message}`);
      return;
    }

    console.log('Videos loaded:', data?.length || 0);
    if (data) {
      setVideos(data);
    }
  };

  const loadPrograms = async () => {
    if (!user?.id) {
      console.log('loadPrograms: No user ID');
      return;
    }

    console.log('Loading programs for professor:', user.id);
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        videos!program_id(
          duration_minutes
        )
      `)
      .eq('professor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading programs:', error);
      setError(`Erreur lors du chargement des programmes: ${error.message}`);
      return;
    }

    console.log('Programs loaded:', data?.length || 0);
    if (data) {
      const programsWithCounts = data.map(program => {
        const videos = (program as any).videos || [];
        return {
          ...program,
          video_count: videos.length,
          duration_total_minutes: videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0)
        };
      });
      setPrograms(programsWithCounts);
    }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingProgram) {
        const { error } = await supabase
          .from('programs')
          .update({ ...programForm, updated_at: new Date().toISOString() })
          .eq('id', editingProgram.id);

        if (error) throw error;
        setSuccess('Programme mis à jour avec succès');
      } else {
        if (!user?.id) throw new Error('Utilisateur non connecté');

        await ensureProfessorExists(user.id);

        const { error } = await supabase
          .from('programs')
          .insert([{ ...programForm, professor_id: user.id }]);

        if (error) throw error;
        setSuccess('Programme créé avec succès');
      }

      await loadPrograms();
      resetProgramForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingVideo) {
        const { error } = await supabase
          .from('videos')
          .update({ ...videoForm, updated_at: new Date().toISOString() })
          .eq('id', editingVideo.id);

        if (error) throw error;
        setSuccess('Vidéo mise à jour avec succès');
      } else {
        if (!user?.id) throw new Error('Utilisateur non connecté');

        await ensureProfessorExists(user.id);

        const { error } = await supabase
          .from('videos')
          .insert([{ ...videoForm, professor_id: user.id }]);

        if (error) throw error;
        setSuccess('Vidéo ajoutée avec succès');
      }

      await loadVideos();
      resetVideoForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce programme ?')) return;

    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadPrograms();
      setSuccess('Programme supprimé avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) return;

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadVideos();
      setSuccess('Vidéo supprimée avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleEditProgram = (program: Program) => {
    setEditingProgram(program);
  };

  const handleEditVideo = (video: Video) => {
    setEditingVideo(video);
  };

  const handleSaveProgramEdit = async (formData: ProgramFormData) => {
    if (!editingProgram) return;

    const { error } = await supabase
      .from('programs')
      .update({ ...formData, updated_at: new Date().toISOString() })
      .eq('id', editingProgram.id);

    if (error) throw error;

    await loadPrograms();
    setEditingProgram(null);
    setSuccess('Programme mis à jour avec succès');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveVideoEdit = async (formData: VideoFormData) => {
    if (!editingVideo) return;

    const { error } = await supabase
      .from('videos')
      .update({ ...formData, updated_at: new Date().toISOString() })
      .eq('id', editingVideo.id);

    if (error) throw error;

    await loadVideos();
    setEditingVideo(null);
    setSuccess('Vidéo mise à jour avec succès');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleUpdateDiscount = async () => {
    if (!user?.id) {
      setError('Utilisateur non connecté');
      return;
    }

    setSavingDiscount(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('professors')
        .update({ subscriber_discount_percentage: subscriberDiscount })
        .eq('id', user.id);

      if (error) throw error;
      setSuccess('Réduction mise à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleUpdateSubscriptionPrice = async () => {
    if (!user?.id) {
      setError('Utilisateur non connecté');
      return;
    }

    if (subscriptionPrice < 0) {
      setError('Le prix ne peut pas être négatif');
      return;
    }

    setSavingPrice(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('professors')
        .update({ subscription_price: subscriptionPrice })
        .eq('id', user.id);

      if (error) throw error;
      setSuccess('Prix d\'abonnement mis à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPrice(false);
    }
  };

  const resetProgramForm = () => {
    setProgramForm({
      title: '',
      description: '',
      level: 'beginner',
      price: 0,
      thumbnail_url: '',
      visibility: 'public',
    });
    setEditingProgram(null);
    setShowProgramForm(false);
  };

  const resetVideoForm = () => {
    setVideoForm({
      title: '',
      description: '',
      level: 'beginner',
      duration_minutes: 0,
      cloudflare_video_id: '',
      thumbnail_url: '',
      program_id: null,
      visibility: 'public',
      program_order_index: 0,
    });
    setEditingVideo(null);
    setShowVideoForm(false);
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Eye className="w-4 h-4" />;
      case 'private':
        return <EyeOff className="w-4 h-4" />;
      case 'subscribers_only':
        return <Lock className="w-4 h-4" />;
      case 'paid':
        return <Check className="w-4 h-4" />;
      case 'platform':
        return <Lock className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'Public';
      case 'private':
        return 'Privé';
      case 'subscribers_only':
        return 'Abonnés uniquement';
      case 'paid':
        return 'Payant';
      case 'platform':
        return 'NEXA Academy';
      default:
        return visibility;
    }
  };

  const loadProgramVideos = async (programId: string) => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('program_id', programId)
      .order('program_order_index', { ascending: true });

    if (error) {
      console.error('Error loading program videos:', error);
      setError('Erreur lors du chargement des vidéos du programme');
      return;
    }

    setProgramVideos(data || []);
  };

  const handleManageVideos = async (programId: string) => {
    setManagingProgramId(programId);
    await loadProgramVideos(programId);
  };

  const handleMoveVideoUp = async (video: Video, currentIndex: number) => {
    if (currentIndex === 0) return;

    const prevVideo = programVideos[currentIndex - 1];

    await supabase
      .from('videos')
      .update({ program_order_index: currentIndex })
      .eq('id', prevVideo.id);

    await supabase
      .from('videos')
      .update({ program_order_index: currentIndex - 1 })
      .eq('id', video.id);

    if (managingProgramId) {
      await loadProgramVideos(managingProgramId);
    }
    setSuccess('Ordre mis à jour');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleMoveVideoDown = async (video: Video, currentIndex: number) => {
    if (currentIndex === programVideos.length - 1) return;

    const nextVideo = programVideos[currentIndex + 1];

    await supabase
      .from('videos')
      .update({ program_order_index: currentIndex })
      .eq('id', nextVideo.id);

    await supabase
      .from('videos')
      .update({ program_order_index: currentIndex + 1 })
      .eq('id', video.id);

    if (managingProgramId) {
      await loadProgramVideos(managingProgramId);
    }
    setSuccess('Ordre mis à jour');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleRemoveVideoFromProgram = async (videoId: string) => {
    if (!confirm('Voulez-vous vraiment retirer cette vidéo du programme ? Elle restera disponible dans votre bibliothèque de vidéos.')) return;

    const { error } = await supabase
      .from('videos')
      .update({ program_id: null, program_order_index: 0 })
      .eq('id', videoId);

    if (error) {
      setError(error.message);
      return;
    }

    if (managingProgramId) {
      await loadProgramVideos(managingProgramId);
    }
    await loadVideos();
    await loadPrograms();
    setSuccess('Vidéo retirée du programme');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleAddVideoToProgram = async (videoId: string) => {
    if (!managingProgramId) return;

    const nextIndex = programVideos.length;

    const { error } = await supabase
      .from('videos')
      .update({
        program_id: managingProgramId,
        program_order_index: nextIndex
      })
      .eq('id', videoId);

    if (error) {
      setError(error.message);
      return;
    }

    await loadProgramVideos(managingProgramId);
    await loadVideos();
    await loadPrograms();
    setSuccess('Vidéo ajoutée au programme');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (profile?.role !== 'professor' && profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mb-2">
            Tableau de <span className="text-[#B8913D]">Bord</span>
          </h1>
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-sm sm:text-base text-gray-400">Gérez vos programmes et vidéos</p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-2 sm:space-x-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-100 rounded-xl flex items-start space-x-2 sm:space-x-3">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="flex justify-center mb-6 sm:mb-8 overflow-x-auto">
          <div className="inline-flex space-x-1.5 sm:space-x-3 p-1.5 sm:p-2 bg-gray-800/50 border border-gray-700/50 rounded-full shadow-md min-w-max">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Statistiques</span>
              <span className="xs:hidden">Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('programs')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 ${
                activeTab === 'programs'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Programmes</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Vidéos</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-base font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Paramètres</span>
              <span className="xs:hidden">Config</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'stats' ? (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-400">Chargement des statistiques...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium text-white text-opacity-90 mb-0.5 sm:mb-1">Abonnés Actifs</h3>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold">{stats.totalSubscribers}</p>
                  </div>

                  <div className="bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium text-white text-opacity-90 mb-0.5 sm:mb-1">Total de Vues</h3>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold">{stats.totalViews.toLocaleString()}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium text-white text-opacity-90 mb-0.5 sm:mb-1">Revenus Totaux</h3>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold">{stats.totalRevenue.toFixed(2)}€</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium text-white text-opacity-90 mb-0.5 sm:mb-1">Vidéos Totales</h3>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold">{videos.length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium text-white text-opacity-90 mb-0.5 sm:mb-1">Programmes Totaux</h3>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold">{programs.length}</p>
                  </div>
                </div>

                {stats.topVideos.length > 0 && (
                  <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 border border-gray-700/50">
                    <div className="flex items-center space-x-2.5 sm:space-x-3 mb-4 sm:mb-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-light text-white">Top 5 Vidéos</h2>
                        <p className="text-xs sm:text-sm text-gray-400">Les vidéos les plus regardées</p>
                      </div>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {stats.topVideos.map((video, index) => {
                        const maxViews = stats.topVideos[0]?.views || 1;
                        const percentage = (video.views / maxViews) * 100;
                        return (
                          <div key={video.video_id} className="group">
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                                  index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="text-white text-sm sm:text-base font-medium group-hover:text-[#B8913D] transition-colors cursor-pointer truncate">
                                  {video.title}
                                </span>
                              </div>
                              <span className="text-[#B8913D] font-bold text-xs sm:text-sm whitespace-nowrap">
                                {video.views} vues
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] h-full rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stats.topVideos.length === 0 && stats.topPrograms.length === 0 && (
                  <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-12 border border-gray-700/50 text-center">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">Aucune statistique disponible</h3>
                    <p className="text-gray-400">
                      Les statistiques apparaîtront lorsque vos vidéos seront visionnées et vos programmes achetés
                    </p>
                  </div>
                )}

                {stats.topPrograms.length > 0 && (
                  <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 border border-gray-700/50">
                    <div className="flex items-center space-x-2.5 sm:space-x-3 mb-4 sm:mb-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-light text-white">Top 5 Programmes</h2>
                        <p className="text-xs sm:text-sm text-gray-400">Les programmes les plus achetés</p>
                      </div>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {stats.topPrograms.map((program, index) => {
                        const maxPurchases = stats.topPrograms[0]?.purchases || 1;
                        const percentage = (program.purchases / maxPurchases) * 100;
                        return (
                          <div key={program.program_id} className="group">
                            <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                                  index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="text-white text-sm sm:text-base font-medium group-hover:text-blue-600 transition-colors cursor-pointer truncate">
                                  {program.title}
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-3 flex-shrink-0">
                                <span className="text-blue-600 font-bold text-xs sm:text-sm whitespace-nowrap">
                                  {program.purchases} achats
                                </span>
                                <span className="text-green-600 font-bold text-xs sm:text-sm whitespace-nowrap">
                                  {program.revenue.toFixed(2)}€
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'settings' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-light text-white">Prix d'Abonnement Mensuel</h2>
                  <p className="text-sm text-gray-400">Définissez le prix que les élèves paient pour accéder à votre contenu exclusif</p>
                </div>
              </div>

              <div className="bg-gray-900/50 p-6 rounded-xl mb-6 border border-[#B8913D]/20">
                <h3 className="font-medium text-white mb-2">Comment ça marche ?</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Définissez votre propre tarif mensuel pour votre abonnement</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Les élèves abonnés ont accès à tout votre contenu "Réservé aux abonnés"</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Mettez 0€ pour rendre tout votre contenu gratuit et accessible au public</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Le renouvellement est automatique chaque mois via Stripe</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Prix mensuel (en euros)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={subscriptionPrice}
                      onChange={(e) => setSubscriptionPrice(Math.max(0, Number(e.target.value)))}
                      className="flex-1 px-4 py-3 bg-gray-900/50 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white placeholder-gray-500"
                      placeholder="Ex: 9.99"
                    />
                    <div className="flex items-center justify-center min-w-[120px] h-14 bg-gradient-to-br from-[#B8913D] to-[#A07F35] text-white rounded-xl font-bold text-xl px-4">
                      {subscriptionPrice.toFixed(2)}€/mois
                    </div>
                  </div>
                </div>

                {subscriptionPrice === 0 ? (
                  <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4">
                    <h4 className="font-medium text-green-400 mb-2 text-sm flex items-center space-x-2">
                      <Check className="w-5 h-5" />
                      <span>Contenu Gratuit</span>
                    </h4>
                    <p className="text-sm text-green-300/90">
                      Votre contenu marqué "Réservé aux abonnés" sera accessible à tous sans paiement.
                      Cela permet de partager vos cours gratuitement avec tout le monde.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                    <h4 className="font-medium text-blue-400 mb-2 text-sm">Aperçu de votre abonnement</h4>
                    <div className="space-y-2 text-sm text-blue-300/90">
                      <div className="flex justify-between">
                        <span>Prix mensuel</span>
                        <span className="font-bold">{subscriptionPrice.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue annuel estimé (10 abonnés)</span>
                        <span className="font-medium">{(subscriptionPrice * 12 * 10).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue annuel estimé (50 abonnés)</span>
                        <span className="font-medium">{(subscriptionPrice * 12 * 50).toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpdateSubscriptionPrice}
                  disabled={savingPrice}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {savingPrice ? (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Enregistrement...</span>
                    </span>
                  ) : (
                    'Enregistrer le prix'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl flex items-center justify-center">
                  <Percent className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-light text-white">Réduction Abonnés</h2>
                  <p className="text-sm text-gray-400">Offrez une réduction à vos abonnés sur vos programmes payants</p>
                </div>
              </div>

              <div className="bg-gray-900/50 p-6 rounded-xl mb-6 border border-[#B8913D]/20">
                <h3 className="font-medium text-white mb-2">Comment ça marche ?</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Les utilisateurs abonnés à vos cours bénéficient automatiquement de cette réduction</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>La réduction s'applique sur tous vos programmes payants</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Le prix réduit est enregistré lors de l'achat</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <span>Les programmes gratuits ou réservés aux abonnés ne sont pas affectés</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Pourcentage de réduction (0-100%)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={subscriberDiscount}
                      onChange={(e) => setSubscriberDiscount(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#B8913D]"
                    />
                    <div className="flex items-center justify-center w-20 h-14 bg-gradient-to-br from-[#B8913D] to-[#A07F35] text-white rounded-xl font-bold text-xl">
                      {subscriberDiscount}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>Aucune réduction</span>
                    <span>Réduction maximale</span>
                  </div>
                </div>

                {subscriberDiscount > 0 && (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                    <h4 className="font-medium text-blue-400 mb-2 text-sm">Exemple de réduction</h4>
                    <div className="space-y-2 text-sm text-blue-300/90">
                      <div className="flex justify-between">
                        <span>Programme à 50€</span>
                        <span className="font-medium">{(50 * (1 - subscriberDiscount / 100)).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Programme à 100€</span>
                        <span className="font-medium">{(100 * (1 - subscriberDiscount / 100)).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-700/50">
                        <span className="font-medium">Économie</span>
                        <span className="font-bold">{subscriberDiscount}% de réduction</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpdateDiscount}
                  disabled={savingDiscount}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {savingDiscount ? (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Enregistrement...</span>
                    </span>
                  ) : (
                    'Enregistrer la réduction'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'programs' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-light text-white">Mes Programmes</h2>
              <button
                onClick={() => setShowProgramForm(!showProgramForm)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
              >
                {showProgramForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showProgramForm ? 'Annuler' : 'Nouveau Programme'}</span>
              </button>
            </div>

            {showProgramForm && !editingProgram && (
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
                <h3 className="text-xl font-medium text-white mb-6">
                  Nouveau Programme
                </h3>
                <form onSubmit={handleProgramSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Titre *
                      </label>
                      <input
                        type="text"
                        value={programForm.title}
                        onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Niveau *
                      </label>
                      <select
                        value={programForm.level}
                        onChange={(e) => setProgramForm({ ...programForm, level: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      >
                        <option value="beginner">Débutant</option>
                        <option value="intermediate">Intermédiaire</option>
                        <option value="advanced">Avancé</option>
                        <option value="all_levels">Tous niveaux</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Visibilité *
                      </label>
                      <select
                        value={programForm.visibility}
                        onChange={(e) => {
                          const newVisibility = e.target.value as any;
                          setProgramForm({
                            ...programForm,
                            visibility: newVisibility,
                            price: (newVisibility === 'public' || newVisibility === 'subscribers_only' || newVisibility === 'platform') ? 0 : programForm.price
                          });
                        }}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      >
                        <option value="public">Public</option>
                        <option value="paid">Payant (achat à l'unité)</option>
                        <option value="subscribers_only">Abonnés uniquement</option>
                        <option value="platform">NEXA Academy (abonnement plateforme)</option>
                        <option value="private">Privé</option>
                      </select>
                    </div>

                    {programForm.visibility === 'paid' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Prix (€) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={programForm.price}
                          onChange={(e) => setProgramForm({ ...programForm, price: parseFloat(e.target.value) || 0 })}
                          required
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={programForm.description}
                      onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL de la miniature
                    </label>
                    <ImageUpload
                      currentImageUrl={programForm.thumbnail_url}
                      onImageUrlChange={(url) => setProgramForm({ ...programForm, thumbnail_url: url })}
                      label="Program Thumbnail"
                      aspectRatio="video"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetProgramForm}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingProgram ? 'Mettre à jour' : 'Créer le Programme'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {managingProgramId ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-gradient-to-r from-[#B8913D] to-[#A07F35] rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <div className="flex items-center space-x-2.5 sm:space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                        <List className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-white text-opacity-90">Gestion des vidéos</p>
                        <h3 className="text-base sm:text-xl font-medium truncate">{programs.find(p => p.id === managingProgramId)?.title || 'Programme'}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setManagingProgramId(null)}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm sm:text-base"
                    >
                      Retour aux programmes
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700/50">
                  <h4 className="font-medium text-white mb-4">Vidéos du programme ({programVideos.length})</h4>
                  {programVideos.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Video className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>Aucune vidéo dans ce programme</p>
                      <p className="text-sm text-gray-400 mt-1">Ajoutez des vidéos ci-dessous</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {programVideos.map((video, index) => (
                        <div
                          key={video.id}
                          className="flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => handleMoveVideoUp(video, index)}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-[#B8913D] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleMoveVideoDown(video, index)}
                                disabled={index === programVideos.length - 1}
                                className="p-1 text-gray-400 hover:text-[#B8913D] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="w-8 h-8 bg-[#B8913D]/20 text-[#B8913D] rounded-lg flex items-center justify-center font-medium text-sm border border-[#B8913D]/30">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h5 className="font-medium text-white">{video.title}</h5>
                              <p className="text-sm text-gray-400">{video.duration_minutes} min</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveVideoFromProgram(video.id)}
                            className="p-2 text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-all border border-red-700/50 hover:border-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700/50">
                  <h4 className="font-medium text-white mb-4">Ajouter des vidéos au programme</h4>
                  {videos.filter(v => !v.program_id || v.program_id !== managingProgramId).length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>Toutes vos vidéos sont déjà dans ce programme</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {videos
                        .filter(v => !v.program_id || v.program_id !== managingProgramId)
                        .map((video) => (
                          <div
                            key={video.id}
                            className="flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 hover:border-[#B8913D]/30 transition-all"
                          >
                            <div className="flex-1">
                              <h5 className="font-medium text-white">{video.title}</h5>
                              <p className="text-sm text-gray-400">{video.duration_minutes} min</p>
                            </div>
                            <button
                              onClick={() => handleAddVideoToProgram(video.id)}
                              className="px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all hover:scale-105"
                            >
                              Ajouter
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {programs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700/50">
                    <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400">Aucun programme pour le moment</p>
                    <p className="text-sm text-gray-400 mt-1">Créez votre premier programme</p>
                  </div>
                ) : (
                  programs.map((program) => (
                    <div key={program.id}>
                      <div
                        onClick={() => !editingProgram && onNavigate(`program-${program.id}`)}
                        className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-gray-700/50 group ${!editingProgram ? 'cursor-pointer hover:border-[#B8913D]/50' : ''}`}
                      >
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          {program.thumbnail_url && program.thumbnail_url.trim() !== '' && (
                            <div className="w-full sm:w-48 h-32 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 group-hover:scale-105 transition-transform duration-300">
                              <LazyImage
                                src={program.thumbnail_url}
                                alt={program.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 w-full sm:w-auto">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-base sm:text-lg font-medium text-white">{program.title}</h3>
                              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium border ${
                                program.level === 'beginner' ? 'bg-green-900/30 text-green-400 border-green-700/50' :
                                program.level === 'intermediate' ? 'bg-blue-900/30 text-blue-400 border-blue-700/50' :
                                program.level === 'advanced' ? 'bg-purple-900/30 text-purple-400 border-purple-700/50' :
                                'bg-gray-700/50 text-gray-300 border-gray-600'
                              }`}>
                                {program.level === 'all_levels' ? 'Tous niveaux' : program.level}
                              </span>
                              <span className="flex items-center space-x-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium">
                                {getVisibilityIcon(program.visibility)}
                                <span>{getVisibilityLabel(program.visibility)}</span>
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm mb-2 line-clamp-2">{program.description}</p>
                            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs sm:text-sm">
                              {program.visibility === 'paid' ? (
                                <>
                                  <span className="font-medium text-[#B8913D]">{Number(program.price).toFixed(2)}€</span>
                                  <span className="text-gray-400 hidden sm:inline">•</span>
                                </>
                              ) : program.visibility === 'public' ? (
                                <>
                                  <span className="font-medium text-green-400">Gratuit</span>
                                  <span className="text-gray-400 hidden sm:inline">•</span>
                                </>
                              ) : program.visibility === 'subscribers_only' ? (
                                <>
                                  <span className="font-medium text-blue-400">Abonnés</span>
                                  <span className="text-gray-400 hidden sm:inline">•</span>
                                </>
                              ) : program.visibility === 'platform' ? (
                                <>
                                  <span className="font-medium text-blue-400">NEXA Academy</span>
                                  <span className="text-gray-400 hidden sm:inline">•</span>
                                </>
                              ) : null}
                              <span className="text-gray-400">{program.video_count || 0} vidéos</span>
                              <span className="text-gray-400 hidden sm:inline">•</span>
                              <span className="text-gray-400">{program.duration_total_minutes || 0} min</span>
                            </div>
                            <div className="flex items-center space-x-1.5 sm:space-x-2 mt-3 sm:mt-0 w-full sm:w-auto justify-end sm:justify-start">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleManageVideos(program.id);
                                }}
                                className="p-2 sm:p-2.5 text-blue-400 hover:text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 rounded-lg transition-all border border-blue-700/50 hover:border-blue-600"
                                title="Gérer les vidéos"
                              >
                                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditProgram(program);
                                }}
                                className="p-2 sm:p-2.5 text-[#B8913D] hover:text-[#A07F35] bg-[#B8913D]/20 hover:bg-[#B8913D]/30 rounded-lg transition-all border border-[#B8913D]/50 hover:border-[#B8913D]"
                                title="Modifier"
                              >
                                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProgram(program.id);
                                }}
                                className="p-2 sm:p-2.5 text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-all border border-red-700/50 hover:border-red-600"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {editingProgram?.id === program.id && (
                        <ProgramEditForm
                          program={program}
                          onSave={handleSaveProgramEdit}
                          onCancel={() => setEditingProgram(null)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-light text-white">Mes Vidéos</h2>
              <button
                onClick={() => setShowVideoForm(!showVideoForm)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
              >
                {showVideoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showVideoForm ? 'Annuler' : 'Nouvelle Vidéo'}</span>
              </button>
            </div>

            {showVideoForm && !editingVideo && (
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700/50">
                <h3 className="text-xl font-medium text-white mb-6">
                  Nouvelle Vidéo
                </h3>
                <form onSubmit={handleVideoSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Titre *
                      </label>
                      <input
                        type="text"
                        value={videoForm.title}
                        onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Niveau *
                      </label>
                      <select
                        value={videoForm.level}
                        onChange={(e) => setVideoForm({ ...videoForm, level: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      >
                        <option value="beginner">Débutant</option>
                        <option value="intermediate">Intermédiaire</option>
                        <option value="advanced">Avancé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Durée (minutes) *
                      </label>
                      <input
                        type="number"
                        value={videoForm.duration_minutes}
                        onChange={(e) => setVideoForm({ ...videoForm, duration_minutes: parseInt(e.target.value) || 0 })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Visibilité *
                      </label>
                      <select
                        value={videoForm.visibility}
                        onChange={(e) => setVideoForm({ ...videoForm, visibility: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      >
                        <option value="public">Public</option>
                        <option value="paid">Payant (achat à l'unité)</option>
                        <option value="subscribers_only">Abonnés uniquement</option>
                        <option value="platform">NEXA Academy (abonnement plateforme)</option>
                        <option value="private">Privé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Programme (optionnel)
                      </label>
                      <select
                        value={videoForm.program_id || ''}
                        onChange={(e) => setVideoForm({ ...videoForm, program_id: e.target.value || null })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                      >
                        <option value="">Vidéo indépendante</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {videoForm.program_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Ordre dans le programme
                        </label>
                        <input
                          type="number"
                          value={videoForm.program_order_index}
                          onChange={(e) => setVideoForm({ ...videoForm, program_order_index: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={videoForm.description}
                      onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
                    />
                  </div>

                  <div>
                    <VideoUpload
                      currentVideoId={videoForm.cloudflare_video_id}
                      onVideoIdChange={(videoId) => setVideoForm({ ...videoForm, cloudflare_video_id: videoId })}
                      videoTitle={videoForm.title}
                      label="Vidéo *"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL de la miniature
                    </label>
                    <ImageUpload
                      currentImageUrl={videoForm.thumbnail_url}
                      onImageUrlChange={(url) => setVideoForm({ ...videoForm, thumbnail_url: url })}
                      label="Video Thumbnail"
                      aspectRatio="video"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetVideoForm}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingVideo ? 'Mettre à jour' : 'Ajouter la Vidéo'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {videos.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700/50">
                  <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">Aucune vidéo pour le moment</p>
                  <p className="text-sm text-gray-400 mt-1">Ajoutez votre première vidéo</p>
                </div>
              ) : (
                videos.map((video) => (
                  <div key={video.id}>
                    <div
                      onClick={() => !editingVideo && onNavigate('video', video.id)}
                      className={`bg-gray-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all p-4 sm:p-6 border border-gray-700/50 group ${!editingVideo ? 'cursor-pointer hover:border-[#B8913D]/50' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {video.thumbnail_url && video.thumbnail_url.trim() !== '' && (
                          <div className="w-full sm:w-48 h-32 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 group-hover:scale-105 transition-transform duration-300">
                            <LazyImage
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base sm:text-lg font-medium text-white">{video.title}</h3>
                            <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium border ${
                              video.level === 'beginner' ? 'bg-green-900/30 text-green-400 border-green-700/50' :
                              video.level === 'intermediate' ? 'bg-blue-900/30 text-blue-400 border-blue-700/50' :
                              'bg-purple-900/30 text-purple-400 border-purple-700/50'
                            }`}>
                              {video.level}
                            </span>
                            <span className="flex items-center space-x-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium">
                              {getVisibilityIcon(video.visibility)}
                              <span>{getVisibilityLabel(video.visibility)}</span>
                            </span>
                            {video.program_id && (
                              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-700/50 text-gray-300 border border-gray-600 rounded-full text-xs font-medium flex items-center space-x-1">
                                <Folder className="w-3 h-3" />
                                <span>Programme</span>
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs sm:text-sm mb-2 line-clamp-2">{video.description}</p>
                          <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-400">
                            <span>{video.duration_minutes} min</span>
                          </div>
                          <div className="flex items-center space-x-1.5 sm:space-x-2 mt-3 sm:mt-0 w-full sm:w-auto justify-end sm:justify-start">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditVideo(video);
                              }}
                              className="p-2 sm:p-2.5 text-[#B8913D] hover:text-[#A07F35] bg-[#B8913D]/20 hover:bg-[#B8913D]/30 rounded-lg transition-all border border-[#B8913D]/50 hover:border-[#B8913D]"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVideo(video.id);
                              }}
                              className="p-2 sm:p-2.5 text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-all border border-red-700/50 hover:border-red-600"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {editingVideo?.id === video.id && (
                      <VideoEditForm
                        video={video}
                        programs={programs}
                        onSave={handleSaveVideoEdit}
                        onCancel={() => setEditingVideo(null)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
