import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="p-3 bg-muted rounded-full text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">404 — Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The requested URL was not found on this system.
      </p>
      <Link
        to="/"
        className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors text-sm"
      >
        <Home className="w-4 h-4 mr-2" />
        Return to Dashboard
      </Link>
    </div>
  );
};
