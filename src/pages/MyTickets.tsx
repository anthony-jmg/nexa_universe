import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Calendar, MapPin, Ticket, Download, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import QRCode from 'qrcode';

interface AttendeeWithDetails {
  id: string;
  event_id: string;
  user_id: string;
  event_ticket_type_id: string | null;
  qr_code: string;
  check_in_status: string;
  checked_in_at: string | null;
  purchased_at: string | null;
  created_at: string | null;
  attendee_first_name: string | null;
  attendee_last_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  event_ticket_types: {
    id: string;
    price: number;
    ticket_types: {
      name: string;
    };
  } | null;
  events: {
    id: string;
    title: string;
    location: string;
    start_date: string;
    end_date: string | null;
    thumbnail_url: string | null;
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

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTicket) {
      generateQRCode(selectedTicket.qr_code);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        event_ticket_types (
          id,
          price,
          ticket_types (name)
        ),
        events (
          id,
          title,
          location,
          start_date,
          end_date,
          thumbnail_url
        )
      `)
      .eq('user_id', user!.id)
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
      // QR generation failed silently
    }
  };

  const downloadQRCode = () => {
    if (!selectedTicket || !qrCodeUrl) return;
    const link = document.createElement('a');
    link.download = `ticket-${selectedTicket.id}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_checked_in':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-green-900 bg-opacity-40 text-green-400 rounded-full text-sm border border-green-600 border-opacity-40">
            <CheckCircle className="w-4 h-4" />
            <span>Valide</span>
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-900 bg-opacity-40 text-blue-400 rounded-full text-sm border border-blue-600 border-opacity-40">
            <CheckCircle className="w-4 h-4" />
            <span>Utilise</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-red-900 bg-opacity-40 text-red-400 rounded-full text-sm border border-red-600 border-opacity-40">
            <XCircle className="w-4 h-4" />
            <span>Annule</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-green-900 bg-opacity-40 text-green-400 rounded-full text-sm border border-green-600 border-opacity-40">
            <CheckCircle className="w-4 h-4" />
            <span>Valide</span>
          </span>
        );
    }
  };

  const groupedTickets = tickets.reduce((acc, ticket) => {
    const eventId = ticket.event_id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: ticket.events,
        tickets: []
      };
    }
    acc[eventId].tickets.push(ticket);
    return acc;
  }, {} as Record<string, { event: AttendeeWithDetails['events']; tickets: AttendeeWithDetails[] }>);

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
          <p className="text-gray-400">Tous vos billets d'evenements</p>
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
              Decouvrir les evenements
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
                          Evenement passe
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
                              {ticket.event_ticket_types?.ticket_types && (
                                <p className="text-sm font-medium text-[#B8913D] mb-1">
                                  {ticket.event_ticket_types.ticket_types.name}
                                </p>
                              )}
                              {(ticket.attendee_first_name || ticket.attendee_last_name) && (
                                <p className="text-sm text-white font-medium">
                                  {[ticket.attendee_first_name, ticket.attendee_last_name].filter(Boolean).join(' ')}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {ticket.purchased_at
                                  ? `Achete le ${new Date(ticket.purchased_at).toLocaleDateString('fr-FR')}`
                                  : ''}
                              </p>
                            </div>
                            <Ticket className="w-5 h-5 text-[#B8913D]" />
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-700">
                            {getStatusBadge(ticket.check_in_status)}
                          </div>

                          {ticket.check_in_status === 'checked_in' && ticket.checked_in_at && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                Scanne le {new Date(ticket.checked_in_at).toLocaleDateString('fr-FR', {
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

            <h3 className="text-2xl font-medium text-white mb-6 text-center">Billet d'entree</h3>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Evenement</p>
                <p className="text-white font-medium">{selectedTicket.events.title}</p>
              </div>

              {selectedTicket.event_ticket_types?.ticket_types && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Type de billet</p>
                  <p className="text-[#B8913D] font-medium">{selectedTicket.event_ticket_types.ticket_types.name}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Statut</p>
                {getStatusBadge(selectedTicket.check_in_status)}
              </div>

              {(selectedTicket.attendee_first_name || selectedTicket.attendee_last_name || selectedTicket.attendee_email || selectedTicket.attendee_phone) && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Participant</p>
                  <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                    {(selectedTicket.attendee_first_name || selectedTicket.attendee_last_name) && (
                      <p className="text-white font-medium text-base">
                        {[selectedTicket.attendee_first_name, selectedTicket.attendee_last_name].filter(Boolean).join(' ')}
                      </p>
                    )}
                    {selectedTicket.attendee_email && (
                      <p className="text-gray-400 text-sm">{selectedTicket.attendee_email}</p>
                    )}
                    {selectedTicket.attendee_phone && (
                      <p className="text-gray-400 text-sm">{selectedTicket.attendee_phone}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedTicket.check_in_status === 'not_checked_in' && qrCodeUrl && (
              <>

                <div className="bg-white p-4 rounded-xl mb-6">
                  <img src={qrCodeUrl} alt="QR Code" className="w-full" />
                </div>

                <button
                  onClick={downloadQRCode}
                  className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Telecharger</span>
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Presentez ce QR code a l'entree de l'evenement
                </p>
              </>
            )}

            {selectedTicket.check_in_status === 'checked_in' && (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                <p className="text-green-400 font-medium mb-2">Billet deja utilise</p>
                {selectedTicket.checked_in_at && (
                  <p className="text-sm text-gray-400">
                    Scanne le {new Date(selectedTicket.checked_in_at).toLocaleDateString('fr-FR', {
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

            {selectedTicket.check_in_status === 'cancelled' && (
              <div className="text-center">
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-medium">Billet annule</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
