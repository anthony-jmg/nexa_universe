import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Ticket, Check, X, Loader } from 'lucide-react';
import { EventTicketCartItem } from '../contexts/CartContext';

interface AttendeeInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface EventTicketPurchasePageProps {
  onNavigate: (page: string) => void;
}

export function EventTicketPurchasePage({ onNavigate }: EventTicketPurchasePageProps) {
  const { user, profile } = useAuth();
  const [orderId, setOrderId] = useState<string>('');
  const [eventTickets, setEventTickets] = useState<EventTicketCartItem[]>([]);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [useMyInfo, setUseMyInfo] = useState<boolean[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pendingOrderId = localStorage.getItem('pendingOrderId');
    const pendingEventTickets = localStorage.getItem('pendingEventTickets');
    const pendingAttendees = localStorage.getItem('pendingAttendees');

    if (!pendingOrderId || !pendingEventTickets) {
      onNavigate('cart');
      return;
    }

    setOrderId(pendingOrderId);
    const tickets = JSON.parse(pendingEventTickets) as EventTicketCartItem[];
    setEventTickets(tickets);

    const totalQuantity = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

    if (pendingAttendees) {
      try {
        const parsed = JSON.parse(pendingAttendees) as AttendeeInfo[];
        if (parsed.length === totalQuantity) {
          setAttendees(parsed);
          setUseMyInfo(Array(totalQuantity).fill(false));
          return;
        }
      } catch {
      }
    }

    setAttendees(Array(totalQuantity).fill({ firstName: '', lastName: '', email: '', phone: '' }));
    setUseMyInfo(Array(totalQuantity).fill(false));
  }, []);

  const handleUseMyInfo = (index: number) => {
    const newUseMyInfo = [...useMyInfo];
    newUseMyInfo[index] = !newUseMyInfo[index];
    setUseMyInfo(newUseMyInfo);

    if (newUseMyInfo[index] && profile) {
      const newAttendees = [...attendees];
      const nameParts = profile.full_name?.split(' ') || ['', ''];
      newAttendees[index] = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: profile.email,
        phone: ''
      };
      setAttendees(newAttendees);
    }
  };

  const updateAttendee = (index: number, field: keyof AttendeeInfo, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index] = { ...newAttendees[index], [field]: value };
    setAttendees(newAttendees);
  };

  const validateAttendees = () => {
    for (const attendee of attendees) {
      if (!attendee.firstName || !attendee.lastName || !attendee.email) {
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) {
        return false;
      }
    }
    return true;
  };

  const handleConfirm = async () => {
    if (!validateAttendees()) {
      setError('Veuillez remplir tous les champs obligatoires avec des informations valides');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const { data: existingAttendees, error: fetchError } = await supabase
        .from('event_attendees')
        .select('id, event_ticket_type_id, attendee_first_name')
        .eq('user_id', user!.id)
        .in('event_ticket_type_id', eventTickets.map(t => t.eventTicketType.id))
        .is('attendee_first_name', null)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      let attendeeIndex = 0;
      const attendeesByTicketType: Record<string, string[]> = {};

      for (const ea of existingAttendees || []) {
        if (!attendeesByTicketType[ea.event_ticket_type_id]) {
          attendeesByTicketType[ea.event_ticket_type_id] = [];
        }
        attendeesByTicketType[ea.event_ticket_type_id].push(ea.id);
      }

      for (const ticket of eventTickets) {
        const ids = attendeesByTicketType[ticket.eventTicketType.id] || [];
        for (let i = 0; i < ticket.quantity; i++) {
          const currentAttendee = attendees[attendeeIndex];
          const attendeeId = ids[i];

          if (attendeeId && currentAttendee) {
            await supabase
              .from('event_attendees')
              .update({
                attendee_first_name: currentAttendee.firstName || null,
                attendee_last_name: currentAttendee.lastName || null,
                attendee_email: currentAttendee.email || null,
                attendee_phone: currentAttendee.phone || null,
              })
              .eq('id', attendeeId);
          }

          attendeeIndex++;
        }
      }

      localStorage.removeItem('pendingOrderId');
      localStorage.removeItem('pendingEventTickets');
      localStorage.removeItem('pendingAttendees');

      onNavigate('my-tickets');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setProcessing(false);
    }
  };

  if (eventTickets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 flex items-center justify-center">
        <Loader className="w-10 h-10 text-[#B8913D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            Informations des <span className="text-[#B8913D]">Participants</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">Veuillez renseigner les informations pour chaque billet</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900 bg-opacity-40 border border-red-600 border-opacity-40 rounded-lg text-red-300 flex items-center space-x-2">
            <X className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6 mb-8">
          {attendees.map((attendee, index) => (
            <div key={index} className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Ticket className="w-5 h-5 text-[#B8913D]" />
                  <h3 className="text-lg font-medium text-white">Billet {index + 1}</h3>
                </div>
                {index === 0 && (
                  <button
                    onClick={() => handleUseMyInfo(index)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      useMyInfo[index]
                        ? 'bg-[#B8913D] text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Utiliser mes informations
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prénom <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={attendee.firstName}
                    onChange={(e) => updateAttendee(index, 'firstName', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={attendee.lastName}
                    onChange={(e) => updateAttendee(index, 'lastName', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={attendee.email}
                    onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={attendee.phone || ''}
                    onChange={(e) => updateAttendee(index, 'phone', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 mb-2">Après confirmation, vos QR codes seront générés</p>
              <p className="text-sm text-gray-500">Vous les retrouverez dans "Mes Billets"</p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="px-8 py-4 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {processing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Traitement...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Confirmer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
