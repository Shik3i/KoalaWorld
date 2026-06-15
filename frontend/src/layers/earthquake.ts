import * as THREE from 'three';
import type { GeoEvent } from '../types';

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

const MARKER_RADIUS = 2.01;

function getColor(mag: number): number {
  if (mag < 3) return 0x00ff00;
  if (mag < 5) return 0xffff00;
  if (mag < 6) return 0xff8800;
  return 0xff0000;
}

function getSize(mag: number): number {
  return 0.05 + mag * 0.02;
}

export function createEarthquakeMarkers(events: GeoEvent[]): THREE.Group {
  const group = new THREE.Group();

  if (events.length > 500) {
    const counts = new Map<number, { count: number; size: number }>();
    for (const ev of events) {
      const mag = ev.magnitude ?? 1;
      const color = getColor(mag);
      const s = getSize(mag);
      const entry = counts.get(color);
      if (entry) {
        entry.count++;
        entry.size = Math.max(entry.size, s);
      } else {
        counts.set(color, { count: 1, size: s });
      }
    }

    for (const [color, { count, size }] of counts) {
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (const ev of events) {
        const mag = ev.magnitude ?? 1;
        if (getColor(mag) !== color) continue;
        const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
        dummy.position.copy(pos);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
  } else {
    for (const ev of events) {
      const mag = ev.magnitude ?? 1;
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
      const size = getSize(mag);
      const color = getColor(mag);
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.copy(pos);
      group.add(marker);
    }
  }

  return group;
}
