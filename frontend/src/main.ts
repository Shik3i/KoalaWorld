import './styles/base.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGlobe, applyGlobeTheme } from './globe';
import { api } from './api';
import { createEarthquakeMarkers, updateMarkerAnimations, needsRebuild } from './layers/earthquake';
import { createGridLayer } from './layers/grid_layer';
import { createCountryBorders } from './layers/country_borders';
import { createHeatmapTexture, createHeatmapOverlay } from './layers/heatmap';
import { createPlateBoundaries } from './layers/plate_boundaries';
import { createRippleEffect, flashMarker } from './layers/effects';
import { wildfirePlugin } from './layers/wildfire';
import { weatherPlugin } from './layers/weather';
import {
  createSidebar,
  createEventPanel,
  createMapControls,
  createInfoPanel,
  createMagnitudeLegend,
  createLoadingIndicator,
  createOfflineBanner,
  createAPIStatusMonitor,
  createAdminPanel,
} from './ui';
import type { SidebarCallbacks, FilterValues, LayerState, EventPanelState } from './ui';
import type { GeoEvent } from './types';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.setAttribute('tabindex', '0');
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const textureLoader = new THREE.TextureLoader();
const savedTheme = (localStorage.getItem('koalaworld-theme') as string) || 'satellite';
const globeMesh = createGlobe(scene, textureLoader, savedTheme);

// Move globe from scene into worldGroup so it rotates with layers
scene.remove(globeMesh);
worldGroup.add(globeMesh);

const plateGroup = createPlateBoundaries();
worldGroup.add(plateGroup);

const gridGroup = createGridLayer();
worldGroup.add(gridGroup);

camera.position.z = 15;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 15;

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

let markersGroup: THREE.Group | null = null;
let wildfireGroup: THREE.Group | null = null;
let weatherGroup: THREE.Group | null = null;
let bordersGroup: THREE.Group | null = null;
let heatmapGroup: THREE.Mesh | null = null;
let latestEvents: GeoEvent[] = [];
let totalEventCount = 0;

const layerControls: LayerState[] = [
  { id: 'earthquakes', label: 'Earthquakes', visible: true },
  { id: 'wildfire', label: 'Wildfires', visible: false },
  { id: 'weather', label: 'Weather', visible: false },
  { id: 'grid', label: 'Grid', visible: true },
  { id: 'borders', label: 'Country Borders', visible: true },
  { id: 'heatmap', label: 'Heatmap', visible: false },
  { id: 'plates', label: 'Tectonic Plates', visible: true },
];

function onLayerToggle(id: string, visible: boolean) {
  switch (id) {
    case 'earthquakes':
      if (markersGroup) markersGroup.visible = visible;
      break;
    case 'wildfire':
      if (wildfireGroup) wildfireGroup.visible = visible;
      break;
    case 'weather':
      if (weatherGroup) weatherGroup.visible = visible;
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
    case 'plates':
      plateGroup.visible = visible;
      break;
  }
}

function getEventsInView(): number {
  if (!markersGroup) return 0;
  let count = 0;
  const camDir = camera.position.clone().normalize();
  for (const ev of latestEvents) {
    const phi = (90 - ev.latitude) * Math.PI / 180;
    const theta = (ev.longitude + 180) * Math.PI / 180;
    const dot = camDir.dot(new THREE.Vector3(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)));
    if (dot > 0) count++;
  }
  return count;
}

// --- MODE SELECTOR (bottom bar) ---
type DataMode = 'live' | 'top' | 'today' | 'week' | 'month';
let currentMode: DataMode = 'live';
let liveCount = 100;
const liveCounts = [50, 100, 500, 1000, 5000];

function createModeSelector(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'kw-mode-bar kw-panel';
  bar.innerHTML = `
    <div class="kw-mode-buttons">
      <button class="kw-mode-btn active" data-mode="live">Live</button>
      <button class="kw-mode-btn" data-mode="top">Top</button>
      <button class="kw-mode-btn" data-mode="today">Today</button>
      <button class="kw-mode-btn" data-mode="week">Week</button>
      <button class="kw-mode-btn" data-mode="month">Month</button>
    </div>
    <div class="kw-mode-count" id="kw-live-count">
      <span class="kw-label">Show</span>
      <select class="kw-select">
        ${liveCounts.map(n => `<option value="${n}" ${n === liveCount ? 'selected' : ''}>Last ${n}</option>`).join('')}
      </select>
    </div>
  `;

  // Mode buttons
  bar.querySelectorAll('.kw-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.kw-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = (btn as HTMLElement).dataset.mode as DataMode;
      const countEl = document.getElementById('kw-live-count');
      if (countEl) countEl.style.display = currentMode === 'live' ? 'flex' : 'none';
      fetchAndDisplayEarthquakes();
    });
  });

  // Live count selector
  const select = bar.querySelector('.kw-select') as HTMLSelectElement;
  if (select) {
    select.addEventListener('change', () => {
      liveCount = parseInt(select.value);
      fetchAndDisplayEarthquakes();
    });
  }

  return bar;
}

// --- SIDEBAR ---
const filterState: FilterValues = { query: '', minMag: '', maxMag: '', dateFrom: '', dateTo: '' };

const sidebarCallbacks: SidebarCallbacks = {
  onThemeChange: (themeId) => {
    applyGlobeTheme(themeId);
    document.documentElement.setAttribute('data-theme',
      document.body.style.backgroundColor === '#f0f2f5' ? 'light' : 'dark');
  },
  onLayerToggle,
  onFilterApply: (filters) => {
    Object.assign(filterState, filters);
    fetchAndDisplayEarthquakes();
  },
  onFilterReset: () => {
    Object.assign(filterState, { query: '', minMag: '', maxMag: '', dateFrom: '', dateTo: '' });
    fetchAndDisplayEarthquakes();
  },
};

const sidebar = createSidebar(layerControls, filterState, sidebarCallbacks);
document.body.appendChild(sidebar);

// --- MODE BAR ---
const modeBar = createModeSelector();
document.body.appendChild(modeBar);

// --- INFO PANEL ---
const infoPanel = createInfoPanel();
document.body.appendChild(infoPanel.element);

// --- EVENT PANEL ---
let eventPanelPage = 1;
const eventPanel = createEventPanel({
  onEventClick: (event) => {
    rotateGlobeTo(event.latitude, event.longitude);
    infoPanel.show(event);
    if (markersGroup) {
      markersGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.eventId === event.id) {
          const origColor = (child.material as THREE.MeshStandardMaterial).color.clone();
          flashMarker(child, origColor);
        }
      });
    }
  },
  onEventHover: (_event) => {},
  onPageChange: (page) => {
    eventPanelPage = page;
    const epState: EventPanelState = {
      events: latestEvents,
      totalCount: totalEventCount,
      currentPage: page,
      pageSize: 50,
      loading: false,
      sortBy: 'time',
      sortDir: 'desc',
    };
    eventPanel.update(epState);
  },
  onExportCSV: () => {
    if (latestEvents.length === 0) return;
    const headers = ['ID', 'Type', 'Magnitude', 'Depth (km)', 'Latitude', 'Longitude', 'Time', 'Place'];
    const rows = latestEvents.map((ev) => {
      const place = (ev.metadata as any)?.place || '';
      return [ev.id, ev.type, ev.magnitude?.toFixed(2) || '', ev.depth_km?.toFixed(1) || '', ev.latitude.toFixed(4), ev.longitude.toFixed(4), ev.timestamp, `"${String(place).replace(/"/g, '""')}"`].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koalaworld-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
});
document.body.appendChild(eventPanel.element);

// --- MAP CONTROLS ---
const mapControls = createMapControls({
  onZoomIn: () => {
    camera.position.multiplyScalar(0.85);
    controls.update();
  },
  onZoomOut: () => {
    camera.position.multiplyScalar(1.15);
    controls.update();
  },
  onReset: () => {
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();
  },
  onFullscreen: () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  },
});
document.body.appendChild(mapControls);

// --- MAGNITUDE LEGEND ---
document.body.appendChild(createMagnitudeLegend());

// --- LOADING ---
const loading = createLoadingIndicator();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function findClosestEvent(hitPos: THREE.Vector3): GeoEvent | null {
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
  return closest;
}

function getIntersectHitPos(hit: THREE.Intersection): THREE.Vector3 {
  const hitPos = new THREE.Vector3();
  if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
    const matrix = new THREE.Matrix4();
    hit.object.getMatrixAt(hit.instanceId, matrix);
    hitPos.setFromMatrixPosition(matrix);
  } else if (hit.object instanceof THREE.Mesh) {
    hitPos.copy(hit.object.position);
  }
  return hitPos;
}

function onGlobeClick(event: MouseEvent) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  function checkGroup(group: THREE.Group | null): boolean {
    if (!group) return false;
    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hitPos = getIntersectHitPos(intersects[0]);
      const closest = findClosestEvent(hitPos);
      if (closest) {
        infoPanel.show(closest);
        const mag = closest.magnitude ?? 0;
        if (mag >= 6 && closest.type === 'earthquake') {
          const phi = (90 - closest.latitude) * Math.PI / 180;
          const theta = (closest.longitude + 180) * Math.PI / 180;
          const pos = new THREE.Vector3(-2.01 * Math.sin(phi) * Math.cos(theta), 2.01 * Math.cos(phi), 2.01 * Math.sin(phi) * Math.sin(theta));
          createRippleEffect(pos, new THREE.Color(0xff4400), scene);
        }
      }
      return true;
    }
    return false;
  }

  if (checkGroup(markersGroup)) return;
  if (checkGroup(wildfireGroup)) return;
  if (checkGroup(weatherGroup)) return;
  infoPanel.hide();
}

renderer.domElement.addEventListener('click', onGlobeClick);

createCountryBorders().then(group => {
  bordersGroup = group;
  worldGroup.add(group);
});

function buildQueryParams(): Record<string, string> {
  const params: Record<string, string> = { type: 'earthquake' };

  switch (currentMode) {
    case 'live':
      params.limit = String(liveCount);
      break;
    case 'top':
      params.limit = '500';
      params.min_mag = '6';
      break;
    case 'today': {
      const today = new Date().toISOString().slice(0, 10);
      params.from = today + 'T00:00:00Z';
      params.limit = '500';
      break;
    }
    case 'week': {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      params.from = weekAgo + 'T00:00:00Z';
      params.limit = '1000';
      break;
    }
    case 'month': {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      params.from = monthAgo + 'T00:00:00Z';
      params.limit = '2000';
      break;
    }
  }

  if (filterState.minMag) params.min_mag = filterState.minMag;
  if (filterState.maxMag) params.max_mag = filterState.maxMag;
  if (filterState.dateFrom && currentMode !== 'today' && currentMode !== 'week' && currentMode !== 'month') {
    params.from = filterState.dateFrom + 'T00:00:00Z';
  }
  if (filterState.dateTo && currentMode !== 'today' && currentMode !== 'week' && currentMode !== 'month') {
    params.to = filterState.dateTo + 'T23:59:59Z';
  }

  return params;
}

async function fetchAndDisplayEarthquakes() {
  try {
    loading.show();
    const params = buildQueryParams();
    const res = await api.getEvents(params);
    const eventsChanged = hasDataChanged(res.data, latestEvents);
    latestEvents = res.data;
    totalEventCount = res.total || res.data.length;

    if (eventsChanged || !markersGroup) {
      if (markersGroup) {
        disposeGroup(markersGroup);
        worldGroup.remove(markersGroup);
      }
      markersGroup = createEarthquakeMarkers(res.data, camera.position.length());
      markersGroup.visible = layerControls.find(c => c.id === 'earthquakes')?.visible ?? true;
      worldGroup.add(markersGroup);

      const heatmapVisible = layerControls.find(c => c.id === 'heatmap')?.visible ?? false;
      if (res.data.length > 0 && heatmapVisible) {
        if (heatmapGroup) {
          worldGroup.remove(heatmapGroup);
          const mat = Array.isArray(heatmapGroup.material) ? heatmapGroup.material[0] : heatmapGroup.material;
          if (mat instanceof THREE.MeshBasicMaterial && mat.map) mat.map.dispose();
          if (Array.isArray(heatmapGroup.material)) {
            heatmapGroup.material.forEach(m => m.dispose());
          } else {
            heatmapGroup.material.dispose();
          }
          heatmapGroup.geometry.dispose();
        }
        const tex = createHeatmapTexture(res.data);
        heatmapGroup = createHeatmapOverlay(tex);
        heatmapGroup.visible = heatmapVisible;
        worldGroup.add(heatmapGroup);
      }
    }

    const strongestMag = res.data.reduce((max, ev) => Math.max(max, ev.magnitude ?? 0), 0);

    const epState: EventPanelState = {
      events: res.data,
      totalCount: totalEventCount,
      currentPage: eventPanelPage,
      pageSize: 50,
      loading: false,
      sortBy: 'time',
      sortDir: 'desc',
    };
    eventPanel.update(epState);

    const sidebarStats = {
      totalEvents: totalEventCount,
      strongestMag: strongestMag > 0 ? strongestMag : null,
      eventsInView: getEventsInView(),
    };
    (sidebar as any).updateStats?.(sidebarStats);

    loading.hide();
  } catch {
    console.warn('Failed to fetch earthquake data - API may not be available yet');
    loading.hide();
  }
}

fetchAndDisplayEarthquakes();
const earthquakeInterval = setInterval(fetchAndDisplayEarthquakes, 60000);

function disposeGroup(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) {
      child.dispose();
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    } else if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    } else if (child instanceof THREE.Sprite) {
      const mat = child.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
  });
}

function hasDataChanged(newEvents: GeoEvent[], oldEvents: GeoEvent[]): boolean {
  if (newEvents.length !== oldEvents.length) return true;
  if (newEvents.length === 0) return false;
  return newEvents[0].id !== oldEvents[0].id || newEvents[newEvents.length - 1].id !== oldEvents[oldEvents.length - 1].id;
}

async function fetchAndDisplayWildfires() {
  try {
    const events = await wildfirePlugin.fetchEvents({ limit: '5000' });
    if (wildfireGroup) {
      worldGroup.remove(wildfireGroup);
      disposeGroup(wildfireGroup);
    }
    wildfireGroup = wildfirePlugin.createMarkers(events, camera.position.length());
    wildfireGroup.visible = layerControls.find(c => c.id === 'wildfire')?.visible ?? false;
    worldGroup.add(wildfireGroup);
  } catch {
    console.warn('Failed to fetch wildfire data');
  }
}

async function fetchAndDisplayWeather() {
  try {
    const events = await weatherPlugin.fetchEvents({ limit: '200' });
    if (weatherGroup) {
      worldGroup.remove(weatherGroup);
      disposeGroup(weatherGroup);
    }
    weatherGroup = weatherPlugin.createMarkers(events, camera.position.length());
    weatherGroup.visible = layerControls.find(c => c.id === 'weather')?.visible ?? false;
    worldGroup.add(weatherGroup);
  } catch {
    console.warn('Failed to fetch weather data');
  }
}

fetchAndDisplayWildfires();
fetchAndDisplayWeather();
const wildfireInterval = setInterval(fetchAndDisplayWildfires, 5 * 60 * 1000);
const weatherInterval = setInterval(fetchAndDisplayWeather, 5 * 60 * 1000);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  if (markersGroup) {
    updateMarkerAnimations(markersGroup, time, camera);
  }

  if (wildfireGroup && wildfirePlugin.updateAnimation) {
    wildfirePlugin.updateAnimation(wildfireGroup, time, delta);
  }

  const currentDist = camera.position.length();
  if (needsRebuild(currentDist) && latestEvents.length > 0) {
    if (markersGroup) {
      disposeGroup(markersGroup);
      worldGroup.remove(markersGroup);
    }
    markersGroup = createEarthquakeMarkers(latestEvents, currentDist);
    markersGroup.visible = layerControls.find(c => c.id === 'earthquakes')?.visible ?? true;
    worldGroup.add(markersGroup);
  }

  // Rotate entire world group so globe, borders, plates, markers all rotate together
  worldGroup.rotation.y += 0.0002;

  const atmosphereMesh = (globeMesh as any).userData?.atmosphereMesh as THREE.Mesh | undefined;
  if (atmosphereMesh) {
    atmosphereMesh.rotation.y = worldGroup.rotation.y;
  }

  renderer.render(scene, camera);

  if (Math.floor(time) % 60 === 0) {
    const drawCalls = renderer.info.render.calls;
    const triangles = renderer.info.render.triangles;
    if (drawCalls > 0) {
      console.debug(`Draw calls: ${drawCalls}, Triangles: ${triangles}`);
    }
  }
}

const offlineBanner = createOfflineBanner();
const monitor = createAPIStatusMonitor(
  () => { offlineBanner.style.display = 'none'; },
  () => { offlineBanner.style.display = 'block'; }
);
monitor.start();

const adminPanel = createAdminPanel(() => ({ layers: [] }));
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
  } catch { /* backend not available yet */ }
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
  clearInterval(wildfireInterval);
  clearInterval(weatherInterval);
  clearInterval(adminInterval);
  monitor.stop();
}

animate();
