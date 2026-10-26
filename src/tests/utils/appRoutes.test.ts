import { describe, it, expect } from 'vitest';
import { buildAppPath, parseAppPath } from '../../lib/appRoutes';

describe('URL du profil Academy Discovery', () => {
  it('construit /academy/<id> pour un profil Discovery', () => {
    expect(buildAppPath('professor-discovery', undefined, 'p-123')).toBe('/academy/p-123');
  });

  it('retrouve le profil au rechargement ou depuis un lien partagé', () => {
    expect(parseAppPath('/academy/p-123')).toEqual({ page: 'professor-discovery', professorId: 'p-123' });
  });

  it('garde /academy pour la liste et /professor/<id> pour l’ancienne Academy', () => {
    expect(parseAppPath('/academy')).toEqual({ page: 'academy' });
    expect(buildAppPath('academy')).toBe('/academy');
    expect(parseAppPath('/professor/p-1')).toEqual({ page: 'professor-detail', professorId: 'p-1' });
    expect(buildAppPath('professor-detail', undefined, 'p-1')).toBe('/professor/p-1');
  });

  it('ne change pas les autres routes', () => {
    expect(parseAppPath('/')).toEqual({ page: 'landing' });
    expect(parseAppPath('/my-purchases')).toEqual({ page: 'my-purchases' });
    expect(parseAppPath('/event/e-1')).toEqual({ page: 'event-detail', eventId: 'e-1' });
    expect(buildAppPath('landing')).toBe('/');
  });
});

describe('Pages légales', () => {
  it('CGV et politique de remboursement ont une URL directe', () => {
    expect(buildAppPath('terms')).toBe('/terms');
    expect(parseAppPath('/terms')).toEqual({ page: 'terms' });
    expect(buildAppPath('refund-policy')).toBe('/refund-policy');
    expect(parseAppPath('/refund-policy')).toEqual({ page: 'refund-policy' });
  });
});
