import * as THREE from 'three';
import * as topojson from 'topojson-client';

const RADIUS = 2.005;

function latLngToPosition(lat: number, lng: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const x = -RADIUS * Math.sin(phi) * Math.cos(theta);
  const y = RADIUS * Math.cos(phi);
  const z = RADIUS * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

export async function createCountryBorders(): Promise<THREE.Group> {
  const group = new THREE.Group();

  try {
    const res = await fetch('https://unpkg.com/world-atlas@2/countries-110m.json');
    const topology = await res.json();
    const countries = topojson.feature(topology, topology.objects.countries) as any;

    const positions: number[] = [];

    for (const feature of countries.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const coords = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

      for (const polygon of coords) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length; i++) {
            const [lng, lat] = ring[i];
            const pos = latLngToPosition(lat, lng);
            positions.push(pos.x, pos.y, pos.z);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x44aa88, opacity: 0.4, transparent: true });
    const lines = new THREE.LineSegments(geo, mat);
    group.add(lines);
  } catch {
    console.warn('Failed to load country borders');
  }

  return group;
}
