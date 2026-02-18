import { useState, useRef, useCallback } from 'react';
import { X, Loader2, Film, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VideoUploadProps {
  currentVideoId?: string;
  onVideoIdChange: (videoId: string) => void;
  videoTitle?: string;
  label?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
}

export function VideoUpload({
  currentVideoId,
  onVideoIdChange,
  videoTitle = 'Video',
  label = 'Video'
}: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [step, setStep] = useState<'idle' | 'requesting' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadStartTimeRef = useRef(0);

  const handleCancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setStep('idle');
    setUploadSpeed('');
    setTimeRemaining('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error('Impossible de lire les métadonnées de la vidéo'));
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Veuillez selectionner un fichier video');
      return;
    }

    // Limite à 200MB pour encourager des vidéos optimisées
    if (file.size > 200 * 1024 * 1024) {
      setError('La taille de la video doit etre inferieure a 200MB. Compressez votre video avec Handbrake (gratuit) ou un service en ligne avant l\'upload.');
      return;
    }

    // Vérification de la durée
    try {
      const duration = await getVideoDuration(file);
      if (duration > 7200) { // 2 heures max
        setError('La duree de la video ne doit pas depasser 2 heures');
        return;
      }
    } catch (err) {
      console.warn('Could not read video metadata:', err);
    }

    setUploading(true);
    setUploadProgress(0);
    setStep('requesting');
    setError('');
    setSuccess(false);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setUploadSpeed('');
    setTimeRemaining('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Vous devez etre connecte pour uploader des videos');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration Supabase manquante');
      }

      const apiUrl = `${supabaseUrl}/functions/v1/upload-cloudflare-video`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let tokenResponse: Response;
      try {
        tokenResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: videoTitle }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!tokenResponse.ok) {
        const err = await tokenResponse.json().catch(() => ({}));
        throw new Error(err.error || `Erreur serveur (${tokenResponse.status})`);
      }

      const { uploadURL, videoId } = await tokenResponse.json();

      if (!uploadURL || !videoId) {
        throw new Error('Reponse invalide du serveur');
      }

      setStep('uploading');
      uploadStartTimeRef.current = Date.now();

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);

          const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000;
          if (elapsed > 0.5) {
            const speed = event.loaded / elapsed;
            setUploadSpeed(`${formatFileSize(Math.round(speed))}/s`);

            const remaining = (event.total - event.loaded) / speed;
            setTimeRemaining(formatTime(remaining));
          }
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload echoue (status ${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Erreur reseau pendant l\'upload'));
        xhr.onabort = () => reject(new Error('Upload annule'));

        xhr.open('POST', uploadURL);
        xhr.send(formData);
      });

      await uploadPromise;

      xhrRef.current = null;
      onVideoIdChange(videoId);
      setUploadedVideoId(videoId);
      setSuccess(true);
      setStep('done');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Timeout: le serveur n\'a pas repondu a temps. Reessayez.');
      } else {
        let errorMessage = err.message || 'Echec de l\'upload';
        if (errorMessage.includes('Server configuration error') || errorMessage.includes('CLOUDFLARE')) {
          errorMessage = 'Cloudflare n\'est pas configure. Contactez l\'administrateur.';
        }
        setError(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setStep('idle');
      setUploadSpeed('');
      setTimeRemaining('');
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
      ) : (
        <div className="w-full bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors">
          {uploading ? (
            <div className="p-6">
              {step === 'requesting' && (
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-[#B8913D] mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-white font-medium mb-1">Preparation de l'upload...</p>
                  <p className="text-xs text-gray-400">Connexion a Cloudflare en cours</p>
                  {fileName && (
                    <p className="text-xs text-gray-500 mt-2">{fileName} ({fileSize})</p>
                  )}
                </div>
              )}

              {step === 'uploading' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white font-medium">Upload en cours...</p>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>

                  {fileName && (
                    <p className="text-xs text-gray-400 mb-3">{fileName} ({fileSize})</p>
                  )}

                  <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                    <div
                      className="bg-gradient-to-r from-[#B8913D] to-[#D4A84B] h-3 rounded-full transition-all duration-300 relative"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {uploadProgress > 10 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          {uploadProgress}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{uploadProgress}%</span>
                    <div className="flex items-center space-x-3">
                      {uploadSpeed && <span>{uploadSpeed}</span>}
                      {timeRemaining && uploadProgress < 100 && (
                        <span>~ {timeRemaining} restant</span>
                      )}
                    </div>
                  </div>

                  {uploadProgress > 50 && (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300 text-center">
                      Apres l'upload, Cloudflare optimisera automatiquement votre video
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <label className="cursor-pointer block p-8">
              <div className="text-center">
                <Film className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-2">Cliquez pour uploader une video</p>
                <p className="text-xs text-gray-500 mb-1">MP4, MOV, AVI, WebM</p>
                <p className="text-xs text-gray-600 mb-2">Taille maximum : 200MB, durée max : 2h</p>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-blue-400 mb-1">✓ Optimisation automatique par Cloudflare Stream</p>
                  <p className="text-xs text-gray-500">Streaming adaptatif multi-résolutions</p>
                </div>
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
        <div className="flex items-start space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && uploadedVideoId && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-400">Video uploadee avec succes !</p>
          </div>
          <div className="bg-green-500/5 rounded p-3 border border-green-500/20">
            <p className="text-xs text-green-300 mb-1 font-medium">ID Cloudflare :</p>
            <p className="text-xs text-green-200 font-mono break-all">{uploadedVideoId}</p>
          </div>
          <div className="flex items-start space-x-2 mt-3 p-3 bg-purple-500/10 border border-purple-400/30 rounded">
            <Loader2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 animate-spin" />
            <div className="text-xs text-purple-300">
              <p className="font-medium mb-1">Traitement en cours :</p>
              <p>Cloudflare Stream optimise et compresse votre video. Elle sera disponible dans quelques minutes avec streaming adaptatif multi-resolutions.</p>
            </div>
          </div>
          <div className="flex items-start space-x-2 mt-3 p-3 bg-blue-500/10 border border-blue-400/30 rounded">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300">
              <p className="font-medium mb-1">Etape suivante :</p>
              <p>Remplissez les champs requis puis cliquez sur <span className="font-bold">"Ajouter la Video"</span> pour finaliser.</p>
            </div>
          </div>
        </div>
      )}

      {!currentVideoId && !success && (
        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
          <p className="text-xs text-gray-400 font-medium">💡 Conseils pour optimiser vos videos :</p>
          <ul className="text-xs text-gray-500 space-y-1 ml-4">
            <li>• Resolution recommandee : 1080p (1920x1080) ou 720p (1280x720)</li>
            <li>• Format : MP4 avec codec H.264 ou H.265</li>
            <li>• Si votre video depasse 200MB, utilisez :</li>
            <li className="ml-4">- <span className="text-gray-400 font-medium">Handbrake</span> (gratuit, Windows/Mac/Linux)</li>
            <li className="ml-4">- <span className="text-gray-400 font-medium">Clipchamp</span> (en ligne, gratuit)</li>
            <li className="ml-4">- <span className="text-gray-400 font-medium">FFmpeg</span> (ligne de commande)</li>
          </ul>
          <a
            href="https://github.com/your-repo/blob/main/VIDEO_OPTIMIZATION_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-[#B8913D] hover:text-[#D4A84B] transition-colors mt-2"
          >
            📖 Guide complet d'optimisation video
          </a>
        </div>
      )}

    </div>
  );
}
