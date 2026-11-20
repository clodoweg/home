/**
 * alerts-data — Alerts of the admin's bell, as GET /api/notifications returns them (home-back
 * app/api/notifications/route.ts): newest first, dated relative to the test run.
 */

/** One alert as the back serves it. */
export interface MockAlert {
  id: number;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Two unread alerts, then an older read one. */
export const ALERTS_DATA: MockAlert[] = [
  {
    id: 3,
    category: 'alarm',
    title: 'Alarme',
    body: 'Alarme activée (absence)',
    createdAt: minutesAgo(5),
    read: false,
  },
  {
    id: 2,
    category: 'feeder',
    title: 'Croquettes',
    body: 'Le bac de croquettes est vide',
    createdAt: minutesAgo(90),
    read: false,
  },
  {
    id: 1,
    category: 'spa',
    title: 'Spa',
    body: 'Température du spa : 34 °C',
    createdAt: minutesAgo(60 * 30),
    read: true,
  },
];
