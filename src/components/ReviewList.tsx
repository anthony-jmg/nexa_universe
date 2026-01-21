import { useEffect, useState } from 'react';
import { Star, ThumbsUp, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ReviewForm from './ReviewForm';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  helpful_count: number;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  user_voted_helpful?: boolean;
}

interface ReviewListProps {
  itemType: 'video' | 'program';
  itemId: string;
}

export default function ReviewList({ itemType, itemId }: ReviewListProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    distribution: [0, 0, 0, 0, 0]
  });

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviews_user_id_fkey(full_name, avatar_url)
        `)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (user) {
        const { data: votes } = await supabase
          .from('review_helpful_votes')
          .select('review_id')
          .eq('user_id', user.id)
          .in('review_id', data.map(r => r.id));

        const votedReviewIds = new Set(votes?.map(v => v.review_id));

        const reviewsWithVotes = data.map(review => ({
          ...review,
          user_voted_helpful: votedReviewIds.has(review.id)
        }));

        setReviews(reviewsWithVotes);
      } else {
        setReviews(data);
      }

      const totalReviews = data.length;
      const averageRating = totalReviews > 0
        ? data.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      const distribution = [0, 0, 0, 0, 0];
      data.forEach(r => {
        distribution[r.rating - 1]++;
      });

      setStats({
        averageRating,
        totalReviews,
        distribution
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [itemType, itemId, user]);

  const handleVoteHelpful = async (reviewId: string, currentlyVoted: boolean) => {
    if (!user) {
      showToast('Connectez-vous pour voter', 'error');
      return;
    }

    try {
      if (currentlyVoted) {
        await supabase
          .from('review_helpful_votes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('review_helpful_votes')
          .insert({
            review_id: reviewId,
            user_id: user.id
          });
      }

      fetchReviews();
    } catch (error) {
      console.error('Error voting helpful:', error);
      showToast('Erreur lors du vote', 'error');
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      showToast('Avis supprimé', 'success');
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const starSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating
                ? 'fill-[#B8913D] text-[#B8913D]'
                : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const userReview = reviews.find(r => r.user_id === user?.id);

  return (
    <div className="space-y-6">
      {stats.totalReviews > 0 && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-white">
                {stats.averageRating.toFixed(1)}
              </div>
              {renderStars(Math.round(stats.averageRating), 'lg')}
              <div className="text-sm text-gray-400 mt-2">
                {stats.totalReviews} avis
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map(rating => {
                const count = stats.distribution[rating - 1];
                const percentage = stats.totalReviews > 0
                  ? (count / stats.totalReviews) * 100
                  : 0;

                return (
                  <div key={rating} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-16">
                      <span className="text-sm font-medium text-gray-300">{rating}</span>
                      <Star className="w-4 h-4 fill-[#B8913D] text-[#B8913D]" />
                    </div>
                    <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {user && !userReview && (
        <ReviewForm
          itemType={itemType}
          itemId={itemId}
          onReviewSubmitted={fetchReviews}
        />
      )}

      <div className="space-y-4">
        <h3 className="text-xl font-medium text-white">
          {stats.totalReviews > 0 ? `Avis (${stats.totalReviews})` : 'Aucun avis'}
        </h3>

        {reviews.map((review) => (
          <div key={review.id} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-700/50">
            {editingReview === review.id ? (
              <ReviewForm
                itemType={itemType}
                itemId={itemId}
                existingReview={{
                  id: review.id,
                  rating: review.rating,
                  comment: review.comment
                }}
                onReviewSubmitted={() => {
                  setEditingReview(null);
                  fetchReviews();
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] flex items-center justify-center text-white font-semibold">
                      {review.profiles?.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {review.profiles?.full_name || 'Utilisateur'}
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-sm text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {user?.id === review.user_id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingReview(review.id)}
                        className="p-2 text-gray-400 hover:text-[#B8913D] transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {review.comment && (
                  <p className="text-gray-300 mb-4 leading-relaxed">{review.comment}</p>
                )}

                <button
                  onClick={() => handleVoteHelpful(review.id, review.user_voted_helpful || false)}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    review.user_voted_helpful
                      ? 'text-[#B8913D]'
                      : 'text-gray-400 hover:text-[#B8913D]'
                  }`}
                >
                  <ThumbsUp className={`w-4 h-4 ${review.user_voted_helpful ? 'fill-current' : ''}`} />
                  <span>Utile ({review.helpful_count})</span>
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
