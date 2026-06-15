import * as THREE from 'three';

const CANVAS_SIZE = 512;
const EARTH_RADIUS = 2.01;

function latLngToCanvas(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * CANVAS_SIZE;
  const y = ((90 - lat) / 180) * CANVAS_SIZE;
  return [x, y];
}

export function createHeatmapTexture(
  events: { latitude: number; longitude: number; magnitude?: number | null }[]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (const ev of events) {
    const [x, y] = latLngToCanvas(ev.latitude, ev.longitude);
    const mag = ev.magnitude ?? 1;
    const radius = 3 + mag * 2;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const intensity = Math.min(1, mag / 6);
    gradient.addColorStop(0, `rgba(255, ${Math.round(255 * (1 - intensity))}, 0, ${0.4 + intensity * 0.4})`);
    gradient.addColorStop(0.4, `rgba(255, ${Math.round(200 * (1 - intensity))}, 0, ${0.2 + intensity * 0.2})`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'screen';
  for (const ev of events) {
    const [x, y] = latLngToCanvas(ev.latitude, ev.longitude);
    const mag = ev.magnitude ?? 1;
    const radius = 2 + mag * 1.5;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const intensity = Math.min(1, mag / 6);
    gradient.addColorStop(0, `rgba(255, ${Math.round(200 * (1 - intensity))}, 50, 0.3)`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
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
