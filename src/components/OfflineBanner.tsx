import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../contexts/LanguageContext';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="w-5 h-5" />
      <span className="font-medium">{t('common.offline')}</span>
    </div>
  );
}
