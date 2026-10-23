import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-muted-foreground ${className}`}
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
