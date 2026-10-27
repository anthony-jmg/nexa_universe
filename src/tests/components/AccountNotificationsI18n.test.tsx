import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';

// i18n LOT 6 : Mon compte et notifications en FR / EN. Les données de
// l'utilisateur et le texte des notifications (stocké en base) ne sont jamais
// traduits ; seule l'interface change de langue.

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const profile = {
  id: 'user-1',
  role: 'student',
  full_name: 'Ana Ribeiro',
  email: 'ana.ribeiro@example.com',
  avatar_url: null,
};

const notification = (id: string, isRead: boolean, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: 'user-1',
  professor_id: null,
  type: 'order_paid',
  title: `Commande payée ${id}`,
  message: `Votre commande ${id} a bien été réglée.`,
  link: '/my-purchases',
  item_id: null,
  is_read: isRead,
  created_at: createdAt,
  ...extra,
});

const db = {
  notifications: [] as Record<string, unknown>[],
  updateError: null as null | { message: string },
};
const calls: { table: string; method: string; payload?: unknown }[] = [];
const showToast = vi.fn();
const refreshProfile = vi.fn().mockResolvedValue(undefined);

// Objet stable, comme l'état réel d'AuthContext (sinon l'effet [user] se relance).
const authValue = { user: { id: 'user-1' }, profile, refreshProfile };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authValue,
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));
vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({ cancelSubscription: vi.fn(), reactivateSubscription: vi.fn() }),
}));
vi.mock('../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    let method = 'select';
    for (const m of ['select', 'eq', 'in', 'order', 'maybeSingle', 'limit']) {
      b[m] = () => {
        if (m === 'select' && method === 'select') calls.push({ table, method: 'select' });
        return b;
      };
    }
    b.update = (payload: unknown) => {
      method = 'update';
      calls.push({ table, method, payload });
      return b;
    };
    b.delete = () => {
      method = 'delete';
      calls.push({ table, method });
      return b;
    };
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const data = method === 'select' && table === 'notifications' ? db.notifications : [];
      const error = method === 'update' && table === 'profiles' ? db.updateError : null;
      return Promise.resolve({ data, error }).then(resolve, reject);
    };
    return b;
  };
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: vi.fn() };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => builder('rpc'),
      channel: () => channel,
    },
  };
});

import { Account } from '../../pages/Account';
import NotificationsPage from '../../pages/Notifications';
import NotificationDropdown from '../../components/NotificationDropdown';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { setActiveLanguage, formatDate } from '../../lib/locale';
import { frenchStrings } from '../utils/hardcodedFrench';

const store = new Map<string, string>();
vi.mocked(localStorage.getItem).mockImplementation((k: string) => store.get(k) ?? null);
vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => void store.set(k, String(v)));

const renderIn = (language: 'fr' | 'en', ui: ReactElement) => {
  store.clear();
  store.set('language', language);
  setActiveLanguage(language);
  return render(
    <LanguageProvider>
      <LanguageSelector />
      <NotificationProvider>{ui}</NotificationProvider>
    </LanguageProvider>
  );
};

const switchToEnglish = () => {
  fireEvent.click(screen.getByRole('button', { name: '🇫🇷' }));
  fireEvent.click(screen.getByText('English'));
};

const text = () => document.body.textContent ?? '';
const RAW_KEY = /\b(account|notifications|time|common|nav)\.[a-z][a-zA-Z]*/;
const writes = () => calls.filter((c) => c.method !== 'select');
const reads = (table: string) => calls.filter((c) => c.table === table && c.method === 'select').length;

beforeEach(() => {
  cleanup();
  calls.length = 0;
  showToast.mockClear();
  refreshProfile.mockClear();
  db.notifications = [];
  db.updateError = null;
});

describe('Mon compte', () => {
  it('1 — en français', () => {
    renderIn('fr', <Account onNavigate={vi.fn()} />);
    expect(screen.getByText('Paramètres du Compte')).toBeInTheDocument();
    expect(screen.getByText('Nom Complet')).toBeInTheDocument();
    expect(screen.getByText('Devenir professeur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer les Modifications' })).toBeInTheDocument();
    expect(screen.getByText('JPG, PNG, WEBP ou GIF. 5 Mo maximum.')).toBeInTheDocument();
  });

  it('2/4/5/7/15 — FR → EN sans rechargement : libellés traduits, données inchangées, aucune écriture', () => {
    renderIn('fr', <Account onNavigate={vi.fn()} />);
    switchToEnglish();
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Profile Information')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByText('Become an instructor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send my request' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe your experience, your specialties...')).toBeInTheDocument();
    expect(screen.getByTitle('Change profile picture')).toBeInTheDocument();
    // Données de l'utilisateur affichées telles quelles
    expect(screen.getByDisplayValue('Ana Ribeiro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ana.ribeiro@example.com')).toBeInTheDocument();
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    // Le changement de langue n'écrit rien
    expect(writes()).toEqual([]);
  });

  it('3 — persistance de l’anglais après rechargement', () => {
    const first = renderIn('fr', <Account onNavigate={vi.fn()} />);
    switchToEnglish();
    first.unmount();
    setActiveLanguage('fr');
    render(
      <LanguageProvider>
        <NotificationProvider>
          <Account onNavigate={vi.fn()} />
        </NotificationProvider>
      </LanguageProvider>
    );
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('6 — sauvegarde inchangée, message de succès traduit et affiché comme un succès', async () => {
    renderIn('en', <Account onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('Ana Ribeiro'), { target: { value: 'Ana R.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    const message = await screen.findByText('Profile updated successfully');
    expect(message.className).toContain('bg-green-50');
    const update = writes().find((c) => c.table === 'profiles');
    expect(update?.method).toBe('update');
    expect(update?.payload).toMatchObject({ full_name: 'Ana R.' });
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('succès en français affiché en vert (et non en rouge)', async () => {
    renderIn('fr', <Account onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les Modifications' }));
    expect((await screen.findByText('Profil mis à jour avec succès')).className).toContain('bg-green-50');
  });

  it('8 — erreur de sauvegarde traduite, jamais le message technique', async () => {
    db.updateError = { message: 'new row violates row-level security policy for table "profiles"' };
    renderIn('en', <Account onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    const message = await screen.findByText('Error updating profile');
    expect(message.className).toContain('bg-red-50');
    expect(screen.queryByText(/row-level security/)).not.toBeInTheDocument();
  });

  it('demande professeur : toasts traduits', async () => {
    renderIn('en', <Account onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send my request' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Request sent successfully!', 'success'));
  });

  it('historique de facturation : état vide FR / EN', async () => {
    renderIn('fr', <Account onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Facturation/ }));
    expect(await screen.findByText('Aucune transaction trouvée')).toBeInTheDocument();
    switchToEnglish();
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });
});

describe('Notifications', () => {
  const seed = () => {
    db.notifications = [
      notification('n1', false, ago(5 * MIN)),
      notification('n2', false, ago(3 * 60 * MIN)),
      notification('n3', true, ago(2 * DAY)),
      notification('n4', true, ago(30 * DAY)),
    ];
  };

  it('9/12/13/16 — en français : texte stocké, dates relatives, lu / non lu', async () => {
    seed();
    renderIn('fr', <NotificationsPage onNavigate={vi.fn()} />);
    expect(await screen.findByText('Commande payée n1')).toBeInTheDocument();
    expect(screen.getByText('2 non lues')).toBeInTheDocument();
    expect(screen.getByText('Toutes (4)')).toBeInTheDocument();
    expect(screen.getByText('Non lues (2)')).toBeInTheDocument();
    expect(screen.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Il y a 3 h')).toBeInTheDocument();
    expect(screen.getByText('Il y a 2 j')).toBeInTheDocument();
    setActiveLanguage('fr');
    expect(screen.getByText(formatDate(ago(30 * DAY), { day: 'numeric', month: 'long' }))).toBeInTheDocument();
    expect(screen.getAllByTitle('Marquer comme lu')).toHaveLength(2);
  });

  it('10/12/13/14/15/16 — FR → EN : interface et dates traduites, contenu, compteurs et lu/non lu inchangés', async () => {
    seed();
    renderIn('fr', <NotificationsPage onNavigate={vi.fn()} />);
    await screen.findByText('Commande payée n1');
    const readsBefore = reads('notifications');
    switchToEnglish();

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    expect(screen.getByText('All (4)')).toBeInTheDocument();
    expect(screen.getByText('Unread (2)')).toBeInTheDocument();
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
    expect(screen.getByText('3 h ago')).toBeInTheDocument();
    expect(screen.getByText('2 d ago')).toBeInTheDocument();
    setActiveLanguage('en');
    expect(screen.getByText(formatDate(ago(30 * DAY), { day: 'numeric', month: 'long' }))).toBeInTheDocument();
    expect(screen.getAllByTitle('Mark as read')).toHaveLength(2);
    expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    // Texte stocké en base : affiché tel quel, jamais traduit
    expect(screen.getByText('Commande payée n1')).toBeInTheDocument();
    expect(screen.getByText('Votre commande n2 a bien été réglée.')).toBeInTheDocument();
    // Aucune requête ni écriture supplémentaire au changement de langue
    expect(reads('notifications')).toBe(readsBefore);
    expect(writes()).toEqual([]);
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
  });

  it('marquer comme lu : même mise à jour, toast traduit', async () => {
    seed();
    renderIn('en', <NotificationsPage onNavigate={vi.fn()} />);
    await screen.findByText('Commande payée n1');
    fireEvent.click(screen.getByText('Mark all as read'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('All notifications marked as read', 'success'));
    expect(writes()).toEqual([{ table: 'notifications', method: 'update', payload: { is_read: true } }]);
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('11 — aucune notification : FR et EN', async () => {
    renderIn('fr', <NotificationsPage onNavigate={vi.fn()} />);
    expect(await screen.findByText('Aucune notification')).toBeInTheDocument();
    expect(screen.getByText('Tout est lu')).toBeInTheDocument();
    switchToEnglish();
    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText('Add instructors to your favourites to receive notifications')).toBeInTheDocument();
  });

  it('menu déroulant : FR → EN, compteur inchangé, texte stocké inchangé', async () => {
    seed();
    renderIn('fr', <NotificationDropdown />);
    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await waitFor(() => expect(within(bell).getByText('2')).toBeInTheDocument());
    fireEvent.click(bell);
    expect(screen.getByText('Tout lire')).toBeInTheDocument();
    expect(screen.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Voir toutes les notifications')).toBeInTheDocument();

    switchToEnglish();
    // Menu toujours ouvert (aucun mousedown extérieur) : il se traduit sur place
    expect(within(screen.getByRole('button', { name: 'Notifications' })).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Read all')).toBeInTheDocument();
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
    expect(screen.getByText('View all notifications')).toBeInTheDocument();
    expect(screen.getByText('Commande payée n1')).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('menu déroulant vide : FR / EN', async () => {
    renderIn('en', <NotificationDropdown />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });
});

describe('18 — écrans actifs du LOT 6', () => {
  const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');

  // Onglet « Abonnements » (abonnements professeurs de l'ancienne Academy)
  // exclu : laissé en l'état, voir rapport du LOT 6.
  const withoutSubscriptionTab = (code: string) => {
    const from = code.indexOf("{activeTab === 'subscription' && (");
    const to = code.indexOf("{activeTab === 'billing' && (");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return code.slice(0, from) + code.slice(to);
  };

  it('aucun texte français codé en dur', () => {
    const files: [string, string][] = [
      ['pages/Account.tsx', withoutSubscriptionTab(read('pages/Account.tsx'))],
      ['components/AvatarUpload.tsx', read('components/AvatarUpload.tsx')],
      ['pages/Notifications.tsx', read('pages/Notifications.tsx')],
      ['components/NotificationDropdown.tsx', read('components/NotificationDropdown.tsx')],
      ['contexts/NotificationContext.tsx', read('contexts/NotificationContext.tsx')],
      ['lib/relativeTime.ts', read('lib/relativeTime.ts')],
    ];
    const offenders = files.flatMap(([file, code]) => frenchStrings(code).map((s) => `${file}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('plus de fr-FR, de toFixed ni de « € » ajouté à la main', () => {
    for (const file of ['pages/Notifications.tsx', 'components/NotificationDropdown.tsx', 'components/AvatarUpload.tsx']) {
      expect(read(file), file).not.toMatch(/'fr-FR'|toLocaleDateString|\.toFixed\(|€/);
    }
    const account = withoutSubscriptionTab(read('pages/Account.tsx'));
    expect(account).not.toMatch(/'fr-FR'|getActiveLocale\(\)|\.toFixed\(|\}\s*€/);
  });

  it('nouvelles clés présentes en FR et en EN', async () => {
    const { translations } = await import('../../i18n/translations');
    // Clés ajoutées au LOT 6 (les anciennes clés account.subscription.* restent hors lot).
    const keys = Object.keys(translations.fr).filter((k) =>
      /^(account\.(avatar|request|professor|billing\.(empty|type|status|subscriptionItem|orderItem|orderMany|orderOne|detail|totalPaid|reference))|notifications\.|time\.)/.test(k)
    );
    expect(keys.length).toBeGreaterThan(65);
    expect(keys.filter((k) => !translations.en[k])).toEqual([]);
  });
});
