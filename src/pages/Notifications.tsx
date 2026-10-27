import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Video, BookOpen, ArrowLeft, AlertTriangle, Clock, ShoppingBag, Package, Truck, CheckCircle, XCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification } from '../contexts/NotificationContext';
import PageTransition from '../components/PageTransition';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRelativeTime } from '../lib/relativeTime';

interface NotificationsPageProps {
  onNavigate: (page: string) => void;
}

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, deleteAllRead } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    window.location.href = notification.link;
  }

  // Au-delà de 7 jours : date longue, année affichée seulement si différente.
  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return formatRelativeTime(date, t, {
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
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
            <p className="text-white">{t('notifications.signInRequired')}</p>
            <button
              onClick={() => onNavigate('signin')}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white rounded-xl hover:shadow-glow transition-all"
            >
              {t('nav.signIn')}
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
            {t('common.back')}
          </button>

          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{t('notifications.title')}</h1>
                    <p className="text-sm text-gray-400">
                      {unreadCount > 0 ? t(unreadCount > 1 ? 'notifications.unread.other' : 'notifications.unread.one', { count: unreadCount }) : t('notifications.allRead')}
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
                      <span className="hidden sm:inline">{t('notifications.markAllRead')}</span>
                    </button>
                  )}
                  {notifications.some(n => n.is_read) && (
                    <button
                      onClick={deleteAllRead}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('notifications.deleteRead')}</span>
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
                  {t('notifications.filterAll', { count: notifications.length })}
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('notifications.filterUnread', { count: unreadCount })}
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-[#B8913D]/30 border-t-[#B8913D] rounded-full animate-spin" />
                  <p className="text-gray-400 mt-4">{t('notifications.loading')}</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 text-lg font-medium mb-2">
                    {filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {t('notifications.emptyHint')}
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
                            : notification.type === 'professor_approved'
                            ? 'bg-green-500/20 text-green-400'
                            : notification.type === 'professor_rejected'
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
                          ) : notification.type === 'professor_approved' ? (
                            <GraduationCap className="w-6 h-6" />
                          ) : notification.type === 'professor_rejected' ? (
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
                            title={t('notifications.markRead')}
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
                          title={t('notifications.delete')}
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
