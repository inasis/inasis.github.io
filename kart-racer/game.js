import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/loaders/GLTFLoader.js/+esm';

const $ = (id) => document.getElementById(id);
const game = $('game');
const loading = $('loading');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91caee);
scene.fog = new THREE.Fog(0x91caee, 180, 570);

const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
game.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x49643b, 2.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(-100, 150, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 720),
  new THREE.MeshStandardMaterial({ color: 0x63974b, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// -----------------------------------------------------------------------------
// Track
// Positive-radius polar curve: complex shape without X-shaped self crossings.
// -----------------------------------------------------------------------------
function trackPoint(u) {
  const a = u * Math.PI * 2;
  const r = 210
    + 30 * Math.sin(3 * a + 0.3)
    + 19 * Math.sin(5 * a - 0.7)
    + 11 * Math.cos(2 * a + 0.2);

  return new THREE.Vector3(
    Math.cos(a) * r * 1.22,
    0,
    Math.sin(a) * r * 0.82
  );
}

const N = 800;
const ROAD_HALF = 11.5;
const centers = [];
const tangents = [];
const leftEdge = [];
const rightEdge = [];
const cumulative = [0];

for (let i = 0; i < N; i++) {
  const p = trackPoint(i / N);
  const p0 = trackPoint((i - 1 + N) / N);
  const p1 = trackPoint((i + 1) / N);
  const tangent = p1.clone().sub(p0).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  centers.push(p);
  tangents.push(tangent);
  leftEdge.push(p.clone().addScaledVector(side, ROAD_HALF));
  rightEdge.push(p.clone().addScaledVector(side, -ROAD_HALF));

  if (i > 0) cumulative[i] = cumulative[i - 1] + centers[i].distanceTo(centers[i - 1]);
}

const trackLength = cumulative[N - 1] + centers[N - 1].distanceTo(centers[0]);

function orient(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}
function segmentsCross(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function selfIntersects(arr, stride = 3) {
  const n = arr.length;
  for (let i = 0; i < n; i += stride) {
    const ni = (i + stride) % n;
    for (let j = i + stride * 2; j < n; j += stride) {
      const nj = (j + stride) % n;
      const separation = Math.min(Math.abs(j - i), n - Math.abs(j - i));
      if (separation <= stride * 2) continue;
      if (segmentsCross(arr[i], arr[ni], arr[j], arr[nj])) return true;
    }
  }
  return false;
}

if (selfIntersects(centers) || selfIntersects(leftEdge) || selfIntersects(rightEdge)) {
  throw new Error('Track validation failed: self intersection detected.');
}

const roadPositions = [];
const roadIndices = [];
for (let i = 0; i < N; i++) {
  roadPositions.push(leftEdge[i].x, 0.035, leftEdge[i].z);
  roadPositions.push(rightEdge[i].x, 0.035, rightEdge[i].z);
}
for (let i = 0; i < N; i++) {
  const j = (i + 1) % N;
  roadIndices.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
}
const roadGeo = new THREE.BufferGeometry();
roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
roadGeo.setIndex(roadIndices);
roadGeo.computeVertexNormals();
const road = new THREE.Mesh(
  roadGeo,
  new THREE.MeshStandardMaterial({ color: 0x3e4248, roughness: 0.96, side: THREE.DoubleSide })
);
road.receiveShadow = true;
scene.add(road);

const railMat = new THREE.MeshStandardMaterial({ color: 0xd9dce0, metalness: 0.62, roughness: 0.32 });
const postMat = new THREE.MeshStandardMaterial({ color: 0x555960, metalness: 0.35, roughness: 0.55 });
const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

function buildTrackSide(arr) {
  for (let i = 0; i < N; i += 6) {
    const j = (i + 6) % N;
    const a = arr[i];
    const b = arr[j];
    const d = b.clone().sub(a);

    const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, d.length()), lineMat);
    line.position.copy(a).add(b).multiplyScalar(0.5);
    line.position.y = 0.09;
    line.rotation.y = Math.atan2(d.x, d.z);
    scene.add(line);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, d.length() + 0.2), railMat);
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.position.y = 0.8;
    beam.rotation.y = Math.atan2(d.x, d.z);
    beam.castShadow = true;
    scene.add(beam);

    if (i % 18 === 0) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.25, 0.3), postMat);
      post.position.copy(a);
      post.position.y = 0.55;
      scene.add(post);
    }
  }
}
buildTrackSide(leftEdge);
buildTrackSide(rightEdge);

// A few low-poly environmental markers.
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x70513b, roughness: 1 });
const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x397c48, roughness: 1 });
for (let i = 0; i < 48; i++) {
  const a = i * 2.399963;
  const r = 295 + (i % 4) * 11;
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.48, 3, 7), treeTrunkMat);
  trunk.position.y = 1.5;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 8), treeLeafMat);
  crown.position.y = 4.7;
  g.add(trunk, crown);
  g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8);
  g.scale.setScalar(0.75 + (i % 3) * 0.12);
  scene.add(g);
}

// -----------------------------------------------------------------------------
// Track sampling helpers
// -----------------------------------------------------------------------------
function nearestTrack(p) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < N; i += 2) {
    const d = centers[i].distanceToSquared(p);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { index, dist: Math.sqrt(best) };
}

function sampleDistance(distance) {
  const d = ((distance % trackLength) + trackLength) % trackLength;
  let lo = 0;
  let hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulative[mid] <= d) lo = mid;
    else hi = mid - 1;
  }

  const i = lo;
  const j = (i + 1) % N;
  const d0 = cumulative[i];
  const d1 = j === 0 ? trackLength : cumulative[j];
  const f = (d - d0) / Math.max(0.001, d1 - d0);

  return {
    position: centers[i].clone().lerp(centers[j], f),
    tangent: tangents[i].clone().lerp(tangents[j], f).normalize(),
    index: i,
  };
}

function progressAtPosition(p, lap) {
  const n = nearestTrack(p);
  return lap * trackLength + (cumulative[n.index] || 0);
}

function signedTrackGap(a, b) {
  let d = b - a;
  while (d > trackLength * 0.5) d -= trackLength;
  while (d < -trackLength * 0.5) d += trackLength;
  return d;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function signedTurn(distance, look = 36) {
  const a = sampleDistance(distance).tangent;
  const b = sampleDistance(distance + look).tangent;
  return Math.atan2(a.z * b.x - a.x * b.z, THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

// -----------------------------------------------------------------------------
// GLB cars
// -----------------------------------------------------------------------------
const loader = new GLTFLoader();
const MODEL_YAW = Math.PI; // Cosmo models face the opposite local Z direction.
const CAR_SCALE = 0.8;

async function loadCarAsset(filename) {
  const gltf = await loader.loadAsync(`./assets/cars/${filename}`);
  const root = gltf.scene;
  root.rotation.y = MODEL_YAW;
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return root;
}

function fallbackKart(color = 0x2876e5) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.65, 4.0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  body.position.y = 0.7;
  root.add(body);
  return root;
}

async function makeCar(filename, fallbackColor) {
  const group = new THREE.Group();
  let model;
  try {
    model = await loadCarAsset(filename);
  } catch (err) {
    console.warn(`Failed to load ${filename}; using fallback.`, err);
    model = fallbackKart(fallbackColor);
  }
  model.rotation.y = MODEL_YAW;
  model.scale.setScalar(CAR_SCALE);
  group.add(model);
  scene.add(group);
  return group;
}

const [playerCar, ...aiCars] = await Promise.all([
  makeCar('rally.glb', 0x2876e5),
  makeCar('coupe.glb', 0xe04b4b),
  makeCar('fenyr.glb', 0xe5b73b),
  makeCar('italia.glb', 0x8b5ce5),
  makeCar('kamaro.glb', 0x42a66b),
  makeCar('lamb.glb', 0xe76fa9),
]);

playerCar.position.copy(centers[0]);
playerCar.position.y = 0.06;

// -----------------------------------------------------------------------------
// Player state
// -----------------------------------------------------------------------------
let heading = Math.atan2(tangents[0].x, tangents[0].z);
let speed = 0;
let leftHeld = false;
let rightHeld = false;
let brakeHeld = false;
let driftHeld = false;
let prevDriftHeld = false;
let slide = 0;
let driftYaw = 0;
let cameraHeading = heading;
let boost = 0;
let wallContact = false;
let wallTime = 0;
let playerLap = 0;
let lastTrackIndex = 0;
let lapStart = performance.now();
let bestLap = Infinity;
let lapWallTouches = 0;
let lastWall = false;
let recoveryBlink = 0;
let blinkClock = 0;
let stuckTime = 0;
let lastMotion = playerCar.position.clone();

const history = [];
let historyDistance = 0;
let lastHistory = playerCar.position.clone();

const NORMAL = 'NORMAL';
const ENTRY = 'ENTRY';
const SHORT = 'SHORT';
const FULL = 'FULL';
let driftState = NORMAL;
let driftTime = 0;
let driftDir = 0;
let driftCharge = 0;
let shortLife = 0;
let chainWindow = 0;

function steeringInput() {
  if (leftHeld === rightHeld) return 0;
  return leftHeld ? -1 : 1;
}

// -----------------------------------------------------------------------------
// Adaptive learning: 120 track segments, persisted in localStorage.
// -----------------------------------------------------------------------------
const SEGMENTS = 120;
const STORAGE_KEY = 'adaptive-kart-ai-v1';
let learned = Array.from({ length: SEGMENTS }, () => ({ lane: 0, speed: 135, drift: 0, confidence: 0 }));
const currentLap = Array.from({ length: SEGMENTS }, () => ({ lane: 0, speed: 0, drift: 0, count: 0 }));
let learnedLaps = 0;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.segments?.length === SEGMENTS) {
    learned = saved.segments;
    learnedLaps = saved.learnedLaps || 0;
    bestLap = saved.bestLap || Infinity;
  }
} catch (err) {
  console.warn('Could not restore AI learning data.', err);
}
$('learnCount').textContent = learnedLaps;

function saveLearningProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ learnedLaps, bestLap, segments: learned }));
  } catch (err) {
    console.warn('Could not persist AI learning data.', err);
  }
}

function segmentForIndex(index) {
  return Math.min(SEGMENTS - 1, Math.floor(index / N * SEGMENTS));
}

function recordLearning() {
  if (wallContact || speed < 8) return;

  const n = nearestTrack(playerCar.position);
  const seg = segmentForIndex(n.index);
  const side = new THREE.Vector3(-tangents[n.index].z, 0, tangents[n.index].x);
  const lane = THREE.MathUtils.clamp(playerCar.position.clone().sub(centers[n.index]).dot(side), -7, 7);
  const s = currentLap[seg];
  s.lane += lane;
  s.speed += Math.max(0, speed);
  s.drift += (driftState === SHORT || driftState === FULL) ? 1 : 0;
  s.count++;
}

function commitLap(lapTime) {
  learnedLaps++;
  if (lapTime < bestLap) bestLap = lapTime;

  const pace = THREE.MathUtils.clamp(bestLap / lapTime, 0.55, 1);
  const clean = Math.max(0.45, 1 - lapWallTouches * 0.07);
  const quality = pace * clean;
  const alpha = 0.18 + 0.42 * quality;

  for (let i = 0; i < SEGMENTS; i++) {
    const s = currentLap[i];
    const dst = learned[i];
    if (s.count) {
      const lane = s.lane / s.count;
      const v = s.speed / s.count;
      const driftRatio = s.drift / s.count;
      const a = dst.confidence === 0 ? 1 : alpha;
      dst.lane = THREE.MathUtils.lerp(dst.lane, lane, a);
      dst.speed = THREE.MathUtils.lerp(dst.speed, v, a);
      dst.drift = THREE.MathUtils.lerp(dst.drift, driftRatio, a);
      dst.confidence = Math.min(1, dst.confidence + 0.22 * quality);
    }
    s.lane = 0;
    s.speed = 0;
    s.drift = 0;
    s.count = 0;
  }

  lapWallTouches = 0;
  $('learnCount').textContent = learnedLaps;
  saveLearningProfile();
}

function learnedAt(distance) {
  const sm = sampleDistance(distance);
  return learned[segmentForIndex(sm.index)];
}

// -----------------------------------------------------------------------------
// Player drift state machine
// -----------------------------------------------------------------------------
function beginDrift() {
  const s = steeringInput();
  if (s === 0 || speed < 25) return;
  driftDir = s;
  driftTime = 0;

  if (chainWindow > 0) {
    driftState = FULL;
    driftCharge = 0.25;
    chainWindow = 0;
    driftYaw = s * THREE.MathUtils.degToRad(12);
  } else {
    driftState = ENTRY;
  }
}

function releaseDrift() {
  if (driftState === ENTRY) {
    driftState = SHORT;
    shortLife = 0.72;
    driftYaw = driftDir * THREE.MathUtils.degToRad(14);
    slide = driftDir * 1.75;
    boost = Math.min(100, boost + 20);
    speed = Math.max(10, speed - 4);
    chainWindow = 0.48;
  } else if (driftState === FULL) {
    // Full drift exits into the visual direction, so the camera stays continuous.
    heading -= driftYaw;
    driftYaw = 0;
    slide *= 0.44;
    driftCharge = 0;
    driftState = NORMAL;
  }
}

function updateDrift(dt) {
  const s = steeringInput();
  if (chainWindow > 0) chainWindow = Math.max(0, chainWindow - dt);

  if (driftHeld && !prevDriftHeld) beginDrift();
  if (!driftHeld && prevDriftHeld) releaseDrift();

  if (driftState === ENTRY) {
    driftTime += dt;
    driftYaw += angleDelta(driftYaw, driftDir * THREE.MathUtils.degToRad(8 + driftTime * 20)) * Math.min(1, dt * 12);
    slide += driftDir * dt * 2.5;
    if (driftTime >= 0.24) {
      driftState = FULL;
      driftCharge = 0.12;
    }
  }

  if (driftState === FULL) {
    driftCharge = Math.min(1, driftCharge + dt / 0.95);
    const sf = s === -driftDir ? 0.62 : s === driftDir ? 1.08 : 1;
    driftYaw += angleDelta(
      driftYaw,
      driftDir * THREE.MathUtils.degToRad(40) * driftCharge * sf
    ) * Math.min(1, dt * 6.7);

    speed = Math.max(35, speed - (7 + 18 * driftCharge) * dt);
    boost = Math.min(100, boost + (22 + 38 * driftCharge) * dt);
    slide += driftDir * dt * (2.5 + 5.8 * driftCharge);
    slide = THREE.MathUtils.clamp(slide, -5.2, 5.2);
  }

  if (driftState === SHORT) {
    shortLife -= dt;
    const counter = s === -driftDir;
    const same = s === driftDir;
    driftYaw += angleDelta(driftYaw, 0) * Math.min(1, dt * (counter ? 8.5 : same ? 1.2 : 2.4));
    slide *= Math.pow(counter ? 0.07 : same ? 0.72 : 0.26, dt);
    if (counter) heading -= s * Math.min(1, Math.abs(speed) / 80) * 0.42 * dt;
    if (same) shortLife = Math.min(0.8, shortLife + dt * 0.22);

    if (shortLife <= 0 || Math.abs(driftYaw) < THREE.MathUtils.degToRad(1.2)) {
      driftYaw = 0;
      slide *= 0.4;
      driftState = NORMAL;
      driftDir = 0;
    }
  }

  prevDriftHeld = driftHeld;
}

// -----------------------------------------------------------------------------
// Wall contact + recovery
// -----------------------------------------------------------------------------
function wallPhysics(dt) {
  const n = nearestTrack(playerCar.position);
  const limit = ROAD_HALF - 1.25;

  if (n.dist < limit - 0.25) {
    wallContact = false;
    wallTime = 0;
    lastWall = false;
    return;
  }

  wallContact = true;
  wallTime += dt;
  if (!lastWall) {
    lapWallTouches++;
    lastWall = true;
  }

  const c = centers[n.index];
  const out = playerCar.position.clone().sub(c);
  out.y = 0;
  if (out.lengthSq() < 0.001) out.set(1, 0, 0);
  out.normalize();

  if (n.dist > limit) {
    playerCar.position.copy(c).addScaledVector(out, limit - 0.04);
    playerCar.position.y = 0.06;
  }

  let wallHeading = Math.atan2(tangents[n.index].x, tangents[n.index].z);
  if (Math.cos(heading - wallHeading) < 0) wallHeading += Math.PI;
  heading += angleDelta(heading, wallHeading) * Math.min(1, dt * (0.75 + Math.min(1, Math.abs(speed) / 135)));

  const friction = 16 + 38 * Math.min(1, Math.abs(speed) / 170) + Math.min(24, wallTime * 6);
  if (speed > 10) speed = Math.max(10, speed - friction * dt);
  else if (speed < 0) speed = Math.min(0, speed + friction * dt);
  slide *= Math.pow(0.02, dt);
}

function saveHistory() {
  const d = playerCar.position.distanceTo(lastHistory);
  if (d < 0.8) return;
  historyDistance += d;
  history.push({ distance: historyDistance, index: nearestTrack(playerCar.position).index });
  lastHistory.copy(playerCar.position);
  while (history.length > 650) history.shift();
}

function recover() {
  const target = historyDistance - 10;
  let safe = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].distance <= target) {
      safe = history[i];
      break;
    }
  }

  const idx = safe ? safe.index : 0;
  playerCar.position.copy(centers[idx]);
  playerCar.position.y = 0.06;
  heading = Math.atan2(tangents[idx].x, tangents[idx].z);
  cameraHeading = heading;
  speed = 10;
  slide = 0;
  driftYaw = 0;
  driftState = NORMAL;
  driftHeld = false;
  prevDriftHeld = false;
  wallContact = false;
  wallTime = 0;
  stuckTime = 0;
  lastMotion.copy(playerCar.position);
  lastHistory.copy(playerCar.position);
  recoveryBlink = 4;
  blinkClock = 0;
  playerCar.visible = true;
}

function checkStuck(dt) {
  const moved = playerCar.position.distanceTo(lastMotion);
  const trying = wallContact && (speed >= 9 || brakeHeld || Math.abs(steeringInput()) > 0.1);
  if (trying && moved < 0.025) stuckTime += dt;
  else stuckTime = Math.max(0, stuckTime - dt * 3);
  lastMotion.copy(playerCar.position);
  if (stuckTime >= 1.4) recover();
}

function updateLap(index, dot) {
  if (lastTrackIndex > N * 0.82 && index < N * 0.18 && dot > 0) {
    playerLap++;
    const now = performance.now();
    commitLap((now - lapStart) / 1000);
    lapStart = now;
  }
  lastTrackIndex = index;
}

// -----------------------------------------------------------------------------
// AI: learned line/speed/drift + avoidance + drift state machine.
// -----------------------------------------------------------------------------
const aiNames = ['RED', 'GOLD', 'VIOLET', 'GREEN', 'PINK'];
const ai = aiCars.map((group, i) => ({
  name: aiNames[i],
  group,
  distance: -(i + 1) * 6.2,
  speed: 125 + i * 4,
  baseSpeed: 147 + i * 4,
  lane: (i % 2 ? -1 : 1) * (1.2 + (i % 3) * 0.5),
  desiredLane: 0,
  bumpX: 0,
  bumpZ: 0,
  phase: i * 1.7,
  skill: 0.55 + i * 0.09,
  driftState: NORMAL,
  driftYaw: 0,
  driftDir: 0,
  driftCharge: 0,
  driftTimer: 0,
  slide: 0,
  counter: 0,
}));

function chooseAILane(car) {
  const data = learnedAt(car.distance + 20);
  const learn = Math.min(0.9, learnedLaps * 0.16) * car.skill * data.confidence;
  const choices = [-5, -2.5, 0, 2.5, 5];
  let best = 0;
  let bestRisk = Infinity;

  for (const lane of choices) {
    let risk = Math.abs(lane) * 0.015 + Math.abs(lane - data.lane) * 0.13 * learn;

    for (const other of ai) {
      if (other === car) continue;
      const g = signedTrackGap(car.distance, other.distance);
      if (g > 0 && g < 27 && Math.abs(lane - other.lane) < 2.5) risk += (27 - g) * 0.09;
    }

    const pp = progressAtPosition(playerCar.position, playerLap);
    const pg = signedTrackGap(car.distance, pp);
    const pn = nearestTrack(playerCar.position);
    const side = new THREE.Vector3(-tangents[pn.index].z, 0, tangents[pn.index].x);
    const playerLane = playerCar.position.clone().sub(centers[pn.index]).dot(side);
    if (pg > 0 && pg < 27 && Math.abs(lane - playerLane) < 2.5) risk += (27 - pg) * 0.1;

    if (risk < bestRisk) {
      bestRisk = risk;
      best = lane;
    }
  }

  car.desiredLane = THREE.MathUtils.lerp(best, data.lane, learn * 0.65);
}

function updateAIDrift(car, dt) {
  const turn = signedTurn(car.distance, 38);
  const absTurn = Math.abs(turn);
  const dir = Math.sign(turn) || 1;
  const data = learnedAt(car.distance + 14);
  const learn = Math.min(0.85, learnedLaps * 0.18) * car.skill * data.confidence;
  const urge = absTurn + data.drift * 0.23 * learn;

  if (car.driftState === NORMAL && car.speed > 100 && urge > 0.105) {
    if (urge > 0.24) {
      car.driftState = FULL;
      car.driftDir = dir;
      car.driftCharge = 0.08;
      car.driftTimer = 0;
    } else {
      car.driftState = SHORT;
      car.driftDir = dir;
      car.counter = 0.48;
      car.driftYaw = dir * THREE.MathUtils.degToRad(12);
      car.slide = dir * 1.2;
    }
  }

  if (car.driftState === FULL) {
    car.driftTimer += dt;
    car.driftCharge = Math.min(1, car.driftCharge + dt / 0.9);
    car.driftYaw += angleDelta(
      car.driftYaw,
      car.driftDir * THREE.MathUtils.degToRad(38) * car.driftCharge
    ) * Math.min(1, dt * 6.5);
    car.slide += car.driftDir * dt * (2.2 + 4.8 * car.driftCharge);
    car.slide = THREE.MathUtils.clamp(car.slide, -4.5, 4.5);
    if (absTurn < 0.09 || car.driftTimer > 1.15) {
      car.driftState = 'COUNTER';
      car.counter = 0.42;
    }
  } else if (car.driftState === SHORT) {
    car.counter -= dt;
    car.driftYaw += angleDelta(car.driftYaw, 0) * Math.min(1, dt * 2.2);
    car.slide *= Math.pow(0.36, dt);
    if (car.counter <= 0 || absTurn < 0.055) {
      car.driftState = 'COUNTER';
      car.counter = 0.26;
    }
  } else if (car.driftState === 'COUNTER') {
    car.counter -= dt;
    car.driftYaw += angleDelta(car.driftYaw, 0) * Math.min(1, dt * 8.5);
    car.slide *= Math.pow(0.05, dt);
    if (car.counter <= 0 || Math.abs(car.driftYaw) < THREE.MathUtils.degToRad(1)) {
      car.driftYaw = 0;
      car.slide = 0;
      car.driftCharge = 0;
      car.driftState = NORMAL;
    }
  }
}

function updateAI(dt, time) {
  for (const car of ai) {
    chooseAILane(car);
    updateAIDrift(car, dt);

    const data = learnedAt(car.distance + 20);
    const learn = Math.min(0.86, learnedLaps * 0.15) * car.skill * data.confidence;
    car.lane += (car.desiredLane - car.lane) * Math.min(1, dt * (car.driftState === FULL ? 1.2 : 2.2));

    const turn = Math.abs(signedTurn(car.distance, 34));
    let desired = car.baseSpeed * THREE.MathUtils.clamp(1 - turn / 1.08, 0.5, 1);

    if (data.confidence > 0) {
      const learnedSpeed = THREE.MathUtils.clamp(data.speed * (1.015 + 0.025 * car.skill), 75, 180);
      desired = THREE.MathUtils.lerp(desired, learnedSpeed, learn);
    }

    if (car.driftState === FULL) desired -= 16 + 18 * car.driftCharge;
    if (car.driftState === SHORT) desired -= 5;

    for (const other of ai) {
      if (other === car) continue;
      const g = signedTrackGap(car.distance, other.distance);
      if (g > 0 && g < 18 && Math.abs(other.lane - car.lane) < 2.8) {
        desired = Math.min(desired, other.speed + (g - 6) * 2);
      }
    }

    const pg = signedTrackGap(car.distance, progressAtPosition(playerCar.position, playerLap));
    if (pg > 0 && pg < 18) desired = Math.min(desired, Math.max(65, speed) + (pg - 6) * 2);

    desired = THREE.MathUtils.clamp(desired + Math.sin(time * 0.0006 + car.phase) * 2.2, 72, 180);
    const accel = desired > car.speed ? 30 : 62;
    car.speed += THREE.MathUtils.clamp(desired - car.speed, -accel * dt, accel * dt);
    car.distance += car.speed / 3.6 * dt;

    const sm = sampleDistance(car.distance);
    const side = new THREE.Vector3(-sm.tangent.z, 0, sm.tangent.x);
    car.group.position.copy(sm.position)
      .addScaledVector(side, THREE.MathUtils.clamp(car.lane + car.slide * 0.55, -7, 7))
      .add(new THREE.Vector3(car.bumpX, 0, car.bumpZ));
    car.group.position.y = 0.06;
    car.group.rotation.y = Math.atan2(sm.tangent.x, sm.tangent.z) - car.driftYaw;

    car.bumpX *= Math.pow(0.08, dt);
    car.bumpZ *= Math.pow(0.08, dt);
  }
}

// -----------------------------------------------------------------------------
// Vehicle collisions
// -----------------------------------------------------------------------------
const COLLISION_RADIUS = 1.45;

function resolvePair(a, b, aSpeed, bSpeed, pushA, pushB) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const ds = dx * dx + dz * dz;
  const minDist = COLLISION_RADIUS * 2;
  if (ds >= minDist * minDist || ds < 0.00001) return null;

  const d = Math.sqrt(ds);
  const nx = dx / d;
  const nz = dz / d;
  const overlap = minDist - d;
  pushA(-nx * overlap * 0.5, -nz * overlap * 0.5);
  pushB(nx * overlap * 0.5, nz * overlap * 0.5);
  return THREE.MathUtils.clamp(3 + Math.abs(aSpeed - bSpeed) * 0.14, 3, 22);
}

function resolveVehicleCollisions() {
  for (const car of ai) {
    const loss = resolvePair(
      playerCar.position,
      car.group.position,
      speed,
      car.speed,
      (x, z) => {
        playerCar.position.x += x;
        playerCar.position.z += z;
      },
      (x, z) => {
        car.bumpX += x;
        car.bumpZ += z;
      }
    );

    if (loss !== null) {
      if (speed > 0) speed = Math.max(10, speed - loss);
      car.speed = Math.max(60, car.speed - loss * 0.65);
    }
  }

  for (let i = 0; i < ai.length; i++) {
    for (let j = i + 1; j < ai.length; j++) {
      const a = ai[i];
      const b = ai[j];
      const loss = resolvePair(
        a.group.position,
        b.group.position,
        a.speed,
        b.speed,
        (x, z) => {
          a.bumpX += x;
          a.bumpZ += z;
        },
        (x, z) => {
          b.bumpX += x;
          b.bumpZ += z;
        }
      );
      if (loss !== null) {
        a.speed = Math.max(65, a.speed - loss * 0.45);
        b.speed = Math.max(65, b.speed - loss * 0.45);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Ranking HUD
// -----------------------------------------------------------------------------
function updateRankingUI() {
  const list = [{ name: 'YOU', score: progressAtPosition(playerCar.position, playerLap), player: true }];
  for (const car of ai) list.push({ name: car.name, score: car.distance, player: false });
  list.sort((a, b) => b.score - a.score);

  $('rank').textContent = list.findIndex((x) => x.player) + 1;
  $('lap').textContent = Math.min(3, playerLap + 1);
  $('ranking').innerHTML = list.map((r, i) =>
    `<div class="rank-row ${r.player ? 'me' : ''}"><span>${i + 1}</span><span>${r.name}</span></div>`
  ).join('');
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------
function bindHold(id, on, off) {
  const el = $(id);
  const down = (e) => {
    e.preventDefault();
    on();
    el.classList.add('pressed');
    try { el.setPointerCapture(e.pointerId); } catch {}
  };
  const up = (e) => {
    e?.preventDefault?.();
    off();
    el.classList.remove('pressed');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

bindHold('leftBtn', () => leftHeld = true, () => leftHeld = false);
bindHold('rightBtn', () => rightHeld = true, () => rightHeld = false);
bindHold('driftBtn', () => driftHeld = true, () => driftHeld = false);
bindHold('brakeBtn', () => brakeHeld = true, () => brakeHeld = false);

addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') leftHeld = true;
  if (e.code === 'ArrowRight') rightHeld = true;
  if (e.code === 'ArrowDown') brakeHeld = true;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    driftHeld = true;
    e.preventDefault();
  }
});
addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') leftHeld = false;
  if (e.code === 'ArrowRight') rightHeld = false;
  if (e.code === 'ArrowDown') brakeHeld = false;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') driftHeld = false;
});

// -----------------------------------------------------------------------------
// Resize
// -----------------------------------------------------------------------------
function resize() {
  const r = game.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(game);
resize();

// -----------------------------------------------------------------------------
// Main loop
// -----------------------------------------------------------------------------
const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const side = new THREE.Vector3();
const camDir = new THREE.Vector3();
let rankTimer = 0;
let learnTimer = 0;

function loop(time) {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.035);
  const steering = steeringInput();

  const near = nearestTrack(playerCar.position);
  const touching = near.dist >= ROAD_HALF - 1.7;

  // Signed speed: brake becomes reverse accelerator after reaching zero.
  if (brakeHeld) {
    if (speed > 0) speed = Math.max(0, speed - 155 * dt);
    else speed = Math.max(-20, speed - 32 * dt);
  } else if (!touching) {
    if (speed < 0) speed = Math.min(0, speed + 27 * dt);
    else speed = Math.min(180, speed + 38 * dt);
  }

  updateDrift(dt);

  const reverse = speed < -0.2;
  const norm = Math.min(1, Math.abs(speed) / 75);
  const steerRate = driftState === FULL ? 0.48 : driftState === SHORT ? 0.64 : 0.82;
  heading -= steering * (reverse ? -1 : 1) * steerRate * norm * dt;

  if (driftState !== FULL && driftState !== SHORT) slide *= Math.pow(0.045, dt);

  forward.set(Math.sin(heading), 0, Math.cos(heading));
  side.set(forward.z, 0, -forward.x);
  const mps = speed / 3.6;
  playerCar.position.addScaledVector(forward, mps * dt);
  playerCar.position.addScaledVector(side, slide * dt);

  wallPhysics(dt);
  checkStuck(dt);

  playerCar.rotation.y = heading - driftYaw;

  const pn = nearestTrack(playerCar.position);
  updateLap(pn.index, forward.dot(tangents[pn.index]));
  if (!wallContact && speed > 8) saveHistory();

  learnTimer += dt;
  if (learnTimer > 0.1) {
    learnTimer = 0;
    recordLearning();
  }

  if (recoveryBlink > 0) {
    recoveryBlink -= dt;
    blinkClock += dt;
    if (blinkClock > 0.16) {
      blinkClock = 0;
      playerCar.visible = !playerCar.visible;
    }
    if (recoveryBlink <= 0) {
      playerCar.visible = true;
      recoveryBlink = 0;
    }
  }

  updateAI(dt, time);
  resolveVehicleCollisions();

  rankTimer += dt;
  if (rankTimer > 0.12) {
    rankTimer = 0;
    updateRankingUI();
  }

  // Camera always follows the visual vehicle heading during drift.
  const visualHeading = heading - driftYaw;
  cameraHeading += angleDelta(cameraHeading, visualHeading) * Math.min(1, dt * 6.2);

  // Rear view only while brake is actively held and the vehicle is actually reversing.
  const rear = brakeHeld && speed < -0.2;
  const ch = cameraHeading + (rear ? Math.PI : 0);
  camDir.set(Math.sin(ch), 0, Math.cos(ch));

  const desired = playerCar.position.clone()
    .addScaledVector(camDir, -10.8)
    .add(new THREE.Vector3(0, 5.8, 0));
  camera.position.lerp(desired, 1 - Math.pow(0.0015, dt));
  camera.lookAt(
    playerCar.position.clone()
      .addScaledVector(camDir, 7.5)
      .add(new THREE.Vector3(0, 1.1, 0))
  );

  $('speed').textContent = Math.round(speed);
  $('boostBar').style.width = `${boost}%`;
  $('boostText').textContent = `BOOST ${Math.round(boost)}%`;
  $('driftState').textContent = driftState === SHORT && steeringInput() === -driftDir ? 'COUNTER' : driftState;
  $('driftAngle').textContent = `${Math.round(Math.abs(THREE.MathUtils.radToDeg(driftYaw)))}°`;

  renderer.render(scene, camera);
}

updateRankingUI();
loading.remove();
requestAnimationFrame(loop);
