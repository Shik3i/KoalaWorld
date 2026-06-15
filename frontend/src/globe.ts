import * as THREE from 'three';
import type { GlobeTheme } from './themes/types';
import { THEMES } from './themes/presets';

let currentTheme: GlobeTheme = THEMES[0];
let globeMesh: THREE.Mesh;
let ambientLight: THREE.AmbientLight;
let directionalLight: THREE.DirectionalLight;
let starfieldGroup: THREE.Group | null = null;
let atmosphereMesh: THREE.Mesh | null = null;
let scene: THREE.Scene;

export function getCurrentTheme(): GlobeTheme {
  return currentTheme;
}

export function getThemes(): GlobeTheme[] {
  return THEMES;
}

function createStarfield(color: number = 0xffffff): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 30 + Math.random() * 20;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    const brightness = 0.3 + Math.random() * 0.7;
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    colors[i * 3] = r * brightness;
    colors[i * 3 + 1] = g * brightness;
    colors[i * 3 + 2] = b * brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  group.add(points);
  return group;
}

function createAtmosphereGlow(color: number = 0x4488ff): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(2.08, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform vec3 uColor;
      uniform vec3 uCameraPos;
      void main() {
        vec3 viewDir = normalize(uCameraPos - vPosition);
        float fresnel = 1.0 - abs(dot(viewDir, vNormal));
        fresnel = pow(fresnel, 3.0);
        float alpha = fresnel * 0.3;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 5) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

export function createGlobe(sceneRef: THREE.Scene, textureLoader: THREE.TextureLoader, themeId?: string): THREE.Mesh {
  scene = sceneRef;

  if (themeId) {
    const found = THEMES.find(t => t.id === themeId);
    if (found) currentTheme = found;
  }

  const theme = currentTheme;

  // Background
  if (typeof theme.backgroundColor === 'string') {
    document.body.style.backgroundColor = theme.backgroundColor;
  }

  // Starfield
  if (theme.showStarfield) {
    if (starfieldGroup) scene.remove(starfieldGroup);
    starfieldGroup = createStarfield(theme.starfieldColor || 0x8888cc);
    scene.add(starfieldGroup);
  }

  // Globe mesh
  const geometry = new THREE.SphereGeometry(2, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: theme.earthFallbackColor,
    roughness: theme.roughness,
    metalness: theme.metalness,
  });

  globeMesh = new THREE.Mesh(geometry, material);
  scene.add(globeMesh);

  // Load texture if specified
  if (theme.earthTextureUrl) {
    textureLoader.load(
      theme.earthTextureUrl,
      (texture) => {
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn(`Earth texture failed for theme ${theme.id}`);
      }
    );
  }

  // Lighting
  ambientLight = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(theme.directionalColor, theme.directionalIntensity);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  // Atmosphere
  if (theme.atmosphereGlow) {
    atmosphereMesh = createAtmosphereGlow(theme.atmosphereColor || 0x4488ff);
    scene.add(atmosphereMesh);
    globeMesh.userData.atmosphereMesh = atmosphereMesh;
  }

  return globeMesh;
}

export function applyGlobeTheme(themeId: string): GlobeTheme {
  const theme = THEMES.find(t => t.id === themeId);
  if (!theme) return currentTheme;

  currentTheme = theme;

  // Update background
  if (typeof theme.backgroundColor === 'string') {
    document.body.style.backgroundColor = theme.backgroundColor;
  }

  // Update starfield
  if (starfieldGroup) {
    scene.remove(starfieldGroup);
    starfieldGroup = null;
  }
  if (theme.showStarfield) {
    starfieldGroup = createStarfield(theme.starfieldColor || 0x8888cc);
    scene.add(starfieldGroup);
  }

  // Update globe material
  const mat = globeMesh.material as THREE.MeshStandardMaterial;
  mat.color.set(theme.earthFallbackColor);
  mat.roughness = theme.roughness;
  mat.metalness = theme.metalness;
  if (theme.earthTextureUrl) {
    new THREE.TextureLoader().load(theme.earthTextureUrl, (t) => {
      mat.map = t;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  } else {
    mat.map = null;
    mat.needsUpdate = true;
  }

  // Update lights
  ambientLight.color.set(theme.ambientColor);
  ambientLight.intensity = theme.ambientIntensity;
  directionalLight.color.set(theme.directionalColor);
  directionalLight.intensity = theme.directionalIntensity;

  // Update atmosphere
  if (atmosphereMesh) {
    scene.remove(atmosphereMesh);
    atmosphereMesh.geometry.dispose();
    (atmosphereMesh.material as THREE.ShaderMaterial).dispose();
    atmosphereMesh = null;
    delete globeMesh.userData.atmosphereMesh;
  }
  if (theme.atmosphereGlow) {
    atmosphereMesh = createAtmosphereGlow(theme.atmosphereColor || 0x4488ff);
    scene.add(atmosphereMesh);
    globeMesh.userData.atmosphereMesh = atmosphereMesh;
  }

  localStorage.setItem('koalaworld-theme', themeId);
  return currentTheme;
}

export function getCurrentGlobeMesh(): THREE.Mesh {
  return globeMesh;
}
