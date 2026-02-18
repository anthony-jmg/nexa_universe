import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface Notification {
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

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (mounted) setNotifications(data || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          if (mounted) {
            setNotifications(prev => [newNotification, ...prev]);
            showToast(newNotification.title, 'success');
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n)
      );
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const markAllAsRead = async () => {
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;
      showToast('Toutes les notifications sont marquées comme lues', 'success');
    } catch (error) {
      console.error('Error marking all as read:', error);
      setNotifications(previous);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const previous = notifications;
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;
      showToast('Notification supprimée', 'success');
    } catch (error) {
      console.error('Error deleting notification:', error);
      setNotifications(previous);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const deleteAllRead = async () => {
    const previous = notifications;
    setNotifications(prev => prev.filter(n => !n.is_read));

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_read', true);

      if (error) throw error;
      showToast('Notifications lues supprimées', 'success');
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      setNotifications(previous);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
