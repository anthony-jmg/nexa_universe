import { buildAppPath } from './appRoutes';

// Destination d'une notification. La table notifications n'a pas de colonne
// « link » : la page cible se déduit du type. Sans destination connue, la
// notification est seulement marquée comme lue (aucune navigation).
const PAGE_BY_TYPE: Record<string, string> = {
  pass_available: 'my-purchases',
};

export function notificationPath(notification: { type: string }): string | null {
  const page = PAGE_BY_TYPE[notification.type];
  return page ? buildAppPath(page) : null;
}
