import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Fonctionnalité « Favoris » de l'ancienne Academy retirée de l'interface
// publique : plus de bouton dans l'en-tête (desktop et mobile), plus de route.

const auth = vi.hoisted(() => ({
  value: {
    user: { id: 'user-1' } as { id: string } | null,
    profile: { id: 'user-1', role: 'student', full_name: 'Ana Ribeiro' } as Record<string, unknown> | null,
    signOut: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../../contexts/CartContext', () => ({ useCart: () => ({ getCartCount: () => 0 }) }));
vi.mock('../../components/NotificationDropdown', () => ({ default: () => <span>cloche</span> }));
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0 }),
}));

import { Header } from '../../components/Header';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { parseAppPath } from '../../lib/appRoutes';

const renderHeader = (onNavigate = vi.fn()) =>
  render(
    <LanguageProvider>
      <Header onNavigate={onNavigate} currentPage="shop" />
    </LanguageProvider>
  );

const openMobileMenu = () => {
  // Bouton burger du menu mobile (affiché sous le point de rupture md).
  const toggle = document.querySelector('button.md\\:hidden');
  expect(toggle).not.toBeNull();
  fireEvent.click(toggle!);
  expect(document.querySelector('div.md\\:hidden')).not.toBeNull();
};

beforeEach(() => {
  cleanup();
  auth.value.user = { id: 'user-1' };
  auth.value.profile = { id: 'user-1', role: 'student', full_name: 'Ana Ribeiro' };
});

describe('En-tête sans Favoris', () => {
  it('desktop et mobile : aucun bouton Favoris, aucune navigation vers favorites', () => {
    const onNavigate = vi.fn();
    renderHeader(onNavigate);
    openMobileMenu();
    expect(screen.queryByText('Favoris')).not.toBeInTheDocument();
    expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
    // Les autres entrées du menu sont toujours là
    expect(screen.getAllByText('Panier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mes Pass').length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole('button')) fireEvent.click(button);
    expect(onNavigate.mock.calls.map(([page]) => page)).not.toContain('favorites');
  });

  it('Dashboard professeur inchangé pour un compte professeur', () => {
    auth.value.profile = { id: 'user-1', role: 'professor', full_name: 'Prof' };
    const onNavigate = vi.fn();
    renderHeader(onNavigate);
    fireEvent.click(screen.getAllByText('Dashboard')[0]);
    expect(onNavigate).toHaveBeenCalledWith('professor-dashboard');
  });
});

describe('Route Favorites supprimée', () => {
  const src = join(__dirname, '../..');

  it('page supprimée et plus aucune route ni import', () => {
    expect(existsSync(join(src, 'pages/Favorites.tsx'))).toBe(false);
    const app = readFileSync(join(src, 'App.tsx'), 'utf8');
    expect(app).not.toMatch(/pages\/Favorites|case 'favorites'|<Favorites /);
    // /favorites tombe désormais sur la page 404 (cas default du routeur)
    expect(parseAppPath('/favorites').page).toBe('favorites');
    expect(app).toContain('default:\n        return <NotFound onNavigate={handleNavigate} />;');
  });

  it('les anciennes pages gardent leurs boutons favoris (FavoritesProvider conservé)', () => {
    const app = readFileSync(join(src, 'App.tsx'), 'utf8');
    expect(app).toContain('<FavoritesProvider>');
    expect(existsSync(join(src, 'components/FavoriteButton.tsx'))).toBe(true);
  });
});
