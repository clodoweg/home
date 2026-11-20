/** useNotificationSettings — Telegram chat ID and alert categories of the user, read and saved through React Query. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '../context/UserContext';
import { queryKeys } from '../lib/query-keys';
import {
  getNotificationSettings,
  updatePreferences,
  type NotificationSettings,
} from '../services/api';
import { createTokenQuery } from './createTokenQuery';

/**
 * Reads the notification settings; always refetched when the screen opens, since they can be
 * changed from another device.
 *
 * @returns The query result (`data` is null without a session).
 */
export const useNotificationSettings = createTokenQuery<NotificationSettings>(
  queryKeys.user.notifications,
  getNotificationSettings,
  { staleTime: 0 },
);

/**
 * Saves the notification settings, then puts the saved values in the cache.
 *
 * @returns The mutation; `mutateAsync` rejects (ApiError) when the back refuses.
 */
export function useSaveNotificationSettings() {
  const { token } = useUserProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      if (!token) throw new Error('No token');
      await updatePreferences(token, settings);
      return settings;
    },
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.user.notifications, settings),
  });
}
