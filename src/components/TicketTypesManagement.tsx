import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Ticket, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

type TicketType = Database['public']['Tables']['ticket_types']['Row'];

interface TicketTypeFormData {
  name: string;
  description: string;
}

export function TicketTypesManagement() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState<TicketTypeFormData>({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadTicketTypes();
  }, []);

  const loadTicketTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setTicketTypes(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTicketType(null);
    setForm({
      name: '',
      description: '',
    });
    setShowForm(true);
  };

  const handleEdit = (ticketType: TicketType) => {
    setEditingTicketType(ticketType);
    setForm({
      name: ticketType.name,
      description: ticketType.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (ticketTypeId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce type de billet ?')) return;

    try {
      const { error } = await supabase
        .from('ticket_types')
        .delete()
        .eq('id', ticketTypeId);

      if (error) throw error;

      setSuccess('Type de billet supprimé avec succès');
      loadTicketTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingTicketType) {
        const { error: updateError } = await supabase
          .from('ticket_types')
          .update(form)
          .eq('id', editingTicketType.id);

        if (updateError) throw updateError;
        setSuccess('Type de billet mis à jour avec succès');
      } else {
        const { error: insertError } = await supabase
          .from('ticket_types')
          .insert(form);

        if (insertError) throw insertError;
        setSuccess('Type de billet créé avec succès');
      }

      setShowForm(false);
      loadTicketTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B8913D]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900 bg-opacity-40 border border-red-600 border-opacity-40 rounded-lg text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900 bg-opacity-40 border border-green-600 border-opacity-40 rounded-lg text-green-300 flex items-center space-x-2">
          <Check className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-light text-white">Gestion des types de billets</h2>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Nouveau type</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-medium text-white">
              {editingTicketType ? 'Modifier le type de billet' : 'Nouveau type de billet'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ex: Standard, VIP, Early Bird..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Description du type de billet..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {editingTicketType ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ticketTypes.map((ticketType) => (
          <div
            key={ticketType.id}
            className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-lg">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">{ticketType.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{ticketType.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(ticketType)}
                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ticketType.id)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {ticketTypes.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun type de billet créé</p>
          <p className="text-sm mt-2">Cliquez sur "Nouveau type" pour commencer</p>
        </div>
      )}
    </div>
  );
}
