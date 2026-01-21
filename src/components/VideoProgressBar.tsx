import { CheckCircle } from 'lucide-react';

interface VideoProgressBarProps {
  progress: number;
  completed?: boolean;
}

export function VideoProgressBar({ progress, completed }: VideoProgressBarProps) {
  if (progress === 0 && !completed) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0">
      <div className="relative h-1 bg-black/30">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {completed && (
        <div className="absolute -top-8 right-2">
          <div className="bg-green-500 rounded-full p-1">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
      {!completed && progress > 0 && (
        <div className="absolute -top-6 right-2">
          <div className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            {Math.round(progress)}%
          </div>
        </div>
      )}
    </div>
  );
}
