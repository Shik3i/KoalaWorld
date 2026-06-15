import * as THREE from 'three';
import type { GeoEvent } from '../types';
import type { LayerPlugin } from './plugin';
import { api } from '../api';

const MARKER_RADIUS = 2.01;

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export const issPlugin: LayerPlugin = {
  id: 'iss',
  label: 'ISS',
  defaultVisible: false,
  pollIntervalMs: 10000,

  async fetchEvents(params: Record<string, string>): Promise<GeoEvent[]> {
    const res = await api.getEvents({ ...params, type: 'iss' });
    return res.data;
  },

  createMarkers(events: GeoEvent[], _cameraDistance: number): THREE.Group {
    const group = new THREE.Group();

    for (const ev of events) {
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);

      // ISS glow
      const glowGeo = new THREE.SphereGeometry(0.06, 16, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(pos);
      glow.userData = { event: ev, eventId: ev.id, isISS: true };
      group.add(glow);

      // ISS core
      const coreGeo = new THREE.SphereGeometry(0.03, 12, 8);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x88ddff });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(pos);
      core.userData = { event: ev, eventId: ev.id, isISS: true };
      group.add(core);
    }

    return group;
  },

  updateAnimation(group: THREE.Group, _time: number, _delta: number): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isISS) {
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.2;
        child.scale.setScalar(scale);
        if (child.material instanceof THREE.MeshBasicMaterial && child.material.transparent) {
          child.material.opacity = 0.2 + Math.sin(Date.now() * 0.003) * 0.1;
        }
      }
    });
  },
};
