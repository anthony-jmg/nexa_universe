import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, MapPin, Ticket, Download, QrCode, Check, X } from 'lucide-react';
import QRCode from 'qrcode';

interface EventTicketWithDetails {
  id: string;
  event_id: string;
  user_id: string;
  event_ticket_type_id: string | null;
  qr_code: string;
  check_in_status: string;
  checked_in_at: string | null;
  purchased_at: string | null;
  created_at: string | null;
  event_ticket_types: {
    id: string;
    event_id: string;
    ticket_types: {
      name: string;
      description: string;
    };
  } | null;
  events: {
    title: string;
    description: string;
    location: string;
    start_date: string;
    end_date: string | null;
    thumbnail_url: string | null;
  };
}

export function MyEventTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<EventTicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<EventTicketWithDetails | null>(null);
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
    setLoading(true);
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        event_ticket_types (
          id,
          event_id,
          ticket_types (name, description)
        ),
        events (title, description, location, start_date, end_date, thumbnail_url)
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
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(url);
    } catch (err) {
      // QR generation failed silently
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !selectedTicket) return;
    const link = document.createElement('a');
    link.download = `ticket-${selectedTicket.id}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const groupTicketsByEvent = () => {
    const grouped: { [key: string]: EventTicketWithDetails[] } = {};
    tickets.forEach(ticket => {
      const eventId = ticket.event_id;
      if (!grouped[eventId]) {
        grouped[eventId] = [];
      }
      grouped[eventId].push(ticket);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Vous n'avez pas encore de billets d'evenement</p>
      </div>
    );
  }

  const groupedTickets = groupTicketsByEvent();

  return (
    <div className="space-y-6">
      {Object.entries(groupedTickets).map(([eventId, eventTickets]) => {
        const event = eventTickets[0].events;
        const isPastEvent = new Date(event.start_date) < new Date();

        return (
          <div
            key={eventId}
            className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl overflow-hidden border border-gray-700/50"
          >
            <div className="relative h-48">
              <img
                src={event.thumbnail_url || 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg'}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
              <div className="absolute bottom-4 left-6 right-6">
                <h3 className="text-2xl font-light text-white mb-2">{event.title}</h3>
                <div className="flex items-center space-x-4 text-gray-300 text-sm">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(event.start_date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-white">
                  Mes billets ({eventTickets.length})
                </h4>
                {isPastEvent && (
                  <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                    Evenement passe
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50 hover:border-[#B8913D]/50 transition-all cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        {ticket.event_ticket_types?.ticket_types && (
                          <p className="text-white font-medium">
                            {ticket.event_ticket_types.ticket_types.name}
                          </p>
                        )}
                        <p className="text-sm text-gray-400">
                          {ticket.purchased_at
                            ? new Date(ticket.purchased_at).toLocaleDateString('fr-FR')
                            : ''}
                        </p>
                      </div>
                      <QrCode className="w-5 h-5 text-[#B8913D]" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Check-in:</span>
                        {ticket.check_in_status === 'checked_in' ? (
                          <span className="flex items-center text-green-400">
                            <Check className="w-4 h-4 mr-1" />
                            Valide
                          </span>
                        ) : (
                          <span className="flex items-center text-gray-400">
                            <X className="w-4 h-4 mr-1" />
                            Non valide
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(ticket);
                      }}
                      className="mt-4 w-full py-2 bg-[#B8913D]/20 text-[#B8913D] rounded-lg hover:bg-[#B8913D]/30 transition-colors text-sm font-medium"
                    >
                      Voir le QR Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {selectedTicket && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <h3 className="text-2xl font-light text-white mb-2">Votre Billet</h3>
              <p className="text-gray-400">
                {selectedTicket.events.title}
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 mb-6">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-full h-auto"
                />
              ) : (
                <div className="aspect-square flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {selectedTicket.event_ticket_types?.ticket_types && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Type de billet:</span>
                  <span className="text-white">
                    {selectedTicket.event_ticket_types.ticket_types.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Statut:</span>
                {selectedTicket.check_in_status === 'checked_in' ? (
                  <span className="flex items-center text-green-400">
                    <Check className="w-4 h-4 mr-1" />
                    Valide le {selectedTicket.checked_in_at ? new Date(selectedTicket.checked_in_at).toLocaleDateString('fr-FR') : ''}
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <X className="w-4 h-4 mr-1" />
                    Non valide
                  </span>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={downloadQRCode}
                className="flex-1 flex items-center justify-center space-x-2 py-3 bg-[#B8913D]/20 text-[#B8913D] rounded-lg hover:bg-[#B8913D]/30 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Telecharger</span>
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="flex-1 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
