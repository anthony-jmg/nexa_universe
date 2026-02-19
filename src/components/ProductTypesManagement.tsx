import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type ProductType = Database['public']['Tables']['product_types']['Row'];

interface ProductTypesManagementProps {
  productTypes: ProductType[];
  onRefresh: () => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

export function ProductTypesManagement({
  productTypes,
  onRefresh,
  setError,
  setSuccess
}: ProductTypesManagementProps) {
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '' });

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingType) {
        const { error } = await supabase
          .from('product_types')
          .update({ name: typeForm.name })
          .eq('id', editingType.id);

        if (error) throw error;
        setSuccess('Type de produit mis à jour avec succès');
      } else {
        const { error } = await supabase
          .from('product_types')
          .insert([{ name: typeForm.name }]);

        if (error) throw error;
        setSuccess('Type de produit créé avec succès');
      }

      onRefresh();
      resetTypeForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce type de produit ?')) return;

    const { error } = await supabase
      .from('product_types')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
      setSuccess('Type de produit supprimé');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleEditType = (productType: ProductType) => {
    setEditingType(productType);
    setTypeForm({ name: productType.name });
    setShowTypeForm(true);
  };

  const resetTypeForm = () => {
    setTypeForm({ name: '' });
    setEditingType(null);
    setShowTypeForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-light text-white">Gestion des Types de Produits</h2>
        <button
          onClick={() => setShowTypeForm(!showTypeForm)}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105"
        >
          {showTypeForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showTypeForm ? 'Annuler' : 'Ajouter un Type'}</span>
        </button>
      </div>

      {showTypeForm && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleTypeSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom du Type *
              </label>
              <input
                type="text"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ name: e.target.value })}
                required
                placeholder="Ex: T-Shirt, Hoodie, Sticker..."
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetTypeForm}
                className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {editingType ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(productTypes || []).map((type) => (
          <div
            key={type.id}
            className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#B8913D]/10 rounded-full flex items-center justify-center">
                  <Tag className="w-6 h-6 text-[#B8913D]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{type.name}</h3>
                  <p className="text-sm text-gray-400">
                    {type.is_active ? 'Actif' : 'Inactif'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEditType(type)}
                  className="p-2 text-[#B8913D] hover:bg-[#B8913D]/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteType(type.id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
