import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface CloudflareVideoPlayerProps {
  videoId: string;
  cloudflareVideoId?: string;
  onProgress?: (percentage: number) => void;
  onComplete?: () => void;
  autoplay?: boolean;
}

export default function CloudflareVideoPlayer({
  videoId,
  cloudflareVideoId,
  onProgress,
  onComplete
}: CloudflareVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoViewId, setVideoViewId] = useState<string | null>(null);
  const progressSaveTimer = useRef<number>();

  const saveProgress = async (currentTime: number, duration: number) => {
    if (!duration || duration === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const progressPercentage = (currentTime / duration) * 100;
    const completed = progressPercentage >= 95;

    try {
      if (videoViewId) {
        await supabase
          .from('video_views')
          .update({
            progress_percentage: progressPercentage,
            last_position_seconds: Math.floor(currentTime),
            watch_duration_seconds: Math.floor(currentTime),
            completed
          })
          .eq('id', videoViewId);
      } else {
        const { data } = await supabase
          .from('video_views')
          .insert({
            user_id: user.id,
            video_id: videoId,
            progress_percentage: progressPercentage,
            last_position_seconds: Math.floor(currentTime),
            watch_duration_seconds: Math.floor(currentTime),
            completed
          })
          .select()
          .single();

        if (data) {
          setVideoViewId(data.id);
        }
      }
    } catch (err) {
      console.error('Error saving video progress:', err);
    }
  };

  const loadSavedProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    try {
      const { data } = await supabase
        .from('video_views')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .order('last_watched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setVideoViewId(data.id);
        return data.last_position_seconds || 0;
      }
    } catch (err) {
      console.error('Error loading video progress:', err);
    }
    return 0;
  };

  useEffect(() => {
    let progressInterval: number;

    const buildIframeUrl = (cfVideoId: string, token: string | null, startTime: number) => {
      const params = new URLSearchParams();
      if (token) {
        params.append('token', token);
      }
      params.append('controls', 'true');
      params.append('preload', 'auto');
      params.append('loop', 'false');
      if (startTime > 0) {
        params.append('startTime', startTime.toString());
      }
      return `https://customer-${import.meta.env.VITE_CLOUDFLARE_ACCOUNT_HASH}.cloudflarestream.com/${cfVideoId}/iframe?${params.toString()}`;
    };

    const fetchSignedUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please sign in to watch this video');
          setLoading(false);
          return;
        }

        const savedPosition = await loadSavedProgress();

        try {
          const { data: responseData, error: fnError } = await supabase.functions.invoke(
            'get-cloudflare-video-token',
            { body: { videoId } }
          );

          if (!fnError && responseData) {
            const { token, videoId: cfVid } = responseData;
            setStreamUrl(buildIframeUrl(cfVid, token, savedPosition));
            setLoading(false);

            progressInterval = window.setInterval(() => {
              if (iframeRef.current) {
                iframeRef.current.contentWindow?.postMessage(
                  JSON.stringify({ event: 'get-current-time' }),
                  '*'
                );
              }
            }, 1000);
            return;
          }
        } catch {
          // Edge function failed, fall through to direct playback
        }

        if (cloudflareVideoId) {
          setStreamUrl(buildIframeUrl(cloudflareVideoId, null, savedPosition));
          setLoading(false);

          progressInterval = window.setInterval(() => {
            if (iframeRef.current) {
              iframeRef.current.contentWindow?.postMessage(
                JSON.stringify({ event: 'get-current-time' }),
                '*'
              );
            }
          }, 1000);
          return;
        }

        setError('Failed to load video');
        setLoading(false);
      } catch (err) {
        if (cloudflareVideoId) {
          const savedPosition = await loadSavedProgress();
          setStreamUrl(buildIframeUrl(cloudflareVideoId, null, savedPosition));
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load video');
        setLoading(false);
      }
    };

    fetchSignedUrl();

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === 'timeupdate') {
          const percentage = (data.currentTime / data.duration) * 100;
          if (onProgress) {
            onProgress(percentage);
          }

          if (percentage >= 95 && onComplete) {
            onComplete();
          }

          if (progressSaveTimer.current) {
            clearTimeout(progressSaveTimer.current);
          }
          progressSaveTimer.current = window.setTimeout(() => {
            saveProgress(data.currentTime, data.duration);
          }, 2000);
        }
      } catch (err) {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (progressSaveTimer.current) {
        clearTimeout(progressSaveTimer.current);
      }
    };
  }, [videoId, onProgress, onComplete]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-red-500 text-lg mb-2">Unable to load video</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!streamUrl) {
    return null;
  }

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        src={streamUrl}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
