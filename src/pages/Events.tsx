import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { Calendar, MapPin, Users, ChevronRight, Clock } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type TicketType = Database['public']['Tables']['ticket_types']['Row'];
type EventTicketType = Database['public']['Tables']['event_ticket_types']['Row'] & {
  ticket_type: TicketType;
};

interface EventWithTickets extends Event {
  event_ticket_types: EventTicketType[];
}

interface EventsProps {
  onNavigate: (page: string, eventId?: string) => void;
}

export function Events({ onNavigate }: EventsProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const isMember = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_ticket_types (
          *,
          ticket_type:ticket_types (*)
        )
      `)
      .eq('event_status', 'published')
      .eq('is_active', true)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (!error && data) {
      setEvents(data as any);
    }
    setLoading(false);
  };

  const getMinPrice = (event: EventWithTickets) => {
    if (!event.event_ticket_types || event.event_ticket_types.length === 0) return null;

    const prices = event.event_ticket_types
      .filter(ett => ett.is_active)
      .map(ett => ett.price);

    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const getMinMemberPrice = (event: EventWithTickets) => {
    if (!event.event_ticket_types || event.event_ticket_types.length === 0) return null;

    const memberPrices = event.event_ticket_types
      .filter(ett => ett.is_active && ett.member_price > 0)
      .map(ett => ett.member_price);

    return memberPrices.length > 0 ? Math.min(...memberPrices) : null;
  };

  const getAvailableTickets = (event: EventWithTickets) => {
    if (!event.event_ticket_types) return 0;

    return event.event_ticket_types
      .filter(ett => ett.is_active)
      .reduce((total, ett) => {
        if (ett.quantity_available === null) return total + 999;
        return total + (ett.quantity_available - ett.quantity_sold);
      }, 0);
  };

  const currentEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return events.slice(startIndex, endIndex);
  }, [events, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(events.length / itemsPerPage);
  }, [events, itemsPerPage]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-72 h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-72 h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-light text-white mb-3">
            Événements <span className="text-[#B8913D]">Kizomba</span>
          </h1>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400 text-lg">Découvrez nos événements et réservez vos places</p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-10 h-10 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30">
            <Calendar className="w-20 h-20 text-[#B8913D] opacity-50 mx-auto mb-4" />
            <p className="text-gray-300 text-lg">Aucun événement disponible pour le moment</p>
            <p className="text-gray-500 mt-2">Revenez bientôt pour découvrir nos prochains événements</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {currentEvents.map((event) => {
              const minPrice = getMinPrice(event);
              const minMemberPrice = getMinMemberPrice(event);
              const availableTickets = getAvailableTickets(event);
              const eventDate = new Date(event.start_date);
              const isAlmostFull = event.max_attendees && availableTickets < event.max_attendees * 0.2;

              return (
                <div
                  key={event.id}
                  className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-[#B8913D]/20 transition-all overflow-hidden group border border-[#B8913D] border-opacity-30"
                >
                  <div className="relative h-64 bg-gray-800 overflow-hidden">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="w-20 h-20 text-[#B8913D] opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>

                    {isAlmostFull && (
                      <div className="absolute top-4 right-4 px-4 py-2 bg-red-600 bg-opacity-90 text-white text-sm font-bold rounded-full shadow-lg">
                        Places limitées
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-2xl font-medium text-white mb-3 group-hover:text-[#B8913D] transition-colors">
                      {event.title}
                    </h3>

                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center space-x-3 text-gray-300">
                        <Calendar className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
                        <span className="text-sm">
                          {eventDate.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-gray-300">
                        <Clock className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
                        <span className="text-sm">
                          {eventDate.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {event.location && (
                        <div className="flex items-center space-x-3 text-gray-300">
                          <MapPin className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
                          <span className="text-sm">{event.location}</span>
                        </div>
                      )}

                      <div className="flex items-center space-x-3 text-gray-300">
                        <Users className="w-5 h-5 text-[#B8913D] flex-shrink-0" />
                        <span className="text-sm">
                          {availableTickets > 0 ? `${availableTickets} places disponibles` : 'Complet'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                      <div>
                        {minPrice !== null ? (
                          <>
                            {minMemberPrice && minMemberPrice < minPrice ? (
                              <>
                                <div className="flex items-baseline space-x-2">
                                  <span className="text-sm text-gray-400">Prix normal:</span>
                                  <span className="text-base font-medium text-gray-400">
                                    {minPrice.toFixed(2)}€
                                  </span>
                                </div>
                                <div className="flex items-baseline space-x-2 mt-1">
                                  <span className="text-2xl font-bold text-[#B8913D]">
                                    {minMemberPrice.toFixed(2)}€
                                  </span>
                                  <span className="text-xs text-[#B8913D]">avec abonnement</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-baseline space-x-2">
                                <span className="text-sm text-gray-400">À partir de</span>
                                <span className="text-2xl font-bold text-[#B8913D]">
                                  {minPrice.toFixed(2)}€
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">Prix à venir</span>
                        )}
                      </div>

                      <button
                        onClick={() => onNavigate('event-detail', event.id)}
                        disabled={availableTickets === 0}
                        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                          availableTickets === 0
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/50 hover:scale-105'
                        }`}
                      >
                        <span>{availableTickets === 0 ? 'Complet' : 'Réserver'}</span>
                        {availableTickets > 0 && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-6 py-3 rounded-full bg-gray-900 bg-opacity-60 backdrop-blur-sm border border-[#B8913D] border-opacity-30 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-all"
                >
                  Précédent
                </button>

                <span className="text-white px-4">
                  Page {currentPage} sur {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
