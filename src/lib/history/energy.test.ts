/** history/energy tests — séries, coûts, gaz et météo, carte horaire, talon de nuit, calendrier. */
import { describe, expect, it } from 'vitest';
import {
  costDays,
  dayCost,
  degreeDays,
  electricityDays,
  gasDays,
  gasPerDegreeDayBuckets,
  gasTemperaturePoints,
  gasWeatherSummary,
  hourlyHeatmap,
  nightBaseline,
  periodHasApproximateGasPrice,
  readDaysOf,
  shortDate,
  waterDays,
  yearCalendar,
} from './energy';
import { periodContaining } from './period';

const FEB = periodContaining('month', new Date('2026-02-10T12:00:00'));

describe('series', () => {
  it('converts the Enedis, GRDF and Suez answers', () => {
    expect(
      electricityDays({
        dailyConsumption: [{ date: '2026-02-01T00:00:00Z', value: 12500 }],
        dailyMaxPower: [],
        loadCurve: [],
      }),
    ).toEqual([{ date: '2026-02-01', value: 12.5 }]);
    expect(electricityDays(null)).toEqual([]);
    expect(
      gasDays({
        dailyConsumption: [{ date: '2026-02-01', value: 40, temp: 3, isEstimate: false }],
      }),
    ).toEqual([{ date: '2026-02-01', value: 40, temp: 3, isEstimate: false }]);
    expect(gasDays(undefined)).toEqual([]);
    expect(waterDays({ dailyConsumption: [{ date: '2026-02-01', value: 300 }], price: 3 })).toEqual(
      [{ date: '2026-02-01', value: 300, isEstimate: undefined }],
    );
    expect(waterDays(null)).toEqual([]);
  });

  it('leaves out the days not read yet (0), which are unknown rather than empty', () => {
    const enedis = {
      dailyConsumption: [
        { date: '2026-02-01', value: 9000 },
        { date: '2026-02-02', value: 0 },
      ],
      dailyMaxPower: [],
      loadCurve: [],
    };
    expect(electricityDays(enedis).map((d) => d.date)).toEqual(['2026-02-01']);
    expect(
      gasDays({ dailyConsumption: [{ date: '2026-02-02', value: 0, isEstimate: false }] }),
    ).toEqual([]);
    expect(waterDays({ dailyConsumption: [{ date: '2026-02-02', value: 0 }], price: 3 })).toEqual(
      [],
    );
  });

  it('values each day at its own price', () => {
    expect(dayCost('electricity', { date: '2026-11-01', value: 10 })).toBeCloseTo(2.001);
    expect(dayCost('gas', { date: '2026-11-01', value: 10 })).toBeCloseTo(1.5761);
    expect(dayCost('water', { date: '2026-11-01', value: 500 }, 4)).toBe(2);
    expect(dayCost('water', { date: '2026-11-01', value: 1000 })).toBe(2.74);
    expect(costDays('electricity', [{ date: '2026-11-01', value: 1 }])).toEqual([
      { date: '2026-11-01', value: 0.2001 },
    ]);
    expect(periodHasApproximateGasPrice(FEB)).toBe(false);
    expect(periodHasApproximateGasPrice(periodContaining('month', new Date('2025-10-05')))).toBe(
      true,
    );
  });
});

describe('gas and weather', () => {
  const days = [
    { date: '2026-02-01', value: 40, temp: 8 },
    { date: '2026-02-02', value: 60, temp: 3 },
    { date: '2026-02-03', value: 30, temp: 20 },
    { date: '2026-02-04', value: 25, temp: 9, isEstimate: true },
    { date: '2026-02-05', value: 0, temp: 9 },
    { date: '2026-02-06', value: 10 },
    { date: '2026-03-01', value: 99, temp: 1 },
  ];

  it('keeps the days actually read', () => {
    expect(readDaysOf(days, FEB).map((d) => d.date)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-06',
    ]);
  });

  it('weighs the gas by the degree days', () => {
    expect(degreeDays(20)).toBe(0);
    expect(degreeDays(8)).toBe(10);
    const summary = gasWeatherSummary(days, FEB);
    expect(summary).toEqual({ kwh: 130, degreeDays: 25, kwhPerDegreeDay: 5.2, meanTemp: 31 / 3 });
    expect(gasWeatherSummary([], FEB)).toEqual({
      kwh: 0,
      degreeDays: 0,
      kwhPerDegreeDay: null,
      meanTemp: null,
    });
    const buckets = gasPerDegreeDayBuckets(days, FEB);
    expect(buckets[0]).toBe(4);
    expect(buckets[2]).toBeNull();
    expect(gasTemperaturePoints(days, FEB)).toHaveLength(3);
  });
});

describe('electricity patterns', () => {
  const week = periodContaining('week', new Date('2026-02-25T12:00:00'));
  const curve = [
    // 00:30-01:00 local, 1 kW: 0,5 kWh in the hour 0.
    { date: '2026-02-25T00:00:00Z', value: 1000 },
    // 01:00-02:00 local: 300 W then 400 W.
    { date: '2026-02-25T00:30:00Z', value: 300 },
    { date: '2026-02-25T01:00:00Z', value: 400 },
    // 02:00-03:00 local: 200 W.
    { date: '2026-02-25T01:30:00Z', value: 200 },
    { date: '2026-02-25T02:00:00Z', value: 200 },
    { date: '2027-01-01T00:00:00Z', value: 999 },
  ];

  it('sums the energy of each hour of each day', () => {
    const heatmap = hourlyHeatmap(curve, week);
    expect(heatmap.days[2]).toBe('2026-02-25');
    expect(heatmap.cells[2][0]).toBeCloseTo(0.5);
    expect(heatmap.cells[2][1]).toBeCloseTo(0.35);
    expect(heatmap.cells[2][2]).toBeCloseTo(0.2);
    expect(heatmap.cells[0][0]).toBeNull();
    expect(heatmap.max).toBeCloseTo(0.5);
  });

  it('takes the lowest night hour as the baseline', () => {
    const baseline = nightBaseline(curve, week);
    expect(baseline[2]).toBeCloseTo(200);
    expect(baseline[0]).toBeNull();
  });

  it('lays a year out as weeks', () => {
    const year = periodContaining('year', new Date('2026-06-01'));
    const { weeks, max } = yearCalendar(
      [
        { date: '2026-01-01', value: 5 },
        { date: '2026-01-02', value: 7 },
      ],
      year,
    );
    // 1 January 2026 is a Thursday: three blanks before it.
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, { date: '2026-01-01', value: 5 }]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(max).toBe(7);
    expect(weeks.flat().filter(Boolean)).toHaveLength(365);
    expect(shortDate('2026-01-02')).toBe('02/01/2026');
  });
});
