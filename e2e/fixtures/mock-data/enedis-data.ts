/**
 * Mock Enedis electricity consumption data for testing.
 */

export const ENEDIS_DATA = {
  dailyConsumption: [
    { date: '2026-02-20', value: 12500 },
    { date: '2026-02-21', value: 15200 },
    { date: '2026-02-22', value: 11800 },
    { date: '2026-02-23', value: 13600 },
    { date: '2026-02-24', value: 14100 },
    { date: '2026-02-25', value: 9800 },
  ],
  dailyMaxPower: [
    { date: '2026-02-20', value: 4500 },
    { date: '2026-02-21', value: 5200 },
    { date: '2026-02-22', value: 3800 },
    { date: '2026-02-23', value: 4600 },
    { date: '2026-02-24', value: 5100 },
    { date: '2026-02-25', value: 3200 },
  ],
  loadCurve: [
    { date: '2026-02-25T00:00:00Z', value: 350 },
    { date: '2026-02-25T00:30:00Z', value: 320 },
    { date: '2026-02-25T01:00:00Z', value: 280 },
    { date: '2026-02-25T01:30:00Z', value: 290 },
    { date: '2026-02-25T02:00:00Z', value: 310 },
    { date: '2026-02-25T06:00:00Z', value: 1200 },
    { date: '2026-02-25T06:30:00Z', value: 2100 },
    { date: '2026-02-25T07:00:00Z', value: 3500 },
  ],
};
