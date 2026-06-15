import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGlobe } from './globe';
import { api } from './api';
import { createEarthquakeMarkers } from './layers/earthquake';
import { createGridLayer } from './layers/grid_layer';
import { createCountryBorders } from './layers/country_borders';
import { createHeatmapTexture, createHeatmapOverlay } from './layers/heatmap';
import { createLayerUI, createPopup, createFilterUI, createThemeToggle, applyTheme, createAdminPanel, createLoadingIndicator, createOfflineBanner, createAPIStatusMonitor, createEventModal, createTimelineSlider } from './ui';
import type { LayerControl, FilterState } from './ui';
import type { GeoEvent } from './types';

document.body.style.backgroundColor = '#000';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.setAttribute('tabindex', '0');
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
createGlobe(scene, textureLoader);

const gridGroup = createGridLayer();
scene.add(gridGroup);

// Intro animation: start far away and zoom in
camera.position.z = 15;

let introAnimation: number | null = null;
function startIntroAnimation() {
  const startZ = 15;
  const endZ = 5;
  const duration = 2000;
  const startTime = performance.now();

  function animateIntro(time: number) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.z = startZ + (endZ - startZ) * eased;
    controls.update();

    if (progress < 1) {
      introAnimation = requestAnimationFrame(animateIntro);
    }
  }
  introAnimation = requestAnimationFrame(animateIntro);
}
startIntroAnimation();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 15;

// Touch gesture zones for quick camera actions
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length === 3) {
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();
  }
});

function rotateGlobeTo(lat: number, lng: number) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const radius = 5;
  camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
  camera.position.y = radius * Math.cos(phi);
  camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
  controls.target.set(0, 0, 0);
  controls.update();
}
void rotateGlobeTo;

let markersGroup: THREE.Group | null = null;
let bordersGroup: THREE.Group | null = null;
let heatmapGroup: THREE.Mesh | null = null;
let latestEvents: GeoEvent[] = [];

const layerControls: LayerControl[] = [
  { id: 'earthquakes', label: 'Earthquakes', visible: true },
  { id: 'grid', label: 'Grid', visible: true },
  { id: 'borders', label: 'Country Borders', visible: true },
  { id: 'heatmap', label: 'Heatmap', visible: false },
];

function onLayerToggle(id: string, visible: boolean) {
  switch (id) {
    case 'earthquakes':
      if (markersGroup) markersGroup.visible = visible;
      break;
    case 'grid':
      gridGroup.visible = visible;
      break;
    case 'borders':
      if (bordersGroup) bordersGroup.visible = visible;
      break;
    case 'heatmap':
      if (heatmapGroup) heatmapGroup.visible = visible;
      break;
  }
}

createLayerUI(layerControls, onLayerToggle);

// Search/Filter UI
const filterState: FilterState = { query: '', minMag: '', maxMag: '', dateFrom: '', dateTo: '' };
function applyFilters() {
  fetchAndDisplayEarthquakes();
}
createFilterUI(filterState, (newFilters) => {
  Object.assign(filterState, newFilters);
}, applyFilters);

// Theme
const savedTheme = (localStorage.getItem('koalaworld-theme') as 'dark' | 'light') || 'dark';
applyTheme(savedTheme);
createThemeToggle(savedTheme, (theme) => {
  applyTheme(theme);
});

// Timeline slider
const timelineSlider = createTimelineSlider('2024-01-01T00:00:00Z', new Date().toISOString(), (from, to) => {
  filterState.dateFrom = from.slice(0, 10);
  filterState.dateTo = to.slice(0, 10);
  fetchAndDisplayEarthquakes();
});
document.body.appendChild(timelineSlider);

const popup = createPopup();
const loading = createLoadingIndicator();
const modal = createEventModal();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onGlobeClick(event: MouseEvent) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  if (markersGroup) {
    const meshes: THREE.Mesh[] = [];
    markersGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });

    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0];
      let hitPos = new THREE.Vector3();

      if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
        const matrix = new THREE.Matrix4();
        hit.object.getMatrixAt(hit.instanceId, matrix);
        hitPos.setFromMatrixPosition(matrix);
      } else if (hit.object instanceof THREE.Mesh) {
        hitPos.copy(hit.object.position);
      }

      let closest: GeoEvent | null = null;
      let minDist = Infinity;
      for (const ev of latestEvents) {
        const phi = (90 - ev.latitude) * Math.PI / 180;
        const theta = (ev.longitude + 180) * Math.PI / 180;
        const ex = -2.01 * Math.sin(phi) * Math.cos(theta);
        const ey = 2.01 * Math.cos(phi);
        const ez = 2.01 * Math.sin(phi) * Math.sin(theta);
        const d = hitPos.distanceTo(new THREE.Vector3(ex, ey, ez));
        if (d < minDist) { minDist = d; closest = ev; }
      }
      if (closest) {
        popup.show(closest, event.clientX, event.clientY);
      }
      return;
    }
  }
  popup.hide();
}

renderer.domElement.addEventListener('click', onGlobeClick);

renderer.domElement.addEventListener('dblclick', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (markersGroup) {
    const meshes: THREE.Mesh[] = [];
    markersGroup.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      let closest: GeoEvent | null = null;
      let minDist = Infinity;
      const hit = intersects[0];
      let hitPos = new THREE.Vector3();
      if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
        const matrix = new THREE.Matrix4();
        hit.object.getMatrixAt(hit.instanceId, matrix);
        hitPos.setFromMatrixPosition(matrix);
      } else if (hit.object instanceof THREE.Mesh) {
        hitPos.copy(hit.object.position);
      }
      for (const ev of latestEvents) {
        const phi = (90 - ev.latitude) * Math.PI / 180;
        const theta = (ev.longitude + 180) * Math.PI / 180;
        const ex = -2.01 * Math.sin(phi) * Math.cos(theta);
        const ey = 2.01 * Math.cos(phi);
        const ez = 2.01 * Math.sin(phi) * Math.sin(theta);
        const d = hitPos.distanceTo(new THREE.Vector3(ex, ey, ez));
        if (d < minDist) { minDist = d; closest = ev; }
      }
      if (closest) modal.show(closest);
    }
  }
});

createCountryBorders().then(group => {
  bordersGroup = group;
  scene.add(group);
});

async function fetchAndDisplayEarthquakes() {
  try {
    loading.show();
    const params: Record<string, string> = { type: 'earthquake', limit: '200' };
    if (filterState.minMag) params.min_mag = filterState.minMag;
    if (filterState.maxMag) params.max_mag = filterState.maxMag;
    if (filterState.dateFrom) params.from = filterState.dateFrom + 'T00:00:00Z';
    if (filterState.dateTo) params.to = filterState.dateTo + 'T23:59:59Z';
    const res = await api.getEvents(params);
    latestEvents = res.data;
    if (markersGroup) {
      scene.remove(markersGroup);
      markersGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    markersGroup = createEarthquakeMarkers(res.data);
    scene.add(markersGroup);

    if (heatmapGroup) {
      scene.remove(heatmapGroup);
      heatmapGroup.geometry.dispose();
      if (Array.isArray(heatmapGroup.material)) {
        heatmapGroup.material.forEach(m => m.dispose());
      } else {
        heatmapGroup.material.dispose();
      }
    }
    if (res.data.length > 0) {
      const tex = createHeatmapTexture(res.data);
      heatmapGroup = createHeatmapOverlay(tex);
      heatmapGroup.visible = layerControls.find(c => c.id === 'heatmap')?.visible ?? false;
      scene.add(heatmapGroup);
    }
    loading.hide();
  } catch {
    console.warn('Failed to fetch earthquake data – API may not be available yet');
    loading.hide();
  }
}

fetchAndDisplayEarthquakes();
const earthquakeInterval = setInterval(fetchAndDisplayEarthquakes, 30000);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Backend offline detection
const offlineBanner = createOfflineBanner();
const monitor = createAPIStatusMonitor(
  () => { offlineBanner.style.display = 'none'; },
  () => { offlineBanner.style.display = 'block'; }
);
monitor.start();

// Admin status
const adminPanel = createAdminPanel(() => {
  return { layers: [] };
});
document.body.appendChild(adminPanel);

async function refreshAdminStatus() {
  try {
    const res = await api.getLayers();
    adminPanel.replaceWith(createAdminPanel(() => ({
      layers: (res as any).data?.map((l: any) => ({
        type: l.type,
        enabled: l.enabled,
        lastSync: l.last_sync
      })) || []
    })));
    document.body.appendChild(adminPanel);
  } catch {}
}
refreshAdminStatus();
const adminInterval = setInterval(refreshAdminStatus, 60000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export function dispose() {
  if (introAnimation) cancelAnimationFrame(introAnimation);
  renderer.domElement.removeEventListener('click', onGlobeClick);
  clearInterval(earthquakeInterval);
  clearInterval(adminInterval);
  monitor.stop();
}

animate();
