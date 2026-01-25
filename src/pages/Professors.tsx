import { useEffect, useState } from 'react';
import { Award, PlayCircle, Star, Search, X, Filter, ChevronDown, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { FavoriteButton } from '../components/FavoriteButton';
import { getAvatarUrl } from '../components/AvatarUpload';
import type { Database } from '../lib/database.types';

type Professor = Database['public']['Tables']['professors']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

interface ProfessorsProps {
  onNavigate: (page: string) => void;
}

export function Professors({ onNavigate }: ProfessorsProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);

  useEffect(() => {
    fetchProfessors();
  }, []);

  const fetchProfessors = async () => {
    const { data, error } = await supabase
      .from('professors')
      .select(`
        *,
        profiles (*)
      `)
      .order('is_founder', { ascending: false })
      .order('is_featured', { ascending: false });

    if (error) {
      console.error('Error fetching professors:', error);
    } else if (data) {
      setProfessors(data as any);

      const specialties = new Set<string>();
      data.forEach(prof => {
        if (prof.specialties && Array.isArray(prof.specialties)) {
          prof.specialties.forEach((s: string) => specialties.add(s));
        }
      });
      setAllSpecialties(Array.from(specialties).sort());
    }
    setLoading(false);
  };

  const filteredProfessors = professors.filter(professor => {
    if (!professor.profiles) return false;

    const matchesSearch = !searchQuery.trim() ||
      professor.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (professor.bio?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

    const matchesSpecialty = selectedSpecialty === 'all' ||
      (professor.specialties && professor.specialties.includes(selectedSpecialty));

    return matchesSearch && matchesSpecialty;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative">
      <BackgroundDecor />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-6 sm:mb-10 md:mb-12 relative">
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-64 h-64 sm:w-96 sm:h-96 bg-[#B8913D] opacity-5 rounded-full blur-3xl pointer-events-none"></div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mb-2 sm:mb-3 md:mb-4 relative px-2">
            {t('professors.header.titleStart')} <span className="text-[#B8913D]">{t('professors.header.titleHighlight')}</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-2xl mx-auto relative px-4 sm:px-2 leading-relaxed">
            {t('professors.header.subtitle')}
          </p>
        </div>

        <div className="mb-6 sm:mb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl md:rounded-3xl p-3 sm:p-5 md:p-6 shadow-xl">
              <div className="relative group mb-3 sm:mb-4">
                <Search className="absolute left-3 sm:left-4 md:left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-focus-within:text-[#B8913D] transition-colors pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder={t('professors.search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:pl-12 md:pl-14 pr-9 sm:pr-12 md:pr-14 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base bg-gray-900/50 border border-gray-700/50 rounded-lg sm:rounded-xl md:rounded-2xl outline-none focus:border-[#B8913D] focus:ring-2 focus:ring-[#B8913D]/20 text-white placeholder-gray-500 font-light transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 sm:right-4 md:right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>

              {allSpecialties.length > 0 && (
                <div className="relative group">
                  <Filter className="absolute left-3 sm:left-4 md:left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-focus-within:text-[#B8913D] transition-colors pointer-events-none z-10" />
                  <ChevronDown className="absolute right-3 sm:right-4 md:right-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none z-10" />
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    className="w-full pl-9 sm:pl-12 md:pl-14 pr-9 sm:pr-12 md:pr-14 py-2.5 sm:py-3 md:py-4 text-sm sm:text-base bg-gray-900/30 border border-gray-700/30 rounded-lg sm:rounded-xl md:rounded-2xl outline-none focus:border-[#B8913D] focus:ring-2 focus:ring-[#B8913D]/20 text-white font-light transition-all appearance-none cursor-pointer"
                  >
                    <option value="all" className="bg-gray-900 text-white">{t('professors.filters.allSpecialties')}</option>
                    {allSpecialties.map(specialty => (
                      <option key={specialty} value={specialty} className="bg-gray-900 text-white">
                        {specialty}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(searchQuery || selectedSpecialty !== 'all') && (
                <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-4 border-t border-gray-700/30 mt-3 sm:mt-4">
                  <span className="text-xs sm:text-sm text-gray-400">{t('professors.filters.activeLabel')}</span>
                  {searchQuery && (
                    <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#B8913D]/10 text-[#D4AC5B] rounded-full text-xs sm:text-sm border border-[#B8913D]/20">
                      <Search className="w-3 h-3 mr-1 sm:mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-none">{searchQuery}</span>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="ml-1.5 sm:ml-2 hover:text-white transition-colors flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedSpecialty !== 'all' && (
                    <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#B8913D]/10 text-[#D4AC5B] rounded-full text-xs sm:text-sm border border-[#B8913D]/20">
                      <Filter className="w-3 h-3 mr-1 sm:mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-none">{selectedSpecialty}</span>
                      <button
                        onClick={() => setSelectedSpecialty('all')}
                        className="ml-1.5 sm:ml-2 hover:text-white transition-colors flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedSpecialty('all');
                    }}
                    className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 text-gray-400 hover:text-gray-300 text-xs sm:text-sm transition-colors duration-200"
                  >
                    {t('professors.filters.resetAll')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 sm:py-20">
            <div className="inline-block w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredProfessors.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl sm:rounded-2xl">
            <User className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm sm:text-base">
              {searchQuery || selectedSpecialty !== 'all'
                ? t('professors.empty.filtered')
                : t('professors.empty.none')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {filteredProfessors.map((professor) => (
              <div
                key={professor.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden group border border-gray-700/50 hover:border-[#B8913D] hover:border-opacity-30 flex flex-col h-full"
              >
                {(professor.is_featured || professor.is_founder) && (
                  <div className="bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-xs font-medium py-1.5 px-3 sm:py-2 sm:px-4 flex items-center justify-center space-x-1.5 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-20 h-20 bg-white opacity-10 rounded-full blur-xl"></div>
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10 flex-shrink-0" />
                    <span className="relative z-10 text-xs sm:text-sm">
                      {professor.is_founder ? t('professors.card.founder') : t('professors.card.featured')}
                    </span>
                  </div>
                )}

                <div className="p-4 sm:p-5 md:p-6 flex flex-col flex-1">
                  <div className="flex items-start space-x-3 sm:space-x-4 mb-4">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
                      {professor.profiles?.avatar_url ? (
                        <img
                          src={getAvatarUrl(professor.profiles.avatar_url) || ''}
                          alt={professor.profiles.full_name || 'Professor'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="relative w-full h-full bg-gradient-to-br from-[#B8913D] to-[#A07F35] flex items-center justify-center text-white text-lg sm:text-xl font-medium">
                          <div className="absolute inset-0 bg-white opacity-10 blur"></div>
                          <span className="relative z-10">{professor.profiles?.full_name?.charAt(0) || '?'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-medium text-white truncate">
                          {professor.profiles?.full_name || 'Unknown'}
                        </h3>
                        <FavoriteButton type="professor" itemId={professor.id} size="sm" />
                      </div>
                      <div className="flex items-center text-xs sm:text-sm text-gray-400 mt-1">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-[#B8913D] flex-shrink-0" />
                        <span>{professor.experience_years} {t('professors.card.experience')}</span>
                      </div>
                    </div>
                  </div>

                  {professor.specialties && professor.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {professor.specialties.slice(0, 3).map((specialty, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-[#B8913D] bg-opacity-20 text-[#B8913D] text-xs font-medium rounded border border-[#B8913D] border-opacity-30"
                        >
                          {specialty}
                        </span>
                      ))}
                      {professor.specialties.length > 3 && (
                        <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs font-medium rounded border border-gray-700">
                          +{professor.specialties.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-gray-300 mb-4 line-clamp-3 sm:line-clamp-4 leading-relaxed text-sm flex-1">
                    {professor.bio || t('professors.card.noBio')}
                  </p>

                  {professor.profile_video_url && (
                    <div className="mb-4">
                      <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden group/video">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#B8913D] to-[#A07F35] flex items-center justify-center">
                          <PlayCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white opacity-75 group-hover/video:opacity-100 transition-opacity" />
                        </div>
                        <button className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xs sm:text-sm font-medium">{t('professors.card.watchIntro')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 sm:pt-4 border-t border-gray-700 mt-auto">
                    <button
                      onClick={() => onNavigate(`professor-${professor.id}`)}
                      className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-full hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all"
                    >
                      {t('professors.card.viewProfile')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
