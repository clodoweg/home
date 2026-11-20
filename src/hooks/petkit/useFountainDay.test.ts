/** useFountainDay tests — fountain state fallbacks, visits per period and the visit list. */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FountainDay, PetKitData, PetkitDevice } from '../../services/api';
import { useFountainDay, visitHour } from './useFountainDay';

const DAY = new Date('2026-10-23T00:00:00+02:00');

const device = (overrides: Partial<PetkitDevice> = {}): PetkitDevice => ({
  id: 7,
  deviceId: 7,
  deviceType: 'ctw3',
  sn: 'sn',
  name: 'Fontaine',
  status: {},
  ...overrides,
});

const withFountains = (fountains: FountainDay[]): PetKitData => ({
  devices: [],
  records: [],
  fountains,
});

const render = (data: PetKitData | null, fountain: PetkitDevice | undefined = device()) =>
  renderHook(() => useFountainDay(data, fountain, DAY)).result.current;

describe('visitHour', () => {
  it.each([
    [{ dayTime: 7 * 3600 + 59 }, 7],
    [{ time: 13 * 3600 }, 13],
    [{ timestamp: new Date('2026-10-23T21:30:00+02:00').getTime() / 1000 }, 21],
    [{}, -1],
  ])('%j → %i', (record, hour) => {
    expect(visitHour(record)).toBe(hour);
  });
});

describe('useFountainDay', () => {
  it('reads the record of the device for the selected day', () => {
    const day = render(
      withFountains([
        { deviceId: 8, day: '2026-10-23', data: { filterPercent: 10 } },
        { deviceId: 7, day: '2026-10-22', data: { filterPercent: 20 } },
        {
          deviceId: 7,
          day: '2026-10-23T00:00:00',
          data: {
            filterPercent: 64,
            lackWarning: true,
            mode: 2,
            electricity: { batteryPercent: 80 },
          },
          workRecords: [
            { dayTime: 7 * 3600, stayTime: 90 },
            { dayTime: 14 * 3600, stayTime: 30 },
            { dayTime: 22 * 3600, stayTime: 0 },
            { stayTime: 0 },
          ],
        },
      ]),
      device({ data: { status: { electricQuantity: 0 } } }),
    );

    expect(day).toMatchObject({
      filterLife: 64,
      waterLevelStatus: 1,
      mode: 2,
      battery: 80,
      isPlugged: false,
      activity: { morning: 1, afternoon: 1, night: 1, total: 4 },
      totalDrunkMinutes: 2,
    });
    expect(day.latestVisits.map((v) => v.dayTime)).toEqual([
      22 * 3600,
      14 * 3600,
      7 * 3600,
      undefined,
    ]);
  });

  it('uses the daily summary when the visit list is missing', () => {
    const day = render(
      withFountains([
        { deviceId: 7, day: '2026-10-23', data: { activity: { morning: 2, night: 1 } } },
      ]),
    );
    expect(day.activity).toEqual({ morning: 2, afternoon: 0, night: 1, total: 3 });
    expect(day.latestVisits).toEqual([]);
  });

  it('falls back to the device state without a record', () => {
    const day = render(
      null,
      device({
        status: { pim: 40, battery: 55 },
        data: { status: { water_level_status: 0, mode: 1, electricQuantity: 3 } },
      }),
    );
    expect(day).toMatchObject({
      filterLife: 40,
      waterLevelStatus: 0,
      mode: 1,
      battery: 55,
      isPlugged: true,
      activity: { total: 0 },
    });
  });

  it('has neutral values without a device', () => {
    const day = render(withFountains([{ deviceId: 7, day: '2026-10-23' }]), undefined);
    expect(day).toMatchObject({
      filterLife: 0,
      waterLevelStatus: 0,
      mode: 1,
      totalDrunkMinutes: 0,
    });
  });
});
