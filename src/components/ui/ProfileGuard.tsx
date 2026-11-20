/**
 * ProfileGuard — Full-screen loading / error fallback while the user profile
 * is being resolved by Clerk + the backend permissions lookup.
 */
import React from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from './Button';

interface ProfileGuardProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Shows a loader or an error screen until the profile is known, then its children.
 *
 * @param props - Children and the profile state.
 * @returns The guarded subtree.
 */
export const ProfileGuard = ({ loading, error, onRetry }: ProfileGuardProps) => (
  <div className="flex flex-1 flex-col items-center justify-center bg-background p-6">
    {loading ? (
      <>
        <Loader2 size={40} className="mb-4 animate-spin text-primary" />
        <p className="font-medium text-muted-foreground">Checking permissions...</p>
      </>
    ) : (
      <>
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <X size={32} className="text-destructive" />
        </div>
        <h2 className="mb-2 text-center font-display text-2xl font-bold text-foreground">
          Erreur de profil
        </h2>
        <p className="mb-8 text-center font-medium text-muted-foreground">{error}</p>
        <Button
          label="Réessayer"
          onClick={onRetry}
          variant="default"
          className="w-full max-w-[200px]"
        />
      </>
    )}
  </div>
);
