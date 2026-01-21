import { useState, useRef } from 'react';
import { Upload, X, Loader2, Video, Film, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VideoUploadProps {
  currentVideoId?: string;
  onVideoIdChange: (videoId: string) => void;
  videoTitle?: string;
  label?: string;
}

export function VideoUpload({
  currentVideoId,
  onVideoIdChange,
  videoTitle = 'Video',
  label = 'Video'
}: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError('Video size should be less than 500MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('You must be logged in to upload videos');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', videoTitle);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase configuration missing');
      }

      const apiUrl = `${supabaseUrl}/functions/v1/upload-cloudflare-video`;

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('POST', apiUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.send(formData);
      });

      const result = await uploadPromise;

      if (result.success && result.videoId) {
        onVideoIdChange(result.videoId);
        setUploadedVideoId(result.videoId);
        setSuccess(true);
      } else {
        throw new Error('No video ID received from server');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      let errorMessage = err.message || 'Failed to upload video';

      if (errorMessage.includes('Server configuration error') || errorMessage.includes('CLOUDFLARE')) {
        errorMessage = 'Cloudflare n\'est pas configuré. Veuillez contacter l\'administrateur pour configurer CLOUDFLARE_API_TOKEN dans les variables d\'environnement.';
      }

      setError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onVideoIdChange('');
    setSuccess(false);
    setUploadedVideoId('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>

      {currentVideoId ? (
        <div className="relative group">
          <div className="w-full p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Video Uploaded</p>
                  <p className="text-xs text-gray-400 font-mono">{currentVideoId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors">
          {uploading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-12 h-12 text-[#B8913D] mx-auto mb-4 animate-spin" />
              <p className="text-sm text-gray-400 mb-2">Uploading video...</p>
              <div className="max-w-xs mx-auto">
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-[#B8913D] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer block p-8">
              <div className="text-center">
                <Film className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-2">Click to upload video</p>
                <p className="text-xs text-gray-500 mb-1">MP4, MOV, AVI, WebM</p>
                <p className="text-xs text-gray-600">Maximum size: 500MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && uploadedVideoId && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-400">Vidéo téléchargée avec succès sur Cloudflare !</p>
          </div>
          <div className="bg-green-500/5 rounded p-3 border border-green-500/20">
            <p className="text-xs text-green-300 mb-1 font-medium">ID Cloudflare :</p>
            <p className="text-xs text-green-200 font-mono break-all">{uploadedVideoId}</p>
          </div>
          <div className="flex items-start space-x-2 mt-3 p-3 bg-blue-500/10 border border-blue-400/30 rounded">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300">
              <p className="font-medium mb-1">Étape suivante importante :</p>
              <p>Remplissez tous les champs requis (titre, niveau, durée, etc.) puis cliquez sur le bouton <span className="font-bold">"Ajouter la Vidéo"</span> en bas du formulaire pour finaliser la création de la vidéo.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <Upload className="w-3 h-3" />
        <span>Or enter a Cloudflare Video ID manually</span>
      </div>

      <input
        type="text"
        value={currentVideoId || ''}
        onChange={(e) => onVideoIdChange(e.target.value)}
        placeholder="abc123def456..."
        disabled={uploading}
        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all text-sm font-mono"
      />
    </div>
  );
}
