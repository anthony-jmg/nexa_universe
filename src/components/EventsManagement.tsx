import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { ImageUpload } from './ImageUpload';
import { Calendar, Plus, Edit2, Trash2, X, Check, AlertCircle, Ticket } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_type: TicketType;
};

interface EventWithTickets extends Event {
  event_ticket_types: EventTicketType[];
}

interface EventFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  thumbnail_url: string;
  event_status: 'draft' | 'published';
  is_active: boolean;
}

interface TicketTypeFormData {
  ticket_type_id: string;
  price: number;
  member_price: number;
  quantity_available: number | null;
  max_per_order: number;
  display_order: number;
  is_active: boolean;
}

export function EventsManagement() {
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithTickets | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [eventForm, setEventForm] = useState<EventFormData>({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    thumbnail_url: '',
    event_status: 'draft',
    is_active: true,
  });

  const [eventTicketTypes, setEventTicketTypes] = useState<TicketTypeFormData[]>([]);

  useEffect(() => {
    loadEvents();
    loadTicketTypes();

    const savedDraft = localStorage.getItem('eventFormDraft');
    if (savedDraft) {
      try {
        const { eventForm: savedEventForm, eventTicketTypes: savedTickets, timestamp } = JSON.parse(savedDraft);
        const dayInMs = 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < dayInMs) {
          setEventForm(savedEventForm);
          setEventTicketTypes(savedTickets);
          setShowEventForm(true);
        } else {
          localStorage.removeItem('eventFormDraft');
        }
      } catch (err) {
        console.error('Error restoring draft:', err);
        localStorage.removeItem('eventFormDraft');
      }
    }
  }, []);

  useEffect(() => {
    if (showEventForm && !editingEvent) {
      const draftData = {
        eventForm,
        eventTicketTypes,
        timestamp: Date.now()
      };
      localStorage.setItem('eventFormDraft', JSON.stringify(draftData));
    }
  }, [eventForm, eventTicketTypes, showEventForm, editingEvent]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_ticket_types (
            *,
            ticket_type:ticket_types (*)
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEvents((data as any) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setTicketTypes(data || []);
    } catch (err: any) {
      console.error('Error loading ticket types:', err);
    }
  };

  const handleAddEvent = () => {
    localStorage.removeItem('eventFormDraft');
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      location: '',
      thumbnail_url: '',
      event_status: 'draft',
      is_active: true,
    });
    setEventTicketTypes([]);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: EventWithTickets) => {
    localStorage.removeItem('eventFormDraft');
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      start_date: event.start_date,
      end_date: event.end_date || '',
      location: event.location || '',
      thumbnail_url: event.thumbnail_url || '',
      event_status: event.event_status as 'draft' | 'published',
      is_active: event.is_active,
    });
    setEventTicketTypes(
      event.event_ticket_types?.map((ett) => ({
        ticket_type_id: ett.ticket_type_id,
        price: ett.price,
        member_price: ett.member_price,
        quantity_available: ett.quantity_available,
        max_per_order: ett.max_per_order,
        display_order: ett.display_order,
        is_active: ett.is_active,
      })) || []
    );
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      setSuccess('Événement supprimé avec succès');
      loadEvents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update(eventForm)
          .eq('id', editingEvent.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('event_ticket_types')
          .delete()
          .eq('event_id', editingEvent.id);

        if (deleteError) throw deleteError;

        if (eventTicketTypes.length > 0) {
          const { error: insertError } = await supabase
            .from('event_ticket_types')
            .insert(
              eventTicketTypes.map((ett) => ({
                ...ett,
                event_id: editingEvent.id,
              }))
            );

          if (insertError) throw insertError;
        }

        setSuccess('Événement mis à jour avec succès');
      } else {
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert(eventForm)
          .select()
          .single();

        if (insertError) throw insertError;

        if (eventTicketTypes.length > 0) {
          const { error: ticketError } = await supabase
            .from('event_ticket_types')
            .insert(
              eventTicketTypes.map((ett) => ({
                ...ett,
                event_id: newEvent.id,
              }))
            );

          if (ticketError) throw ticketError;
        }

        setSuccess('Événement créé avec succès');
      }

      localStorage.removeItem('eventFormDraft');
      setShowEventForm(false);
      loadEvents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addTicketType = () => {
    setEventTicketTypes([
      ...eventTicketTypes,
      {
        ticket_type_id: '',
        price: 0,
        member_price: 0,
        quantity_available: null,
        max_per_order: 10,
        display_order: eventTicketTypes.length,
        is_active: true,
      },
    ]);
  };

  const updateTicketType = (index: number, field: keyof TicketTypeFormData, value: any) => {
    const updated = [...eventTicketTypes];
    updated[index] = { ...updated[index], [field]: value };
    setEventTicketTypes(updated);
  };

  const removeTicketType = (index: number) => {
    setEventTicketTypes(eventTicketTypes.filter((_, i) => i !== index));
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
        <h2 className="text-2xl font-light text-white">Gestion des événements</h2>
        <button
          onClick={handleAddEvent}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvel événement</span>
        </button>
      </div>

      {showEventForm && (
        <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-medium text-white">
                {editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}
              </h3>
              {!editingEvent && (
                <p className="text-sm text-gray-400 mt-1">
                  Brouillon sauvegardé automatiquement
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm('Voulez-vous fermer le formulaire ? Vos modifications seront sauvegardées automatiquement.')) {
                  setShowEventForm(false);
                }
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmitEvent} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Titre *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date de début *
                </label>
                <input
                  type="datetime-local"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date de fin
                </label>
                <input
                  type="datetime-local"
                  value={eventForm.end_date}
                  onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Lieu *
                </label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Image
                </label>
                <ImageUpload
                  onImageUploaded={(url) => setEventForm({ ...eventForm, thumbnail_url: url })}
                  currentImageUrl={eventForm.thumbnail_url}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Statut
                </label>
                <select
                  value={eventForm.event_status}
                  onChange={(e) => setEventForm({ ...eventForm, event_status: e.target.value as 'draft' | 'published' })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={eventForm.is_active}
                  onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.checked })}
                  className="w-5 h-5 text-[#B8913D] bg-gray-900 border-gray-700 rounded focus:ring-[#B8913D]"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                  Actif
                </label>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-white flex items-center space-x-2">
                  <Ticket className="w-5 h-5 text-[#B8913D]" />
                  <span>Types de billets</span>
                </h4>
                <button
                  type="button"
                  onClick={addTicketType}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
              </div>

              <div className="space-y-4">
                {eventTicketTypes.map((ett, index) => (
                  <div key={index} className="bg-gray-800 bg-opacity-50 rounded-lg p-4 border border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Type de billet *
                        </label>
                        <select
                          value={ett.ticket_type_id}
                          onChange={(e) => updateTicketType(index, 'ticket_type_id', e.target.value)}
                          required
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        >
                          <option value="">Sélectionner</option>
                          {ticketTypes.map((tt) => (
                            <option key={tt.id} value={tt.id}>
                              {tt.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Prix *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ett.price}
                          onChange={(e) => updateTicketType(index, 'price', parseFloat(e.target.value))}
                          required
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Prix membre
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ett.member_price}
                          onChange={(e) => updateTicketType(index, 'member_price', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Quantité disponible
                        </label>
                        <input
                          type="number"
                          value={ett.quantity_available || ''}
                          onChange={(e) => updateTicketType(index, 'quantity_available', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Illimité"
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Max par commande
                        </label>
                        <input
                          type="number"
                          value={ett.max_per_order}
                          onChange={(e) => updateTicketType(index, 'max_per_order', parseInt(e.target.value))}
                          required
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={ett.is_active}
                            onChange={(e) => updateTicketType(index, 'is_active', e.target.checked)}
                            className="w-4 h-4 text-[#B8913D] bg-gray-900 border-gray-700 rounded"
                          />
                          <label className="text-sm text-gray-300">Actif</label>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTicketType(index)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {editingEvent ? 'Mettre à jour' : 'Créer l\'événement'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-medium text-white">{event.title}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      event.event_status === 'published'
                        ? 'bg-green-900 bg-opacity-40 text-green-300 border border-green-600 border-opacity-40'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {event.event_status === 'published' ? 'Publié' : 'Brouillon'}
                  </span>
                  {!event.is_active && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-900 bg-opacity-40 text-red-300 border border-red-600 border-opacity-40">
                      Inactif
                    </span>
                  )}
                </div>
                <div className="text-gray-400 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-[#B8913D]" />
                    <span>
                      {new Date(event.start_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{event.location}</p>
                </div>
                {event.event_ticket_types && event.event_ticket_types.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-400 mb-2">Types de billets:</p>
                    <div className="flex flex-wrap gap-2">
                      {event.event_ticket_types.map((ett) => (
                        <span
                          key={ett.id}
                          className="px-3 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs"
                        >
                          {ett.ticket_type.name} - {ett.price}€
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEditEvent(event)}
                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
