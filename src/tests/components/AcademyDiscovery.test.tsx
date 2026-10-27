import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

type Row = Record<string, unknown>;

const fiche = (id: string, fullName: string, extra: Row = {}): Row => ({
  id,
  full_name: fullName,
  avatar_url: null,
  bio: 'Danseur et pédagogue.',
  specialties: ['kizomba', 'urban_kiz'],
  experience_years: 12,
  website_url: `https://${id}.example.com`,
  website_cover_image: null,
  profile_video_urls: [],
  is_featured: false,
  ...extra,
});

const db: { professors: Row[]; insertMode: 'ok' | 'error' | 'throw' } = { professors: [], insertMode: 'ok' };
const queries: { table: string; method: string; args: unknown[] }[] = [];
const inserts: { table: string; row: unknown }[] = [];

vi.mock('../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const filters: [string, unknown][] = [];
    let single = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        queries.push({ table, method: m, args });
        return b;
      };
    }
    b.eq = (column: string, value: unknown) => {
      queries.push({ table, method: 'eq', args: [column, value] });
      filters.push([column, value]);
      return b;
    };
    b.maybeSingle = () => {
      single = true;
      return b;
    };
    b.insert = (row: unknown) => {
      inserts.push({ table, row });
      if (db.insertMode === 'throw') throw new Error('network down');
      return Promise.resolve({ error: db.insertMode === 'error' ? { message: 'boom' } : null });
    };
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const rows = table === 'professors'
        ? db.professors.filter((r) => filters.every(([c, v]) => r[c] === v || (c === 'is_active' && r.is_active === undefined && v === true)))
        : [];
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
    };
    return b;
  };
  return {
    supabase: {
      from: (table: string) => {
        queries.push({ table, method: 'from', args: [] });
        return builder(table);
      },
    },
  };
});

import AcademyDiscovery from '../../pages/AcademyDiscovery';
import { ProfessorDiscoveryProfile } from '../../pages/ProfessorDiscoveryProfile';
import { LanguageProvider } from '../../contexts/LanguageContext';
import type { ReactElement } from 'react';

const renderWithLanguage = (ui: ReactElement) => render(ui, { wrapper: LanguageProvider });

// Langue mémorisée lue par LanguageProvider au montage (FR par défaut).
const useSavedLanguage = (language: 'fr' | 'en') =>
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === 'language' ? language : null));
afterEach(() => vi.mocked(localStorage.getItem).mockReset());

const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

beforeEach(() => {
  db.professors = [];
  db.insertMode = 'ok';
  queries.length = 0;
  inserts.length = 0;
  openSpy.mockClear();
});

const tables = () => new Set(queries.filter((q) => q.method === 'from').map((q) => q.table));

describe('AcademyDiscovery — liste', () => {
  it('affiche uniquement les fiches actives avec un site valide, sans lire profiles', async () => {
    db.professors = [
      fiche('ana', 'Ana Silva'),
      fiche('bruno', 'Bruno Kiz', { website_url: null }),
      fiche('carla', 'Carla Semba', { website_url: 'javascript:alert(1)' }),
      fiche('diego', 'Diego Urban', { is_active: false }),
      fiche('eva', 'Eva Featured', { is_featured: true }),
    ];
    renderWithLanguage(<AcademyDiscovery onNavigate={vi.fn()} />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Eva Featured')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Kiz')).not.toBeInTheDocument();
    expect(screen.queryByText('Carla Semba')).not.toBeInTheDocument();
    expect(screen.queryByText('Diego Urban')).not.toBeInTheDocument();
    // Fiche mise en avant en premier
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent).slice(0, 2)).toEqual(['Eva Featured', 'Ana Silva']);
    expect(queries).toContainEqual({ table: 'professors', method: 'eq', args: ['is_active', true] });
    expect([...tables()]).toEqual(['professors']);
  });

  it('ne rend pas son propre Header (déjà rendu par App)', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    const { container } = renderWithLanguage(<AcademyDiscovery onNavigate={vi.fn()} />);
    await screen.findByText('Ana Silva');
    expect(container.querySelectorAll('header')).toHaveLength(0);
  });

  it('« Voir le profil » ouvre le profil Discovery et enregistre academy_profile_click', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    const onNavigate = vi.fn();
    renderWithLanguage(<AcademyDiscovery onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByText('Voir le profil'));

    expect(onNavigate).toHaveBeenCalledWith('professor-discovery-ana');
    expect(inserts).toEqual([
      { table: 'academy_click_tracking', row: { professor_id: 'ana', content_type: 'academy_profile_click', destination_url: null } },
    ]);
  });

  it('« Visiter le site » ouvre le site et enregistre academy_website_click', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    renderWithLanguage(<AcademyDiscovery onNavigate={vi.fn()} />);

    fireEvent.click(await screen.findByText('Visiter le site'));

    expect(openSpy).toHaveBeenCalledWith('https://ana.example.com', '_blank', 'noopener,noreferrer');
    expect(inserts).toEqual([
      { table: 'academy_click_tracking', row: { professor_id: 'ana', content_type: 'academy_website_click', destination_url: 'https://ana.example.com' } },
    ]);
  });

  it.each(['error', 'throw'] as const)('le tracking en échec (%s) ne bloque pas la navigation', async (mode) => {
    db.professors = [fiche('ana', 'Ana Silva')];
    db.insertMode = mode;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onNavigate = vi.fn();
    renderWithLanguage(<AcademyDiscovery onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByText('Voir le profil'));
    fireEvent.click(screen.getByText('Visiter le site'));

    expect(onNavigate).toHaveBeenCalledWith('professor-discovery-ana');
    expect(openSpy).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('ProfessorDiscoveryProfile', () => {
  const renderProfile = async (id = 'ana') => {
    renderWithLanguage(<ProfessorDiscoveryProfile professorId={id} onNavigate={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  };

  it('affiche la fiche publique éligible (nom, expérience, spécialités, bio, site) sans lire profiles', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { avatar_url: 'https://cdn.example.com/ana.webp' })];
    await renderProfile();

    expect(screen.getByRole('heading', { level: 1, name: 'Ana Silva' })).toBeInTheDocument();
    expect(screen.getByText("12 ans d'expérience")).toBeInTheDocument();
    expect(screen.getByText('Urban Kiz')).toBeInTheDocument();
    expect(screen.getByText('Danseur et pédagogue.')).toBeInTheDocument();
    expect(screen.getByAltText('Ana Silva')).toHaveAttribute('src', 'https://cdn.example.com/ana.webp');
    expect(queries).toContainEqual({ table: 'professors', method: 'eq', args: ['is_active', true] });
    expect([...tables()]).toEqual(['professors']);

    fireEvent.click(screen.getByText('Visiter le site'));
    expect(openSpy).toHaveBeenCalledWith('https://ana.example.com', '_blank', 'noopener,noreferrer');
    expect(inserts[0]).toEqual({
      table: 'academy_click_tracking',
      row: { professor_id: 'ana', content_type: 'academy_website_click', destination_url: 'https://ana.example.com' },
    });
  });

  it.each([
    ['sans site', { website_url: null }],
    ['site javascript:', { website_url: 'javascript:alert(1)' }],
    ['désactivé', { is_active: false }],
  ])('refuse un profil non éligible (%s)', async (_label, extra) => {
    db.professors = [fiche('ana', 'Ana Silva', extra)];
    await renderProfile();
    expect(screen.getByText('Professeur introuvable.')).toBeInTheDocument();
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument();
  });

  it('refuse un identifiant inconnu (lien direct)', async () => {
    db.professors = [];
    await renderProfile('inconnu');
    expect(screen.getByText('Professeur introuvable.')).toBeInTheDocument();
  });

  it('0 vidéo : pas de section vidéo', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    await renderProfile();
    expect(screen.queryByText('En vidéo')).not.toBeInTheDocument();
  });

  it('1 vidéo YouTube : un lecteur intégré', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { profile_video_urls: ['https://youtu.be/dQw4w9WgXcQ'] })];
    await renderProfile();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('3 vidéos (watch, Shorts, Instagram) et URL invalide ignorée', async () => {
    db.professors = [fiche('ana', 'Ana Silva', {
      profile_video_urls: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'https://www.instagram.com/reel/C1abcdEF/',
        'https://vimeo.com/1',
      ],
    })];
    await renderProfile();
    expect(document.querySelectorAll('iframe')).toHaveLength(2);
    expect(screen.getByText('Voir la vidéo sur Instagram')).toBeInTheDocument();
  });

  it('un profil Instagram (non vidéo) n’est pas présenté comme vidéo', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { profile_video_urls: ['https://www.instagram.com/ana.silva/'] })];
    await renderProfile();
    expect(screen.queryByText('Voir la vidéo sur Instagram')).not.toBeInTheDocument();
    expect(screen.queryByText('En vidéo')).not.toBeInTheDocument();
  });
});

describe('Academy Discovery — contenus bilingues', () => {
  const renderProfile = async () => {
    renderWithLanguage(<ProfessorDiscoveryProfile professorId="ana" onNavigate={vi.fn()} />);
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
  };

  it('FR : biographie française et libellés de spécialités', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { bio_en: 'Dancer and teacher.' })];
    await renderProfile();
    expect(screen.getByText('Danseur et pédagogue.')).toBeInTheDocument();
    expect(screen.queryByText('Dancer and teacher.')).not.toBeInTheDocument();
    expect(screen.getByText('Kizomba')).toBeInTheDocument();
    expect(screen.getByText('Urban Kiz')).toBeInTheDocument();
    expect(screen.queryByText('urban_kiz')).not.toBeInTheDocument();
  });

  it('EN renseigné : biographie anglaise', async () => {
    useSavedLanguage('en');
    db.professors = [fiche('ana', 'Ana Silva', { bio_en: 'Dancer and teacher.' })];
    await renderProfile();
    expect(screen.getByText('Dancer and teacher.')).toBeInTheDocument();
    expect(screen.queryByText('Danseur et pédagogue.')).not.toBeInTheDocument();
  });

  it('EN absent ou vide : repli sur la biographie française', async () => {
    useSavedLanguage('en');
    db.professors = [fiche('ana', 'Ana Silva', { bio_en: '   ' })];
    await renderProfile();
    expect(screen.getByText('Danseur et pédagogue.')).toBeInTheDocument();
  });

  it('la liste affiche les libellés des spécialités, jamais les codes', async () => {
    useSavedLanguage('en');
    db.professors = [fiche('ana', 'Ana Silva', { specialties: ['afro_house', 'semba'] })];
    renderWithLanguage(<AcademyDiscovery onNavigate={vi.fn()} />);
    expect(await screen.findByText('Afro House · Semba')).toBeInTheDocument();
  });

  it('une ancienne spécialité libre (hors codes) reste affichée telle quelle', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { specialties: ['Kuduro'] })];
    await renderProfile();
    expect(screen.getByText('Kuduro')).toBeInTheDocument();
  });
});
