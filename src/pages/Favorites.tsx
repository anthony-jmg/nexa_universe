import { useState, useEffect } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Heart, Video, User, BookOpen, Trash2, Play } from 'lucide-react';
import { Database } from '../lib/database.types';

type Professor = Database['public']['Tables']['professors']['Row'] & {
  profiles?: { full_name: string };
};
type VideoType = Database['public']['Tables']['videos']['Row'];
type Program = Database['public']['Tables']['programs']['Row'];

interface FavoritesProps {
  onNavigate: (page: string) => void;
}

export function Favorites({ onNavigate }: FavoritesProps) {
  const { favorites, removeFavorite, loading: favLoading } = useFavorites();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'professors' | 'videos' | 'programs'>('all');

  useEffect(() => {
    loadFavoriteItems();
  }, [favorites]);

  const loadFavoriteItems = async () => {
    setLoading(true);

    const professorIds = favorites
      .filter(f => f.favorite_type === 'professor')
      .map(f => f.professor_id)
      .filter(Boolean) as string[];

    const videoIds = favorites
      .filter(f => f.favorite_type === 'video')
      .map(f => f.video_id)
      .filter(Boolean) as string[];

    const programIds = favorites
      .filter(f => f.favorite_type === 'program')
      .map(f => f.program_id)
      .filter(Boolean) as string[];

    if (professorIds.length > 0) {
      const { data: profData } = await supabase
        .from('professors')
        .select('*, profiles!inner(full_name)')
        .in('id', professorIds);
      if (profData) setProfessors(profData);
    } else {
      setProfessors([]);
    }

    if (videoIds.length > 0) {
      const { data: vidData } = await supabase
        .from('videos')
        .select('*')
        .in('id', videoIds);
      if (vidData) setVideos(vidData);
    } else {
      setVideos([]);
    }

    if (programIds.length > 0) {
      const { data: progData } = await supabase
        .from('programs')
        .select(`
          *,
          videos!program_id(
            duration_minutes
          )
        `)
        .in('id', programIds);
      if (progData) {
        const programsWithCounts = progData.map(program => {
          const videos = (program as any).videos || [];
          return {
            ...program,
            video_count: videos.length,
            duration_total_minutes: videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0)
          };
        });
        setPrograms(programsWithCounts);
      }
    } else {
      setPrograms([]);
    }

    setLoading(false);
  };

  const handleRemoveFavorite = async (type: 'professor' | 'video' | 'program', itemId: string) => {
    await removeFavorite(type, itemId);
  };

  const filteredProfessors = activeTab === 'all' || activeTab === 'professors' ? professors : [];
  const filteredVideos = activeTab === 'all' || activeTab === 'videos' ? videos : [];
  const filteredPrograms = activeTab === 'all' || activeTab === 'programs' ? programs : [];

  const totalCount = professors.length + videos.length + programs.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            {t('favorites.header.my')} <span className="text-[#B8913D]">{t('favorites.header.favorites')}</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">
            {totalCount} {totalCount === 1 ? t('favorites.header.savedSingular') : t('favorites.header.savedPlural')}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex space-x-2 p-2 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-full shadow-lg border border-[#B8913D] border-opacity-30">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>{t('favorites.tabs.all')} ({totalCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('professors')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'professors'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{t('favorites.tabs.professors')} ({professors.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>{t('favorites.tabs.videos')} ({videos.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('programs')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'programs'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800 hover:bg-opacity-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('favorites.tabs.programs')} ({programs.length})</span>
            </button>
          </div>
        </div>

        {loading || favLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30">
            <Heart className="w-16 h-16 text-[#B8913D] opacity-50 mx-auto mb-4" />
            <p className="text-gray-300 text-lg mb-2">{t('favorites.empty.title')}</p>
            <p className="text-gray-400 text-sm mb-6">
              {t('favorites.empty.message')}
            </p>
            <button
              onClick={() => onNavigate('academy')}
              className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-lg transition-all"
            >
              {t('favorites.empty.button')}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredProfessors.length > 0 && (
              <div>
                <h2 className="text-2xl font-light text-white mb-4 flex items-center space-x-2">
                  <User className="w-6 h-6 text-[#B8913D]" />
                  <span>{t('favorites.sections.professors')}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProfessors.map((professor) => (
                    <div
                      key={professor.id}
                      className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl overflow-hidden border border-[#B8913D] border-opacity-30 hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all group"
                    >
                      <div className="relative h-48 bg-gray-800 overflow-hidden">
                        {professor.profile_image_url ? (
                          <img
                            src={professor.profile_image_url}
                            alt={professor.profiles?.full_name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-16 h-16 text-[#B8913D] opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-medium text-white mb-2">
                          {professor.profiles?.full_name}
                        </h3>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                          {professor.bio}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => onNavigate(`professor-${professor.id}`)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                          >
                            {t('favorites.cards.viewProfile')}
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite('professor', professor.id)}
                            className="px-4 py-2 bg-red-900 bg-opacity-40 text-red-400 rounded-lg hover:bg-opacity-60 transition-all"
                            title={t('favorites.cards.removeTitle')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredVideos.length > 0 && (
              <div>
                <h2 className="text-2xl font-light text-white mb-4 flex items-center space-x-2">
                  <Video className="w-6 h-6 text-[#B8913D]" />
                  <span>{t('favorites.sections.videos')}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl overflow-hidden border border-[#B8913D] border-opacity-30 hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all group"
                    >
                      <div className="relative h-48 bg-gray-800 overflow-hidden">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
                            <Play className="w-16 h-16 text-white opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-medium text-white mb-2 line-clamp-1">
                          {video.title}
                        </h3>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                          {video.description}
                        </p>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-gray-400">
                            {video.duration_minutes} min
                          </span>
                          <span className="px-3 py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium">
                            {video.level}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => onNavigate(`video-${video.id}`)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                          >
                            {t('favorites.cards.watch')}
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite('video', video.id)}
                            className="px-4 py-2 bg-red-900 bg-opacity-40 text-red-400 rounded-lg hover:bg-opacity-60 transition-all"
                            title={t('favorites.cards.removeTitle')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredPrograms.length > 0 && (
              <div>
                <h2 className="text-2xl font-light text-white mb-4 flex items-center space-x-2">
                  <BookOpen className="w-6 h-6 text-[#B8913D]" />
                  <span>{t('favorites.sections.programs')}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPrograms.map((program) => (
                    <div
                      key={program.id}
                      className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl overflow-hidden border border-[#B8913D] border-opacity-30 hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all group"
                    >
                      <div className="relative h-48 bg-gray-800 overflow-hidden">
                        {program.thumbnail_url ? (
                          <img
                            src={program.thumbnail_url}
                            alt={program.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#B8913D] to-[#A07F35]">
                            <BookOpen className="w-16 h-16 text-white opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-medium text-white mb-2 line-clamp-1">
                          {program.title}
                        </h3>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                          {program.description}
                        </p>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-gray-400">
                            {program.video_count || 0} {t('favorites.cards.videos')}
                          </span>
                          <span className="px-3 py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium">
                            {program.level}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => onNavigate(`program-${program.id}`)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                          >
                            {t('favorites.cards.viewProgram')}
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite('program', program.id)}
                            className="px-4 py-2 bg-red-900 bg-opacity-40 text-red-400 rounded-lg hover:bg-opacity-60 transition-all"
                            title={t('favorites.cards.removeTitle')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
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
