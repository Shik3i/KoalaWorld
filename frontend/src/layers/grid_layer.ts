import * as THREE from 'three';

const RADIUS = 2.005;
const SEGMENTS = 64;

function latLngToPosition(lat: number, lng: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const x = -RADIUS * Math.sin(phi) * Math.cos(theta);
  const y = RADIUS * Math.cos(phi);
  const z = RADIUS * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function buildLatitudeArc(lat: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const lng = (i / SEGMENTS) * 360 - 180;
    pts.push(latLngToPosition(lat, lng));
  }
  return pts;
}

function buildLongitudeArc(lng: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const lat = (i / SEGMENTS) * 180 - 90;
    pts.push(latLngToPosition(lat, lng));
  }
  return pts;
}

export function createGridLayer(): THREE.Group {
  const group = new THREE.Group();
  const positions: number[] = [];

  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = buildLatitudeArc(lat);
    for (let i = 0; i < pts.length - 1; i++) {
      positions.push(pts[i].x, pts[i].y, pts[i].z);
      positions.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  }

  for (let lng = -180; lng < 180; lng += 30) {
    const pts = buildLongitudeArc(lng);
    for (let i = 0; i < pts.length - 1; i++) {
      positions.push(pts[i].x, pts[i].y, pts[i].z);
      positions.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x4488ff, opacity: 0.3, transparent: true });
  const lines = new THREE.LineSegments(geo, mat);
  group.add(lines);

  return group;
}
