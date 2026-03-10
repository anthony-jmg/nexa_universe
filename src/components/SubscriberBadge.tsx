import { Crown } from 'lucide-react';

interface SubscriberBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export default function SubscriberBadge({ size = 'sm', className = '' }: SubscriberBadgeProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      title="Membre abonné"
      className={`inline-flex items-center justify-center ${iconSize} text-[#B8913D] drop-shadow-sm ${className}`}
    >
      <Crown className={`${iconSize} fill-[#B8913D]`} />
    </span>
  );
}
