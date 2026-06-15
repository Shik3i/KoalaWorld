import * as THREE from 'three';

const EARTH_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png';
const FALLBACK_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

export function createGlobe(scene: THREE.Scene, textureLoader: THREE.TextureLoader): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(2, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2233aa,
    roughness: 0.5,
    metalness: 0.1,
  });

  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  textureLoader.load(
    EARTH_TEXTURE_URL,
    (texture) => {
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    },
    undefined,
    () => {
      textureLoader.load(
        FALLBACK_TEXTURE_URL,
        (texture) => {
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn('Earth texture failed to load, using fallback color');
        }
      );
    }
  );

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  return globe;
}
