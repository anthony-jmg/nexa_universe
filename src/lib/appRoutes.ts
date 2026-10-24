export type Page = 'landing' | 'signin' | 'signup' | 'forgot-password' | 'reset-password' | 'academy' | 'video' | 'professors' | 'account' | 'admin' | 'shop' | 'cart' | 'favorites' | 'my-purchases' | 'professor-dashboard' | 'events' | 'event-detail' | 'my-tickets' | 'event-ticket-purchase' | 'notifications' | string;

export type NavigationState = {
  page: Page;
  videoId?: string;
  professorId?: string;
  programId?: string;
  eventId?: string;
};

// Build URL path from current state
export function buildAppPath(page: Page, videoId?: string, professorId?: string, programId?: string, eventId?: string): string {
  if (page === 'video' && videoId) return `/video/${videoId}`;
  if (page === 'professor-detail' && professorId) return `/professor/${professorId}`;
  if (page === 'professor-discovery' && professorId) return `/academy/${professorId}`;
  if (page === 'program-detail' && programId) return `/program/${programId}`;
  if (page === 'event-detail' && eventId) return `/event/${eventId}`;
  if (page === 'landing') return '/';
  return `/${page}`;
}

// Parse URL path to state
export function parseAppPath(path: string): NavigationState {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'landing' };

  const [first, second] = parts;

  if (first === 'video' && second) return { page: 'video', videoId: second };
  if (first === 'professor' && second) return { page: 'professor-detail', professorId: second };
  // Profil Academy Discovery partageable : /academy/<id>
  if (first === 'academy' && second) return { page: 'professor-discovery', professorId: second };
  if (first === 'program' && second) return { page: 'program-detail', programId: second };
  if (first === 'event' && second) return { page: 'event-detail', eventId: second };

  return { page: first as Page };
}
