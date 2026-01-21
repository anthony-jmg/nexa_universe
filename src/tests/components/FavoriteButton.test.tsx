import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoriteButton } from '../../components/FavoriteButton';
import { FavoritesProvider } from '../../contexts/FavoritesContext';
import { ToastProvider } from '../../contexts/ToastContext';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' }
          }
        }
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', email: 'test@example.com', role: 'student' }
          }),
          order: vi.fn(() => ({
            data: [],
            error: null
          }))
        })),
        in: vi.fn(() => ({
          data: []
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null })
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null })
        }))
      }))
    }))
  }
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    profile: { id: 'test-user-id', email: 'test@example.com', role: 'student' },
    loading: false
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <FavoritesProvider>
      {children}
    </FavoritesProvider>
  </ToastProvider>
);

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render favorite button', () => {
    render(
      <AllProviders>
        <FavoriteButton
          itemId="test-id"
          type="video"
        />
      </AllProviders>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should have correct title attribute', () => {
    render(
      <AllProviders>
        <FavoriteButton
          itemId="test-id"
          type="video"
        />
      </AllProviders>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title');
  });

  it('should be clickable', () => {
    render(
      <AllProviders>
        <FavoriteButton
          itemId="test-id"
          type="program"
        />
      </AllProviders>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });
});
