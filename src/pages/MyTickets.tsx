import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { Calendar, MapPin, Ticket, Download, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import QRCode from 'qrcode';

type EventAttendee = Database['public']['Tables']['event_attendees']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type Event = Database['public']['Tables']['events']['Row'];

interface AttendeeWithDetails extends EventAttendee {
  event_ticket_type: EventTicketType & {
    ticket_type: TicketType;
    event: Event;
  };
}

interface MyTicketsProps {
  onNavigate: (page: string) => void;
}

export function MyTickets({ onNavigate }: MyTicketsProps) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<AttendeeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<AttendeeWithDetails | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTicket) {
      generateQRCode(selectedTicket.qr_code_data);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user!.id);

    if (!ordersData || ordersData.length === 0) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const orderIds = ordersData.map(order => order.id);

    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        event_ticket_type:event_ticket_types (
          *,
          ticket_type:ticket_types (*),
          event:events (*)
        )
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as any);
    }
    setLoading(false);
  };

  const generateQRCode = async (data: string) => {
    try {
      const url = await QRCode.toDataURL(data, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const downloadQRCode = () => {
    if (!selectedTicket || !qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `ticket-${selectedTicket.attendee_first_name}-${selectedTicket.attendee_last_name}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const cancelTicket = async (ticketId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce billet ? Cette action est irréversible.')) {
      return;
    }

    const { error } = await supabase
      .from('event_attendees')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .eq('status', 'valid');

    if (!error) {
      loadTickets();
      setSelectedTicket(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-green-900 bg-opacity-40 text-green-400 rounded-full text-sm border border-green-600 border-opacity-40">
            <CheckCircle className="w-4 h-4" />
            <span>Valide</span>
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-900 bg-opacity-40 text-blue-400 rounded-full text-sm border border-blue-600 border-opacity-40">
            <CheckCircle className="w-4 h-4" />
            <span>Utilisé</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-red-900 bg-opacity-40 text-red-400 rounded-full text-sm border border-red-600 border-opacity-40">
            <XCircle className="w-4 h-4" />
            <span>Annulé</span>
          </span>
        );
      default:
        return null;
    }
  };

  const groupedTickets = tickets.reduce((acc, ticket) => {
    const eventId = ticket.event_ticket_type.event.id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: ticket.event_ticket_type.event,
        tickets: []
      };
    }
    acc[eventId].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { event: Event; tickets: AttendeeWithDetails[] }>);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            Mes <span className="text-[#B8913D]">Billets</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">Tous vos billets d'événements</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30">
            <Ticket className="w-16 h-16 text-[#B8913D] opacity-50 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">Vous n'avez pas encore de billets</p>
            <button
              onClick={() => onNavigate('events')}
              className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
            >
              Découvrir les événements
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.values(groupedTickets).map(({ event, tickets: eventTickets }) => {
              const eventDate = new Date(event.start_date);
              const isPast = eventDate < new Date();

              return (
                <div
                  key={event.id}
                  className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 overflow-hidden"
                >
                  <div className="p-6 border-b border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-medium text-white mb-3">{event.title}</h2>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-gray-300">
                            <Calendar className="w-4 h-4 text-[#B8913D]" />
                            <span className="text-sm">
                              {eventDate.toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center space-x-2 text-gray-300">
                              <MapPin className="w-4 h-4 text-[#B8913D]" />
                              <span className="text-sm">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isPast && (
                        <span className="px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-sm">
                          Événement passé
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {eventTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-4 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700 hover:border-[#B8913D] transition-all cursor-pointer"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#B8913D] mb-1">
                                {ticket.event_ticket_type.ticket_type.name}
                              </p>
                              <p className="text-white font-medium">
                                {ticket.attendee_first_name} {ticket.attendee_last_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">{ticket.attendee_email}</p>
                            </div>
                            <Ticket className="w-5 h-5 text-[#B8913D]" />
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-700">
                            {getStatusBadge(ticket.status)}
                          </div>

                          {ticket.status === 'used' && ticket.checked_in_at && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                Scanné le {new Date(ticket.checked_in_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl max-w-md w-full p-8 border border-[#B8913D] border-opacity-30 shadow-2xl relative">
            <button
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-medium text-white mb-6 text-center">Billet d'entrée</h3>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Événement</p>
                <p className="text-white font-medium">{selectedTicket.event_ticket_type.event.title}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Type de billet</p>
                <p className="text-[#B8913D] font-medium">{selectedTicket.event_ticket_type.ticket_type.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Participant</p>
                <p className="text-white font-medium">
                  {selectedTicket.attendee_first_name} {selectedTicket.attendee_last_name}
                </p>
                <p className="text-sm text-gray-400">{selectedTicket.attendee_email}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Statut</p>
                {getStatusBadge(selectedTicket.status)}
              </div>
            </div>

            {selectedTicket.status === 'valid' && qrCodeUrl && (
              <>
                <div className="bg-white p-4 rounded-xl mb-6">
                  <img src={qrCodeUrl} alt="QR Code" className="w-full" />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </button>
                  <button
                    onClick={() => cancelTicket(selectedTicket.id)}
                    className="flex-1 py-3 border border-red-600 text-red-400 rounded-lg hover:bg-red-900 hover:bg-opacity-20 transition-colors"
                  >
                    Annuler
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Présentez ce QR code à l'entrée de l'événement
                </p>
              </>
            )}

            {selectedTicket.status === 'used' && (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                <p className="text-green-400 font-medium mb-2">Billet déjà utilisé</p>
                {selectedTicket.checked_in_at && (
                  <p className="text-sm text-gray-400">
                    Scanné le {new Date(selectedTicket.checked_in_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            )}

            {selectedTicket.status === 'cancelled' && (
              <div className="text-center">
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-medium">Billet annulé</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
