import { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { Database } from '../lib/database.types';

type Program = Database['public']['Tables']['programs']['Row'];

interface ProgramFormData {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  price: number;
  thumbnail_url: string;
  visibility: 'public' | 'private' | 'subscribers_only' | 'paid' | 'platform';
}

interface ProgramEditFormProps {
  program: Program;
  onSave: (formData: ProgramFormData) => Promise<void>;
  onCancel: () => void;
}

export function ProgramEditForm({ program, onSave, onCancel }: ProgramEditFormProps) {
  const [formData, setFormData] = useState<ProgramFormData>({
    title: program.title,
    description: program.description || '',
    level: program.level as any,
    price: program.price || 0,
    thumbnail_url: program.thumbnail_url || '',
    visibility: program.visibility as any,
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
        <span>Modifier le Programme</span>
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
              <option value="all_levels">Tous niveaux</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Visibilité *
            </label>
            <select
              value={formData.visibility}
              onChange={(e) => {
                const newVisibility = e.target.value as any;
                setFormData({
                  ...formData,
                  visibility: newVisibility,
                  price: (newVisibility === 'public' || newVisibility === 'subscribers_only' || newVisibility === 'platform') ? 0 : formData.price
                });
              }}
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
            >
              <option value="public">Public</option>
              <option value="paid">Payant (achat à l'unité)</option>
              <option value="subscribers_only">Abonnés uniquement</option>
              <option value="platform">NEXA Academy (abonnement plateforme)</option>
              <option value="private">Privé</option>
            </select>
          </div>

          {formData.visibility === 'paid' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prix (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none transition-all text-white"
              />
            </div>
          )}
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
            Miniature
          </label>
          <ImageUpload
            currentImageUrl={formData.thumbnail_url}
            onImageUrlChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
            label="Program Thumbnail"
            aspectRatio="video"
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
