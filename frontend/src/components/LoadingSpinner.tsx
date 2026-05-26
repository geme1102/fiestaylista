interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ fullScreen, size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };

  const video = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={sizeClasses[size]}>
        <video
          src="/animations/gift-loading.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      </div>
      {text && <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        {video}
      </div>
    );
  }

  return video;
}
