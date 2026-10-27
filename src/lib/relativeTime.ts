import { formatDate } from './locale';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Date relative d'une notification (« Il y a 5 min » / « 5 min ago »), puis
 * date courte dans la langue active au-delà de 7 jours.
 */
export function formatRelativeTime(
  value: string | Date,
  t: Translate,
  longDate: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  if (days < 7) return t('time.daysAgo', { count: days });
  return formatDate(date, longDate);
}
