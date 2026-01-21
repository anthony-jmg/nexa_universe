import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface VideoProgress {
  video_id: string;
  progress_percentage: number;
  last_position_seconds: number;
  completed: boolean;
}

export function useVideoProgress(videoIds: string[] = []) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, VideoProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || videoIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const { data } = await supabase
          .from('video_views')
          .select('video_id, progress_percentage, last_position_seconds, completed')
          .eq('user_id', user.id)
          .in('video_id', videoIds)
          .order('watched_at', { ascending: false });

        if (data) {
          const progressMap: Record<string, VideoProgress> = {};
          const seenVideos = new Set<string>();

          data.forEach((view) => {
            if (!seenVideos.has(view.video_id)) {
              progressMap[view.video_id] = {
                video_id: view.video_id,
                progress_percentage: view.progress_percentage || 0,
                last_position_seconds: view.last_position_seconds || 0,
                completed: view.completed || false
              };
              seenVideos.add(view.video_id);
            }
          });

          setProgress(progressMap);
        }
      } catch (err) {
        console.error('Error fetching video progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [user, videoIds.join(',')]);

  return { progress, loading };
}
