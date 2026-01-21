import { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { VideoUpload } from './VideoUpload';
import { Database } from '../lib/database.types';

type Video = Database['public']['Tables']['videos']['Row'];
type Program = Database['public']['Tables']['programs']['Row'];

interface VideoFormData {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  cloudflare_video_id: string;
  thumbnail_url: string;
  program_id: string | null;
  visibility: 'public' | 'private' | 'subscribers_only' | 'paid' | 'platform';
  program_order_index: number;
}

interface VideoEditFormProps {
  video: Video;
  programs: Program[];
  onSave: (formData: VideoFormData) => Promise<void>;
  onCancel: () => void;
}

export function VideoEditForm({ video, programs, onSave, onCancel }: VideoEditFormProps) {
  const [formData, setFormData] = useState<VideoFormData>({
    title: video.title,
    description: video.description || '',
    level: video.level as any,
    duration_minutes: video.duration_minutes || 0,
    cloudflare_video_id: video.cloudflare_video_id || '',
    thumbnail_url: video.thumbnail_url || '',
    program_id: video.program_id,
    visibility: video.visibility as any,
    program_order_index: video.program_order_index || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-6 border-2 border-[#B8913D]/50 mt-4 shadow-2xl">
      <h3 className="text-lg font-medium text-white mb-4 flex items-center space-x-2">
        <span className="w-1 h-6 bg-[#B8913D] rounded"></span>
        <span>Modifier la Vidéo</span>
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Titre *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Niveau *
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
            >
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Durée (minutes) *
            </label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
              required
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Visibilité *
            </label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
            >
              <option value="public">Public</option>
              <option value="paid">Payant</option>
              <option value="subscribers_only">Abonnés uniquement</option>
              <option value="platform">NEXA Academy</option>
              <option value="private">Privé</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Programme
          </label>
          <select
            value={formData.program_id || ''}
            onChange={(e) => setFormData({ ...formData, program_id: e.target.value || null })}
            className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
          >
            <option value="">Vidéo indépendante</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Vidéo Cloudflare
          </label>
          <VideoUpload
            currentVideoId={formData.cloudflare_video_id}
            onVideoIdChange={(id) => setFormData({ ...formData, cloudflare_video_id: id })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Miniature
          </label>
          <ImageUpload
            currentImageUrl={formData.thumbnail_url}
            onImageUrlChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
            label="Video Thumbnail"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </form>
    </div>
  );
}
