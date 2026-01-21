import { Heart } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';

interface FavoriteButtonProps {
  type: 'professor' | 'video' | 'program';
  itemId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

export function FavoriteButton({
  type,
  itemId,
  size = 'md',
  className = '',
  showTooltip = true
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!user) return null;

  const isLiked = isFavorite(type, itemId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorite(type, itemId);
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 ${
        isLiked
          ? 'bg-red-500/90 hover:bg-red-600 shadow-lg shadow-red-500/50'
          : 'bg-gray-900/80 hover:bg-gray-800 border border-gray-700'
      } ${className}`}
      title={showTooltip ? (isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris') : ''}
    >
      <Heart
        className={`${iconSizes[size]} transition-all ${
          isLiked ? 'text-white fill-white' : 'text-gray-300'
        }`}
      />
    </button>
  );
}
