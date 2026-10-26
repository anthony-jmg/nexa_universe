import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { ImageUpload } from './ImageUpload';
import { Calendar, Plus, CreditCard as Edit2, Trash2, X, Check, AlertCircle, Ticket, BarChart3, Lock } from 'lucide-react';
import { EventSalesStats } from './EventSalesStats';
import { PriceLocksList } from './PriceLocksList';
import { checkEventForPublication } from '../lib/eventPublishChecks';

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
  event_status: 'draft' | 'published' | 'upcoming';
  is_active: boolean;
  is_test: boolean;
}

interface TicketTierFormData {
  id?: string;
  label: string;
  price: number;
  starts_at: string;
  ends_at: string;
  display_order: number;
  _delete?: boolean;
}

interface TicketTypeFormData {
  id?: string;
  ticket_type_id: string;
  price: number;
  member_price: number;
  quantity_available: number | null;
  max_per_order: number;
  display_order: number;
  is_active: boolean;
  nexa_cost: number | null;
  sale_end_date: string;
  price_lock_enabled: boolean;
  price_lock_deposit_amount: number;
  price_lock_opens_at: string;
  price_lock_guarantee_days: number;
  tiers: TicketTierFormData[];
}

const toIsoOrNull = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

// Conserve l'id existant des types de billets : les Price Locks sont liés à
// event_ticket_types.id, recréer les lignes casserait ces liens.
// Les prix (price / next_price / price_increase_date) sont dérivés des paliers
// côté base : ils ne sont plus transmis par l'admin.
const toTicketTypePayload = (ett: TicketTypeFormData) => ({
  ticket_type_id: ett.ticket_type_id,
  member_price: ett.member_price,
  quantity_available: ett.quantity_available,
  max_per_order: ett.max_per_order,
  display_order: ett.display_order,
  is_active: ett.is_active,
  nexa_cost: ett.nexa_cost,
  sale_end_date: toIsoOrNull(ett.sale_end_date),
  price_lock_enabled: ett.price_lock_enabled,
  price_lock_deposit_amount: ett.price_lock_deposit_amount,
  price_lock_opens_at: toIsoOrNull(ett.price_lock_opens_at),
  price_lock_guarantee_days: ett.price_lock_guarantee_days,
});

// Validation des paliers d'un billet : prix > 0, dates cohérentes,
// chevauchement interdit. Retourne une liste de messages d'erreur.
const validateTiers = (tiers: TicketTierFormData[]): string[] => {
  const errors: string[] = [];
  const sorted = [...tiers]
    .filter(t => !t._delete)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  sorted.forEach((t, i) => {
    if (!t.label.trim()) errors.push(`Palier ${i + 1} : le libellé est requis.`);
    if (!(t.price > 0)) errors.push(`Palier « ${t.label || i + 1} » : le prix doit être supérieur à 0.`);
    if (!t.starts_at) errors.push(`Palier « ${t.label || i + 1} » : la date de début est requise.`);
    if (t.ends_at && t.starts_at && new Date(t.ends_at).getTime() <= new Date(t.starts_at).getTime()) {
      errors.push(`Palier « ${t.label} » : la fin doit être après le début.`);
    }
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.starts_at && curr.starts_at &&
        new Date(prev.starts_at).getTime() === new Date(curr.starts_at).getTime()) {
      errors.push(`Deux paliers ne peuvent pas démarrer à la même date (${prev.label || '?'} et ${curr.label || '?'}).`);
    }
    if (prev.ends_at && curr.starts_at &&
        new Date(prev.ends_at).getTime() > new Date(curr.starts_at).getTime()) {
      errors.push(`Les paliers « ${prev.label || '?'} » et « ${curr.label || '?'} » se chevauchent.`);
    }
  }
  return errors;
};

export function EventsManagement() {
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithTickets | null>(null);
  const [statsEvent, setStatsEvent] = useState<EventWithTickets | null>(null);
  const [locksEvent, setLocksEvent] = useState<EventWithTickets | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Points à corriger avant publication (non bloquants en brouillon).
  const [warnings, setWarnings] = useState<string[]>([]);

  const [eventForm, setEventForm] = useState<EventFormData>({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    thumbnail_url: '',
    event_status: 'draft',
    is_active: true,
    is_test: false,
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
            ticket_type:ticket_types (*),
            price_tiers:event_ticket_price_tiers (*)
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
    setWarnings([]);
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
      is_test: false,
    });
    setEventTicketTypes([]);
    setShowEventForm(true);
  };

  const toDatetimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleEditEvent = (event: EventWithTickets) => {
    setWarnings([]);
    localStorage.removeItem('eventFormDraft');
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      start_date: toDatetimeLocal(event.start_date),
      end_date: toDatetimeLocal(event.end_date),
      location: event.location || '',
      thumbnail_url: event.thumbnail_url || '',
      event_status: event.event_status as 'draft' | 'published' | 'upcoming',
      is_active: event.is_active,
      is_test: event.is_test ?? false,
    });
    setEventTicketTypes(
      event.event_ticket_types?.map((ett) => ({
        id: ett.id,
        ticket_type_id: ett.ticket_type_id,
        price: ett.price,
        member_price: ett.member_price,
        quantity_available: ett.quantity_available,
        max_per_order: ett.max_per_order,
        display_order: ett.display_order,
        is_active: ett.is_active,
        nexa_cost: ett.nexa_cost,
        sale_end_date: toDatetimeLocal((ett as any).sale_end_date),
        price_lock_enabled: ett.price_lock_enabled,
        price_lock_deposit_amount: ett.price_lock_deposit_amount,
        price_lock_opens_at: toDatetimeLocal(ett.price_lock_opens_at),
        price_lock_guarantee_days: ett.price_lock_guarantee_days,
        tiers: ((ett as any).price_tiers || [])
          .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
          .map((t: any) => ({
            id: t.id,
            label: t.label,
            price: Number(t.price),
            starts_at: toDatetimeLocal(t.starts_at),
            ends_at: toDatetimeLocal(t.ends_at),
            display_order: t.display_order ?? 0,
          })),
      })) || []
    );
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    // La base refuse la suppression d'un événement ayant déjà des ventes,
    // Price Locks ou réservations : il faut alors le dépublier.
    if (!confirm('Supprimer définitivement cet événement ? Un événement qui a déjà des ventes, Price Locks ou réservations ne peut pas être supprimé : dépubliez-le à la place.')) return;

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

  const addTier = (ettIndex: number) => {
    const updated = [...eventTicketTypes];
    const tiers = [...updated[ettIndex].tiers];
    const last = tiers.filter(t => !t._delete).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).pop();
    tiers.push({
      label: '',
      price: last ? last.price : 0,
      starts_at: '',
      ends_at: '',
      display_order: tiers.length,
    });
    updated[ettIndex] = { ...updated[ettIndex], tiers };
    setEventTicketTypes(updated);
  };

  const updateTier = (ettIndex: number, tierIndex: number, field: keyof TicketTierFormData, value: any) => {
    const updated = [...eventTicketTypes];
    const tiers = [...updated[ettIndex].tiers];
    tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
    updated[ettIndex] = { ...updated[ettIndex], tiers };
    setEventTicketTypes(updated);
  };

  const removeTier = (ettIndex: number, tierIndex: number) => {
    const updated = [...eventTicketTypes];
    const tiers = [...updated[ettIndex].tiers];
    if (tiers[tierIndex].id) {
      tiers[tierIndex] = { ...tiers[tierIndex], _delete: true };
    } else {
      tiers.splice(tierIndex, 1);
    }
    updated[ettIndex] = { ...updated[ettIndex], tiers };
    setEventTicketTypes(updated);
  };

  const saveTiers = async (eventTicketTypeId: string, tiers: TicketTierFormData[]) => {
    for (const tier of tiers) {
      if (tier._delete && tier.id) {
        // Un palier référencé par des Price Locks ou des commandes est protégé
        // côté base : la suppression échoue et on remonte l'erreur à l'admin.
        const { error } = await supabase
          .from('event_ticket_price_tiers')
          .delete()
          .eq('id', tier.id);
        if (error) {
          throw new Error(`Suppression du palier « ${tier.label} » impossible : il est utilisé par des Price Locks ou des commandes existantes.`);
        }
        continue;
      }
      if (tier._delete) continue;

      const payload = {
        event_ticket_type_id: eventTicketTypeId,
        label: tier.label.trim(),
        price: tier.price,
        starts_at: new Date(tier.starts_at).toISOString(),
        ends_at: tier.ends_at ? new Date(tier.ends_at).toISOString() : null,
        display_order: tier.display_order,
      };
      if (tier.id) {
        const { error } = await supabase
          .from('event_ticket_price_tiers')
          .update(payload)
          .eq('id', tier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_ticket_price_tiers')
          .insert(payload);
        if (error) throw error;
      }
    }
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const tierErrors = eventTicketTypes.flatMap((ett, i) => {
      const label = ett.ticket_type_id ? `Billet « ${ticketTypes.find(tt => tt.id === ett.ticket_type_id)?.name ?? ett.ticket_type_id} »` : `Billet ${i + 1}`;
      const msgs: string[] = [];
      if (ett.is_active && !ett.tiers.some(t => !t._delete)) {
        msgs.push(`${label} : ajoutez au moins un palier tarifaire (le prix est défini uniquement par les paliers).`);
      }
      return [...msgs, ...validateTiers(ett.tiers).map(msg => `${label} : ${msg}`)];
    });
    if (tierErrors.length > 0) {
      setError(tierErrors.join(' '));
      return;
    }

    // Cohérence du festival : bloquant à la publication, avertissements sinon.
    const publishCheck = checkEventForPublication(
      eventForm,
      eventTicketTypes.map((ett) => ({
        ...ett,
        name: ticketTypes.find((tt) => tt.id === ett.ticket_type_id)?.name ?? 'sans type',
      }))
    );
    if (eventForm.event_status === 'published') {
      if (publishCheck.errors.length > 0) {
        setWarnings([]);
        setError(`Publication impossible : ${publishCheck.errors.join(' ')}`);
        return;
      }
      if (publishCheck.warnings.length > 0 &&
          !confirm(`${publishCheck.warnings.join('\n')}\n\nPublier quand même ?`)) {
        return;
      }
      setWarnings([]);
    } else {
      setWarnings([...publishCheck.errors, ...publishCheck.warnings]);
    }

    try {
      if (editingEvent) {
        // Passes retirés : supprimés en premier. Si la base refuse (ventes,
        // Price Locks…), rien d'autre n'est enregistré.
        const submittedIds = eventTicketTypes.filter((t) => t.id).map((t) => t.id!);
        const removedIds = (editingEvent.event_ticket_types || [])
          .map((e) => e.id)
          .filter((id) => !submittedIds.includes(id));

        if (removedIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('event_ticket_types')
            .delete()
            .in('id', removedIds);

          if (deleteError) throw deleteError;
        }

        const { error: updateError } = await supabase
          .from('events')
          .update(eventForm)
          .eq('id', editingEvent.id);

        if (updateError) throw updateError;

        for (const ett of eventTicketTypes) {
          const payload = toTicketTypePayload(ett);
          if (ett.id) {
            const { error } = await supabase
              .from('event_ticket_types')
              .update(payload)
              .eq('id', ett.id);
            if (error) throw error;
          } else {
            const { data: inserted, error } = await supabase
              .from('event_ticket_types')
              .insert({ ...payload, event_id: editingEvent.id })
              .select()
              .single();
            if (error) throw error;
            ett.id = inserted.id;
          }

          if (ett.id) {
            await saveTiers(ett.id, ett.tiers);
          }
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
          for (const ett of eventTicketTypes) {
            const { data: inserted, error: ticketError } = await supabase
              .from('event_ticket_types')
              .insert({ ...toTicketTypePayload(ett), event_id: newEvent.id })
              .select()
              .single();
            if (ticketError) throw ticketError;
            await saveTiers(inserted.id, ett.tiers);
          }
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
        nexa_cost: null,
        sale_end_date: '',
        price_lock_enabled: false,
        price_lock_deposit_amount: 0,
        price_lock_opens_at: '',
        price_lock_guarantee_days: 30,
        tiers: [],
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

      {warnings.length > 0 && (
        <div className="p-4 bg-amber-900 bg-opacity-30 border border-amber-600 border-opacity-40 rounded-lg text-amber-200 text-sm">
          <p className="flex items-center space-x-2 font-medium mb-2">
            <AlertCircle className="w-5 h-5" />
            <span>À corriger avant publication :</span>
          </p>
          <ul className="list-disc ml-6 space-y-1">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
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
                  onImageUrlChange={(url) => setEventForm({ ...eventForm, thumbnail_url: url })}
                  currentImageUrl={eventForm.thumbnail_url}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Statut
                </label>
                <select
                  value={eventForm.event_status}
                  onChange={(e) => setEventForm({ ...eventForm, event_status: e.target.value as 'draft' | 'published' | 'upcoming' })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                >
                  <option value="draft">Brouillon</option>
                  <option value="upcoming">À venir</option>
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_test"
                  checked={eventForm.is_test}
                  onChange={(e) => setEventForm({ ...eventForm, is_test: e.target.checked })}
                  className="w-5 h-5 text-[#B8913D] bg-gray-900 border-gray-700 rounded focus:ring-[#B8913D]"
                />
                <label htmlFor="is_test" className="text-sm font-medium text-amber-400">
                  Événement de test
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
                          Fin de vente
                        </label>
                        <input
                          type="datetime-local"
                          value={ett.sale_end_date}
                          onChange={(e) => updateTicketType(index, 'sale_end_date', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Coût Nexa
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ett.nexa_cost ?? ''}
                          onChange={(e) => updateTicketType(index, 'nexa_cost', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Quota (places)
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

                    <div className="border-t border-gray-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-[#D4AC5B]">Paliers tarifaires</h5>
                        <button
                          type="button"
                          onClick={() => addTier(index)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Ajouter un palier</span>
                        </button>
                      </div>
                      {ett.tiers.filter(t => !t._delete).length === 0 && (
                        <p className="text-sm text-gray-500 mb-3">
                          Aucun palier. Le prix du billet est défini uniquement par ses paliers tarifaires.
                        </p>
                      )}
                      <div className="space-y-2">
                        {ett.tiers.map((tier, tierIndex) => (
                          tier._delete ? null : (
                            <div key={tier.id ?? `new-${tierIndex}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-900 bg-opacity-40 rounded-lg p-3">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Libellé *</label>
                                <input
                                  type="text"
                                  value={tier.label}
                                  onChange={(e) => updateTier(index, tierIndex, 'label', e.target.value)}
                                  placeholder="Ex. Early bird"
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Prix (€) *</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tier.price || ''}
                                  onChange={(e) => updateTier(index, tierIndex, 'price', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Début *</label>
                                <input
                                  type="datetime-local"
                                  value={tier.starts_at}
                                  onChange={(e) => updateTier(index, tierIndex, 'starts_at', e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] outline-none"
                                />
                              </div>
                              <div className="flex items-end space-x-2">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-400 mb-1">Fin (optionnel)</label>
                                  <input
                                    type="datetime-local"
                                    value={tier.ends_at}
                                    onChange={(e) => updateTier(index, tierIndex, 'ends_at', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#B8913D] outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTier(index, tierIndex)}
                                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                                  title="Supprimer le palier"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-[#D4AC5B] flex items-center space-x-2">
                          <Lock className="w-4 h-4" />
                          <span>Price Lock</span>
                        </h5>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={ett.price_lock_enabled}
                            onChange={(e) => updateTicketType(index, 'price_lock_enabled', e.target.checked)}
                            className="w-4 h-4 text-[#B8913D] bg-gray-900 border-gray-700 rounded"
                          />
                          <label className="text-sm text-gray-300">Activé</label>
                        </div>
                      </div>
                      {ett.price_lock_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Versement minimum Price Lock *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={ett.price_lock_deposit_amount}
                              onChange={(e) => updateTicketType(index, 'price_lock_deposit_amount', parseFloat(e.target.value) || 0)}
                              required
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Le client pourra verser davantage s'il le souhaite (minimum global : 20 € pour les événements publics).
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Ouverture des locks
                            </label>
                            <input
                              type="datetime-local"
                              value={ett.price_lock_opens_at}
                              onChange={(e) => updateTicketType(index, 'price_lock_opens_at', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Jours de garantie
                            </label>
                            <input
                              type="number"
                              value={ett.price_lock_guarantee_days}
                              onChange={(e) => updateTicketType(index, 'price_lock_guarantee_days', parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Expiration réelle : le plus tôt entre hausse + garantie et fin de vente (calculé côté base).
                            </p>
                          </div>
                        </div>
                      )}
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

      {statsEvent && (
        <EventSalesStats
          eventId={statsEvent.id}
          eventTitle={statsEvent.title}
          onClose={() => setStatsEvent(null)}
        />
      )}

      {locksEvent && (
        <PriceLocksList
          eventId={locksEvent.id}
          onClose={() => setLocksEvent(null)}
        />
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
                        : event.event_status === 'upcoming'
                        ? 'bg-blue-900 bg-opacity-40 text-blue-300 border border-blue-600 border-opacity-40'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {event.event_status === 'published' ? 'Publié' : event.event_status === 'upcoming' ? 'À venir' : 'Brouillon'}
                  </span>
                  {!event.is_active && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-900 bg-opacity-40 text-red-300 border border-red-600 border-opacity-40">
                      Inactif
                    </span>
                  )}
                  {event.is_test && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-900 bg-opacity-40 text-amber-300 border border-amber-600 border-opacity-40">
                      Test
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
                      {event.event_ticket_types.map((ett) => {
                        const tiers = ((ett as any).price_tiers || []) as Array<{ price: number | string; starts_at: string; ends_at: string | null }>;
                        const now = Date.now();
                        const activeTier = tiers
                          .filter(t => new Date(t.starts_at).getTime() <= now && (!t.ends_at || new Date(t.ends_at).getTime() > now))
                          .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
                        return (
                          <span
                            key={ett.id}
                            className="px-3 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs"
                          >
                            {ett.ticket_type.name} - {activeTier ? `${activeTier.price}€` : 'aucun tarif actif'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setLocksEvent(event)}
                  className="p-2 text-[#D4AC5B] hover:text-[#F0D38A] transition-colors"
                  title="Price Locks de l'événement"
                >
                  <Lock className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setStatsEvent(event)}
                  className="p-2 text-[#B8913D] hover:text-[#A07F35] transition-colors"
                  title="Statistiques de vente"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
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
