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
  const [typeForm, setTypeForm] = useState({
    name: '',
    sizes: [] as string[],
  });
  const [newSize, setNewSize] = useState('');

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingType) {
        const { error } = await supabase
          .from('product_types')
          .update(typeForm)
          .eq('id', editingType.id);

        if (error) throw error;
        setSuccess('Type de produit mis à jour avec succès');
      } else {
        const { error } = await supabase
          .from('product_types')
          .insert([typeForm]);

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
    setTypeForm({
      name: productType.name,
      sizes: productType.sizes || [],
    });
    setShowTypeForm(true);
  };

  const resetTypeForm = () => {
    setTypeForm({
      name: '',
      sizes: [],
    });
    setNewSize('');
    setEditingType(null);
    setShowTypeForm(false);
  };

  const handleAddSize = () => {
    if (newSize.trim()) {
      setTypeForm({
        ...typeForm,
        sizes: [...typeForm.sizes, newSize.trim()]
      });
      setNewSize('');
    }
  };

  const handleRemoveSize = (index: number) => {
    setTypeForm({
      ...typeForm,
      sizes: typeForm.sizes.filter((_, i) => i !== index)
    });
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
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                required
                placeholder="Ex: T-Shirt, Hoodie, Sticker..."
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tailles disponibles
              </label>
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSize())}
                  placeholder="Ex: S, M, L, XL..."
                  className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="px-4 py-3 bg-[#B8913D] text-white rounded-lg hover:bg-[#A07F35] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {typeForm.sizes.map((size, index) => (
                  <div
                    key={index}
                    className="group flex items-center space-x-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded-full"
                  >
                    <span className="text-sm text-gray-300">{size}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(index)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
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
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#B8913D]/10 rounded-full flex items-center justify-center">
                  <Tag className="w-6 h-6 text-[#B8913D]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{type.name}</h3>
                  <p className="text-sm text-gray-400">
                    {type.sizes && type.sizes.length > 0 ? `${type.sizes.length} tailles` : 'Sans taille'}
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

            {type.sizes && type.sizes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <span className="text-sm font-medium text-gray-300 mb-2 block">Tailles disponibles</span>
                <div className="flex flex-wrap gap-2">
                  {type.sizes.map((size, index) => (
                    <div
                      key={index}
                      className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full"
                    >
                      <span className="text-sm text-gray-300">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
