/** action-feedback tests — a failed action or save is explained once, never on top of a full-screen error. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyActionFailure, notifySaveFailure } from './action-feedback';

const toast = vi.hoisted(() => vi.fn());
vi.mock('../hooks/use-toast', () => ({ toast }));

beforeEach(() => {
  toast.mockClear();
});

describe('notifyActionFailure', () => {
  it('explains a failure of the device or the network', () => {
    notifyActionFailure(new TypeError('Failed to fetch'), 'le distributeur');
    expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Action impossible',
      description: "Le distributeur n'a pas répondu. Réessayez dans un instant.",
    });
  });

  it('explains a refused action', () => {
    notifyActionFailure({ status: 403, code: 'FORBIDDEN' });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Vous n'avez pas le droit de piloter l'équipement.",
      }),
    );
  });

  it.each([
    ['an expired session', { status: 401 }],
    ['the home network restriction', { status: 403, code: 'IP_RESTRICTED' }],
    ['an unknown user', { status: 403, code: 'USER_NOT_FOUND' }],
  ])('stays silent for %s (handled by a full screen)', (_case, error) => {
    notifyActionFailure(error);
    expect(toast).not.toHaveBeenCalled();
  });

  it('copes with a rejection without value', () => {
    notifyActionFailure(undefined);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});

describe('notifySaveFailure', () => {
  it('explains which preference was not saved', () => {
    notifySaveFailure(new TypeError('Failed to fetch'), 'le thème');
    expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Modification non enregistrée',
      description: "Impossible d'enregistrer le thème. Réessayez dans un instant.",
    });
  });

  it('stays quiet when a full screen already explains the error', () => {
    notifySaveFailure({ status: 401 });
    notifySaveFailure(undefined);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('la préférence') }),
    );
  });
});
