/** useAlertNotifications — The admin's alerts for the bell: list, unread count, "mark all read". */
import { useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserProfile } from '../context/UserContext';
import { PUSH_RECEIVED_MESSAGE } from '../lib/alert-notifications';
import { queryKeys } from '../lib/query-keys';
import { getNotifications, markNotificationsRead, type NotificationList } from '../services/api';
import { createTokenQuery } from './createTokenQuery';

const useNotificationList = createTokenQuery<NotificationList>(
  queryKeys.alerts.list,
  getNotifications,
  {
    staleTime: 30_000,
    // New alerts show up while the app stays open, even without push.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  },
);

const NO_NOTIFICATIONS: NotificationList = { notifications: [], unread: 0 };

/**
 * The bell's data, for admins only (others get an empty list and no request). A push received
 * while the app is open refreshes it at once.
 *
 * @returns The alerts, the unread count, whether the bell applies, and `markAllRead`.
 */
export function useAlertNotifications() {
  const { token, isAdmin } = useUserProfile();
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotificationList(isAdmin);

  useEffect(() => {
    if (!isAdmin || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === PUSH_RECEIVED_MESSAGE) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list });
      }
    };
    const container = navigator.serviceWorker;
    container.addEventListener('message', onMessage);
    return () => container.removeEventListener('message', onMessage);
  }, [isAdmin, queryClient]);

  const { mutate } = useMutation({
    mutationFn: () => markNotificationsRead(token!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alerts.list });
      const previous = queryClient.getQueryData<NotificationList | null>(queryKeys.alerts.list);
      if (previous) {
        queryClient.setQueryData<NotificationList>(queryKeys.alerts.list, {
          notifications: previous.notifications.map((item) => ({ ...item, read: true })),
          unread: 0,
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.alerts.list, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list }),
  });
  const markAllRead = useCallback(() => mutate(), [mutate]);

  const list = data ?? NO_NOTIFICATIONS;
  return {
    enabled: isAdmin,
    notifications: list.notifications,
    unread: list.unread,
    isLoading: isAdmin && isLoading,
    markAllRead,
  };
}
