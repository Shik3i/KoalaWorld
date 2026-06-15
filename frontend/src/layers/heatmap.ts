import * as THREE from 'three';

const CANVAS_SIZE = 512;
const EARTH_RADIUS = 2.01;
const MAX_INTENSITY = 0.9;

let cachedCanvas: HTMLCanvasElement | null = null;
let cachedTexture: THREE.CanvasTexture | null = null;

function latLngToCanvas(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * CANVAS_SIZE;
  const y = ((90 - lat) / 180) * CANVAS_SIZE;
  return [x, y];
}

function getHeatColor(intensity: number): [number, number, number, number] {
  const t = Math.min(1, Math.max(0, intensity));
  if (t < 0.25) {
    const s = t / 0.25;
    return [0, Math.round(100 + s * 155), Math.round(255 - s * 55), 0.3 + s * 0.2];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [Math.round(s * 255), Math.round(255 - s * 55), 0, 0.5 + s * 0.3];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [255, Math.round((1 - s) * 200), 0, 0.8 + s * 0.2];
  } else {
    const s = (t - 0.75) / 0.25;
    return [255, Math.round((1 - s) * 100), Math.round(s * 100), 1.0];
  }
}

function magnitudeToIntensity(mag: number): number {
  if (mag < 2) return 0;
  if (mag >= 8) return 1;
  return Math.log(mag - 1) / Math.log(7);
}

export function clearHeatmapCache() {
  if (cachedCanvas) {
    cachedCanvas.width = 0;
    cachedCanvas.height = 0;
    cachedCanvas = null;
  }
  if (cachedTexture) {
    cachedTexture.dispose();
    cachedTexture = null;
  }
}

export function createHeatmapTexture(
  events: { latitude: number; longitude: number; magnitude?: number | null }[]
): THREE.CanvasTexture {
  const canvas = cachedCanvas || document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  cachedCanvas = canvas;

  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (const ev of events) {
    const [x, y] = latLngToCanvas(ev.latitude, ev.longitude);
    const mag = ev.magnitude ?? 1;
    const radius = 6 + mag * 4;
    const intensity = Math.min(MAX_INTENSITY, magnitudeToIntensity(mag));
    const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);

    const [cr, cg, cb, ca] = getHeatColor(intensity);
    gradient.addColorStop(0, `rgba(${cr},${cg},${cb},${ca})`);
    const hm = intensity * 0.6;
    const [mr, mg, mb] = getHeatColor(hm);
    gradient.addColorStop(0.4, `rgba(${mr},${mg},${mb},${ca * 0.6})`);
    gradient.addColorStop(1, 'rgba(255,0,0,0)');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  if (cachedTexture) {
    cachedTexture.needsUpdate = true;
    return cachedTexture;
  }

  const texture = new THREE.CanvasTexture(canvas);
  cachedTexture = texture;
  return texture;
}

export function createHeatmapOverlay(texture: THREE.CanvasTexture): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}
