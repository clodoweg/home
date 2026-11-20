/** action-feedback — Tells the user, with a toast, that an action on a device did not go through. */
import { toast } from '../hooks/use-toast';

/** Errors already handled by a full screen (session expired, outside home network, unknown user). */
const isHandledGlobally = (error: { status?: number; code?: string }): boolean =>
  error.status === 401 || error.code === 'IP_RESTRICTED' || error.code === 'USER_NOT_FOUND';

/**
 * Shows a toast for a failed action, unless the error already leads to a full-screen message.
 * The optimistic state has been rolled back by then: the toast explains why the switch moved back.
 *
 * @param error - Error thrown by the service (ApiError, network TypeError…).
 * @param device - What the action targeted, as shown to the user (e.g. "le distributeur").
 */
export function notifyActionFailure(error: unknown, device = "l'équipement"): void {
  const apiError = (error ?? {}) as { status?: number; code?: string };
  if (isHandledGlobally(apiError)) return;
  toast({
    variant: 'destructive',
    title: 'Action impossible',
    description:
      apiError.status === 403
        ? `Vous n'avez pas le droit de piloter ${device}.`
        : `${device.charAt(0).toUpperCase()}${device.slice(1)} n'a pas répondu. Réessayez dans un instant.`,
  });
}

/**
 * Shows a toast for a preference the back did not save; the screen has already gone back to the
 * saved value, the toast explains why.
 *
 * @param error - Error thrown by the service.
 * @param what - The preference, as shown to the user (e.g. "le thème").
 */
export function notifySaveFailure(error: unknown, what = 'la préférence'): void {
  if (isHandledGlobally((error ?? {}) as { status?: number; code?: string })) return;
  toast({
    variant: 'destructive',
    title: 'Modification non enregistrée',
    description: `Impossible d'enregistrer ${what}. Réessayez dans un instant.`,
  });
}
