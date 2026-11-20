/**
 * Test user profiles matching the Prisma UserGroup model and the back's DEFAULT_GROUPS
 * (home-back lib/user.ts). Served by the /api/user/me mock.
 */

type UserGroup = 'admin' | 'user' | 'children';

export interface TestUserProfile {
  email: string;
  group: UserGroup;
  permissions: string[];
  widgetPreferences: Record<string, unknown>;
  theme?: 'light' | 'dark';
}

// ── Admin: full access ──────────────────────────────────────────────────────────
export const ADMIN_PROFILE: TestUserProfile = {
  email: 'admin@test.home',
  group: 'admin',
  permissions: ['remote', 'history', 'cameras', 'admin'],
  widgetPreferences: {
    widgetOrder: [
      'lights',
      'alarm',
      'temperature',
      'weather',
      'electricity',
      'gas',
      'feeder',
      'arlo',
      'plugs',
      'spa',
    ],
    collapsed: {},
  },
};

// ── Standard user: no cameras, no history ───────────────────────────────────────
export const USER_PROFILE: TestUserProfile = {
  email: 'user@test.home',
  group: 'user',
  permissions: ['remote'],
  widgetPreferences: {
    widgetOrder: ['lights', 'temperature', 'weather', 'plugs'],
    collapsed: {},
  },
};

// ── Children: restricted view ───────────────────────────────────────────────────
export const CHILDREN_PROFILE: TestUserProfile = {
  email: 'child@test.home',
  group: 'children',
  permissions: [],
  widgetPreferences: {
    widgetOrder: ['lights', 'weather', 'feeder'],
    collapsed: {},
  },
};
