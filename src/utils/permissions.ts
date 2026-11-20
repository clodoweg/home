/**
 * User Permission Utility
 * Mirrors the back's rights (home-back lib/permissions.ts) to decide what the UI shows.
 * The back stays the authority: it refuses any request the UI should not have sent.
 */
export type UserGroup = 'admin' | 'children' | 'user';

/** Rights the UI depends on, as stored in `UserGroup.permissions` on the back. */
export type PermissionFlag = 'history' | 'cameras';

/**
 * Same rule as the back's `hasPermission`: the group carries the flag, or is the admin group.
 *
 * @param profile - Group and permission flags returned by `/api/user/me` (null while loading).
 * @param flag - Right to check.
 * @returns True if the back grants that right.
 */
export const hasPermission = (
  profile: { group?: UserGroup; permissions?: readonly string[] } | null | undefined,
  flag: PermissionFlag,
): boolean => {
  if (!profile) return false;
  return Boolean(profile.permissions?.includes(flag)) || profile.group === 'admin';
};
