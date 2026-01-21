import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type FavoriteType = 'professor' | 'video' | 'program';

interface Favorite {
  id: string;
  user_id: string;
  favorite_type: FavoriteType;
  professor_id?: string;
  video_id?: string;
  program_id?: string;
  created_at: string;
}

interface FavoritesContextType {
  favorites: Favorite[];
  loading: boolean;
  isFavorite: (type: FavoriteType, itemId: string) => boolean;
  addFavorite: (type: FavoriteType, itemId: string) => Promise<void>;
  removeFavorite: (type: FavoriteType, itemId: string) => Promise<void>;
  toggleFavorite: (type: FavoriteType, itemId: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFavorites(data);
    }
    setLoading(false);
  };

  const isFavorite = (type: FavoriteType, itemId: string): boolean => {
    return favorites.some(fav => {
      if (type === 'professor') return fav.professor_id === itemId;
      if (type === 'video') return fav.video_id === itemId;
      if (type === 'program') return fav.program_id === itemId;
      return false;
    });
  };

  const addFavorite = async (type: FavoriteType, itemId: string) => {
    if (!user) return;

    const favoriteData: any = {
      user_id: user.id,
      favorite_type: type,
    };

    if (type === 'professor') favoriteData.professor_id = itemId;
    if (type === 'video') favoriteData.video_id = itemId;
    if (type === 'program') favoriteData.program_id = itemId;

    const { error } = await supabase
      .from('favorites')
      .insert([favoriteData]);

    if (!error) {
      await loadFavorites();
    }
  };

  const removeFavorite = async (type: FavoriteType, itemId: string) => {
    if (!user) return;

    let query = supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('favorite_type', type);

    if (type === 'professor') query = query.eq('professor_id', itemId);
    if (type === 'video') query = query.eq('video_id', itemId);
    if (type === 'program') query = query.eq('program_id', itemId);

    const { error } = await query;

    if (!error) {
      await loadFavorites();
    }
  };

  const toggleFavorite = async (type: FavoriteType, itemId: string) => {
    if (isFavorite(type, itemId)) {
      await removeFavorite(type, itemId);
    } else {
      await addFavorite(type, itemId);
    }
  };

  const refreshFavorites = async () => {
    await loadFavorites();
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        loading,
        isFavorite,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        refreshFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
