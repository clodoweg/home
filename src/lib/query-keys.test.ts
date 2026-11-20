/** query-keys tests — every key sits under its domain prefix, so refreshing a domain reaches it. */
import { describe, expect, it } from 'vitest';
import { queryKeys } from './query-keys';

describe('queryKeys', () => {
  it('nests parametrized keys under their family', () => {
    expect(queryKeys.ha.history('sensor.a', 24)).toEqual([
      'ha',
      'history',
      'sensor.a',
      24,
      'state',
    ]);
    expect(queryKeys.ha.history('sensor.a', 24).slice(0, 2)).toEqual(queryKeys.ha.histories);
    expect(queryKeys.ha.historyBatch(['a', 'b'], 6)).toEqual([
      'ha',
      'history-batch',
      ['a', 'b'],
      6,
    ]);
    expect(queryKeys.ha.historyBatch(['a'], 6).slice(0, 2)).toEqual(queryKeys.ha.historyBatches);
    expect(queryKeys.ha.forecast('weather.home', 'hourly')).toEqual([
      'ha',
      'forecast',
      'weather.home',
      'hourly',
    ]);
  });

  it('copies the entity list, so a later change of the caller array leaves the key intact', () => {
    const ids = ['a'];
    const key = queryKeys.ha.historyBatch(ids, 6);
    ids.push('b');
    expect(key[2]).toEqual(['a']);
  });
});
