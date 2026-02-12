import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUrlChange: (url: string) => void;
  label?: string;
  bucket?: string;
  aspectRatio?: 'square' | 'video';
}

export function ImageUpload({
  currentImageUrl,
  onImageUrlChange,
  label = 'Image',
  bucket = 'images',
  aspectRatio = 'square'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.9): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          let width = img.width;
          let height = img.height;

          if (aspectRatio === 'video') {
            const targetRatio = 16 / 9;
            const currentRatio = width / height;

            if (currentRatio > targetRatio) {
              width = height * targetRatio;
            } else if (currentRatio < targetRatio) {
              height = width / targetRatio;
            }

            const scale = Math.min(maxWidth / width, maxHeight / height);
            canvas.width = width * scale;
            canvas.height = height * scale;

            const offsetX = (img.width - width) / 2;
            const offsetY = (img.height - height) / 2;

            ctx.drawImage(
              img,
              offsetX, offsetY, width, height,
              0, 0, canvas.width, canvas.height
            );
          } else {
            if (width > height) {
              if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = width * (maxHeight / height);
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to upload images');
      }

      const maxWidth = aspectRatio === 'video' ? 1920 : 1200;
      const maxHeight = aspectRatio === 'video' ? 1080 : 1200;

      const resizedBlob = await resizeImage(file, maxWidth, maxHeight, 0.85);

      const fileExt = 'jpg';
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, resizedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 31536000);

      if (signedUrlError) throw signedUrlError;

      onImageUrlChange(data.signedUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onImageUrlChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>

      {currentImageUrl ? (
        <div className="relative group">
          <div className={`w-full ${aspectRatio === 'video' ? 'aspect-video' : 'h-48'} bg-gray-800 rounded-lg overflow-hidden border border-gray-700`}>
            <img
              src={currentImageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </button>
          {aspectRatio === 'video' && (
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <div className="flex items-center space-x-1">
                <span>📐</span>
                <span>Format 16:9 (1920×1080) - tel qu'affiché dans Academy</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>✓</span>
                <span>Image automatiquement recadrée et optimisée</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`w-full ${aspectRatio === 'video' ? 'aspect-video' : 'h-48'} bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors flex items-center justify-center`}>
          {uploading ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#B8913D] mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-400">Optimisation et upload...</p>
              {aspectRatio === 'video' && (
                <p className="text-xs text-gray-500 mt-1">Recadrage en 16:9</p>
              )}
            </div>
          ) : (
            <label className="cursor-pointer text-center p-4">
              <ImageIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400 mb-1">Cliquez pour uploader une image</p>
              <p className="text-xs text-gray-500">
                {aspectRatio === 'video'
                  ? 'Sera automatiquement recadrée en 16:9 (1920×1080)'
                  : 'PNG, JPG, GIF, WEBP jusqu\'à 10MB'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Optimisation automatique</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <Upload className="w-3 h-3" />
        <span>Or paste an image URL below</span>
      </div>

      <input
        type="url"
        value={currentImageUrl || ''}
        onChange={(e) => onImageUrlChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        disabled={uploading}
        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all text-sm"
      />
    </div>
  );
}
