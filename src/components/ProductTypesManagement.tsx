import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Tag, Ruler } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type ProductType = Database['public']['Tables']['product_types']['Row'];
type ProductSize = Database['public']['Tables']['product_sizes']['Row'];

interface ProductTypesManagementProps {
  productTypes: ProductType[];
  productSizes: ProductSize[];
  onRefresh: () => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

export function ProductTypesManagement({
  productTypes,
  productSizes,
  onRefresh,
  setError,
  setSuccess
}: ProductTypesManagementProps) {
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    has_sizes: false,
    is_active: true,
    order_index: 0,
  });

  const [selectedTypeForSizes, setSelectedTypeForSizes] = useState<string>('');
  const [showSizeForm, setShowSizeForm] = useState(false);
  const [sizeForm, setSizeForm] = useState({
    name: '',
    order_index: 0,
  });

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
      has_sizes: productType.has_sizes,
      is_active: productType.is_active,
      order_index: productType.order_index,
    });
    setShowTypeForm(true);
  };

  const resetTypeForm = () => {
    setTypeForm({
      name: '',
      has_sizes: false,
      is_active: true,
      order_index: 0,
    });
    setEditingType(null);
    setShowTypeForm(false);
  };

  const handleSizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedTypeForSizes) {
      setError('Veuillez sélectionner un type de produit');
      return;
    }

    try {
      const { error } = await supabase
        .from('product_sizes')
        .insert([{
          product_type_id: selectedTypeForSizes,
          ...sizeForm
        }]);

      if (error) throw error;

      setSuccess('Taille ajoutée avec succès');
      onRefresh();
      resetSizeForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSize = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette taille ?')) return;

    const { error } = await supabase
      .from('product_sizes')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
      setSuccess('Taille supprimée');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const resetSizeForm = () => {
    setSizeForm({
      name: '',
      order_index: 0,
    });
    setShowSizeForm(false);
  };

  const getTypeSizes = (typeId: string) => {
    return productSizes.filter(size => size.product_type_id === typeId);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  value={typeForm.order_index}
                  onChange={(e) => setTypeForm({ ...typeForm, order_index: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={typeForm.has_sizes}
                  onChange={(e) => setTypeForm({ ...typeForm, has_sizes: e.target.checked })}
                  className="w-5 h-5 text-[#B8913D] bg-gray-900 border-gray-600 rounded focus:ring-[#B8913D] focus:ring-2"
                />
                <span className="text-gray-300 group-hover:text-white transition-colors">
                  Ce type a des tailles (S, M, L, XL, etc.)
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={typeForm.is_active}
                  onChange={(e) => setTypeForm({ ...typeForm, is_active: e.target.checked })}
                  className="w-5 h-5 text-[#B8913D] bg-gray-900 border-gray-600 rounded focus:ring-[#B8913D] focus:ring-2"
                />
                <span className="text-gray-300 group-hover:text-white transition-colors">
                  Actif
                </span>
              </label>
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
        {productTypes.map((type) => (
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
                    {type.has_sizes ? 'Avec tailles' : 'Sans taille'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  type.is_active
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-gray-500/10 text-gray-400'
                }`}>
                  {type.is_active ? 'Actif' : 'Inactif'}
                </span>
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

            {type.has_sizes && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-2">
                    <Ruler className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-300">Tailles disponibles</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTypeForSizes(type.id);
                      setShowSizeForm(true);
                    }}
                    className="text-xs px-3 py-1 bg-[#B8913D]/20 text-[#B8913D] rounded-full hover:bg-[#B8913D]/30 transition-colors"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    Ajouter
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getTypeSizes(type.id).length > 0 ? (
                    getTypeSizes(type.id).map((size) => (
                      <div
                        key={size.id}
                        className="group flex items-center space-x-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded-full"
                      >
                        <span className="text-sm text-gray-300">{size.name}</span>
                        <button
                          onClick={() => handleDeleteSize(size.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 italic">Aucune taille définie</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showSizeForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-light text-white mb-6">Ajouter une taille</h3>

            <form onSubmit={handleSizeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de la taille *
                </label>
                <input
                  type="text"
                  value={sizeForm.name}
                  onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })}
                  required
                  placeholder="Ex: S, M, L, XL, XXL"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  value={sizeForm.order_index}
                  onChange={(e) => setSizeForm({ ...sizeForm, order_index: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetSizeForm}
                  className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
