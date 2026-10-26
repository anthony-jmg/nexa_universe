import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const calls: { table: string; method: string; payload?: unknown; eq?: unknown[] }[] = [];

vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const call: { table: string; method: string; payload?: unknown; eq?: unknown[] } = { table, method: '' };
    const b: Record<string, unknown> = {
      insert: (payload: unknown) => { call.method = 'insert'; call.payload = payload; calls.push(call); return b; },
      update: (payload: unknown) => { call.method = 'update'; call.payload = payload; calls.push(call); return b; },
      eq: (...args: unknown[]) => { call.eq = args; return b; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => Promise.resolve({ data: [{ professor_id: 'p1', profile_clicks: 4, website_clicks: 2 }], error: null }),
    },
  };
});

// Upload d'image remplacé par un champ texte (le vrai composant envoie vers le stockage).
vi.mock('../../components/ImageUpload', () => ({
  ImageUpload: ({ label, currentImageUrl, onImageUrlChange }: { label: string; currentImageUrl: string; onImageUrlChange: (v: string) => void }) => (
    <input aria-label={label} value={currentImageUrl} onChange={(e) => onImageUrlChange(e.target.value)} />
  ),
}));

import { ProfessorDiscoveryManagement } from '../../pages/Admin';
import { isProfessorDraftDirty, type ProfessorDraft } from '../../lib/professorDraft';

const professor = (extra: Record<string, unknown> = {}) => ({
  id: 'p1',
  profile_id: null,
  full_name: 'Ana Silva',
  avatar_url: null,
  bio: 'Bio',
  specialties: ['Kizomba'],
  experience_years: 10,
  website_url: 'https://ana.example.com',
  website_cover_image: null,
  profile_video_urls: [],
  is_featured: false,
  is_founder: false,
  is_active: true,
  profiles: null,
  ...extra,
});

// Reproduit Admin : le brouillon vit dans le parent, et l'onglet Professeurs
// est démonté quand on change d'onglet.
let latestDraft: ProfessorDraft | null = null;
function AdminTabs({ professors, onRefresh, setError, setSuccess }: {
  professors: unknown[];
  onRefresh: () => Promise<void>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'professors' | 'orders'>('professors');
  const [draft, setDraft] = useState<ProfessorDraft | null>(null);
  latestDraft = draft;
  return (
    <>
      <button onClick={() => setTab('orders')}>Onglet Commandes</button>
      <button onClick={() => setTab('professors')}>Onglet Professeurs</button>
      {tab === 'professors' ? (
        <ProfessorDiscoveryManagement
          professors={professors as never}
          onRefresh={onRefresh}
          setError={setError}
          setSuccess={setSuccess}
          createDraft={draft}
          onCreateDraftChange={setDraft}
        />
      ) : (
        <p>Commandes</p>
      )}
    </>
  );
}

const setup = (professors: unknown[] = [professor()]) => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const setError = vi.fn();
  const setSuccess = vi.fn();
  render(<AdminTabs professors={professors} onRefresh={onRefresh} setError={setError} setSuccess={setSuccess} />);
  return { onRefresh, setError, setSuccess };
};

const switchTabAndBack = () => {
  fireEvent.click(screen.getByText('Onglet Commandes'));
  expect(screen.queryByText('Nouveau professeur')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Onglet Professeurs'));
};

const fill = (placeholder: string | RegExp, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

beforeEach(() => {
  calls.length = 0;
  latestDraft = null;
  vi.restoreAllMocks();
});

describe('Admin — Professeurs Discovery', () => {
  it('crée une fiche sans compte utilisateur (aucun id ni profile_id envoyé)', async () => {
    const { onRefresh, setError } = setup([]);

    fireEvent.click(screen.getByText('Ajouter un professeur'));
    fill('Prénom Nom', '  Bruno Kiz ');
    fireEvent.change(screen.getByLabelText('Photo du professeur'), { target: { value: 'https://cdn.example.com/bruno.webp' } });
    fill('https://monsiteprof.com', 'https://bruno.example.com');
    fireEvent.click(screen.getByText('Ajouter une vidéo'));
    fill(/youtube\.com\/watch/, 'https://www.youtube.com/live/dQw4w9WgXcQ');
    fireEvent.click(screen.getByLabelText(/Mettre en avant/));
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(setError).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'professors', method: 'insert' });
    const payload = calls[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      full_name: 'Bruno Kiz',
      avatar_url: 'https://cdn.example.com/bruno.webp',
      website_url: 'https://bruno.example.com',
      profile_video_urls: ['https://www.youtube.com/live/dQw4w9WgXcQ'],
      is_featured: true,
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('profile_id');
  });

  it('exige un nom', async () => {
    const { setError } = setup([]);
    fireEvent.click(screen.getByText('Ajouter un professeur'));
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(setError).toHaveBeenCalledWith('Le nom du professeur est obligatoire');
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['URL sans protocole', 'youtube.com/watch?v=dQw4w9WgXcQ', /https:\/\//],
    ['Vimeo', 'https://vimeo.com/1', /seules les vidéos YouTube/],
    ['profil Instagram', 'https://www.instagram.com/ana/', /seules les vidéos YouTube/],
    ['identifiant YouTube invalide', 'https://youtu.be/abc', /seules les vidéos YouTube/],
  ])('refuse une vidéo invalide (%s) avec un message clair', async (_label, url, message) => {
    const { setError } = setup();
    fireEvent.click(screen.getByTitle('Modifier'));
    fireEvent.click(screen.getByText('Ajouter une vidéo'));
    fill(/youtube\.com\/watch/, url);

    // Message affiché sous le champ dès la saisie
    expect(screen.getByText(message)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Enregistrer'));
    // Rien n'est enregistré : refus par la validation (ou, pour une URL sans
    // protocole, déjà par le navigateur car le champ est de type url).
    expect(calls).toHaveLength(0);
    for (const [msg] of setError.mock.calls) expect(msg).toMatch(message);
  });

  it('modifie une fiche existante', async () => {
    const { onRefresh } = setup();
    fireEvent.click(screen.getByTitle('Modifier'));
    fireEvent.change(screen.getByPlaceholderText('Présentation du professeur...'), { target: { value: 'Nouvelle bio' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(calls[0]).toMatchObject({ table: 'professors', method: 'update', eq: ['id', 'p1'] });
    expect(calls[0].payload).toMatchObject({ bio: 'Nouvelle bio', full_name: 'Ana Silva' });
  });

  it('désactive puis réactive une fiche, sans bouton de suppression', async () => {
    const { onRefresh } = setup([professor(), professor({ id: 'p2', full_name: 'Off', is_active: false })]);

    expect(screen.queryByText(/Supprimer/)).not.toBeInTheDocument();
    expect(screen.getByText('Désactivé')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Désactiver'));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(calls[0]).toMatchObject({ method: 'update', payload: { is_active: false }, eq: ['id', 'p1'] });

    fireEvent.click(screen.getByText('Réactiver'));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
    expect(calls[1]).toMatchObject({ method: 'update', payload: { is_active: true }, eq: ['id', 'p2'] });
  });

  it('affiche les clics profil / site par professeur', async () => {
    setup();
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  describe('brouillon « Ajouter un professeur »', () => {
    const fillDraft = () => {
      fireEvent.click(screen.getByText('Ajouter un professeur'));
      fill('Prénom Nom', 'Carla Semba');
      fill('Présentation du professeur...', 'Bio en cours');
      fill('https://monsiteprof.com', 'https://carla.example.com');
      fill('Ajouter une spécialité (ex: Kizomba)', 'Semba');
      fireEvent.click(screen.getByText('Ajouter une vidéo'));
      fill(/youtube\.com\/watch/, 'https://youtu.be/dQw4w9WgXcQ');
      fireEvent.click(screen.getByLabelText(/Mettre en avant/));
    };

    it('survit au changement d’onglet : formulaire rouvert avec les données saisies', () => {
      setup([]);
      fillDraft();
      switchTabAndBack();

      expect(screen.getByText('Nouveau professeur')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Prénom Nom')).toHaveValue('Carla Semba');
      expect(screen.getByPlaceholderText('Présentation du professeur...')).toHaveValue('Bio en cours');
      expect(screen.getByPlaceholderText('https://monsiteprof.com')).toHaveValue('https://carla.example.com');
      expect(screen.getByPlaceholderText(/youtube\.com\/watch/)).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
      expect(screen.getByLabelText(/Mettre en avant/)).toBeChecked();
      expect(calls).toHaveLength(0); // rien n'est enregistré en base
      expect(latestDraft).toMatchObject({ full_name: 'Carla Semba', is_active: true, is_featured: true });
    });

    it('Annuler demande confirmation et garde le brouillon si l’on refuse', () => {
      setup([]);
      fillDraft();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      fireEvent.click(screen.getByText('Annuler'));

      expect(confirm).toHaveBeenCalled();
      expect(screen.getByText('Nouveau professeur')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Prénom Nom')).toHaveValue('Carla Semba');
    });

    it('Annuler confirmé vide le brouillon', () => {
      setup([]);
      fillDraft();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByText('Annuler'));

      expect(screen.queryByText('Nouveau professeur')).not.toBeInTheDocument();
      expect(latestDraft).toBeNull();
      switchTabAndBack();
      expect(screen.queryByText('Nouveau professeur')).not.toBeInTheDocument();
    });

    it('Annuler sans saisie ferme sans confirmation', () => {
      setup([]);
      const confirm = vi.spyOn(window, 'confirm');
      fireEvent.click(screen.getByText('Ajouter un professeur'));
      fireEvent.click(screen.getByText('Annuler'));
      expect(confirm).not.toHaveBeenCalled();
      expect(screen.queryByText('Nouveau professeur')).not.toBeInTheDocument();
    });

    it('une création réussie vide le brouillon, ferme le formulaire et recharge la liste', async () => {
      const { onRefresh } = setup([]);
      fillDraft();
      switchTabAndBack();
      fireEvent.click(screen.getByText('Enregistrer'));

      await waitFor(() => expect(onRefresh).toHaveBeenCalled());
      expect(calls[0]).toMatchObject({ method: 'insert', payload: { full_name: 'Carla Semba', is_active: true } });
      expect(latestDraft).toBeNull();
      expect(screen.queryByText('Nouveau professeur')).not.toBeInTheDocument();
    });

    it('modifier une fiche existante n’efface pas le brouillon de création', async () => {
      const { onRefresh } = setup();
      fillDraft();
      fireEvent.click(screen.getByTitle('Modifier'));
      // Formulaire d'édition chargé avec la fiche existante
      expect(screen.getByPlaceholderText('Prénom Nom')).toHaveValue('Ana Silva');
      fireEvent.click(screen.getByText('Enregistrer'));

      await waitFor(() => expect(onRefresh).toHaveBeenCalled());
      expect(calls[0]).toMatchObject({ method: 'update', eq: ['id', 'p1'], payload: { full_name: 'Ana Silva' } });
      // Le brouillon de création est rouvert intact
      expect(screen.getByText('Nouveau professeur')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Prénom Nom')).toHaveValue('Carla Semba');
      expect(latestDraft).toMatchObject({ full_name: 'Carla Semba' });
    });

    it('détecte un brouillon modifié (avertissement avant de quitter la page)', () => {
      setup([]);
      fireEvent.click(screen.getByText('Ajouter un professeur'));
      expect(isProfessorDraftDirty(latestDraft)).toBe(false);
      fill('Prénom Nom', 'C');
      expect(isProfessorDraftDirty(latestDraft)).toBe(true);
      expect(isProfessorDraftDirty(null)).toBe(false);
    });
  });
});
