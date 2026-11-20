import { describe, expect, it } from 'vitest';

import type { HAState } from '../services/api';
import { cameraImageUrl, listArloCameras } from './arlo';

const entity = (
  entity_id: string,
  state = 'idle',
  attributes: Record<string, unknown> = {},
  last_updated = '',
): HAState =>
  ({ entity_id, state, attributes, last_changed: '', last_updated, context: {} }) as HAState;

describe('listArloCameras', () => {
  it('pairs each camera with its sensors and names it', () => {
    const cameras = listArloCameras([
      entity('camera.aarlo_jardin', 'idle', { friendly_name: 'Arlo Jardin' }),
      entity('binary_sensor.aarlo_motion_jardin', 'on'),
      entity('binary_sensor.aarlo_connected_jardin', 'on'),
      entity('sensor.aarlo_last_jardin', '2026-11-14T08:00:00Z'),
      entity('camera.aarlo_entree'),
    ]);

    expect(cameras.map((cam) => [cam.id, cam.name])).toEqual([
      ['jardin', 'Arlo Jardin'],
      ['entree', 'Entree'],
    ]);
    expect(cameras[0].motionEntity?.state).toBe('on');
    expect(cameras[0].connectedEntity?.state).toBe('on');
    expect(cameras[0].lastCaptureEntity?.state).toBe('2026-11-14T08:00:00Z');
    expect(cameras[1].motionEntity).toBeUndefined();
  });
});

describe('cameraImageUrl', () => {
  it('points at the back, versioned by the latest picture', () => {
    const [camera] = listArloCameras([
      entity(
        'camera.aarlo_jardin',
        'idle',
        { image_source: 'snapshot', last_thumbnail: 't1' },
        'u1',
      ),
      entity('sensor.aarlo_last_jardin', 'c1'),
    ]);
    const url = cameraImageUrl(camera);
    expect(url).toMatch(/\/api\/camera_proxy_image\/camera\.aarlo_jardin\?v=snapshot_t1_c1_u1$/);
  });

  it('has no URL without a camera entity', () => {
    expect(
      cameraImageUrl({
        id: 'x',
        name: 'X',
        cameraEntity: undefined,
        motionEntity: undefined,
        connectedEntity: undefined,
        lastCaptureEntity: undefined,
      }),
    ).toBeUndefined();
  });
});
