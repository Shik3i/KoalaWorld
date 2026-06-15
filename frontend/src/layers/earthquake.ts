import * as THREE from 'three';
import type { GeoEvent } from '../types';

const MARKER_RADIUS = 2.01;
const REBUILD_DISTANCE_THRESHOLD = 1;
const INSTANCED_THRESHOLD = 100;
const MAX_MARKERS = 10000;

interface ClusterCell {
  events: GeoEvent[];
  avgLat: number;
  avgLng: number;
  avgMag: number;
}

let lastCameraDistance = -Infinity;

export function needsRebuild(cameraDistance: number): boolean {
  return Math.abs(cameraDistance - lastCameraDistance) > REBUILD_DISTANCE_THRESHOLD;
}

function latLngToPosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function getColor(mag: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (mag - 2.5) / 5.0));
  const r = t < 0.5 ? t * 2 : 1;
  const g = t < 0.5 ? 1 : 2 - t * 2;
  const b = 0;
  return new THREE.Color(r, g, b);
}

function getSize(mag: number): number {
  const baseSize = 0.04;
  const size = baseSize + mag * 0.015;
  return Math.max(0.03, Math.min(0.15, size));
}

function isRecent(timestamp: string): boolean {
  const eventTime = new Date(timestamp).getTime();
  const now = Date.now();
  return now - eventTime < 24 * 60 * 60 * 1000;
}

function clusterEvents(events: GeoEvent[], resolution: number): ClusterCell[] {
  const cells = new Map<string, ClusterCell>();
  const latStep = 180 / resolution;
  const lngStep = 360 / resolution;

  for (const ev of events) {
    const latIdx = Math.floor((ev.latitude + 90) / latStep);
    const lngIdx = Math.floor((ev.longitude + 180) / lngStep);
    const key = `${latIdx},${lngIdx}`;

    const existing = cells.get(key);
    if (existing) {
      existing.events.push(ev);
      const n = existing.events.length;
      existing.avgLat = existing.avgLat * ((n - 1) / n) + ev.latitude / n;
      existing.avgLng = existing.avgLng * ((n - 1) / n) + ev.longitude / n;
      existing.avgMag = existing.avgMag * ((n - 1) / n) + (ev.magnitude ?? 0) / n;
    } else {
      cells.set(key, {
        events: [ev],
        avgLat: ev.latitude,
        avgLng: ev.longitude,
        avgMag: ev.magnitude ?? 0,
      });
    }
  }

  return Array.from(cells.values());
}

function createCountLabel(count: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(count > 99 ? '99+' : String(count), 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  );
  sprite.scale.set(0.12, 0.12, 1);
  return sprite;
}

function createInstancedMarkers(events: GeoEvent[], widthSeg: number, heightSeg: number): THREE.Group {
  const group = new THREE.Group();
  const colorGroups = new Map<string, { color: THREE.Color; events: GeoEvent[] }>();

  for (const ev of events) {
    const mag = ev.magnitude ?? 1;
    const c = getColor(mag);
    const hex = c.getHexString();
    if (!colorGroups.has(hex)) {
      colorGroups.set(hex, { color: c, events: [] });
    }
    colorGroups.get(hex)!.events.push(ev);
  }

  for (const [, groupData] of colorGroups) {
    const evts = groupData.events;
    const color = groupData.color;
    let maxSize = 0;
    for (const ev of evts) {
      const s = getSize(ev.magnitude ?? 1);
      if (s > maxSize) maxSize = s;
    }
    const geo = new THREE.SphereGeometry(maxSize, widthSeg, heightSeg);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, evts.length);
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (const ev of evts) {
      const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
      dummy.position.copy(pos);
      dummy.scale.setScalar(getSize(ev.magnitude ?? 1) / maxSize);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  return group;
}

function createIndividualMarkers(events: GeoEvent[]): THREE.Group {
  const group = new THREE.Group();

  for (const ev of events) {
    const mag = ev.magnitude ?? 1;
    const pos = latLngToPosition(ev.latitude, ev.longitude, MARKER_RADIUS);
    const size = getSize(mag);
    const color = getColor(mag);
    const geo = new THREE.SphereGeometry(size, 12, 8);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(pos);
    marker.userData = {
      event: ev,
      eventId: ev.id,
      baseSize: size,
      pulse: isRecent(ev.timestamp),
      mag,
    };

    if (mag >= 6) {
      const ringGeo = new THREE.TorusGeometry(size * 1.3, size * 0.15, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.userData = { type: 'ring', baseScale: 1, mag };
      marker.add(ring);
    }

    group.add(marker);
  }

  return group;
}

function createClusteredMarkers(events: GeoEvent[], resolution: number, widthSeg: number, heightSeg: number): THREE.Group {
  const group = new THREE.Group();
  const clusters = clusterEvents(events, resolution);

  for (const cluster of clusters) {
    const pos = latLngToPosition(cluster.avgLat, cluster.avgLng, MARKER_RADIUS);
    const color = getColor(cluster.avgMag);
    const size = 0.06 + Math.log(cluster.events.length) * 0.03;
    const geo = new THREE.SphereGeometry(size, widthSeg, heightSeg);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(pos);
    marker.userData = {
      cluster: true,
      count: cluster.events.length,
      events: cluster.events,
    };

    const label = createCountLabel(cluster.events.length);
    label.position.copy(pos.clone().normalize().multiplyScalar(MARKER_RADIUS + size * 1.5));
    group.add(label);
    group.add(marker);
  }

  return group;
}

export function createEarthquakeMarkers(
  events: GeoEvent[],
  cameraDistance: number = 5
): THREE.Group {
  lastCameraDistance = cameraDistance;

  let eventsToRender = events;
  if (events.length > MAX_MARKERS) {
    console.warn(`Earthquake markers: ${events.length} events, limiting to ${MAX_MARKERS}`);
    eventsToRender = events.slice(0, MAX_MARKERS);
  }

  if (cameraDistance > 12 && eventsToRender.length > 20) {
    return createClusteredMarkers(eventsToRender, 18, 4, 3);
  }

  if (cameraDistance > 8 && eventsToRender.length > 20) {
    return createClusteredMarkers(eventsToRender, 36, 8, 6);
  }

  if (eventsToRender.length > INSTANCED_THRESHOLD) {
    if (cameraDistance > 5) {
      return createInstancedMarkers(eventsToRender, 8, 6);
    }
    return createInstancedMarkers(eventsToRender, 12, 8);
  }

  return createIndividualMarkers(eventsToRender);
}

export function updateMarkerAnimations(group: THREE.Group, time: number, camera?: THREE.Camera) {
  let frustum: THREE.Frustum | null = null;
  if (camera) {
    frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
  }

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.pulse) return;

    if (frustum) {
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      if (!frustum.containsPoint(worldPos)) return;
    }

    const scale = 1 + Math.sin(time * 3) * 0.15;
    if (child.userData.baseSize) {
      child.scale.setScalar(scale);
    }

    if (child.userData.type === 'ring') {
      const elapsed = time % 2;
      const ringScale = child.userData.baseScale + elapsed;
      child.scale.setScalar(ringScale);
      if (child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = 0.5 * Math.max(0, 1 - elapsed / 2);
      }
    }
  });
}

export { MARKER_RADIUS };
