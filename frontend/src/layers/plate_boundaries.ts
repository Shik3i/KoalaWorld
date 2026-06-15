import * as THREE from 'three';

const RADIUS = 2.02;
const SEGMENTS_PER_DEGREE = 2;

const PLATE_BOUNDARIES: [number, number][][] = [
  // San Andreas Fault (Pacific-North American)
  [[-124, 40], [-123, 38], [-122, 37], [-121, 36], [-120, 35], [-119, 34], [-117, 33], [-116, 32], [-115, 30]],

  // Cascadia Subduction Zone
  [[-128, 50], [-126, 48], [-125, 46], [-124, 44], [-124, 42], [-124, 40]],

  // Japan Trench
  [[142, 42], [143, 40], [144, 38], [144, 36], [143, 34], [142, 32], [141, 30], [140, 28]],

  // Izu-Bonin-Mariana Trench
  [[140, 28], [141, 25], [142, 22], [143, 18], [144, 14], [145, 10], [146, 6], [147, 2]],

  // Philippine Trench
  [[126, 16], [127, 13], [127, 10], [127, 7], [127, 4]],

  // Ryukyu Trench
  [[130, 32], [129, 30], [128, 28], [128, 26], [127, 24], [126, 22]],

  // Sunda Trench (Java-Sumatra)
  [[105, -6], [104, -8], [103, -10], [101, -12], [99, -10], [97, -8], [95, -6], [94, -4]],

  // New Hebrides Trench
  [[168, -14], [168, -16], [168, -18], [168, -20], [169, -22]],

  // Tonga-Kermadec Trench
  [[-175, -20], [-176, -22], [-177, -24], [-178, -26], [-179, -28], [180, -30], [179, -32], [178, -34], [177, -36]],

  // Peru-Chile Trench
  [[-80, -5], [-79, -8], [-78, -10], [-77, -14], [-76, -17], [-74, -20], [-73, -24], [-72, -28], [-70, -33], [-69, -38], [-67, -42], [-65, -46]],

  // Middle America Trench
  [[-106, 18], [-104, 17], [-100, 15], [-96, 13], [-92, 10], [-88, 8], [-85, 6], [-82, 4]],

  // Aleutian Trench
  [[164, 54], [170, 53], [176, 52], [-178, 51], [-172, 52], [-166, 54], [-160, 55], [-154, 56], [-148, 58]],

  // Kuril-Kamchatka Trench
  [[155, 50], [156, 48], [157, 46], [154, 44], [150, 42], [146, 40]],

  // Mid-Atlantic Ridge (north)
  [[-30, 70], [-28, 65], [-26, 60], [-24, 55], [-22, 50], [-21, 45], [-20, 40], [-19, 35], [-18, 30], [-17, 25], [-16, 20], [-15, 15]],

  // Mid-Atlantic Ridge (central)
  [[-14, 10], [-14, 5], [-13, 0], [-12, -5], [-12, -10], [-11, -15], [-10, -20], [-9, -25]],

  // Mid-Atlantic Ridge (south)
  [[-9, -30], [-8, -35], [-7, -40], [-6, -45], [-5, -50], [-4, -55], [-3, -60]],

  // East Pacific Rise
  [[-109, -10], [-108, -15], [-108, -20], [-109, -25], [-110, -30], [-111, -35], [-112, -40], [-113, -45], [-114, -50], [-115, -55]],

  // India-Eurasia (Himalaya front)
  [[70, 36], [72, 35], [74, 34], [76, 33], [78, 32], [80, 30], [82, 29], [84, 28], [86, 27], [88, 26], [90, 25], [92, 24], [94, 23], [95, 22]],

  // East African Rift
  [[34, 12], [35, 10], [36, 8], [37, 6], [37, 4], [36, 2], [35, 0], [34, -2], [34, -4], [33, -6], [33, -8], [33, -10], [33, -12], [33, -14], [34, -16], [34, -18], [34, -20]],

  // Anatolian Fault
  [[42, 41], [41, 40], [40, 39], [39, 38], [38, 38], [37, 37], [36, 36], [35, 36], [34, 35], [33, 34], [32, 34]],

  // Macquarie Ridge
  [[160, -50], [161, -52], [162, -54], [163, -56], [164, -58], [165, -60]],
];

function latLngToPosition(lat: number, lng: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -RADIUS * Math.sin(phi) * Math.cos(theta),
    RADIUS * Math.cos(phi),
    RADIUS * Math.sin(phi) * Math.sin(theta)
  );
}

export function createPlateBoundaries(): THREE.Group {
  const group = new THREE.Group();

  const positions: number[] = [];

  for (const segment of PLATE_BOUNDARIES) {
    for (let i = 0; i < segment.length - 1; i++) {
      const [lng1, lat1] = segment[i];
      const [lng2, lat2] = segment[i + 1];

      const stepCount = Math.max(1, Math.round(
        Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2) * SEGMENTS_PER_DEGREE
      ));

      for (let s = 0; s < stepCount; s++) {
        const t1 = s / stepCount;
        const t2 = (s + 1) / stepCount;
        const latA = lat1 + (lat2 - lat1) * t1;
        const lngA = lng1 + (lng2 - lng1) * t1;
        const latB = lat1 + (lat2 - lat1) * t2;
        const lngB = lng1 + (lng2 - lng1) * t2;

        const a = latLngToPosition(latA, lngA);
        const b = latLngToPosition(latB, lngB);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.15,
    depthTest: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  group.add(lines);

  return group;
}
