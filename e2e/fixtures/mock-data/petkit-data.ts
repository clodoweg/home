/**
 * Mock PetKit data for testing the PetKit feeder widget.
 */

// Generate today's date string YYYY-MM-DD
const today = new Date();
const todayYYYYMMDD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// Generate Unix timestamps (seconds) for today minus a few hours
const nowSec = Math.floor(Date.now() / 1000);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timeAm = nowSec - 4 * 3600; // 4 hours ago
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timePm = nowSec - 1 * 3600; // 1 hour ago

// Dynamic timestamps: use today's date so records are always visible
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const morningTimestamp = Math.floor(Date.now() / 1000) - 4 * 3600; // 4h ago
const noonTimestamp = Math.floor(Date.now() / 1000) - 1 * 3600; // 1h ago

export const PETKIT_DATA = {
  devices: [
    {
      id: 100000001,
      deviceId: 100000001,
      deviceType: 'D4sh',
      sn: 'PK-D4SH-TEST001',
      name: 'Distributeur Chat',
      status: {
        batteryStatus: 4,
        desiccantLeftDays: 15,
        food1: 2,
        food2: 2,
        wifi: { ssid: 'HomeWifi', rssi: -45 },
      },
      feedSchedule: [
        {
          items: [
            { amount: 3, time: 7 * 3600 },
            { amount: 2, time: 12 * 3600 },
            { amount: 3, time: 19 * 3600 },
          ],
          repeats: 127,
          suspended: 0,
        },
      ],
    },
    {
      id: 101,
      deviceId: 101,
      deviceType: 'Ctw3',
      sn: 'PK-CTW3-TEST001',
      name: 'Fontaine Salon',
      status: {
        pim: 85,
        water_level_status: 0,
        mode: 2,
        electricQuantity: 0,
        battery: 95,
      },
    },
  ],
  records: [
    {
      id: '1',
      deviceId: 100000001,
      deviceType: 'D4sh',
      day: Number(todayYYYYMMDD.replace(/-/g, '')),
      content: 'Repas matin',
      desc: 'Repas matin',
      amount: 3,
      amount1: 2,
      amount2: 1,
      time: morningTimestamp,
      type: 4, // 4=feed (scheduled dispense)
      state: 1,
    },
    {
      id: '2',
      deviceId: 100000001,
      deviceType: 'D4sh',
      day: Number(todayYYYYMMDD.replace(/-/g, '')),
      content: 'Repas midi',
      desc: 'Repas midi',
      amount: 2,
      amount1: 1,
      amount2: 1,
      time: noonTimestamp,
      type: 4,
      state: 1,
    },
  ],
  fountains: [
    {
      deviceId: 101,
      day: new Date().toISOString(),
      data: {
        filterPercent: 85,
        lackWarning: false,
        mode: 2,
        status: { electricStatus: 2 },
        electricity: { batteryPercent: 95 },
      },
      workRecords: [
        { time: morningTimestamp, stayTime: 45, dayTime: 8 * 3600 },
        { time: noonTimestamp, stayTime: 30, dayTime: 13 * 3600 },
      ],
    },
  ],
  lastSyncedAt: new Date().toISOString(),
};

export const PETKIT_EMPTY = {
  devices: [],
  records: [],
  lastSyncedAt: null,
};
