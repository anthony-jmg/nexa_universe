import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import { Calendar, MapPin, Users, Ticket, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_types: {
    name: string;
    description: string;
  };
};

interface AttendeeInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface EventTicketPurchaseProps {
  eventId?: string;
  onPurchaseComplete?: () => void;
}

export function EventTicketPurchase({ eventId, onPurchaseComplete }: EventTicketPurchaseProps) {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<EventTicketType[]>([]);
  const [selectedTicketType, setSelectedTicketType] = useState<EventTicketType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([{
    first_name: profile?.full_name.split(' ')[0] || '',
    last_name: profile?.full_name.split(' ').slice(1).join(' ') || '',
    email: profile?.email || '',
    phone: ''
  }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (eventId) {
      loadEventById(eventId);
    }
  }, [eventId]);

  useEffect(() => {
    if (selectedEvent) {
      loadTicketTypes(selectedEvent.id);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (quantity > attendees.length) {
      const newAttendees = [...attendees];
      for (let i = attendees.length; i < quantity; i++) {
        newAttendees.push({
          first_name: '',
          last_name: '',
          email: '',
          phone: ''
        });
      }
      setAttendees(newAttendees);
    } else if (quantity < attendees.length) {
      setAttendees(attendees.slice(0, quantity));
    }
  }, [quantity]);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_status', 'published')
      .eq('is_active', true)
      .gte('start_date', new Date().toISOString())
      .order('start_date');

    if (!error && data) {
      setEvents(data);
    }
  };

  const loadEventById = async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setSelectedEvent(data);
    }
  };

  const loadTicketTypes = async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_ticket_types')
      .select('*, ticket_types(name, description)')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setTicketTypes(data as EventTicketType[]);
    }
  };

  const updateAttendee = (index: number, field: keyof AttendeeInfo, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index][field] = value;
    setAttendees(newAttendees);
  };

  const generateQRCodeData = (
    attendeeId: string,
    attendee: AttendeeInfo,
    eventId: string,
    ticketTypeId: string
  ) => {
    return JSON.stringify({
      attendee_id: attendeeId,
      first_name: attendee.first_name,
      last_name: attendee.last_name,
      email: attendee.email,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      timestamp: new Date().toISOString()
    });
  };

  const generateQRCodeHash = async (qrData: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(qrData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const validateAttendees = () => {
    for (let i = 0; i < attendees.length; i++) {
      const attendee = attendees[i];
      if (!attendee.first_name.trim()) {
        setError(`Veuillez renseigner le prénom du participant ${i + 1}`);
        return false;
      }
      if (!attendee.last_name.trim()) {
        setError(`Veuillez renseigner le nom du participant ${i + 1}`);
        return false;
      }
      if (!attendee.email.trim()) {
        setError(`Veuillez renseigner l'email du participant ${i + 1}`);
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) {
        setError(`L'email du participant ${i + 1} n'est pas valide`);
        return false;
      }
    }
    return true;
  };

  const handlePurchase = async () => {
    setError('');
    setSuccess('');

    if (!user) {
      setError('Vous devez être connecté pour acheter des billets');
      return;
    }

    if (!selectedEvent || !selectedTicketType) {
      setError('Veuillez sélectionner un événement et un type de billet');
      return;
    }

    if (!validateAttendees()) {
      return;
    }

    if (selectedTicketType.quantity_available !== null &&
        quantity > (selectedTicketType.quantity_available - selectedTicketType.quantity_sold)) {
      setError('Quantité demandée non disponible');
      return;
    }

    setLoading(true);

    try {
      const isMember = profile?.platform_subscription_status === 'active';
      const unitPrice = isMember ? selectedTicketType.member_price : selectedTicketType.price;
      const totalAmount = unitPrice * quantity;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_amount: totalAmount,
          is_member_order: isMember,
          shipping_name: `${attendees[0].first_name} ${attendees[0].last_name}`,
          shipping_email: attendees[0].email,
          shipping_phone: attendees[0].phone || '',
          shipping_address: '',
          notes: `Billets pour ${selectedEvent.title}`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: orderItemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: null,
          product_name: `${selectedEvent.title} - ${selectedTicketType.ticket_types.name}`,
          quantity: quantity,
          unit_price: unitPrice,
          details: {
            event_id: selectedEvent.id,
            event_ticket_type_id: selectedTicketType.id,
            ticket_type_name: selectedTicketType.ticket_types.name
          }
        });

      if (orderItemError) throw orderItemError;

      const attendeeInserts = await Promise.all(
        attendees.map(async (attendee) => {
          const attendeeId = crypto.randomUUID();
          const qrCodeData = generateQRCodeData(
            attendeeId,
            attendee,
            selectedEvent.id,
            selectedTicketType.id
          );
          const qrCodeHash = await generateQRCodeHash(qrCodeData);

          return {
            id: attendeeId,
            order_id: order.id,
            event_ticket_type_id: selectedTicketType.id,
            attendee_first_name: attendee.first_name.trim(),
            attendee_last_name: attendee.last_name.trim(),
            attendee_email: attendee.email.trim().toLowerCase(),
            attendee_phone: attendee.phone.trim() || null,
            qr_code_data: qrCodeData,
            qr_code_hash: qrCodeHash
          };
        })
      );

      const { error: attendeesError } = await supabase
        .from('event_attendees')
        .insert(attendeeInserts);

      if (attendeesError) throw attendeesError;

      const { error: updateQuantityError } = await supabase
        .from('event_ticket_types')
        .update({
          quantity_sold: selectedTicketType.quantity_sold + quantity
        })
        .eq('id', selectedTicketType.id);

      if (updateQuantityError) throw updateQuantityError;

      setSuccess(`Billets achetés avec succès ! Total: ${totalAmount.toFixed(2)}€`);

      setSelectedEvent(null);
      setSelectedTicketType(null);
      setQuantity(1);
      setAttendees([{
        first_name: profile?.full_name.split(' ')[0] || '',
        last_name: profile?.full_name.split(' ').slice(1).join(' ') || '',
        email: profile?.email || '',
        phone: ''
      }]);

      if (onPurchaseComplete) {
        onPurchaseComplete();
      }

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message || 'Erreur lors de l\'achat des billets');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableQuantity = () => {
    if (!selectedTicketType) return 0;
    if (selectedTicketType.quantity_available === null) return selectedTicketType.max_per_order;
    return Math.min(
      selectedTicketType.max_per_order,
      selectedTicketType.quantity_available - selectedTicketType.quantity_sold
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-center space-x-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300">{success}</p>
        </div>
      )}

      {!eventId && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sélectionner un événement
          </label>
          <select
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const event = events.find(ev => ev.id === e.target.value);
              setSelectedEvent(event || null);
              setSelectedTicketType(null);
            }}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
          >
            <option value="">-- Choisir un événement --</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} - {new Date(event.start_date).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedEvent && (
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl p-6 border border-gray-700/50">
          <h3 className="text-2xl font-light text-white mb-4">{selectedEvent.title}</h3>
          <div className="space-y-2 text-gray-300">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#B8913D]" />
              <span>{new Date(selectedEvent.start_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#B8913D]" />
              <span>{selectedEvent.location}</span>
            </div>
          </div>
          <p className="text-gray-400 mt-4">{selectedEvent.description}</p>
        </div>
      )}

      {selectedEvent && ticketTypes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Type de billet
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ticketTypes.map((ticketType) => {
              const available = ticketType.quantity_available !== null
                ? ticketType.quantity_available - ticketType.quantity_sold
                : null;
              const isMember = profile?.platform_subscription_status === 'active';
              const displayPrice = isMember ? ticketType.member_price : ticketType.price;

              return (
                <button
                  key={ticketType.id}
                  onClick={() => setSelectedTicketType(ticketType)}
                  disabled={available !== null && available <= 0}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTicketType?.id === ticketType.id
                      ? 'border-[#B8913D] bg-[#B8913D]/10'
                      : available !== null && available <= 0
                      ? 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                      : 'border-gray-700 bg-gray-800/50 hover:border-[#B8913D]/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-medium text-white">{ticketType.ticket_types.name}</h4>
                    <Ticket className="w-5 h-5 text-[#B8913D]" />
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{ticketType.ticket_types.description}</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-2xl font-bold text-[#B8913D]">{displayPrice.toFixed(2)}€</span>
                      {isMember && ticketType.price !== ticketType.member_price && (
                        <span className="ml-2 text-sm text-gray-500 line-through">
                          {ticketType.price.toFixed(2)}€
                        </span>
                      )}
                    </div>
                    {available !== null && (
                      <span className="text-sm text-gray-400">
                        {available > 0 ? `${available} restants` : 'Épuisé'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedTicketType && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre de billets
            </label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
            >
              {Array.from({ length: getAvailableQuantity() }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'billet' : 'billets'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#B8913D]" />
              <h3 className="text-lg font-medium text-white">
                Informations des participants
              </h3>
            </div>
            <p className="text-sm text-gray-400">
              Veuillez renseigner les informations de chaque personne qui utilisera un billet.
              Un QR code unique sera généré pour chaque participant.
            </p>

            {attendees.map((attendee, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl p-6 border border-gray-700/50"
              >
                <h4 className="text-white font-medium mb-4">
                  Participant {index + 1}
                  {index === 0 && ' (Acheteur)'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      value={attendee.first_name}
                      onChange={(e) => updateAttendee(index, 'first_name', e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={attendee.last_name}
                      onChange={(e) => updateAttendee(index, 'last_name', e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={attendee.email}
                      onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={attendee.phone}
                      onChange={(e) => updateAttendee(index, 'phone', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end items-center space-x-4 pt-6 border-t border-gray-700">
            <div className="text-right">
              <p className="text-sm text-gray-400">Total à payer</p>
              <p className="text-3xl font-bold text-[#B8913D]">
                {(quantity * (profile?.platform_subscription_status === 'active'
                  ? selectedTicketType.member_price
                  : selectedTicketType.price)).toFixed(2)}€
              </p>
            </div>
            <button
              onClick={handlePurchase}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Traitement...' : 'Acheter les billets'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
