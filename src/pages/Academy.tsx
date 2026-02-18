import { useEffect, useState, useMemo } from 'react';
import { Play, Lock, CheckCircle, Clock, Folder, Video as VideoIcon, Search, X, Filter, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { FavoriteButton } from '../components/FavoriteButton';
import { VideoProgressBar } from '../components/VideoProgressBar';
import type { Database } from '../lib/database.types';

type Video = Database['public']['Tables']['videos']['Row'];
type Program = Database['public']['Tables']['programs']['Row'];

interface VideoProgress {
  video_id: string;
  progress_percentage: number;
  completed: boolean;
}

interface ProgramWithDiscount extends Program {
  professor_discount?: number;
  has_subscription?: boolean;
}

interface AcademyProps {
  onNavigate: (page: string, videoId?: string) => void;
}

export function Academy({ onNavigate }: AcademyProps) {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [programs, setPrograms] = useState<ProgramWithDiscount[]>([]);
  const [purchasedPrograms, setPurchasedPrograms] = useState<Set<string>>(new Set());
  const [subscribedProfessors, setSubscribedProfessors] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, VideoProgress>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'programs' | 'videos'>('programs');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedProfessor, setSelectedProfessor] = useState<string>('all');
  const [professors, setProfessors] = useState<Array<{ id: string; name: string }>>([]);
  const [lockedVideoModal, setLockedVideoModal] = useState<Video | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: videosData, error: videosError } = await supabase
      .from('videos')
      .select(`
        *,
        professor:professors(
          profiles(full_name)
        )
      `)
      .is('program_id', null)
      .order('order_index', { ascending: true });

    if (videosError) {
      console.error('Error fetching videos:', videosError);
    }

    if (videosData) {
      setVideos(videosData);

      const uniqueProfessors = new Map<string, string>();
      videosData.forEach(video => {
        if (video.professor_id && (video as any).professor?.profiles?.full_name) {
          uniqueProfessors.set(video.professor_id, (video as any).professor.profiles.full_name);
        }
      });

      const profList = Array.from(uniqueProfessors.entries()).map(([id, name]) => ({ id, name }));
      setProfessors(profList);
    }

    const { data: programsData, error: programsError } = await supabase
      .from('programs')
      .select(`
        *,
        professor:professors!inner(
          subscriber_discount_percentage,
          profiles(full_name)
        ),
        videos!program_id(
          duration_minutes
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (programsError) {
      console.error('Error fetching programs:', programsError);
    }

    if (user) {
      const { data: progressData } = await supabase
        .from('video_views')
        .select('video_id, progress_percentage, completed')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false });

      if (progressData) {
        const progressMap: Record<string, VideoProgress> = {};
        const seenVideos = new Set<string>();

        progressData.forEach((view) => {
          if (!seenVideos.has(view.video_id)) {
            progressMap[view.video_id] = {
              video_id: view.video_id,
              progress_percentage: view.progress_percentage || 0,
              completed: view.completed || false
            };
            seenVideos.add(view.video_id);
          }
        });

        setProgress(progressMap);
      }

      const { data: purchasesData } = await supabase
        .from('program_purchases')
        .select('program_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (purchasesData) {
        setPurchasedPrograms(new Set(purchasesData.map(p => p.program_id)));
      }

      const { data: subscriptionsData } = await supabase
        .from('professor_subscriptions')
        .select('professor_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (subscriptionsData) {
        setSubscribedProfessors(new Set(subscriptionsData.map(s => s.professor_id)));
      }

      if (programsData) {
        const programsWithDiscounts = programsData.map(program => {
          const videos = (program as any).videos || [];
          return {
            ...program,
            professor_discount: (program as any).professor?.subscriber_discount_percentage || 0,
            has_subscription: subscriptionsData ? subscriptionsData.some(s => s.professor_id === program.professor_id) : false,
            video_count: videos.length,
            duration_total_minutes: videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0)
          };
        });
        setPrograms(programsWithDiscounts);

        const uniqueProfessorsFromPrograms = new Map<string, string>();
        programsData.forEach(program => {
          if (program.professor_id && (program as any).professor?.profiles?.full_name) {
            uniqueProfessorsFromPrograms.set(program.professor_id, (program as any).professor.profiles.full_name);
          }
        });

        setProfessors(prev => {
          const combined = new Map<string, string>();
          prev.forEach(p => combined.set(p.id, p.name));
          uniqueProfessorsFromPrograms.forEach((name, id) => combined.set(id, name));
          return Array.from(combined.entries()).map(([id, name]) => ({ id, name }));
        });
      }
    } else if (programsData) {
      const programsWithDiscounts = programsData.map(program => {
        const videos = (program as any).videos || [];
        return {
          ...program,
          professor_discount: (program as any).professor?.subscriber_discount_percentage || 0,
          has_subscription: false,
          video_count: videos.length,
          duration_total_minutes: videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0)
        };
      });
      setPrograms(programsWithDiscounts);

      const uniqueProfessorsFromPrograms = new Map<string, string>();
      programsData.forEach(program => {
        if (program.professor_id && (program as any).professor?.profiles?.full_name) {
          uniqueProfessorsFromPrograms.set(program.professor_id, (program as any).professor.profiles.full_name);
        }
      });

      setProfessors(prev => {
        const combined = new Map<string, string>();
        prev.forEach(p => combined.set(p.id, p.name));
        uniqueProfessorsFromPrograms.forEach((name, id) => combined.set(id, name));
        return Array.from(combined.entries()).map(([id, name]) => ({ id, name }));
      });
    }

    setLoading(false);
  };

  const getVideoAccess = (video: Video) => {
    // Professors can always access their own videos
    if (user && video.professor_id === user.id) return 'full';

    // Admins can access everything
    if (profile?.role === 'admin') return 'full';

    if (video.visibility === 'public') {
      return user ? 'full' : 'locked';
    }
    if (video.visibility === 'platform') {
      return hasAccess ? 'full' : 'locked';
    }
    if (video.visibility === 'subscribers_only') {
      if (!user || !video.professor_id) return 'locked';
      const isSubscribed = subscribedProfessors.has(video.professor_id);
      return isSubscribed ? 'full' : 'locked';
    }
    return 'locked';
  };

  const hasAccess = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  const filterBySearch = (item: { title: string; description: string | null }) => {
    if (!debouncedSearchQuery.trim()) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return item.title.toLowerCase().includes(query) ||
           (item.description?.toLowerCase().includes(query) || false);
  };

  const filterByProfessor = (professorId: string | null) => {
    if (selectedProfessor === 'all') return true;
    return professorId === selectedProfessor;
  };

  const filterByLevel = (level: string) => {
    if (selectedLevel === 'all') return true;
    return level === selectedLevel;
  };

  const filteredPrograms = useMemo(() => programs
    .filter(filterBySearch)
    .filter(p => filterByProfessor(p.professor_id))
    .filter(p => filterByLevel(p.level)),
    [programs, debouncedSearchQuery, selectedProfessor, selectedLevel]);

  const levelVideos = useMemo(() => videos
    .filter(v => filterByLevel(v.level))
    .filter(filterBySearch)
    .filter(v => filterByProfessor(v.professor_id)),
    [videos, selectedLevel, debouncedSearchQuery, selectedProfessor]);

  const currentItems = useMemo(() => {
    const items = activeTab === 'programs' ? filteredPrograms : levelVideos;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [activeTab, filteredPrograms, levelVideos, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    const items = activeTab === 'programs' ? filteredPrograms : levelVideos;
    return Math.ceil(items.length / itemsPerPage);
  }, [activeTab, filteredPrograms, levelVideos, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedLevel, debouncedSearchQuery, selectedProfessor]);

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'beginner': return t('academy.levels.beginner');
      case 'intermediate': return t('academy.levels.intermediate');
      case 'advanced': return t('academy.levels.advanced');
      case 'all_levels': return t('academy.levels.allLevels');
      default: return level;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-14 sm:pt-16 lg:pt-14 pb-6 sm:pb-10 lg:pb-6 relative">
      <BackgroundDecor />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-5 sm:mb-7 lg:mb-5 relative">
          <div className="absolute -top-20 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-[#B8913D] opacity-5 rounded-full blur-3xl pointer-events-none"></div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-2xl xl:text-3xl font-light text-white mb-2 relative">
            {t('academy.header.title')}
          </h1>
          <p className="text-sm sm:text-base lg:text-sm text-gray-400 relative">
            {hasAccess ? t('academy.header.accessFull') : t('academy.header.accessLimited')}
          </p>
        </div>

        {!hasAccess && profile?.role !== 'professor' && (
          <div className="mb-5 sm:mb-7 lg:mb-5 p-4 sm:p-6 md:p-7 lg:p-5 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl sm:rounded-2xl text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-40 sm:h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
            <div className="relative">
              <h3 className="text-base sm:text-xl md:text-2xl lg:text-lg xl:text-xl font-medium mb-1.5 sm:mb-2">{t('academy.banner.title')}</h3>
              <p className="mb-2 opacity-90 text-xs sm:text-base lg:text-sm leading-snug sm:leading-relaxed">
                {t('academy.banner.description')}
              </p>
              <p className="mb-3 sm:mb-4 lg:mb-3 text-sm sm:text-lg md:text-xl lg:text-base xl:text-lg font-light">
                {t('academy.banner.pricing')}
              </p>
              <button
                onClick={() => onNavigate('account')}
                className="px-4 py-2 sm:px-6 sm:py-2.5 lg:px-5 lg:py-2 text-xs sm:text-base lg:text-sm bg-white text-[#B8913D] font-medium rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {t('academy.banner.button')}
              </button>
            </div>
          </div>
        )}

        <div className="mb-5 sm:mb-7 lg:mb-5">
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-4 shadow-xl">
            <div className="flex items-center mb-3 sm:mb-5 lg:mb-3">
              <Filter className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-gold-400 mr-2" />
              <h3 className="text-base sm:text-lg lg:text-base font-medium text-white">{t('academy.filters.title')}</h3>
            </div>

            <div className="space-y-3 sm:space-y-4 lg:space-y-3">
              <div className="relative group">
                <Search className="absolute left-3 sm:left-4 lg:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 lg:w-3.5 lg:h-3.5 text-gray-400 group-focus-within:text-gold-400 transition-colors" />
                <input
                  type="text"
                  placeholder={t('academy.filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:pl-12 lg:pl-9 pr-9 sm:pr-11 lg:pr-9 py-2.5 sm:py-3.5 lg:py-2.5 text-sm sm:text-base lg:text-sm bg-gray-900/50 border border-gray-700/50 rounded-xl focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none shadow-sm text-white placeholder-gray-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700/50 rounded-full"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>

              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-1 md:grid-cols-2 sm:gap-4">
                {professors.length > 0 && (
                  <div className="relative group">
                    <User className="absolute left-3 sm:left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-focus-within:text-gold-400 transition-colors pointer-events-none z-10" />
                    <select
                      value={selectedProfessor}
                      onChange={(e) => setSelectedProfessor(e.target.value)}
                      className="w-full pl-10 sm:pl-14 pr-10 py-3 sm:py-4 text-sm sm:text-base bg-gray-900/50 border border-gray-700/50 rounded-xl sm:rounded-2xl outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 text-white font-medium transition-all appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value="all">{t('academy.filters.allProfessors')}</option>
                      {professors.map(prof => (
                        <option key={prof.id} value={prof.id}>{prof.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:space-x-2 bg-gray-900/50 border border-gray-700/50 rounded-xl sm:rounded-2xl p-2">
                  <button
                    onClick={() => setSelectedLevel('all')}
                    className={`px-3 py-2.5 sm:flex-1 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl font-medium transition-all text-xs sm:text-sm whitespace-nowrap ${
                      selectedLevel === 'all'
                        ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {t('academy.filters.allLevels')}
                  </button>
                  <button
                    onClick={() => setSelectedLevel('beginner')}
                    className={`px-3 py-2.5 sm:flex-1 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl font-medium transition-all text-xs sm:text-sm whitespace-nowrap ${
                      selectedLevel === 'beginner'
                        ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {t('academy.filters.beginner')}
                  </button>
                  <button
                    onClick={() => setSelectedLevel('intermediate')}
                    className={`px-3 py-2.5 sm:flex-1 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl font-medium transition-all text-xs sm:text-sm whitespace-nowrap ${
                      selectedLevel === 'intermediate'
                        ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {t('academy.filters.intermediate')}
                  </button>
                  <button
                    onClick={() => setSelectedLevel('advanced')}
                    className={`px-3 py-2.5 sm:flex-1 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl font-medium transition-all text-xs sm:text-sm whitespace-nowrap ${
                      selectedLevel === 'advanced'
                        ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    {t('academy.filters.advanced')}
                  </button>
                </div>
              </div>

              {(searchQuery || selectedProfessor !== 'all' || selectedLevel !== 'all') && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-700/50">
                  <span className="text-xs sm:text-sm text-gray-400 font-medium">{t('academy.filters.activeLabel')}</span>
                  {searchQuery && (
                    <span className="inline-flex items-center px-2.5 sm:px-3 py-1.5 bg-gold-500/20 text-gold-300 rounded-full text-xs sm:text-sm border border-gold-500/30">
                      <Search className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      <span className="max-w-[120px] sm:max-w-none truncate">{searchQuery}</span>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="ml-1.5 sm:ml-2 hover:text-white flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedProfessor !== 'all' && (
                    <span className="inline-flex items-center px-2.5 sm:px-3 py-1.5 bg-gold-500/20 text-gold-300 rounded-full text-xs sm:text-sm border border-gold-500/30">
                      <User className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      <span className="max-w-[120px] sm:max-w-none truncate">{professors.find(p => p.id === selectedProfessor)?.name}</span>
                      <button
                        onClick={() => setSelectedProfessor('all')}
                        className="ml-1.5 sm:ml-2 hover:text-white flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedLevel !== 'all' && (
                    <span className="inline-flex items-center px-2.5 sm:px-3 py-1.5 bg-gold-500/20 text-gold-300 rounded-full text-xs sm:text-sm border border-gold-500/30">
                      <Filter className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      <span>{getLevelLabel(selectedLevel)}</span>
                      <button
                        onClick={() => setSelectedLevel('all')}
                        className="ml-1.5 sm:ml-2 hover:text-white flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedProfessor('all');
                      setSelectedLevel('all');
                    }}
                    className="inline-flex items-center px-2.5 sm:px-3 py-1.5 text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-colors"
                  >
                    {t('academy.filters.resetAll')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="inline-flex w-full max-w-md space-x-2 p-2 bg-gray-800/50 border border-gray-700/50 rounded-2xl sm:rounded-full shadow-md">
            <button
              onClick={() => setActiveTab('programs')}
              className={`flex-1 px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-full font-medium transition-all flex items-center justify-center space-x-2 text-sm sm:text-base ${
                activeTab === 'programs'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>{t('academy.tabs.programs')}</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-full font-medium transition-all flex items-center justify-center space-x-2 text-sm sm:text-base ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <VideoIcon className="w-4 h-4" />
              <span>{t('academy.tabs.videos')}</span>
            </button>
          </div>
        </div>

        {activeTab === 'programs' ? (
          loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="text-center py-12 sm:py-16 px-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl">
              <Folder className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-gray-400">
                {searchQuery || selectedProfessor !== 'all' || selectedLevel !== 'all'
                  ? t('academy.empty.programsFiltered')
                  : t('academy.empty.programsNone')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(currentItems as ProgramWithDiscount[]).map((program) => {
                const isPurchased = purchasedPrograms.has(program.id);
                const isLocked = program.visibility === 'subscribers_only' || program.visibility === 'paid' || program.visibility === 'platform';
                const hasSubscription = subscribedProfessors.has(program.professor_id);
                const canAccess = isPurchased || hasSubscription || (program.visibility === 'public' && user) || (program.visibility === 'platform' && hasAccess);

                return (
                  <div
                    key={program.id}
                    onClick={() => onNavigate(`program-${program.id}`)}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden border border-gray-700/50 hover:border-gold-500/50 cursor-pointer card-elevated flex flex-col h-full"
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                      {program.thumbnail_url ? (
                        <img
                          src={program.thumbnail_url}
                          alt={program.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
                          <Folder className="w-12 h-12 text-white opacity-60" />
                        </div>
                      )}

                      <div className="absolute top-3 left-3">
                        <FavoriteButton type="program" itemId={program.id} size="sm" />
                      </div>

                      {!canAccess && (
                        <div className="absolute top-3 right-3">
                          <div className="bg-gray-900 bg-opacity-80 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                            <Lock className="w-3 h-3" />
                            <span>{t('academy.card.locked')}</span>
                          </div>
                        </div>
                      )}

                      {canAccess && !isPurchased && hasSubscription && (
                        <div className="absolute top-3 right-3 bg-[#B8913D] text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{t('academy.card.accessible')}</span>
                        </div>
                      )}

                      {isPurchased && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{t('academy.card.purchased')}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          program.level === 'beginner' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          program.level === 'intermediate' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          program.level === 'advanced' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {getLevelLabel(program.level)}
                        </span>
                        {program.visibility === 'platform' && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30">
                            NEXA Academy
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-white mb-2 line-clamp-2">
                        {program.title}
                      </h3>
                      {(program as any).professor?.profiles?.full_name && (
                        <p className="text-xs text-gold-400 mb-2 font-medium">
                          {t('academy.card.by')} {(program as any).professor.profiles.full_name}
                        </p>
                      )}
                      <p className="text-sm text-gray-400 line-clamp-2 mb-3 flex-1">
                        {program.description}
                      </p>

                      <div className="mt-auto">
                        {program.price_amount && program.price_amount > 0 ? (
                          <div className="mb-3 pb-3 border-b border-gray-700/50">
                            {hasSubscription && program.professor_discount && program.professor_discount > 0 ? (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold text-gold-400">
                                  €{((program.price_amount * (1 - program.professor_discount / 100)) / 100).toFixed(2)}
                                </span>
                                <span className="text-sm text-gray-500 line-through">
                                  €{(program.price_amount / 100).toFixed(2)}
                                </span>
                                <span className="text-xs bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded-full border border-gold-500/30">
                                  -{program.professor_discount}%
                                </span>
                              </div>
                            ) : (
                              <div className="text-lg font-bold text-gold-400">
                                €{(program.price_amount / 100).toFixed(2)}
                              </div>
                            )}
                          </div>
                        ) : (program.visibility === 'public' && !isPurchased) ? (
                          <div className="mb-3 pb-3 border-b border-gray-700/50">
                            <span className="text-lg font-bold text-green-400">
                              {t('academy.card.free')}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <div className="flex items-center">
                            <VideoIcon className="w-4 h-4 mr-1" />
                            <span>{program.video_count || 0} {t('academy.card.videos')}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            <span>{program.duration_total_minutes || 0} {t('academy.card.minutes')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 text-white text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-all"
                  >
                    Précédent
                  </button>

                  <span className="text-white text-sm sm:text-base font-medium px-4">
                    Page {currentPage} sur {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )
        ) : (
          loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : levelVideos.length === 0 ? (
            <div className="text-center py-12 sm:py-16 px-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl">
              <VideoIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-gray-400">
                {searchQuery || selectedProfessor !== 'all' || selectedLevel !== 'all'
                  ? t('academy.empty.videosFiltered')
                  : t('academy.empty.videosNone')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(currentItems as Video[]).map((video) => {
              const access = getVideoAccess(video);
              const videoProgress = progress[video.id];
              const isLocked = access === 'locked';

              return (
                <div
                  key={video.id}
                  onClick={() => isLocked ? setLockedVideoModal(video) : onNavigate('video', video.id)}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden group border border-gray-700/50 hover:border-gold-500/50 cursor-pointer card-elevated flex flex-col h-full"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
                        <div className="absolute inset-0 bg-black opacity-10"></div>
                        <Play className="w-12 h-12 text-white opacity-60 relative z-10" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 z-20">
                      <FavoriteButton type="video" itemId={video.id} size="sm" />
                    </div>

                    {isLocked && (
                      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                        <Lock className="w-12 h-12 text-white" />
                      </div>
                    )}

                    {!isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-6 h-6 text-[#B8913D] ml-1" />
                        </div>
                      </div>
                    )}

                    {videoProgress && (
                      <VideoProgressBar
                        progress={videoProgress.progress_percentage}
                        completed={videoProgress.completed}
                      />
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        video.visibility === 'public' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        video.visibility === 'platform' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        video.visibility === 'subscribers_only' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      }`}>
                        {video.visibility === 'public' ? t('academy.card.public') :
                         video.visibility === 'platform' ? 'NEXA Academy' :
                         video.visibility === 'subscribers_only' ? t('academy.card.subscribers') :
                         t('academy.card.paid')}
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-2 line-clamp-2">
                      {video.title}
                    </h3>
                    {(video as any).professor?.profiles?.full_name && (
                      <p className="text-xs text-gold-400 mb-2 font-medium">
                        {t('academy.card.by')} {(video as any).professor.profiles.full_name}
                      </p>
                    )}
                    <p className="text-sm text-gray-400 line-clamp-2 mb-3 flex-1">
                      {video.description}
                    </p>
                    <div className="flex items-center justify-between text-sm mt-auto">
                      <div className="flex items-center text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{video.duration_minutes} {t('academy.card.minutes')}</span>
                      </div>
                      {isLocked && (
                        <span className="text-xs text-gold-400 font-medium">
                          {video.visibility === 'public' ? t('academy.card.loginRequired') :
                           video.visibility === 'platform' ? 'Abonnement NEXA requis' :
                           video.visibility === 'subscribers_only' ? t('academy.card.subscriptionRequired') :
                           t('academy.card.locked')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 text-white text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-all"
                  >
                    Précédent
                  </button>

                  <span className="text-white text-sm sm:text-base font-medium px-4">
                    Page {currentPage} sur {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {lockedVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLockedVideoModal(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-gray-700 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
              {lockedVideoModal.thumbnail_url ? (
                <img
                  src={lockedVideoModal.thumbnail_url}
                  alt={lockedVideoModal.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
                  <Play className="w-16 h-16 text-white opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                    <Lock className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white font-medium text-lg">{t('academy.modal.locked')}</p>
                </div>
              </div>
              <button
                onClick={() => setLockedVideoModal(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm z-10 shadow-lg"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  lockedVideoModal.level === 'beginner' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  lockedVideoModal.level === 'intermediate' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  lockedVideoModal.level === 'advanced' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {getLevelLabel(lockedVideoModal.level)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  lockedVideoModal.visibility === 'public' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  lockedVideoModal.visibility === 'platform' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  lockedVideoModal.visibility === 'subscribers_only' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-purple-500/20 text-purple-400 border-purple-500/30'
                }`}>
                  {lockedVideoModal.visibility === 'public' ? t('academy.card.public') :
                   lockedVideoModal.visibility === 'platform' ? 'NEXA Academy' :
                   lockedVideoModal.visibility === 'subscribers_only' ? t('academy.card.subscribers') :
                   t('academy.card.paid')}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-medium text-white mb-3">
                {lockedVideoModal.title}
              </h2>

              {lockedVideoModal.description && (
                <p className="text-sm sm:text-base text-gray-300 mb-4 leading-relaxed">
                  {lockedVideoModal.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-400 mb-6 pb-6 border-b border-gray-700">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1.5" />
                  <span>{lockedVideoModal.duration_minutes} {t('academy.card.minutes')}</span>
                </div>
                {(lockedVideoModal as any).professor?.profiles?.full_name && (
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-1.5" />
                    <span className="text-gold-400 font-medium">
                      {(lockedVideoModal as any).professor.profiles.full_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3 sm:space-y-4">
                {!user ? (
                  <>
                    <p className="text-sm sm:text-base text-gray-300 text-center mb-4">
                      {t('academy.modal.loginMessage')}
                    </p>
                    <button
                      onClick={() => onNavigate('signin')}
                      className="w-full py-3 sm:py-3.5 text-sm sm:text-base bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-xl hover:shadow-glow transition-all"
                    >
                      {t('academy.modal.login')}
                    </button>
                  </>
                ) : lockedVideoModal.visibility === 'platform' ? (
                  <>
                    <p className="text-sm sm:text-base text-gray-300 text-center mb-4">
                      Cette vidéo est réservée aux abonnés NEXA Academy. Accédez à tous les contenus exclusifs de la plateforme.
                    </p>
                    <button
                      onClick={() => onNavigate('account')}
                      className="w-full py-3 sm:py-3.5 text-sm sm:text-base bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-xl hover:shadow-glow transition-all"
                    >
                      S'abonner à NEXA Academy
                    </button>
                  </>
                ) : lockedVideoModal.visibility === 'subscribers_only' ? (
                  <>
                    <p className="text-sm sm:text-base text-gray-300 text-center mb-4">
                      {t('academy.modal.subscribeProfessor')}
                    </p>
                    {lockedVideoModal.professor_id && (
                      <button
                        onClick={() => onNavigate(`professor-${lockedVideoModal.professor_id}`)}
                        className="w-full py-3 sm:py-3.5 text-sm sm:text-base bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-xl hover:shadow-glow transition-all"
                      >
                        {t('academy.modal.viewProfessor')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm sm:text-base text-gray-300 text-center mb-4">
                      {t('academy.modal.subscribeNexa')}
                    </p>
                    <button
                      onClick={() => onNavigate('account')}
                      className="w-full py-3 sm:py-3.5 text-sm sm:text-base bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white font-medium rounded-xl hover:shadow-glow transition-all"
                    >
                      {t('academy.modal.subscribeButton')}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setLockedVideoModal(null)}
                  className="w-full py-3 sm:py-3.5 text-sm sm:text-base bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  {t('academy.modal.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
