interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', variant = 'rectangular', width, height }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Skeleton className="w-full h-48" />
      <div className="p-4 space-y-3">
        <Skeleton className="w-3/4 h-6" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-1/2 h-4" />
      </div>
    </div>
  );
}

export function ProfessorCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-3/4 h-6" />
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-1/2 h-4" />
        </div>
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Skeleton className="w-full h-56" />
      <div className="p-6 space-y-3">
        <Skeleton className="w-3/4 h-7" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <div className="flex justify-between items-center pt-4">
          <Skeleton className="w-1/3 h-4" />
          <Skeleton className="w-1/4 h-8" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Skeleton className="w-full h-64" />
      <div className="p-4 space-y-3">
        <Skeleton className="w-2/3 h-5" />
        <Skeleton className="w-1/3 h-6" />
        <Skeleton className="w-full h-10" />
      </div>
    </div>
  );
}
