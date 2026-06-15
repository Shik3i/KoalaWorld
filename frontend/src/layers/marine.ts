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

function getWaveColor(height: number | undefined): THREE.Color {
  if (height === undefined) return new THREE.Color(0x4488ff);
  if (height < 0.5) return new THREE.Color(0x4488ff);
  if (height < 1.5) return new THREE.Color(0x44aaff);
  if (height < 3) return new THREE.Color(0x66ccff);
  if (height < 5) return new THREE.Color(0xff8800);
  return new THREE.Color(0xff2200);
}

export const marinePlugin: LayerPlugin = {
  id: 'marine',
  label: 'Marine',
  defaultVisible: false,
  pollIntervalMs: 5 * 60 * 1000,

  async fetchEvents(params: Record<string, string>): Promise<GeoEvent[]> {
    const res = await api.getEvents({ ...params, type: 'marine' });
    return res.data;
  },

  createMarkers(events: GeoEvent[], _cameraDistance: number): THREE.Group {
    const group = new THREE.Group();
    const DOT_SIZE = 0.04;

    for (const ev of events) {
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
      const waveHeight = (ev.metadata as Record<string, unknown> | undefined)?.wave_height as number | undefined;
      const color = getWaveColor(waveHeight);
      const geo = new THREE.SphereGeometry(DOT_SIZE, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.1,
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.copy(pos);
      marker.userData = {
        event: ev,
        eventId: ev.id,
      };
      group.add(marker);
    }

    return group;
  },
};
