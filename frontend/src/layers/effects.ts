import * as THREE from 'three';

export function createRippleEffect(
  position: THREE.Vector3,
  color: THREE.Color,
  scene: THREE.Scene
): void {
  const ringGeo = new THREE.TorusGeometry(0.05, 0.005, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(position);
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  scene.add(ring);

  const startTime = performance.now();
  function animate() {
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed > 2) {
      scene.remove(ring);
      ringGeo.dispose();
      ringMat.dispose();
      return;
    }
    const scale = 1 + elapsed * 3;
    ring.scale.setScalar(scale);
    ringMat.opacity = 0.6 * (1 - elapsed / 2);
    requestAnimationFrame(animate);
  }
  animate();
}

export function flashMarker(mesh: THREE.Mesh, originalColor: THREE.Color): void {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissive.set(0xffffff);
  mat.emissiveIntensity = 1;
  const origScale = mesh.scale.clone();
  mesh.scale.setScalar(origScale.x * 1.5);

  setTimeout(() => {
    mat.emissive.copy(originalColor);
    mat.emissiveIntensity = 0.3;
    mesh.scale.copy(origScale);
  }, 1000);
}
