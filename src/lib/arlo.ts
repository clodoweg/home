/**
 * arlo — The Arlo cameras as the dashboard shows them: each camera with its motion, connection and
 * last-capture sensors, and the authenticated URL of its latest picture. Shared by the cameras
 * widget and the home screen.
 */
import { ARLO_PREFIXES } from '../constants/entities';
import { API_URL, type HAState } from '../services/api';

export interface ArloCamera {
  /** Camera name in its entity ids (`jardin` for `camera.aarlo_jardin`). */
  id: string;
  name: string;
  cameraEntity: HAState | undefined;
  motionEntity: HAState | undefined;
  connectedEntity: HAState | undefined;
  lastCaptureEntity: HAState | undefined;
}

/**
 * Cameras found among Arlo entities, each with its sensors.
 *
 * @param entities - Arlo entities (cameras and their sensors; see `isArloEntity`).
 * @returns One entry per `camera.aarlo_*` entity, in the entities' order.
 */
export function listArloCameras(entities: HAState[]): ArloCamera[] {
  return entities
    .filter((e) => e.entity_id.startsWith(ARLO_PREFIXES.camera))
    .map((cam) => {
      const suffix = cam.entity_id.slice(ARLO_PREFIXES.camera.length);
      const find = (prefix: string) => entities.find((e) => e.entity_id === `${prefix}${suffix}`);
      return {
        id: suffix,
        name: cam.attributes.friendly_name || suffix.charAt(0).toUpperCase() + suffix.slice(1),
        cameraEntity: cam,
        motionEntity: find(ARLO_PREFIXES.motion),
        connectedEntity: find(ARLO_PREFIXES.connected),
        lastCaptureEntity: find(ARLO_PREFIXES.lastCapture),
      };
    });
}

/**
 * URL of a camera's latest picture on the back. It changes whenever Home Assistant has a new
 * picture, so an image bound to it follows. Load it with `SecureImage` (the back wants the token in
 * the `Authorization` header).
 *
 * @param camera - Camera and its sensors.
 * @returns The URL, or undefined without a camera entity.
 */
export function cameraImageUrl(camera: ArloCamera): string | undefined {
  const entityId = camera.cameraEntity?.entity_id;
  if (!entityId) return undefined;
  const attributes = camera.cameraEntity?.attributes ?? {};
  const version = [
    attributes.image_source,
    attributes.last_thumbnail,
    camera.lastCaptureEntity?.state,
    camera.cameraEntity?.last_updated,
  ]
    .filter(Boolean)
    .join('_');
  return `${API_URL}/api/camera_proxy_image/${encodeURIComponent(entityId)}?v=${encodeURIComponent(version)}`;
}
