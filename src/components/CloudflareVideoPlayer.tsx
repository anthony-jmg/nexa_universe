import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import Hls from 'hls.js';

interface CloudflareVideoPlayerProps {
  videoId: string;
  cloudflareVideoId?: string;
  onProgress?: (percentage: number) => void;
  onComplete?: () => void;
  autoplay?: boolean;
}

type PlayerMode = 'iframe' | 'native';

export default function CloudflareVideoPlayer({
  videoId,
  cloudflareVideoId,
  onProgress,
  onComplete
}: CloudflareVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoViewId, setVideoViewId] = useState<string | null>(null);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('iframe');
  const [loadedPosition, setSavedPosition] = useState<number>(0);
  const progressSaveTimer = useRef<number>();

  // Detect Android devices
  const isAndroid = /android/i.test(navigator.userAgent);

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

    const buildVideoUrl = (cfVideoId: string, token: string | null, startTime: number, mode: PlayerMode) => {
      // For Android, use native HLS manifest for better compatibility
      if (mode === 'native') {
        const pathId = token || cfVideoId;
        return `https://customer-${import.meta.env.VITE_CLOUDFLARE_ACCOUNT_HASH}.cloudflarestream.com/${pathId}/manifest/video.m3u8`;
      }

      // For other devices, use iframe player
      const params = new URLSearchParams();
      params.append('controls', 'true');
      params.append('preload', 'auto');
      params.append('loop', 'false');
      params.append('muted', 'false');
      params.append('autoplay', 'false');
      params.append('defaultTextTrack', 'off');
      if (startTime > 0) {
        params.append('startTime', startTime.toString());
      }
      const pathId = token || cfVideoId;
      return `https://customer-${import.meta.env.VITE_CLOUDFLARE_ACCOUNT_HASH}.cloudflarestream.com/${pathId}/iframe?${params.toString()}`;
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

        // Set player mode based on device
        const mode: PlayerMode = isAndroid ? 'native' : 'iframe';
        setPlayerMode(mode);

        const loadedPosition = await loadSavedProgress();
        setSavedPosition(loadedPosition);

        try {
          const { data: responseData, error: fnError } = await supabase.functions.invoke(
            'get-cloudflare-video-token',
            { body: { videoId } }
          );

          if (!fnError && responseData) {
            const { token, videoId: cfVid } = responseData;
            setStreamUrl(buildVideoUrl(cfVid, token, loadedPosition, mode));
            setLoading(false);

            if (mode === 'iframe') {
              progressInterval = window.setInterval(() => {
                if (iframeRef.current) {
                  iframeRef.current.contentWindow?.postMessage(
                    JSON.stringify({ event: 'get-current-time' }),
                    '*'
                  );
                }
              }, 1000);
            }
            return;
          }
        } catch {
          // Edge function failed, fall through to direct playback
        }

        if (cloudflareVideoId) {
          setStreamUrl(buildVideoUrl(cloudflareVideoId, null, loadedPosition, mode));
          setLoading(false);

          if (mode === 'iframe') {
            progressInterval = window.setInterval(() => {
              if (iframeRef.current) {
                iframeRef.current.contentWindow?.postMessage(
                  JSON.stringify({ event: 'get-current-time' }),
                  '*'
                );
              }
            }, 1000);
          }
          return;
        }

        setError('Failed to load video');
        setLoading(false);
      } catch (err) {
        if (cloudflareVideoId) {
          const loadedPosition = await loadSavedProgress();
          const mode: PlayerMode = isAndroid ? 'native' : 'iframe';
          setPlayerMode(mode);
          setStreamUrl(buildVideoUrl(cloudflareVideoId, null, loadedPosition, mode));
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

    const handleVideoTimeUpdate = () => {
      if (videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const duration = videoRef.current.duration;

        if (duration && duration > 0) {
          const percentage = (currentTime / duration) * 100;
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
            saveProgress(currentTime, duration);
          }, 2000);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Add native video event listeners for Android
    const videoElement = videoRef.current;
    if (videoElement && playerMode === 'native') {
      videoElement.addEventListener('timeupdate', handleVideoTimeUpdate);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (progressSaveTimer.current) {
        clearTimeout(progressSaveTimer.current);
      }
      if (videoElement) {
        videoElement.removeEventListener('timeupdate', handleVideoTimeUpdate);
      }
    };
  }, [videoId, onProgress, onComplete, playerMode]);

  // Initialize HLS player for browsers without native HLS support
  useEffect(() => {
    if (playerMode === 'native' && streamUrl && videoRef.current) {
      const video = videoRef.current;

      // Check if browser supports HLS natively (e.g., Safari, modern Chrome on Android)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support
        video.src = streamUrl;
      } else if (Hls.isSupported()) {
        // Use hls.js for browsers without native support
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error encountered, trying to recover');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error encountered, trying to recover');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, cannot recover');
                setError('Failed to load video');
                hls.destroy();
                break;
            }
          }
        });
      } else {
        setError('Your browser does not support video playback');
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }
  }, [playerMode, streamUrl]);

  // Handle saved position for native video player
  useEffect(() => {
    if (playerMode === 'native' && videoRef.current && savedPosition > 0) {
      const handleLoadedMetadata = () => {
        if (videoRef.current && savedPosition > 0) {
          videoRef.current.currentTime = savedPosition;
        }
      };

      const videoElement = videoRef.current;
      if (videoElement.readyState >= 1) {
        // Metadata already loaded
        videoElement.currentTime = savedPosition;
      } else {
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      }

      return () => {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [playerMode, savedPosition, streamUrl]);

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
      {playerMode === 'native' ? (
        <video
          ref={videoRef}
          controls
          playsInline
          preload="auto"
          controlsList="nodownload"
          crossOrigin="anonymous"
          className="w-full h-full"
          style={{
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: '#000'
          }}
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={streamUrl}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="w-full h-full border-0"
          style={{ border: 'none' }}
          loading="eager"
        />
      )}
    </div>
  );
}
