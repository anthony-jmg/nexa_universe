import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { BackgroundDecor } from '../components/BackgroundDecor';
import {
  Crown,
  User,
  Video,
  ShoppingBag,
  Calendar,
  CheckCircle,
  Package,
  AlertCircle,
  Clock,
  Ticket,
  MapPin,
  Download,
  X,
  XCircle
} from 'lucide-react';
import QRCode from 'qrcode';

type ProfessorSubscription = Database['public']['Tables']['professor_subscriptions']['Row'] & {
  professors: {
    profiles: {
      full_name: string;
      avatar_url: string;
    };
    subscription_price: number;
  };
};

type VideoPurchase = Database['public']['Tables']['video_purchases']['Row'] & {
  videos: {
    title: string;
    thumbnail_url: string;
    duration_minutes: number;
    level: string;
  };
};

type ProgramPurchase = {
  id: string;
  user_id: string;
  program_id: string;
  price_paid: number;
  status: 'active' | 'refunded' | 'expired';
  purchased_at: string;
  expires_at: string | null;
  programs: {
    title: string;
    description: string;
    thumbnail_url: string;
    level: string;
    duration_total_minutes: number;
  };
};

type Order = Database['public']['Tables']['orders']['Row'] & {
  order_items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    details: any;
  }[];
};

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

interface MyPurchasesProps {
  onNavigate: (page: string, params?: any) => void;
}

export function MyPurchases({ onNavigate }: MyPurchasesProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'programs' | 'videos' | 'orders' | 'tickets'>('subscriptions');
  const [professorSubscriptions, setProfessorSubscriptions] = useState<ProfessorSubscription[]>([]);
  const [programPurchases, setProgramPurchases] = useState<ProgramPurchase[]>([]);
  const [videoPurchases, setVideoPurchases] = useState<VideoPurchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<AttendeeWithDetails[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<AttendeeWithDetails | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      onNavigate('signin');
      return;
    }
    loadData();
  }, [user, onNavigate]);

  useEffect(() => {
    if (selectedTicket) {
      generateQRCode(selectedTicket.qr_code_data);
    }
  }, [selectedTicket]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    await Promise.all([
      loadProfessorSubscriptions(),
      loadProgramPurchases(),
      loadVideoPurchases(),
      loadOrders(),
      loadTickets()
    ]);
    setLoading(false);
  };

  const loadProfessorSubscriptions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('professor_subscriptions')
      .select('*, professors(profiles(full_name, avatar_url), subscription_price)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProfessorSubscriptions(data as ProfessorSubscription[]);
    }
  };

  const loadProgramPurchases = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('program_purchases')
      .select('*, programs(id, title, description, thumbnail_url, level)')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (!error && data) {
      const programIds = data.map(p => p.programs?.id).filter(Boolean) as string[];

      if (programIds.length > 0) {
        const { data: programsData } = await supabase
          .from('programs')
          .select(`
            id,
            videos!program_id(
              duration_minutes
            )
          `)
          .in('id', programIds);

        const programDurations = new Map<string, number>();
        if (programsData) {
          programsData.forEach((program: any) => {
            const videos = program.videos || [];
            const totalDuration = videos.reduce((sum: number, v: any) => sum + (v.duration_minutes || 0), 0);
            programDurations.set(program.id, totalDuration);
          });
        }

        const enrichedData = data.map(purchase => ({
          ...purchase,
          programs: {
            ...purchase.programs,
            duration_total_minutes: programDurations.get(purchase.programs?.id || '') || 0
          }
        }));

        setProgramPurchases(enrichedData as ProgramPurchase[]);
      } else {
        setProgramPurchases(data as ProgramPurchase[]);
      }
    }
  };

  const loadVideoPurchases = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('video_purchases')
      .select('*, videos(title, thumbnail_url, duration_minutes, level)')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (!error && data) {
      setVideoPurchases(data as VideoPurchase[]);
    }
  };

  const loadOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(product_name, quantity, unit_price, details)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
  };

  const loadTickets = async () => {
    if (!user) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id);

    if (!ordersData || ordersData.length === 0) {
      setTickets([]);
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

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'trial':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'inactive':
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'shipped':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'processing':
      case 'paid':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'pending':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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

  const isSubscriptionExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-20 pb-8 sm:pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-96 h-96 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-96 h-96 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mb-2 px-2">
            {t('purchases.title')}
          </h1>
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-sm sm:text-base text-gray-400 px-4">{t('purchases.subtitle')}</p>
        </div>

        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg md:text-xl font-medium text-white mb-1 truncate">Abonnement Plateforme</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getSubscriptionStatusColor(profile.platform_subscription_status)}`}>
                  {profile.platform_subscription_status === 'active' ? 'Actif' :
                   profile.platform_subscription_status === 'trial' ? 'Essai' : 'Inactif'}
                </span>
                {profile.platform_subscription_expires_at && (
                  <span className="text-gray-400 text-xs sm:text-sm flex items-center space-x-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">
                      Expire le {new Date(profile.platform_subscription_expires_at).toLocaleDateString('fr-FR')}
                    </span>
                  </span>
                )}
              </div>
              {profile.platform_subscription_expires_at && isSubscriptionExpiringSoon(profile.platform_subscription_expires_at) && (
                <div className="mt-2 flex items-center space-x-2 text-yellow-400 text-xs sm:text-sm">
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Votre abonnement expire bientôt</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-start sm:justify-center mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex space-x-2 sm:space-x-3 p-1.5 sm:p-2 bg-gray-800/50 border border-gray-700/50 rounded-full shadow-md">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'subscriptions'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Professeurs</span>
            </button>
            <button
              onClick={() => setActiveTab('programs')}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'programs'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Programmes</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Vidéos</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Commandes</span>
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 sm:space-x-2 whitespace-nowrap ${
                activeTab === 'tickets'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Billets</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 sm:py-20">
            <div className="inline-block w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'subscriptions' ? (
          <div className="space-y-4">
            {professorSubscriptions.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
                <User className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 px-2">Aucun abonnement professeur</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6 px-4">Abonnez-vous à vos professeurs préférés pour accéder à leur contenu exclusif</p>
                <button
                  onClick={() => onNavigate('professors')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  Découvrir les professeurs
                </button>
              </div>
            ) : (
              professorSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-[#B8913D]/50 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-700 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0">
                      {sub.professors.profiles.avatar_url ? (
                        <img
                          src={sub.professors.profiles.avatar_url}
                          alt={sub.professors.profiles.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <h3 className="text-base sm:text-lg font-medium text-white mb-2">
                        {sub.professors.profiles.full_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-medium border ${getSubscriptionStatusColor(sub.status)}`}>
                          {sub.status === 'active' ? 'Actif' :
                           sub.status === 'cancelled' ? 'Annulé' : 'Inactif'}
                        </span>
                        <span className="text-gray-400 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Depuis le {new Date(sub.started_at).toLocaleDateString('fr-FR')}</span>
                        </span>
                        {sub.expires_at && (
                          <span className="text-gray-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">Expire le {new Date(sub.expires_at).toLocaleDateString('fr-FR')}</span>
                          </span>
                        )}
                        <span className="text-[#B8913D] font-medium">
                          {sub.professors.subscription_price}€/mois
                        </span>
                      </div>
                      {sub.expires_at && isSubscriptionExpiringSoon(sub.expires_at) && sub.status === 'active' && (
                        <div className="mt-2 flex items-center space-x-2 text-yellow-400 text-xs sm:text-sm">
                          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>Expire bientôt</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onNavigate('professor-' + sub.professor_id)}
                      className="w-full sm:w-auto px-4 py-2 border border-[#B8913D] text-[#B8913D] rounded-lg hover:bg-[#B8913D] hover:text-white transition-all sm:opacity-0 sm:group-hover:opacity-100 text-sm"
                    >
                      Voir le profil
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'programs' ? (
          <div className="space-y-4">
            {programPurchases.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 px-2">Aucun programme acheté</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6 px-4">Achetez des programmes complets pour progresser efficacement</p>
                <button
                  onClick={() => onNavigate('academy')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  Explorer les programmes
                </button>
              </div>
            ) : (
              programPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-[#B8913D]/50 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-full sm:w-24 h-20 sm:h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      {purchase.programs.thumbnail_url ? (
                        <img
                          src={purchase.programs.thumbnail_url}
                          alt={purchase.programs.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <h3 className="text-base sm:text-lg font-medium text-white mb-2">
                        {purchase.programs.title}
                      </h3>
                      <p className="text-gray-400 text-xs sm:text-sm mb-2 line-clamp-2">{purchase.programs.description}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-medium border ${
                          purchase.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          purchase.status === 'refunded' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {purchase.status === 'active' ? 'Accessible' :
                           purchase.status === 'refunded' ? 'Remboursé' : 'Expiré'}
                        </span>
                        <span className="text-gray-400">{purchase.programs.duration_total_minutes} min</span>
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-300 rounded text-xs">
                          {purchase.programs.level}
                        </span>
                        <span className="text-gray-400 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Acheté le {new Date(purchase.purchased_at).toLocaleDateString('fr-FR')}</span>
                        </span>
                        <span className="text-[#B8913D] font-medium">
                          {purchase.price_paid}€
                        </span>
                      </div>
                      {purchase.expires_at && (
                        <div className="mt-2 flex items-center space-x-2 text-gray-400 text-xs sm:text-sm">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>Expire le {new Date(purchase.expires_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      )}
                      {purchase.expires_at && isSubscriptionExpiringSoon(purchase.expires_at) && purchase.status === 'active' && (
                        <div className="mt-2 flex items-center space-x-2 text-yellow-400 text-xs sm:text-sm">
                          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>Expire bientôt</span>
                        </div>
                      )}
                    </div>
                    {purchase.status === 'active' && (
                      <button
                        onClick={() => onNavigate('program-' + purchase.program_id)}
                        className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white rounded-lg hover:shadow-lg transition-all sm:opacity-0 sm:group-hover:opacity-100 text-sm"
                      >
                        Accéder
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'videos' ? (
          <div className="space-y-4">
            {videoPurchases.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
                <Video className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 px-2">Aucune vidéo achetée</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6 px-4">Achetez des vidéos individuelles pour enrichir votre apprentissage</p>
                <button
                  onClick={() => onNavigate('academy')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  Explorer l'académie
                </button>
              </div>
            ) : (
              videoPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-[#B8913D]/50 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-full sm:w-24 h-20 sm:h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                      {purchase.videos.thumbnail_url ? (
                        <img
                          src={purchase.videos.thumbnail_url}
                          alt={purchase.videos.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <h3 className="text-base sm:text-lg font-medium text-white mb-2">
                        {purchase.videos.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <span className={`px-2 sm:px-3 py-1 rounded-full font-medium border ${
                          purchase.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          purchase.status === 'refunded' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {purchase.status === 'active' ? 'Accessible' :
                           purchase.status === 'refunded' ? 'Remboursé' : 'Expiré'}
                        </span>
                        <span className="text-gray-400">{purchase.videos.duration_minutes} min</span>
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-300 rounded text-xs">
                          {purchase.videos.level}
                        </span>
                        <span className="text-gray-400 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Acheté le {new Date(purchase.purchased_at).toLocaleDateString('fr-FR')}</span>
                        </span>
                        <span className="text-[#B8913D] font-medium">
                          {purchase.amount_paid}€
                        </span>
                      </div>
                    </div>
                    {purchase.status === 'active' && (
                      <button
                        onClick={() => onNavigate('video-' + purchase.video_id)}
                        className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white rounded-lg hover:shadow-lg transition-all sm:opacity-0 sm:group-hover:opacity-100 text-sm"
                      >
                        Regarder
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 px-2">Aucune commande</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6 px-4">Commandez des produits dans notre boutique</p>
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  Visiter la boutique
                </button>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                    <div className="flex-1 w-full min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-medium text-white">
                          Commande #{order.id.substring(0, 8)}
                        </h3>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getOrderStatusColor(order.status)}`}>
                          {order.status === 'completed' ? 'Livrée' :
                           order.status === 'shipped' ? 'Expédiée' :
                           order.status === 'processing' ? 'En traitement' :
                           order.status === 'paid' ? 'Payée' :
                           order.status === 'pending' ? 'En attente' : 'Annulée'}
                        </span>
                        {order.is_member_order && (
                          <span className="px-2 sm:px-3 py-1 bg-[#B8913D]/20 text-[#B8913D] rounded-full text-xs font-medium border border-[#B8913D]/30">
                            Prix membre
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{new Date(order.created_at).toLocaleDateString('fr-FR')}</span>
                        </span>
                        {order.status === 'completed' && (
                          <span className="flex items-center space-x-1 text-green-400">
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span>Livrée</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-xl sm:text-2xl font-bold text-[#B8913D]">
                        {order.total_amount.toFixed(2)}€
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700/50 pt-4">
                    <p className="text-xs sm:text-sm text-gray-400 mb-2">Articles:</p>
                    <div className="space-y-2">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs sm:text-sm gap-2">
                          <span className="text-white truncate">
                            {item.product_name} x{item.quantity}
                          </span>
                          <span className="text-gray-400 flex-shrink-0">
                            {(item.unit_price * item.quantity).toFixed(2)}€
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {tickets.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
                <Ticket className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 px-2">Aucun billet</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6 px-4">Vous n'avez pas encore de billets d'événements</p>
                <button
                  onClick={() => onNavigate('events')}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm sm:text-base rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  Découvrir les événements
                </button>
              </div>
            ) : (
              <>
                {Object.values(
                  tickets.reduce((acc, ticket) => {
                    const eventId = ticket.event_ticket_type.event.id;
                    if (!acc[eventId]) {
                      acc[eventId] = {
                        event: ticket.event_ticket_type.event,
                        tickets: []
                      };
                    }
                    acc[eventId].tickets.push(ticket);
                    return acc;
                  }, {} as Record<string, { event: Event; tickets: AttendeeWithDetails[] }>)
                ).map(({ event, tickets: eventTickets }) => {
                  const eventDate = new Date(event.start_date);
                  const isPast = eventDate < new Date();

                  return (
                    <div
                      key={event.id}
                      className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden"
                    >
                      <div className="p-4 sm:p-6 border-b border-gray-700">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                          <div className="w-full">
                            <h2 className="text-lg sm:text-xl md:text-2xl font-medium text-white mb-2 sm:mb-3">{event.title}</h2>
                            <div className="space-y-1.5 sm:space-y-2">
                              <div className="flex items-center space-x-2 text-gray-300">
                                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8913D] flex-shrink-0" />
                                <span className="text-xs sm:text-sm">
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
                                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8913D] flex-shrink-0" />
                                  <span className="text-xs sm:text-sm truncate">{event.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isPast && (
                            <span className="px-2.5 sm:px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-xs sm:text-sm whitespace-nowrap">
                              Événement passé
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {eventTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-3 sm:p-4 bg-gray-800 bg-opacity-50 rounded-lg sm:rounded-xl border border-gray-700 hover:border-[#B8913D] transition-all cursor-pointer active:scale-95"
                              onClick={() => setSelectedTicket(ticket)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-sm font-medium text-[#B8913D] mb-1 truncate">
                                    {ticket.event_ticket_type.ticket_type.name}
                                  </p>
                                  <p className="text-sm sm:text-base text-white font-medium truncate">
                                    {ticket.attendee_first_name} {ticket.attendee_last_name}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1 truncate">{ticket.attendee_email}</p>
                                </div>
                                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-[#B8913D] flex-shrink-0 ml-2" />
                              </div>

                              <div className="mt-3 pt-3 border-t border-gray-700">
                                {getStatusBadge(ticket.status)}
                              </div>

                              {ticket.status === 'used' && ticket.checked_in_at && (
                                <p className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">
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
              </>
            )}
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl sm:rounded-2xl max-w-md w-full p-5 sm:p-8 border border-[#B8913D] border-opacity-30 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTicket(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <h3 className="text-xl sm:text-2xl font-medium text-white mb-5 sm:mb-6 text-center pr-8">Billet d'entrée</h3>

            <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">Événement</p>
                <p className="text-sm sm:text-base text-white font-medium">{selectedTicket.event_ticket_type.event.title}</p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400">Type de billet</p>
                <p className="text-sm sm:text-base text-[#B8913D] font-medium">{selectedTicket.event_ticket_type.ticket_type.name}</p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400">Participant</p>
                <p className="text-sm sm:text-base text-white font-medium">
                  {selectedTicket.attendee_first_name} {selectedTicket.attendee_last_name}
                </p>
                <p className="text-xs sm:text-sm text-gray-400">{selectedTicket.attendee_email}</p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-2">Statut</p>
                {getStatusBadge(selectedTicket.status)}
              </div>
            </div>

            {selectedTicket.status === 'valid' && qrCodeUrl && (
              <>
                <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl mb-5 sm:mb-6">
                  <img src={qrCodeUrl} alt="QR Code" className="w-full" />
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 py-2.5 sm:py-3 bg-gray-800 text-white text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </button>
                  <button
                    onClick={() => cancelTicket(selectedTicket.id)}
                    className="flex-1 py-2.5 sm:py-3 border border-red-600 text-red-400 text-sm sm:text-base rounded-lg hover:bg-red-900 hover:bg-opacity-20 transition-colors"
                  >
                    Annuler
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-3 sm:mt-4">
                  Présentez ce QR code à l'entrée de l'événement
                </p>
              </>
            )}

            {selectedTicket.status === 'used' && (
              <div className="text-center">
                <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-green-400 font-medium mb-2">Billet déjà utilisé</p>
                {selectedTicket.checked_in_at && (
                  <p className="text-xs sm:text-sm text-gray-400">
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
                <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-red-400 font-medium">Billet annulé</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
