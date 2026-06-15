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

function getFireColor(frp: number | undefined): THREE.Color {
  if (!frp || frp < 10) return new THREE.Color(0xff6600);
  if (frp < 100) return new THREE.Color(0xff3300);
  return new THREE.Color(0xff0000);
}

function getFireSize(frp: number | undefined): number {
  const base = 0.04;
  if (!frp) return base;
  return Math.max(0.03, Math.min(0.15, base + Math.log10(frp + 1) * 0.03));
}

export const wildfirePlugin: LayerPlugin = {
  id: 'wildfire',
  label: 'Wildfires',
  defaultVisible: false,
  pollIntervalMs: 5 * 60 * 1000,

  async fetchEvents(params: Record<string, string>): Promise<GeoEvent[]> {
    const res = await api.getEvents({ ...params, type: 'wildfire' });
    return res.data;
  },

  createMarkers(events: GeoEvent[], _cameraDistance: number): THREE.Group {
    const group = new THREE.Group();

    for (const ev of events) {
      const frp = (ev.metadata as Record<string, unknown> | undefined)?.frp as number | undefined;
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
      const color = getFireColor(frp);
      const size = getFireSize(frp);
      const geo = new THREE.ConeGeometry(size * 0.7, size * 1.4, 4);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.5,
        metalness: 0,
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.copy(pos);
      const dir = pos.clone().normalize();
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      marker.userData = {
        event: ev,
        eventId: ev.id,
        basePos: pos.clone(),
      };
      group.add(marker);
    }

    return group;
  },

  updateAnimation(group: THREE.Group, time: number, _delta: number): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.basePos) {
        const basePos = child.userData.basePos as THREE.Vector3;
        const wobble = Math.sin(time * 5 + child.id) * 0.015;
        child.position.copy(basePos);
        child.position.x += wobble;
        child.position.z += wobble;
      }
    });
  },
};
