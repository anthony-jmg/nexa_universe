import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Livraison manuelle des billets officiels (lot P0) : statut réel et
// téléchargement sécurisé dans Mes Pass, délai de 24 à 48 heures, liste Admin
// « Billets à fournir », contrôles d'éligibilité et de fichiers.

const lang = vi.hoisted(() => ({ value: 'fr' as 'fr' | 'en' }));
const state = vi.hoisted(() => ({
  attendees: [] as Record<string, unknown>[],
  count: 0,
  queries: [] as { table: string; method: string; args: unknown[] }[],
  signed: [] as unknown[][],
  signedError: null as null | { message: string },
  uploads: [] as unknown[][],
  uploadError: null as null | { message: string },
  updateError: null as null | { message: string },
  reread: null as null | Record<string, unknown>,
}));

const authValue = { user: { id: 'user-1' }, profile: { id: 'user-1', role: 'student' } };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('../../contexts/CartContext', () => ({ useCart: () => ({ clearCart: vi.fn() }) }));
vi.mock('../../contexts/LanguageContext', async () => {
  const { translate } = await import('../../i18n/translations');
  return {
    useLanguage: () => ({
      t: (key: string, params?: Record<string, string | number>) => translate(lang.value, key, params),
      language: lang.value,
    }),
  };
});
vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    let single = false;
    let op = 'select';
    for (const m of ['select', 'eq', 'in', 'neq', 'is', 'order', 'range', 'limit']) {
      b[m] = (...args: unknown[]) => { state.queries.push({ table, method: m, args }); return b; };
    }
    b.update = (...args: unknown[]) => { op = 'update'; state.queries.push({ table, method: 'update', args }); return b; };
    b.maybeSingle = () => { single = true; return b; };
    b.then = (resolve: (v: unknown) => unknown) => {
      if (op === 'update') return Promise.resolve({ error: state.updateError }).then(resolve);
      if (single) return Promise.resolve({ data: state.reread, error: null }).then(resolve);
      const data = table === 'event_attendees' ? state.attendees : [];
      return Promise.resolve({ data, error: null, count: state.count }).then(resolve);
    };
    return b;
  };
  return {
    supabase: {
      from: (table: string) => { state.queries.push({ table, method: 'from', args: [] }); return builder(table); },
      rpc: () => Promise.resolve({ data: [], error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token' } } }) },
      storage: {
        from: () => ({
          createSignedUrl: (...args: unknown[]) => {
            state.signed.push(args);
            return Promise.resolve(state.signedError
              ? { data: null, error: state.signedError }
              : { data: { signedUrl: 'https://storage.test/signed' }, error: null });
          },
          upload: (...args: unknown[]) => {
            state.uploads.push(args);
            return Promise.resolve({ error: state.uploadError });
          },
        }),
      },
    },
  };
});

import { MyPurchases } from '../../pages/MyPurchases';
import { TicketDeliveryList } from '../../components/TicketDeliveryList';
import { PAGE_SIZE, purchaseReference } from '../../lib/ticketDelivery';
import { getPassDownloadUrl, importPassPdf, isPassDelivered } from '../../lib/passService';
import { setActiveLanguage } from '../../lib/locale';

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const ticket = (id: string, checkIn: string, pass: 'pending' | 'available', file = pass === 'available') => ({
  id,
  event_id: `evt-${id}`,
  user_id: 'user-1',
  event_ticket_type_id: 'ett-1',
  qr_code: `EVT-0a1b2c3d-${id}`,
  check_in_status: checkIn,
  checked_in_at: null,
  purchased_at: future(-1),
  created_at: future(-1),
  pass_status: pass,
  pass_file_path: file ? `user-1/${id}/pass.pdf` : null,
  pass_uploaded_at: file ? future(-0.5) : null,
  weezevent_sync_status: 'pending',
  attendee_first_name: 'Ana',
  attendee_last_name: id,
  attendee_email: 'ana@example.com',
  attendee_phone: null,
  event_ticket_types: { id: 'ett-1', price: 80, ticket_types: { name: 'Full Pass' } },
  events: { id: `evt-${id}`, title: `Festival ${id}`, location: 'Lisbonne', start_date: future(30), end_date: future(31), thumbnail_url: null, event_status: 'published' },
});

const assign = vi.fn();
beforeEach(() => {
  cleanup();
  lang.value = 'fr';
  setActiveLanguage('fr');
  Object.assign(state, { attendees: [], count: 0, queries: [], signed: [], signedError: null, uploads: [], uploadError: null, updateError: null, reread: null });
  assign.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign, search: '', pathname: '/my-purchases' } });
});

const renderPasses = async () => {
  render(<MyPurchases onNavigate={vi.fn()} />);
  await screen.findByText(lang.value === 'fr' ? 'Mes billets' : 'My tickets');
};

describe('1 / 2. Mes Pass : statut réel, délai et téléchargement', () => {
  it('achat payé en attente : délai de 24 à 48 heures, aucun téléchargement', async () => {
    state.attendees = [ticket('a', 'not_checked_in', 'pending')];
    await renderPasses();
    expect(screen.getByText('Billet officiel en préparation')).toBeInTheDocument();
    expect(screen.getByText('Délivré sous 24 à 48 heures')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Billet officiel en préparation'));
    expect(screen.getByText('Paiement confirmé. Billet officiel délivré sous 24 à 48 heures.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Télécharger mon billet' })).not.toBeInTheDocument();
    expect(state.signed).toEqual([]);
  });

  it('billet délivré : lien signé de 60 s demandé pour son propre fichier, puis téléchargement', async () => {
    state.attendees = [ticket('b', 'not_checked_in', 'available')];
    await renderPasses();
    fireEvent.click(screen.getByText('Billet officiel disponible'));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mon billet' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://storage.test/signed'));
    expect(state.signed).toEqual([['user-1/b/pass.pdf', 60, { download: 'nexa-ticket.pdf' }]]);
  });

  it('lien refusé par la base (billet remboursé entre-temps) : message clair, aucune redirection', async () => {
    state.attendees = [ticket('c', 'not_checked_in', 'available')];
    state.signedError = { message: 'Object not found' };
    await renderPasses();
    fireEvent.click(screen.getByText('Billet officiel disponible'));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger mon billet' }));
    expect(await screen.findByText('Téléchargement impossible pour le moment. Réessaie dans un instant.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('billet annulé ou remboursé avec fichier : « Annulé », aucun téléchargement', async () => {
    state.attendees = [ticket('d', 'cancelled', 'available')];
    await renderPasses();
    expect(screen.getByText('Annulé')).toBeInTheDocument();
    expect(screen.queryByText('Billet officiel disponible')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Annulé'));
    expect(screen.queryByRole('button', { name: 'Télécharger mon billet' })).not.toBeInTheDocument();
    expect(screen.queryByText(/24 à 48 heures/)).not.toBeInTheDocument();
  });

  it('Price Lock, premier versement seul : ni délai annoncé, ni billet délivrable', async () => {
    state.attendees = [ticket('e', 'awaiting_balance', 'available')];
    await renderPasses();
    expect(screen.getByText('Paiement du solde en attente')).toBeInTheDocument();
    expect(screen.queryByText(/24 à 48 heures/)).not.toBeInTheDocument();
    expect(screen.queryByText('Billet officiel disponible')).not.toBeInTheDocument();
  });

  it('EN : statuts, délai et bouton traduits', async () => {
    lang.value = 'en';
    setActiveLanguage('en');
    state.attendees = [ticket('f', 'not_checked_in', 'pending'), ticket('g', 'not_checked_in', 'available')];
    await renderPasses();
    expect(screen.getByText('Official ticket being prepared')).toBeInTheDocument();
    expect(screen.getByText('Delivered within 24 to 48 hours')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Official ticket available'));
    expect(screen.getByRole('button', { name: 'Download my ticket' })).toBeInTheDocument();
  });
});

describe('2. Message après paiement complet', () => {
  const pay = async (body: unknown) => {
    window.location.search = '?payment=success&session_id=cs_1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
    render(<MyPurchases onNavigate={vi.fn()} />);
    await screen.findByText('Mes billets');
  };

  for (const type of ['order', 'price_lock_balance']) {
    it(`${type} : « Paiement confirmé. Billet officiel délivré sous 24 à 48 heures. »`, async () => {
      await pay({ success: true, payment_type: type });
      expect(screen.getByRole('status')).toHaveTextContent('Paiement confirmé. Billet officiel délivré sous 24 à 48 heures.');
    });
  }

  it('premier versement Price Lock : pas d’annonce de billet', async () => {
    await pay({ success: true, payment_type: 'price_lock_deposit' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('paiement non confirmé : pas d’annonce', async () => {
    await pay({ success: false, error: 'Paiement non rapproché' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('3. Liste Admin « Billets à fournir »', () => {
  it('ne liste que les billets payés, valides, sans fichier, d’événements non annulés, paginés', async () => {
    state.attendees = [ticket('h', 'not_checked_in', 'pending')];
    state.count = 45;
    render(<TicketDeliveryList />);
    expect(await screen.findByText('Festival h')).toBeInTheDocument();
    expect(screen.getByText('Commande 0A1B2C3D')).toBeInTheDocument();
    expect(screen.getByText('À fournir (45)')).toBeInTheDocument();
    const filters = state.queries.filter((q) => q.table === 'event_attendees').map((q) => [q.method, ...q.args]);
    expect(filters).toContainEqual(['eq', 'check_in_status', 'not_checked_in']);
    expect(filters).toContainEqual(['eq', 'pass_status', 'pending']);
    expect(filters).toContainEqual(['neq', 'events.event_status', 'cancelled']);
    expect(filters).toContainEqual(['range', 0, PAGE_SIZE - 1]);
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Suivant'));
    await screen.findByText('Page 2 / 3');
    expect(state.queries.filter((q) => q.method === 'range').map((q) => q.args)).toContainEqual([PAGE_SIZE, 2 * PAGE_SIZE - 1]);
  });

  it('onglet Délivrés : fichiers déjà fournis', async () => {
    render(<TicketDeliveryList />);
    await screen.findByText('Aucun billet à fournir.');
    fireEvent.click(screen.getByText('Délivrés'));
    await screen.findByText('Aucun billet délivré.');
    expect(state.queries.filter((q) => q.method === 'eq').map((q) => q.args)).toContainEqual(['pass_status', 'available']);
  });

  it('ajout du PDF : envoyé, rattaché, puis vérifié en base avant de l’annoncer', async () => {
    state.attendees = [ticket('i', 'not_checked_in', 'pending')];
    state.count = 1;
    state.reread = { pass_status: 'available', pass_file_path: 'user-1/i/pass.pdf' };
    render(<TicketDeliveryList />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter le PDF/ }));
    const file = new File(['%PDF-1.4'], 'billet.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('ticket-file-input'), { target: { files: [file] } });
    expect(await screen.findByText('Billet enregistré et vérifié pour Ana i.')).toBeInTheDocument();
    expect(state.uploads[0][0]).toBe('user-1/i/pass.pdf');
  });

  it('rattachement refusé par la base : erreur, jamais annoncé comme délivré', async () => {
    state.attendees = [ticket('j', 'not_checked_in', 'pending')];
    state.count = 1;
    state.updateError = { message: 'Fichier du billet introuvable dans le stockage' };
    render(<TicketDeliveryList />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter le PDF/ }));
    fireEvent.change(screen.getByTestId('ticket-file-input'), { target: { files: [new File(['%PDF'], 'b.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('introuvable dans le stockage');
    expect(screen.queryByText(/enregistré et vérifié/)).not.toBeInTheDocument();
  });

  it('références d’achat lisibles', () => {
    expect(purchaseReference('EVT-9b3aae26-d080-x')).toBe('Commande 9B3AAE26');
    expect(purchaseReference('PL-123')).toBe('Price Lock soldé');
    expect(purchaseReference('PLR-123')).toBe('Rachat Price Lock');
  });
});

describe('4 / 5 / 6. Service fichiers : éligibilité, type, taille, import interrompu', () => {
  const attendee = { id: 'k', user_id: 'user-1', pass_file_path: null, check_in_status: 'not_checked_in' };

  it('aucun lien pour un billet non délivré, annulé ou sans fichier (aucun appel au stockage)', async () => {
    for (const a of [
      { pass_status: 'pending', pass_file_path: 'x', check_in_status: 'not_checked_in' },
      { pass_status: 'available', pass_file_path: null, check_in_status: 'not_checked_in' },
      { pass_status: 'available', pass_file_path: 'x', check_in_status: 'cancelled' },
      { pass_status: 'available', pass_file_path: 'x', check_in_status: 'awaiting_balance' },
    ]) {
      expect(isPassDelivered(a)).toBe(false);
      expect(await getPassDownloadUrl(a)).toEqual({ ok: false, reason: 'not_available' });
    }
    expect(state.signed).toEqual([]);
  });

  it('billet non éligible : refusé avant tout envoi de fichier', async () => {
    for (const status of ['awaiting_balance', 'cancelled']) {
      const r = await importPassPdf({ ...attendee, check_in_status: status }, new File(['%PDF'], 'b.pdf', { type: 'application/pdf' }));
      expect(r.ok).toBe(false);
    }
    expect(state.uploads).toEqual([]);
  });

  it('type et taille contrôlés avant envoi', async () => {
    const notPdf = await importPassPdf(attendee, new File(['x'], 'b.png', { type: 'image/png' }));
    const empty = await importPassPdf(attendee, new File([], 'b.pdf', { type: 'application/pdf' }));
    const big = new File(['x'], 'b.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    const tooBig = await importPassPdf(attendee, big);
    expect([notPdf, empty, tooBig].map((r) => r.ok)).toEqual([false, false, false]);
    expect(state.uploads).toEqual([]);
  });

  it('envoi échoué : billet jamais marqué délivré (aucune mise à jour)', async () => {
    state.uploadError = { message: 'network' };
    const r = await importPassPdf(attendee, new File(['%PDF'], 'b.pdf', { type: 'application/pdf' }));
    expect(r.ok).toBe(false);
    expect(state.queries.filter((q) => q.method === 'update')).toEqual([]);
  });
});

describe('Migration (base, stockage, droits)', () => {
  const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261120120000_ticket_delivery_p0.sql'), 'utf8').replace(/--.*$/gm, '');

  it('fichier ajouté seulement sur un billet payé, valide, au bon nom, réellement stocké', () => {
    expect(sql).toMatch(/IF NEW\.pass_status = 'available' THEN\s+IF NEW\.check_in_status IS DISTINCT FROM 'not_checked_in' THEN/);
    expect(sql).toContain("e.event_status = 'cancelled'");
    expect(sql).toMatch(/NEW\.user_id::text \|\| '\/' \|\| NEW\.id::text \|\| '\/'/);
    expect(sql).toMatch(/SELECT 1 FROM storage\.objects o\s+WHERE o\.bucket_id = 'event-passes' AND o\.name = NEW\.pass_file_path/);
  });

  it('lien de téléchargement : propriétaire, billet délivré, non annulé, événement non annulé', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.can_download_event_pass'));
    for (const rule of ["a.user_id = auth.uid()", "a.pass_status = 'available'", "a.check_in_status = 'not_checked_in'", "e.event_status IS DISTINCT FROM 'cancelled'"]) {
      expect(fn).toContain(rule);
    }
    expect(sql).toMatch(/USING \(bucket_id = 'event-passes' AND public\.can_download_event_pass\(name\)\)/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.can_download_event_pass(text) FROM PUBLIC, anon;');
  });

  it('bucket : PDF uniquement, 10 Mo ; aucune donnée existante modifiée', () => {
    expect(sql).toMatch(/file_size_limit = 10485760,\s+allowed_mime_types = ARRAY\['application\/pdf'\]/);
    expect(sql).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE public\./i);
  });
});
