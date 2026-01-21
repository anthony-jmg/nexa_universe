import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Video, BookOpen, ArrowLeft, AlertTriangle, Clock, ShoppingBag, Package, Truck, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PageTransition from '../components/PageTransition';

interface Notification {
  id: string;
  professor_id: string | null;
  type: 'new_video' | 'new_program' | 'platform_subscription_expiring' | 'professor_subscription_expiring' | 'platform_subscription_expired' | 'professor_subscription_expired' | 'order_paid' | 'order_processing' | 'order_shipped' | 'order_completed' | 'order_cancelled';
  title: string;
  message: string;
  link: string;
  item_id: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPageProps {
  onNavigate: (page: string) => void;
}

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      showToast('Erreur lors du chargement des notifications', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      showToast('Toutes les notifications sont marquées comme lues', 'success');
    } catch (error) {
      console.error('Error marking all as read:', error);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      showToast('Notification supprimée', 'success');
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  async function deleteAllRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_read', true);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !n.is_read));
      showToast('Notifications lues supprimées', 'success');
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    window.location.href = notification.link;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => !n.is_read);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-white">Vous devez être connecté pour voir vos notifications</p>
            <button
              onClick={() => onNavigate('signin')}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white rounded-xl hover:shadow-glow transition-all"
            >
              Se connecter
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-24 px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => onNavigate('academy')}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">Notifications</h1>
                    <p className="text-sm text-gray-400">
                      {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Tout marquer comme lu</span>
                    </button>
                  )}
                  {notifications.some(n => n.is_read) && (
                    <button
                      onClick={deleteAllRead}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Supprimer lues</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Toutes ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Non lues ({unreadCount})
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-[#B8913D]/30 border-t-[#B8913D] rounded-full animate-spin" />
                  <p className="text-gray-400 mt-4">Chargement...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 text-lg font-medium mb-2">
                    {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    Ajoutez des professeurs en favoris pour recevoir des notifications
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-6 hover:bg-white/5 transition-colors ${
                      !notification.is_read ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          notification.type === 'new_video'
                            ? 'bg-purple-500/20 text-purple-400'
                            : notification.type === 'new_program'
                            ? 'bg-green-500/20 text-green-400'
                            : notification.type === 'order_paid'
                            ? 'bg-blue-500/20 text-blue-400'
                            : notification.type === 'order_processing'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : notification.type === 'order_shipped'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : notification.type === 'order_completed'
                            ? 'bg-green-500/20 text-green-400'
                            : notification.type === 'order_cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : notification.type.includes('expiring')
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {notification.type === 'new_video' ? (
                            <Video className="w-6 h-6" />
                          ) : notification.type === 'new_program' ? (
                            <BookOpen className="w-6 h-6" />
                          ) : notification.type === 'order_paid' ? (
                            <ShoppingBag className="w-6 h-6" />
                          ) : notification.type === 'order_processing' ? (
                            <Package className="w-6 h-6" />
                          ) : notification.type === 'order_shipped' ? (
                            <Truck className="w-6 h-6" />
                          ) : notification.type === 'order_completed' ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : notification.type === 'order_cancelled' ? (
                            <XCircle className="w-6 h-6" />
                          ) : notification.type.includes('expiring') ? (
                            <Clock className="w-6 h-6" />
                          ) : (
                            <AlertTriangle className="w-6 h-6" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleNotificationClick(notification)}
                          className="text-left w-full group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className={`font-semibold group-hover:text-[#D4AC5B] transition-colors ${
                              !notification.is_read ? 'text-white' : 'text-gray-300'
                            }`}>
                              {notification.title}
                            </h3>
                            {!notification.is_read && (
                              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(notification.created_at)}
                          </p>
                        </button>
                      </div>

                      <div className="flex-shrink-0 flex flex-col gap-2">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Marquer comme lu"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
