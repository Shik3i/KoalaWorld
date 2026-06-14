import * as THREE from 'three';

// Setup environment for dark page and canvas visibility
document.body.style.backgroundColor = '#000';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a simple sphere (the globe)
const geometry = new THREE.SphereGeometry(2, 64, 64);
// Using MeshLambertMaterial for better compatibility with basic lighting in minimal setup
const material = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.5 }); // A stylized blue globe
const globe = new THREE.Mesh(geometry, material);
scene.add(globe);

// Lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

camera.position.z = 5;

// Animation loop
function animate() {
	requestAnimationFrame(animate);

	// Rotate the globe
	globe.rotation.y += 0.005;
	globe.rotation.x += 0.001;

	renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();