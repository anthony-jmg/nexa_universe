import { useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ReviewFormProps {
  itemType: 'video' | 'program';
  itemId: string;
  onReviewSubmitted?: () => void;
  existingReview?: {
    id: string;
    rating: number;
    comment: string;
  };
}

export default function ReviewForm({ itemType, itemId, onReviewSubmitted, existingReview }: ReviewFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      showToast('Vous devez être connecté pour laisser un avis', 'error');
      return;
    }

    if (rating === 0) {
      showToast('Veuillez sélectionner une note', 'error');
      return;
    }

    setLoading(true);

    try {
      if (existingReview) {
        const { error } = await supabase
          .from('reviews')
          .update({
            rating,
            comment,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingReview.id);

        if (error) throw error;
        showToast('Avis modifié avec succès', 'success');
      } else {
        const { error } = await supabase
          .from('reviews')
          .insert({
            user_id: user.id,
            reviewable_type: itemType,
            reviewable_id: itemId,
            rating,
            comment
          });

        if (error) throw error;
        showToast('Avis publié avec succès', 'success');
      }

      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

      if (!existingReview) {
        setRating(0);
        setComment('');
      }
    } catch (error: any) {
      console.error('Error submitting review:', error);
      showToast('Erreur lors de la publication de l\'avis', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700/50">
        <p className="text-gray-400">Connectez-vous pour laisser un avis</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-700/50">
      <h3 className="text-xl font-medium text-white mb-4">
        {existingReview ? 'Modifier votre avis' : 'Laisser un avis'}
      </h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Votre note *
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= (hoveredRating || rating)
                    ? 'fill-[#B8913D] text-[#B8913D]'
                    : 'text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-300 mb-2">
          Votre commentaire (optionnel)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Partagez votre expérience avec ce contenu..."
          className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none text-white placeholder-gray-500 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white py-3 rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Publication...' : existingReview ? 'Modifier l\'avis' : 'Publier l\'avis'}
      </button>
    </form>
  );
}
