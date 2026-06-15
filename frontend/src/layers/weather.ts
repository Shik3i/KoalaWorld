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

function getTempColor(tempC: number | undefined): THREE.Color {
  if (tempC === undefined) return new THREE.Color(0x888888);
  if (tempC < 0) return new THREE.Color(0x4488ff);
  if (tempC < 10) return new THREE.Color(0x44aaff);
  if (tempC < 20) return new THREE.Color(0x66dd66);
  if (tempC < 25) return new THREE.Color(0xffcc00);
  if (tempC < 35) return new THREE.Color(0xff8800);
  return new THREE.Color(0xff2200);
}

export const weatherPlugin: LayerPlugin = {
  id: 'weather',
  label: 'Weather',
  defaultVisible: false,
  pollIntervalMs: 5 * 60 * 1000,

  async fetchEvents(params: Record<string, string>): Promise<GeoEvent[]> {
    const res = await api.getEvents({ ...params, type: 'weather' });
    return res.data;
  },

  createMarkers(events: GeoEvent[], _cameraDistance: number): THREE.Group {
    const group = new THREE.Group();
    const DOT_SIZE = 0.03;

    for (const ev of events) {
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
      const tempC = (ev.metadata as Record<string, unknown> | undefined)?.temperature_2m as number | undefined;
      const color = getTempColor(tempC);
      const geo = new THREE.SphereGeometry(DOT_SIZE, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0,
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
