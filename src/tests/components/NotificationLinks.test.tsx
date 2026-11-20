import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Notification « billet disponible » : le clic mène à Mes Pass. La table
// notifications n'a pas de colonne « link » : sans destination connue, aucune
// navigation (avant : « /undefined »).

const notif = vi.hoisted(() => ({
  list: [] as Record<string, unknown>[],
  markAsRead: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../../contexts/LanguageContext', async () => {
  const { translate } = await import('../../i18n/translations');
  return { useLanguage: () => ({ t: (k: string, p?: Record<string, string | number>) => translate('fr', k, p), language: 'fr' }) };
});
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: notif.list,
    unreadCount: notif.list.length,
    loading: false,
    markAsRead: notif.markAsRead,
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    deleteAllRead: vi.fn(),
  }),
}));

import NotificationDropdown from '../../components/NotificationDropdown';
import NotificationsPage from '../../pages/Notifications';
import { notificationPath } from '../../lib/notificationLinks';

const notification = (type: string, title: string) => ({
  id: `n-${type}`,
  type,
  title,
  message: 'Message',
  item_id: 'att-1',
  is_read: false,
  created_at: new Date().toISOString(),
});

let href = '/notifications';
beforeEach(() => {
  cleanup();
  notif.markAsRead.mockReset();
  href = '/notifications';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { get href() { return href; }, set href(v: string) { href = v; }, pathname: '/notifications', search: '' },
  });
});

describe('Destination des notifications', () => {
  it('« billet disponible » → Mes Pass ; type inconnu → aucune destination', () => {
    expect(notificationPath({ type: 'pass_available' })).toBe('/my-purchases');
    expect(notificationPath({ type: 'order_paid' })).toBeNull();
  });

  it('cloche : clic sur « billet disponible » → marquée lue et ouverture de Mes Pass', () => {
    notif.list = [notification('pass_available', 'Ton billet officiel est disponible')];
    render(<NotificationDropdown />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getByText('Ton billet officiel est disponible'));
    expect(notif.markAsRead).toHaveBeenCalledWith('n-pass_available');
    expect(href).toBe('/my-purchases');
  });

  it('page Notifications : même destination, et plus jamais « /undefined »', () => {
    notif.list = [
      notification('pass_available', 'Ton billet officiel est disponible'),
      notification('order_paid', 'Commande payée'),
    ];
    render(<NotificationsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText('Commande payée'));
    expect(href).toBe('/notifications');
    expect(notif.markAsRead).toHaveBeenCalledWith('n-order_paid');
    fireEvent.click(screen.getByText('Ton billet officiel est disponible'));
    expect(href).toBe('/my-purchases');
  });

  it('texte en base : renvoie à « Mes Pass », plus à « Mes achats »', () => {
    const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261120120000_ticket_delivery_p0.sql'), 'utf8');
    const fn = sql.slice(sql.indexOf('FUNCTION public.notify_pass_available'));
    expect(fn).toContain("'Ton billet officiel est disponible. Télécharge-le dans « Mes Pass ».'");
    expect(fn).not.toContain('Mes achats');
  });
});
