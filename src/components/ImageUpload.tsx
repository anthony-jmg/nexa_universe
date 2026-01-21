import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUrlChange: (url: string) => void;
  label?: string;
  bucket?: string;
}

export function ImageUpload({
  currentImageUrl,
  onImageUrlChange,
  label = 'Image',
  bucket = 'images'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to upload images');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
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
          <div className="w-full h-48 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
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
        </div>
      ) : (
        <div className="w-full h-48 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors flex items-center justify-center">
          {uploading ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#B8913D] mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-400">Uploading...</p>
            </div>
          ) : (
            <label className="cursor-pointer text-center p-4">
              <ImageIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400 mb-1">Click to upload image</p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF, WEBP up to 5MB</p>
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
