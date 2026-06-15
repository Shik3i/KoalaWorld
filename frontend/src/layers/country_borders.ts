import * as THREE from 'three';
import * as topojson from 'topojson-client';

const RADIUS = 2.005;
const CDN_URLS = [
  'https://unpkg.com/world-atlas@2/countries-110m.json',
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
];

function latLngToPosition(lat: number, lng: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const x = -RADIUS * Math.sin(phi) * Math.cos(theta);
  const y = RADIUS * Math.cos(phi);
  const z = RADIUS * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

async function fetchTopology(urls: string[]): Promise<any> {
  let lastError: Error | null = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err as Error;
      if ((err as Error).name === 'AbortError') break;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All border CDN URLs failed');
}

export async function createCountryBorders(): Promise<THREE.Group> {
  const group = new THREE.Group();

  try {
    const topology = await fetchTopology(CDN_URLS);
    const countries = topojson.feature(topology, topology.objects.countries) as any;

    const mat = new THREE.LineBasicMaterial({ color: 0x44aa88, opacity: 0.4, transparent: true });

    for (const feature of countries.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const coords = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

      for (const polygon of coords) {
        for (const ring of polygon) {
          if (ring.length < 2) continue;
          const positions: number[] = [];
          for (let i = 0; i < ring.length; i++) {
            const [lng, lat] = ring[i];
            const pos = latLngToPosition(lat, lng);
            positions.push(pos.x, pos.y, pos.z);
          }
          const ringGeo = new THREE.BufferGeometry();
          ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          const line = new THREE.Line(ringGeo, mat);
          group.add(line);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load country borders:', (err as Error).message || err);
  }

  return group;
}
