import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import type { ReactElement } from 'react';

// i18n LOT 5 : Academy Discovery et profils professeur Discovery en FR / EN.
// Seuls les textes d'interface changent ; le contenu saisi pour le professeur
// (nom, bio, spécialités libres, vidéos, site) n'est jamais traduit.

type Row = Record<string, unknown>;

const fiche = (id: string, fullName: string, extra: Row = {}): Row => ({
  id,
  full_name: fullName,
  avatar_url: null,
  bio: 'Danseur et pédagogue depuis vingt ans.',
  bio_en: null,
  specialties: ['kizomba', 'urban_kiz', 'Kuduro moderne'],
  experience_years: 12,
  website_url: `https://${id}.example.com/cours`,
  website_cover_image: null,
  profile_video_urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.instagram.com/reel/Cabc123/'],
  is_featured: false,
  ...extra,
});

const db: { professors: Row[] } = { professors: [] };
const inserts: { table: string; row: Record<string, unknown> }[] = [];

vi.mock('../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const filters: [string, unknown][] = [];
    let single = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit']) b[m] = () => b;
    b.eq = (column: string, value: unknown) => {
      filters.push([column, value]);
      return b;
    };
    b.maybeSingle = () => {
      single = true;
      return b;
    };
    b.insert = (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    };
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const rows = table === 'professors'
        ? db.professors.filter((r) => filters.every(([c, v]) => r[c] === v || (c === 'is_active' && r.is_active === undefined && v === true)))
        : [];
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
    };
    return b;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

import AcademyDiscovery from '../../pages/AcademyDiscovery';
import { ProfessorDiscoveryProfile } from '../../pages/ProfessorDiscoveryProfile';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { setActiveLanguage } from '../../lib/locale';
import { frenchStrings } from '../utils/hardcodedFrench';

const store = new Map<string, string>();
vi.mocked(localStorage.getItem).mockImplementation((k: string) => store.get(k) ?? null);
vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => void store.set(k, String(v)));

const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

const renderIn = (language: 'fr' | 'en', ui: ReactElement) => {
  store.clear();
  store.set('language', language);
  setActiveLanguage(language);
  return render(
    <LanguageProvider>
      <LanguageSelector />
      {ui}
    </LanguageProvider>
  );
};

const switchTo = (from: '🇫🇷' | '🇬🇧', to: 'English' | 'Français') => {
  fireEvent.click(screen.getByRole('button', { name: from }));
  fireEvent.click(screen.getByText(to));
};

const text = () => document.body.textContent ?? '';
const RAW_KEY = /\b(academy|specialty|common|nav)\.[a-z][a-zA-Z]*/;
const tracking = () => inserts.filter((i) => i.table === 'academy_click_tracking').map((i) => i.row);

beforeEach(() => {
  cleanup();
  db.professors = [];
  inserts.length = 0;
  openSpy.mockClear();
});

describe('Academy Discovery — liste', () => {
  it('1 — en français', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    renderIn('fr', <AcademyDiscovery onNavigate={vi.fn()} />);
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Progresse avec les artistes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir le profil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visiter le site' })).toBeInTheDocument();
    expect(screen.getByText('Kizomba · Urban Kiz')).toBeInTheDocument();
  });

  it('2/4/5/6/17 — FR → EN sans rechargement, cartes en anglais, aucun clic de tracking', async () => {
    db.professors = [fiche('ana', 'Ana Silva'), fiche('eva', 'Eva Featured', { is_featured: true })];
    renderIn('fr', <AcademyDiscovery onNavigate={vi.fn()} />);
    await screen.findByText('Ana Silva');
    switchTo('🇫🇷', 'English');

    expect(screen.getByText('Grow with the artists')).toBeInTheDocument();
    expect(screen.getByText('who bring dance to life.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View profile' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Visit website' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Discover the classes/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Voir le profil')).not.toBeInTheDocument();
    // Ordre, noms et spécialités inchangés
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent).slice(0, 2)).toEqual(['Eva Featured', 'Ana Silva']);
    expect(screen.getAllByText('Kizomba · Urban Kiz')).toHaveLength(2);
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    // Le changement de langue n'enregistre aucun clic
    expect(tracking()).toEqual([]);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('3 — persistance de l’anglais après rechargement', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    const first = renderIn('fr', <AcademyDiscovery onNavigate={vi.fn()} />);
    await screen.findByText('Ana Silva');
    switchTo('🇫🇷', 'English');
    first.unmount();

    setActiveLanguage('fr');
    render(
      <LanguageProvider>
        <AcademyDiscovery onNavigate={vi.fn()} />
      </LanguageProvider>
    );
    expect(await screen.findByRole('button', { name: 'View profile' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('7/15 — View profile : même navigation et même tracking', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    const onNavigate = vi.fn();
    renderIn('en', <AcademyDiscovery onNavigate={onNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View profile' }));
    expect(onNavigate).toHaveBeenCalledWith('professor-discovery-ana');
    expect(tracking()).toEqual([{ professor_id: 'ana', content_type: 'academy_profile_click', destination_url: null }]);
  });

  it('12/16 — Visit website : même URL, même tracking', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    renderIn('en', <AcademyDiscovery onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Visit website' }));
    expect(openSpy).toHaveBeenCalledWith('https://ana.example.com/cours', '_blank', 'noopener,noreferrer');
    expect(tracking()).toEqual([
      { professor_id: 'ana', content_type: 'academy_website_click', destination_url: 'https://ana.example.com/cours' },
    ]);
  });

  it('18 — état vide FR / EN', async () => {
    renderIn('fr', <AcademyDiscovery onNavigate={vi.fn()} />);
    expect(await screen.findByText('Les prochaines formations arrivent bientôt.')).toBeInTheDocument();
    switchTo('🇫🇷', 'English');
    expect(screen.getByText('New classes are coming soon.')).toBeInTheDocument();
    expect(screen.getByText('Check back soon to meet our first partner instructors.')).toBeInTheDocument();
  });

  it('les règles d’affichage restent identiques (sans site, site invalide, désactivé)', async () => {
    db.professors = [
      fiche('ana', 'Ana Silva'),
      fiche('bruno', 'Bruno Kiz', { website_url: null }),
      fiche('carla', 'Carla Semba', { website_url: 'javascript:alert(1)' }),
      fiche('diego', 'Diego Urban', { is_active: false }),
    ];
    renderIn('en', <AcademyDiscovery onNavigate={vi.fn()} />);
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    for (const hidden of ['Bruno Kiz', 'Carla Semba', 'Diego Urban']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
  });
});

describe('Profil professeur Discovery', () => {
  const renderProfile = async (language: 'fr' | 'en', id = 'ana') => {
    renderIn(language, <ProfessorDiscoveryProfile professorId={id} onNavigate={vi.fn()} />);
    await screen.findByText(language === 'en' ? /years? of experience|Instructor not found/ : /d'expérience|Professeur introuvable/);
  };

  it('9/10/11/12/13/14 — FR → EN : interface traduite, contenu du professeur inchangé', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    await renderProfile('fr');
    expect(screen.getByText("12 ans d'expérience")).toBeInTheDocument();
    expect(screen.getByText('Biographie')).toBeInTheDocument();
    expect(screen.getByText('En vidéo')).toBeInTheDocument();
    expect(screen.getByText('Voir la vidéo sur Instagram')).toBeInTheDocument();
    const iframeSrc = screen.getByTitle('Vidéo de présentation').getAttribute('src');

    switchTo('🇫🇷', 'English');
    expect(screen.getByText('12 years of experience')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visit website' })).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    // Contenu saisi : jamais traduit automatiquement
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Danseur et pédagogue depuis vingt ans.')).toBeInTheDocument();
    expect(screen.getByText('Kuduro moderne')).toBeInTheDocument();
    expect(screen.getByText('Kizomba')).toBeInTheDocument();
    expect(screen.getByText('Urban Kiz')).toBeInTheDocument();
    // Vidéos inchangées : même lecteur YouTube, même lien Instagram
    expect(screen.getByTitle('Introduction video').getAttribute('src')).toBe(iframeSrc);
    const instagram = screen.getByText('Watch the video on Instagram').closest('a')!;
    expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/reel/Cabc123/');
    expect(within(instagram).getByText('https://www.instagram.com/reel/Cabc123/')).toBeInTheDocument();
    expect(text().match(RAW_KEY)?.[0]).toBeUndefined();
    expect(tracking()).toEqual([]);
  });

  it('bio anglaise saisie par l’admin affichée en EN, sinon bio française', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { bio_en: 'Dancer and teacher for twenty years.' })];
    await renderProfile('en');
    expect(screen.getByText('Dancer and teacher for twenty years.')).toBeInTheDocument();
  });

  it('8 — 1 an / 1 year, plusieurs années', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { experience_years: 1 })];
    await renderProfile('fr');
    expect(screen.getByText("1 an d'expérience")).toBeInTheDocument();
    switchTo('🇫🇷', 'English');
    expect(screen.getByText('1 year of experience')).toBeInTheDocument();

    cleanup();
    db.professors = [fiche('ana', 'Ana Silva', { experience_years: 5 })];
    await renderProfile('en');
    expect(screen.getByText('5 years of experience')).toBeInTheDocument();
  });

  it('0 année : aucune ligne d’expérience (règle inchangée)', async () => {
    db.professors = [fiche('ana', 'Ana Silva', { experience_years: 0 })];
    renderIn('en', <ProfessorDiscoveryProfile professorId="ana" onNavigate={vi.fn()} />);
    await screen.findByText('Ana Silva');
    expect(screen.queryByText(/experience/)).not.toBeInTheDocument();
  });

  it('16 — Visit website depuis le profil : même URL, même tracking', async () => {
    db.professors = [fiche('ana', 'Ana Silva')];
    await renderProfile('en');
    fireEvent.click(screen.getByRole('button', { name: 'Visit website' }));
    expect(openSpy).toHaveBeenCalledWith('https://ana.example.com/cours', '_blank', 'noopener,noreferrer');
    expect(tracking()).toEqual([
      { professor_id: 'ana', content_type: 'academy_website_click', destination_url: 'https://ana.example.com/cours' },
    ]);
  });

  it('profil introuvable FR / EN', async () => {
    await renderProfile('fr', 'inconnu');
    expect(screen.getByText('Professeur introuvable.')).toBeInTheDocument();
    switchTo('🇫🇷', 'English');
    expect(screen.getByText('Instructor not found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('20 — écrans actifs du LOT 5', () => {
  const FILES = ['pages/AcademyDiscovery.tsx', 'pages/ProfessorDiscoveryProfile.tsx'];
  const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');

  it('aucun texte français codé en dur', () => {
    const offenders = FILES.flatMap((file) => frenchStrings(read(file)).map((s) => `${file}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('tracking et requêtes inchangés dans le code', () => {
    const list = read('pages/AcademyDiscovery.tsx');
    const profile = read('pages/ProfessorDiscoveryProfile.tsx');
    expect(list).toContain("trackAcademyClick(professor.id, 'academy_profile_click');");
    expect(list).toContain("trackAcademyClick(professor.id, 'academy_website_click', professor.website_url);");
    expect(profile).toContain("trackAcademyClick(professor.id, 'academy_website_click', professor.website_url);");
    expect(list).toContain('.select(DISCOVERY_PROFESSOR_COLUMNS)');
    expect(profile).toContain('.select(DISCOVERY_PROFESSOR_COLUMNS)');
  });

  it('nouvelles clés présentes en FR et en EN', async () => {
    const { translations } = await import('../../i18n/translations');
    const keys = Object.keys(translations.fr).filter((k) => k.startsWith('academy.') || k.startsWith('specialty.'));
    expect(keys.length).toBeGreaterThan(25);
    expect(keys.filter((k) => !translations.en[k])).toEqual([]);
  });
});
