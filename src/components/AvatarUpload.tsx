import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

export function getAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  return avatarUrl;
}

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  onAvatarUpdate: (url: string) => void;
}

export function AvatarUpload({ userId, currentAvatarUrl, onAvatarUpdate }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(currentAvatarUrl));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    setAvatarUrl(getAvatarUrl(currentAvatarUrl));
  }, [currentAvatarUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast(t('account.avatar.invalidType'), 'error');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast(t('account.avatar.tooLarge'), 'error');
        return;
      }

      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (deleteError && deleteError.message !== 'The resource was not found') {
        console.error('Error deleting old avatar:', deleteError);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithTimestamp);
      onAvatarUpdate(urlWithTimestamp);
      showToast(t('account.avatar.updated'), 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast(t('account.avatar.uploadError'), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative group">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t('account.avatar.alt')}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-16 h-16 text-white" />
          )}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('account.avatar.change')}
          aria-label={t('account.avatar.change')}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-sm text-gray-500 text-center">
        {t('account.avatar.requirements')}
      </p>
    </div>
  );
}
