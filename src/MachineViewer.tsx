import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { StageController } from './StageController';
import { A5_ASPECT_LONG_OVER_SHORT } from './simulation/constants';

/** Fusion-style CAD exports are usually Z-up; Three.js uses Y-up (grid/floor on XZ). */
const MODEL_UP_AXIS_FIX_X = -Math.PI / 2;

/** A5 ISO footprint (long / short). Spec: paper size A5 only. */
const BOND_ASPECT_LONG_OVER_SHORT = A5_ASPECT_LONG_OVER_SHORT;
const BOND_PAPER_SHORT_FALLBACK = 22;
const BOND_PAPER_LONG_FALLBACK = BOND_PAPER_SHORT_FALLBACK * BOND_ASPECT_LONG_OVER_SHORT;
const BOND_PAPER_THICKNESS = 1.05;

/** Hide oversized CAD-only paper geometry; replaced by procedural bond sheet below. */
const CAD_PAPER_NAME_FRAGMENTS = ['paper_stack', 'paper_bundle', 'finished_book'] as const;

function normalizeCadNodeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function hideCadPaperMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const n = normalizeCadNodeName(child.name);
    if (!CAD_PAPER_NAME_FRAGMENTS.some((frag) => n.includes(frag))) return;
    child.visible = false;
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

function isCadPaperMeshName(meshName: string): boolean {
  const n = normalizeCadNodeName(meshName);
  return CAD_PAPER_NAME_FRAGMENTS.some((frag) => n.includes(frag));
}

/** Zero local X/Z tilt on conveyor & tray assemblies so CAD export skew reads level on the floor plane. */
function flattenConveyorAndTraySectionTilt(root: THREE.Object3D) {
  const fragments = ['conveyor_transfer_system', 'output_tray'] as const;
  root.traverse((child) => {
    const n = normalizeCadNodeName(child.name);
    if (!fragments.some((frag) => n.includes(frag))) return;
    child.rotation.x = 0;
    child.rotation.z = 0;
    child.updateMatrix();
  });
}

interface PaperAnchors {
  hopper: THREE.Vector3;
  counting: THREE.Vector3;
  conveyor: THREE.Vector3;
  punch: THREE.Vector3;
  spiral: THREE.Vector3;
  tray: THREE.Vector3;
}

interface PaperPathConfig {
  anchors: PaperAnchors;
  transportDeckY: number;
  trayRestY: number;
  feedYaw: number;
  paperLong: number;
  paperShort: number;
  /** Total thickness (Y) of the finished book when lying flat on the tray. */
  bookThicknessY: number;
  /** Straight feed line on XZ: start → +(lineDir * lineLen) ends at tray center. */
  lineStart: THREE.Vector3;
  lineDir: THREE.Vector3;
  lineLen: number;
  uCount: number;
  uConv: number;
  uPunch: number;
  uSpiral: number;
}

function smoothstep01(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function xzOnStraightFeed(path: PaperPathConfig, u: number, target: THREE.Vector3): THREE.Vector3 {
  const clamped = THREE.MathUtils.clamp(u, 0, 1);
  return target
    .copy(path.lineStart)
    .addScaledVector(path.lineDir, clamped * path.lineLen);
}

const paperXZScratch = new THREE.Vector3();
const stackLayoutScratch = new THREE.Vector3();

const BOOK_STACK_POOL = 48;
const BOOK_STACK_GAP = 0.1;

/** Lying flat on tray: large face on XZ, thin axis Y (stack thickness). */
function getBoundBookFlatMetrics(paperLong: number, paperShort: number) {
  const L = paperLong * 1.02;
  const W = paperShort * 1.06;
  const t = THREE.MathUtils.clamp(paperShort * 0.078, 1.8, 4.6);
  const spineZ = THREE.MathUtils.clamp(W * 0.12, 2.4, W * 0.2);
  const z0 = -W / 2 + spineZ + 0.03;
  const z1 = W / 2 - 0.03;
  const bodyDepthZ = Math.max(z1 - z0, W * 0.45);
  const zBodyCenter = (z0 + z1) / 2;
  return { L, W, t, spineZ, bodyDepthZ, zBodyCenter };
}

function makePageEdgeStripeTexture(): THREE.CanvasTexture {
  const cnv = document.createElement('canvas');
  cnv.width = 128;
  cnv.height = 128;
  const ctx = cnv.getContext('2d')!;
  ctx.fillStyle = '#f6f7f9';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#c5c9cf';
  ctx.lineWidth = 1;
  for (let i = 1; i < 20; i++) {
    const y = Math.round((i / 20) * 126) + 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function disposeObjectMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.map) m.map.dispose();
      m.dispose?.();
    }
  });
}

function createBoundBookGroup(pLong: number, pShort: number): THREE.Group {
  const { L, W, t, spineZ, bodyDepthZ, zBodyCenter } = getBoundBookFlatMetrics(pLong, pShort);

  const g = new THREE.Group();
  g.name = 'Finished_Bound_Book';

  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xfcfcfc,
    roughness: 0.78,
    metalness: 0.03,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: 0xaaabaf,
    roughness: 0.74,
    metalness: 0.05,
  });

  const spineMeshZ = Math.max(spineZ - 0.04, 2);
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(L * 1.01, t * 1.04, spineMeshZ),
    spineMat
  );
  spine.position.set(0, t / 2, -W / 2 + spineMeshZ / 2 + 0.015);
  spine.castShadow = true;
  spine.receiveShadow = true;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(L * 0.985, t * 0.9, bodyDepthZ * 0.98),
    coverMat
  );
  body.position.set(0, t / 2, zBodyCenter);
  body.castShadow = true;
  body.receiveShadow = true;

  const stripeTex = makePageEdgeStripeTexture();
  const topMat = new THREE.MeshStandardMaterial({
    map: stripeTex,
    roughness: 0.76,
    metalness: 0.03,
    color: 0xffffff,
  });
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(L * 0.92, bodyDepthZ * 0.9),
    topMat
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, t + 0.03, zBodyCenter);
  top.castShadow = true;

  g.add(spine, body, top);
  return g;
}

function computePaperPathConfig(
  model: THREE.Group,
  findMeshes: (parent: THREE.Group, pattern: string) => THREE.Mesh[]
): PaperPathConfig {
  model.updateMatrixWorld(true);

  const boxFor = (...patterns: string[]): THREE.Box3 | null => {
    let meshes: THREE.Mesh[] = [];
    for (const p of patterns) {
      meshes = findMeshes(model, p).filter((m) => !isCadPaperMeshName(m.name));
      if (meshes.length) break;
    }
    if (!meshes.length) return null;
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    return box;
  };

  const xzFrom = (box: THREE.Box3 | null, fallback: THREE.Vector3): THREE.Vector3 => {
    if (!box) return fallback.clone();
    const c = box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(c.x, 0, c.z);
  };

  const hopperB = boxFor('Paper_Hopper', 'hopper');
  const countingB = boxFor('Counting_Mechanism', 'counting');
  const conveyorB = boxFor('Conveyor_Transfer_System', 'conveyor');
  const punchB = boxFor('Punching_Station', 'punch');
  const spiralB = boxFor('Spiral_Binding_Unit', 'spiral', 'binding');
  const trayB = boxFor('Output_Tray', 'output');

  const baseHopper = new THREE.Vector3(-180, 0, 0);
  const baseTray = new THREE.Vector3(220, 0, 0);

  const anchors: PaperAnchors = {
    hopper: xzFrom(hopperB, baseHopper),
    counting: xzFrom(countingB, baseHopper.clone().lerp(baseTray, 0.17)),
    conveyor: xzFrom(conveyorB, baseHopper.clone().lerp(baseTray, 0.36)),
    punch: xzFrom(punchB, baseHopper.clone().lerp(baseTray, 0.54)),
    spiral: xzFrom(spiralB, baseHopper.clone().lerp(baseTray, 0.71)),
    tray: xzFrom(trayB, baseTray),
  };

  let transportDeckY = 48;
  if (conveyorB) {
    const ch = conveyorB.max.y - conveyorB.min.y;
    const beltBand = THREE.MathUtils.clamp(ch * 0.38, 6, Math.max(8, ch * 0.62));
    transportDeckY = conveyorB.min.y + beltBand + BOND_PAPER_THICKNESS / 2;
  } else if (countingB) {
    const ch = countingB.max.y - countingB.min.y;
    transportDeckY = countingB.min.y + Math.min(ch * 0.42, ch - 4) + BOND_PAPER_THICKNESS / 2;
  } else if (hopperB) {
    transportDeckY =
      hopperB.min.y + (hopperB.max.y - hopperB.min.y) * 0.25 + BOND_PAPER_THICKNESS / 2;
  }

  let paperShort = BOND_PAPER_SHORT_FALLBACK;
  let paperLong = paperShort * BOND_ASPECT_LONG_OVER_SHORT;

  let trayRestY = transportDeckY;
  if (trayB) {
    const h = trayB.max.y - trayB.min.y;
    const trayFloor = trayB.min.y + BOND_PAPER_THICKNESS / 2 + THREE.MathUtils.clamp(h * 0.08, 1.5, 8);
    trayRestY = THREE.MathUtils.clamp(trayFloor, transportDeckY - 14, transportDeckY + 0.8);
  } else {
    trayRestY = transportDeckY - 4;
  }

  /** Feed line: snapping to conveyor long axis avoids “tabinge” vs rails (hopper≠tray diagonal). */
  const hopperXZ = anchors.hopper.clone();
  const trayXZ = anchors.tray.clone();
  const lineDir = new THREE.Vector3(1, 0, 0);
  const lineStart = new THREE.Vector3();
  let lineLen = 320;

  if (conveyorB) {
    const convCenterXZ = xzFrom(conveyorB, hopperXZ);
    const sx = conveyorB.max.x - conveyorB.min.x;
    const sz = conveyorB.max.z - conveyorB.min.z;
    const feedsAlongWorldX = sx >= sz;
    const towardTray = trayXZ.clone().sub(convCenterXZ);
    if (feedsAlongWorldX) {
      lineDir.set(Math.sign(towardTray.x) || 1, 0, 0);
    } else {
      lineDir.set(0, 0, Math.sign(towardTray.z) || 1);
    }

    const lateralSpan = feedsAlongWorldX ? sz : sx;
    paperShort = THREE.MathUtils.clamp(lateralSpan * 0.48, 9, 30);
    if (trayB) {
      const tx = trayB.max.x - trayB.min.x;
      const tz = trayB.max.z - trayB.min.z;
      const trayLane = Math.min(tx, tz);
      paperShort = Math.min(paperShort, trayLane * 0.42);
    }
    paperLong = paperShort * BOND_ASPECT_LONG_OVER_SHORT;

    const tHop = hopperXZ.clone().sub(convCenterXZ).dot(lineDir);
    const tTray = trayXZ.clone().sub(convCenterXZ).dot(lineDir);
    const padInfeed = 16;
    const padDischarge = 24;
    const tLine0 = Math.min(tHop, tTray) - padInfeed;
    lineStart.copy(convCenterXZ).addScaledVector(lineDir, tLine0);
    lineLen = Math.max(Math.max(tHop, tTray) - tLine0 + padDischarge, 90);
  } else {
    lineStart.copy(hopperXZ);
    const rawDx = trayXZ.x - lineStart.x;
    const rawDz = trayXZ.z - lineStart.z;
    lineLen = Math.hypot(rawDx, rawDz);
    if (lineLen < 1e-5) lineLen = 320;
    else lineDir.set(rawDx / lineLen, 0, rawDz / lineLen);

    if (countingB) {
      const sx = countingB.max.x - countingB.min.x;
      const sz = countingB.max.z - countingB.min.z;
      const lane = Math.max(Math.min(sx, sz), 10);
      paperShort = THREE.MathUtils.clamp(lane * 0.52, 10, 32);
      paperLong = paperShort * BOND_ASPECT_LONG_OVER_SHORT;
    }
  }

  const projU = (p: THREE.Vector3): number => {
    const vx = p.x - lineStart.x;
    const vz = p.z - lineStart.z;
    const s = vx * lineDir.x + vz * lineDir.z;
    return THREE.MathUtils.clamp(s / lineLen, 0.03, 0.97);
  };

  let uCount = projU(anchors.counting);
  let uConv = projU(anchors.conveyor);
  let uPunch = projU(anchors.punch);
  let uSpiral = projU(anchors.spiral);
  const eps = 0.035;
  if (uConv <= uCount + eps) uConv = uCount + eps;
  if (uPunch <= uConv + eps) uPunch = uConv + eps;
  if (uSpiral <= uPunch + eps) uSpiral = uPunch + eps;
  uSpiral = Math.min(uSpiral, 1 - eps);

  const feedYaw = Math.atan2(-lineDir.z, lineDir.x);

  const { t: bookThicknessY } = getBoundBookFlatMetrics(paperLong, paperShort);

  return {
    anchors,
    transportDeckY,
    trayRestY,
    feedYaw,
    paperLong,
    paperShort,
    bookThicknessY,
    lineStart,
    lineDir,
    lineLen,
    uCount,
    uConv,
    uPunch,
    uSpiral,
  };
}

interface MachineViewerProps {
  onStageChange: (stage: number, progress: number) => void;
  onPausedChange: (paused: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onHoveredComponent: (name: string | null) => void;
  /** Simulated timeline delta (seconds) × speed, 0 when paused — for phase timers. */
  onSimulationTick?: (deltaSim: number, stage: number) => void;
  /** Sync ref — books stacked on tray (updated same tick as cycle complete). */
  trayBooksStackedRef: MutableRefObject<number>;
  /** Max books to pool in scene (from target sets / batch). */
  batchBookCapacity: number;
  action: string | null;
  onActionConsumed: () => void;
}

interface MeshGroup {
  meshes: THREE.Mesh[];
  originalPositions: THREE.Vector3[];
  originalRotations: THREE.Euler[];
}

export default function MachineViewer({
  onStageChange,
  onPausedChange,
  onSpeedChange,
  onHoveredComponent,
  onSimulationTick,
  trayBooksStackedRef,
  batchBookCapacity,
  action,
  onActionConsumed,
}: MachineViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef(new StageController());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const paperSheetRef = useRef<THREE.Mesh | null>(null);
  const bookOutputRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const redFlashRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const componentMapRef = useRef<Map<string, MeshGroup>>(new Map());
  const towerLightsRef = useRef<{ green: THREE.Mesh[]; amber: THREE.Mesh[]; red: THREE.Mesh[] }>({
    green: [],
    amber: [],
    red: [],
  });
  const defaultCameraPos = useRef(new THREE.Vector3(0, 300, 800));
  const defaultCameraTarget = useRef(new THREE.Vector3(0, 0, 0));
  const targetCameraPos = useRef(new THREE.Vector3(0, 300, 800));
  const targetCameraTarget = useRef(new THREE.Vector3(0, 0, 0));
  const userInteracting = useRef(false);
  const interactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStageRef = useRef(-1);
  const activeOutlineRef = useRef<THREE.Mesh | null>(null);
  const paperPathRef = useRef<PaperPathConfig | null>(null);
  const bookStackRootRef = useRef<THREE.Group | null>(null);
  const bookStackSlotsRef = useRef<THREE.Group[]>([]);
  const batchBookCapacityRef = useRef(batchBookCapacity);
  batchBookCapacityRef.current = batchBookCapacity;

  const layoutTrayBookStack = useCallback(() => {
    const path = paperPathRef.current;
    const slots = bookStackSlotsRef.current;
    if (!path || !slots.length) return;
    const stackN = Math.max(
      0,
      Math.min(trayBooksStackedRef.current, batchBookCapacityRef.current, slots.length)
    );
    const filled = stackN;
    xzOnStraightFeed(path, 1, stackLayoutScratch);
    const traySurface = path.trayRestY - BOND_PAPER_THICKNESS / 2;
    const t = path.bookThicknessY;
    let y = traySurface;
    for (let i = 0; i < filled; i++) {
      const grp = slots[i];
      grp.visible = true;
      y += t / 2;
      grp.position.set(stackLayoutScratch.x, y, stackLayoutScratch.z);
      grp.rotation.order = 'YXZ';
      grp.rotation.x = 0;
      grp.rotation.z = 0;
      grp.rotation.y = path.feedYaw;
      y += t / 2 + BOOK_STACK_GAP;
    }
    for (let i = filled; i < slots.length; i++) {
      slots[i].visible = false;
    }
  }, [trayBooksStackedRef]);

  const findMeshesByName = useCallback((parent: THREE.Group, pattern: string): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    parent.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.toLowerCase().includes(pattern.toLowerCase())) {
        meshes.push(child);
      }
    });
    return meshes;
  }, []);

  const storeOriginals = useCallback((meshes: THREE.Mesh[]): { positions: THREE.Vector3[]; rotations: THREE.Euler[] } => {
    return {
      positions: meshes.map((m) => m.position.clone()),
      rotations: meshes.map((m) => m.rotation.clone()),
    };
  }, []);

  const buildComponentMap = useCallback(
    (model: THREE.Group) => {
      const map = componentMapRef.current;
      const patterns = [
        'Paper_Hopper', 'hopper',
        'Counting_Mechanism', 'counting',
        'Drive_Roller', 'drive_roller',
        'Conveyor_Transfer_System', 'conveyor',
        'Transport_Roller', 'transport_roller',
        'Punching_Station', 'punch',
        'Punch_Plate', 'punch_plate',
        'Spiral_Binding_Unit', 'spiral', 'binding',
        'Coil_Guide_Channel', 'coil_guide',
        'Output_Tray', 'output',
        'Ejector_Pusher_Plate', 'ejector',
        'Tower_Light', 'tower_light',
        'Light_Green', 'light_green',
        'Light_Amber', 'light_amber',
        'Light_Red', 'light_red',
      ];

      const processed = new Set<string>();
      for (const pattern of patterns) {
        const meshes = findMeshesByName(model, pattern);
        if (meshes.length > 0 && !processed.has(pattern)) {
          processed.add(pattern);
          const originals = storeOriginals(meshes);
          map.set(pattern, { meshes, originalPositions: originals.positions, originalRotations: originals.rotations });
        }
      }

      // Tower lights
      towerLightsRef.current = {
        green: findMeshesByName(model, 'Light_Green').length > 0 ? findMeshesByName(model, 'Light_Green') : findMeshesByName(model, 'green'),
        amber: findMeshesByName(model, 'Light_Amber').length > 0 ? findMeshesByName(model, 'Light_Amber') : findMeshesByName(model, 'amber'),
        red: findMeshesByName(model, 'Light_Red').length > 0 ? findMeshesByName(model, 'Light_Red') : findMeshesByName(model, 'red'),
      };
    },
    [findMeshesByName, storeOriginals]
  );

  const getMeshGroup = useCallback((key: string): MeshGroup | undefined => {
    const map = componentMapRef.current;
    // Try exact match first, then partial
    if (map.has(key)) return map.get(key);
    for (const [k, v] of map) {
      if (k.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(k.toLowerCase())) {
        return v;
      }
    }
    return undefined;
  }, []);

  const createPaperSheet = useCallback((scene: THREE.Scene) => {
    const geo = new THREE.BoxGeometry(BOND_PAPER_LONG_FALLBACK, BOND_PAPER_THICKNESS, BOND_PAPER_SHORT_FALLBACK);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    scene.add(mesh);
    paperSheetRef.current = mesh;
  }, []);

  const createParticleSystem = useCallback((scene: THREE.Scene) => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      velocities[i * 3] = (Math.random() - 0.5) * 4;
      velocities[i * 3 + 1] = Math.random() * 3 + 1;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    (points as any)._velocities = velocities;
    (points as any)._life = 0;
    scene.add(points);
    particleSystemRef.current = points;
  }, []);

  const fireParticles = useCallback((position: THREE.Vector3) => {
    const ps = particleSystemRef.current;
    if (!ps) return;
    ps.position.copy(position);
    ps.visible = true;
    (ps as any)._life = 1.0;
    const posAttr = ps.geometry.getAttribute('position');
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(i, 0, 0, 0);
    }
    posAttr.needsUpdate = true;
  }, []);

  const updateParticles = useCallback((delta: number) => {
    const ps = particleSystemRef.current;
    if (!ps || !(ps as any)._life || (ps as any)._life <= 0) {
      if (ps) ps.visible = false;
      return;
    }
    (ps as any)._life -= delta * 1.5;
    const vel = (ps as any)._velocities as Float32Array;
    const posAttr = ps.geometry.getAttribute('position');
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i) + vel[i * 3] * delta;
      const y = posAttr.getY(i) + vel[i * 3 + 1] * delta;
      const z = posAttr.getZ(i) + vel[i * 3 + 2] * delta;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
    (ps.material as THREE.PointsMaterial).opacity = Math.max(0, (ps as any)._life) * 0.8;
  }, []);

  const animateStage = useCallback(
    (stageIndex: number, progress: number, elapsedTime: number) => {
      const model = modelRef.current;
      if (!model) return;

      const paper = paperSheetRef.current;
      const hopperGroup = getMeshGroup('Paper_Hopper') || getMeshGroup('hopper');
      const countingGroup = getMeshGroup('Counting_Mechanism') || getMeshGroup('counting');
      const driveRollerGroup = getMeshGroup('Drive_Roller') || getMeshGroup('drive_roller');
      const conveyorGroup = getMeshGroup('Conveyor_Transfer_System') || getMeshGroup('conveyor');
      const transportRollerGroup = getMeshGroup('Transport_Roller') || getMeshGroup('transport_roller');
      const punchStationGroup = getMeshGroup('Punching_Station') || getMeshGroup('punch');
      const punchPlateGroup = getMeshGroup('Punch_Plate') || getMeshGroup('punch_plate');
      const spiralGroup = getMeshGroup('Spiral_Binding_Unit') || getMeshGroup('spiral') || getMeshGroup('binding');
      const coilGuideGroup = getMeshGroup('Coil_Guide_Channel') || getMeshGroup('coil_guide');
      const outputGroup = getMeshGroup('Output_Tray') || getMeshGroup('output');
      const ejectorGroup = getMeshGroup('Ejector_Pusher_Plate') || getMeshGroup('ejector');

      // Reset all components to original positions first
      const allGroups = [
        hopperGroup, countingGroup, driveRollerGroup, conveyorGroup,
        transportRollerGroup, punchStationGroup, punchPlateGroup,
        spiralGroup, coilGuideGroup, outputGroup, ejectorGroup,
      ];
      for (const g of allGroups) {
        if (!g) continue;
        g.meshes.forEach((mesh, i) => {
          mesh.position.copy(g.originalPositions[i]);
          mesh.rotation.copy(g.originalRotations[i]);
        });
      }

      const bookOut = bookOutputRef.current;

      const path = paperPathRef.current;
      const showBook = !!(path && bookOut && stageIndex >= 5 && stageIndex <= 6);

      if (paper) {
        paper.visible = stageIndex >= 0 && stageIndex <= 4;
      }
      if (bookOut) {
        bookOut.visible = showBook;
      }

      if (paper && path) {
        paper.rotation.order = 'XYZ';
        paper.rotation.x = 0;
        paper.rotation.z = 0;
        paper.rotation.y = path.feedYaw;
        paper.scale.set(1, 1, 1);
      }

      if (bookOut && path && showBook) {
        bookOut.rotation.order = 'YXZ';
        bookOut.rotation.x = 0;
        bookOut.rotation.z = 0;
        bookOut.rotation.y = path.feedYaw;
      }

      // Tower lights
      const lights = towerLightsRef.current;
      const isPunchStage = stageIndex === 3;
      const isTransition = stageIndex === 6;
      lights.green.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!isPunchStage && !isTransition) {
          mat.emissive = new THREE.Color(0x00ff44);
          mat.emissiveIntensity = 1.5;
        } else {
          mat.emissive = new THREE.Color(0x003311);
          mat.emissiveIntensity = 0.3;
        }
      });
      lights.amber.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (isTransition) {
          mat.emissive = new THREE.Color(0xffaa00);
          mat.emissiveIntensity = 1.5;
        } else {
          mat.emissive = new THREE.Color(0x332200);
          mat.emissiveIntensity = 0.3;
        }
      });
      lights.red.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (isPunchStage) {
          const flash = Math.sin(elapsedTime * 10) > 0 ? 2.0 : 0.2;
          mat.emissive = new THREE.Color(0xff0000);
          mat.emissiveIntensity = flash;
        } else {
          mat.emissive = new THREE.Color(0x330000);
          mat.emissiveIntensity = 0.3;
        }
      });

      // Camera targets
      const camPos = defaultCameraPos.current.clone();
      const camTarget = defaultCameraTarget.current.clone();

      switch (stageIndex) {
        case 0: {
          // Paper Feed — hopper oscillates, paper feeds toward counting
          if (hopperGroup) {
            const offset = Math.sin(progress * Math.PI * 4) * 5;
            hopperGroup.meshes.forEach((mesh, i) => {
              mesh.position.y = hopperGroup.originalPositions[i].y + offset;
            });
          }
          if (paper) {
            if (path) {
              const u = THREE.MathUtils.lerp(0, path.uCount, progress);
              xzOnStraightFeed(path, u, paperXZScratch);
              let y = path.transportDeckY;
              if (hopperGroup) y += Math.sin(progress * Math.PI * 4) * 1;
              paper.position.set(paperXZScratch.x, y, paperXZScratch.z);
            } else {
              const startX = -200;
              const endX = -80;
              paper.position.set(startX + (endX - startX) * progress, 50, 0);
            }
          }
          break;
        }
        case 1: {
          // Counting — registers sheets, advances toward conveyor infeed
          if (driveRollerGroup) {
            driveRollerGroup.meshes.forEach((mesh) => {
              mesh.rotation.y += 0.05;
            });
          }
          if (countingGroup) {
            countingGroup.meshes.forEach((mesh) => {
              mesh.rotation.y += 0.03;
            });
          }
          if (paper) {
            if (path) {
              const u = THREE.MathUtils.lerp(path.uCount, path.uConv, progress);
              xzOnStraightFeed(path, u, paperXZScratch);
              paper.position.set(paperXZScratch.x, path.transportDeckY, paperXZScratch.z);
            } else {
              const startX = -80;
              const endX = 0;
              paper.position.set(startX + (endX - startX) * progress, 50, 0);
            }
          }
          break;
        }
        case 2: {
          // Conveyor Transfer — moves sheet toward punching station
          if (transportRollerGroup) {
            transportRollerGroup.meshes.forEach((mesh) => {
              mesh.rotation.y += 0.05;
            });
          }
          if (conveyorGroup) {
            conveyorGroup.meshes.forEach((mesh) => {
              mesh.rotation.y += 0.03;
            });
          }
          if (paper) {
            if (path) {
              const u = THREE.MathUtils.lerp(path.uConv, path.uPunch, progress);
              xzOnStraightFeed(path, u, paperXZScratch);
              paper.position.set(paperXZScratch.x, path.transportDeckY, paperXZScratch.z);
            } else {
              const startX = 0;
              const endX = 100;
              paper.position.set(startX + (endX - startX) * progress, 50, 0);
            }
          }
          break;
        }
        case 3: {
          // Punching — punch plate moves down then up
          if (punchPlateGroup) {
            const punchDown = progress < 0.5
              ? Math.sin(progress * Math.PI) * 60
              : Math.sin(progress * Math.PI) * 60 * (1 - (progress - 0.5) * 2);
            punchPlateGroup.meshes.forEach((mesh, i) => {
              mesh.position.z = punchPlateGroup.originalPositions[i].z - Math.max(0, punchDown);
            });
          }
          if (paper) {
            if (path) {
              xzOnStraightFeed(path, path.uPunch, paperXZScratch);
              let y = path.transportDeckY;
              if (progress > 0.32 && progress < 0.62) {
                y += Math.sin(elapsedTime * 38) * 0.35;
              }
              paper.position.set(paperXZScratch.x, y, paperXZScratch.z);
            } else {
              paper.position.set(100, 50, 0);
            }
          }
          // Camera zoom to punch area
          if (path) {
            xzOnStraightFeed(path, path.uPunch, paperXZScratch);
            const y = path.transportDeckY;
            camTarget.set(paperXZScratch.x, y, paperXZScratch.z);
            camPos.set(paperXZScratch.x + 95, y + 130, paperXZScratch.z + 295);
          } else {
            camPos.set(100, 150, 300);
            camTarget.set(100, 50, 0);
          }
          // Red flash + particles at peak
          if (progress > 0.35 && progress < 0.55) {
            if (redFlashRef.current) redFlashRef.current.style.opacity = '0.3';
            if (punchPlateGroup && punchPlateGroup.meshes.length > 0) {
              fireParticles(punchPlateGroup.meshes[0].position.clone());
            }
          } else {
            if (redFlashRef.current) redFlashRef.current.style.opacity = '0';
          }
          break;
        }
        case 4: {
          // Spiral Binding — coil engages; sheet settles into binder area
          if (coilGuideGroup) {
            coilGuideGroup.meshes.forEach((mesh) => {
              mesh.rotation.x += 0.08;
            });
          }
          if (spiralGroup) {
            spiralGroup.meshes.forEach((mesh) => {
              mesh.rotation.x += 0.04;
            });
          }
          if (paper) {
            if (path) {
              const u = THREE.MathUtils.lerp(path.uPunch, path.uSpiral, smoothstep01(progress));
              xzOnStraightFeed(path, u, paperXZScratch);
              paper.position.set(paperXZScratch.x, path.transportDeckY, paperXZScratch.z);
            } else {
              paper.position.set(100, 50, 0);
            }
          }
          // Camera zoom to binding area
          if (path) {
            xzOnStraightFeed(path, path.uSpiral, paperXZScratch);
            const y = path.transportDeckY;
            camTarget.set(paperXZScratch.x, y, paperXZScratch.z);
            camPos.set(paperXZScratch.x + 75, y + 115, paperXZScratch.z + 255);
          } else {
            camPos.set(150, 120, 250);
            camTarget.set(100, 50, 0);
          }
          break;
        }
        case 5: {
          // Output — finished bound book upright glides onto tray centerline
          if (ejectorGroup) {
            const push = Math.sin(progress * Math.PI) * 40;
            ejectorGroup.meshes.forEach((mesh, i) => {
              mesh.position.y = ejectorGroup.originalPositions[i].y + push;
            });
          }
          if (paper && !path) {
            const startX = 100;
            const endX = 250;
            paper.position.set(startX + (endX - startX) * progress, 50, 0);
          }
          if (bookOut && path) {
            const t = smoothstep01(progress);
            const u = THREE.MathUtils.lerp(path.uSpiral, 1, t);
            xzOnStraightFeed(path, u, paperXZScratch);
            const traySurface = path.trayRestY - BOND_PAPER_THICKNESS / 2;
            const stackUnder = trayBooksStackedRef.current;
            const stackLift = stackUnder * (path.bookThicknessY + BOOK_STACK_GAP);
            const yBook = traySurface + stackLift + path.bookThicknessY / 2;
            bookOut.position.set(paperXZScratch.x, yBook, paperXZScratch.z);
          }
          if (path) {
            const ta = smoothstep01(0.45);
            const u = THREE.MathUtils.lerp(path.uSpiral, 1, ta);
            xzOnStraightFeed(path, u, paperXZScratch);
            const midY = THREE.MathUtils.lerp(path.transportDeckY, path.trayRestY, ta);
            camTarget.set(paperXZScratch.x, midY, paperXZScratch.z);
            camPos.set(paperXZScratch.x + 65, midY + 135, paperXZScratch.z + 260);
          }
          break;
        }
        case 6: {
          // Idle on tray — bound book rests until cycle restarts at stage 0
          if (bookOut && path) {
            xzOnStraightFeed(path, 1, paperXZScratch);
            const traySurface = path.trayRestY - BOND_PAPER_THICKNESS / 2;
            const stackUnder = trayBooksStackedRef.current;
            const stackLift = stackUnder * (path.bookThicknessY + BOOK_STACK_GAP);
            const yBook = traySurface + stackLift + path.bookThicknessY / 2;
            bookOut.position.set(paperXZScratch.x, yBook, paperXZScratch.z);
          }
          if (redFlashRef.current) redFlashRef.current.style.opacity = '0';
          break;
        }
      }

      // Smooth camera transition
      if (!userInteracting.current) {
        targetCameraPos.current.lerp(camPos, 0.02);
        targetCameraTarget.current.lerp(camTarget, 0.02);
      }
    },
    [getMeshGroup, fireParticles, trayBooksStackedRef]
  );

  const applyOutlineEffect = useCallback((stageIndex: number) => {
    // Remove previous outline
    if (activeOutlineRef.current) {
      const mat = activeOutlineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(0x000000);
      mat.emissiveIntensity = 0;
      activeOutlineRef.current = null;
    }

    const stageKeyMap: Record<number, string[]> = {
      0: ['Paper_Hopper', 'hopper'],
      1: ['Counting_Mechanism', 'counting', 'Drive_Roller', 'drive_roller'],
      2: ['Conveyor_Transfer_System', 'conveyor', 'Transport_Roller', 'transport_roller'],
      3: ['Punching_Station', 'punch', 'Punch_Plate', 'punch_plate'],
      4: ['Spiral_Binding_Unit', 'spiral', 'binding', 'Coil_Guide_Channel', 'coil_guide'],
      5: ['Output_Tray', 'output', 'Ejector_Pusher_Plate', 'ejector'],
      6: [],
    };

    const keys = stageKeyMap[stageIndex] || [];
    for (const key of keys) {
      const group = getMeshGroup(key);
      if (group && group.meshes.length > 0) {
        const mesh = group.meshes[0];
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(0x0088ff);
        mat.emissiveIntensity = 0.8;
        activeOutlineRef.current = mesh;
        break;
      }
    }
  }, [getMeshGroup]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.0004);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.copy(defaultCameraPos.current);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.target.copy(defaultCameraTarget.current);
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controlsRef.current = controls;

    const pauseAutoRotate = () => {
      userInteracting.current = true;
      controls.autoRotate = false;
      if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    };
    const resumeAutoRotateLater = () => {
      interactionTimeout.current = setTimeout(() => {
        userInteracting.current = false;
        controls.autoRotate = true;
      }, 3000);
    };

    const onInteractStart = () => pauseAutoRotate();
    const onInteractEnd = () => resumeAutoRotateLater();
    const onWheelInteract = () => {
      pauseAutoRotate();
      resumeAutoRotateLater();
    };

    renderer.domElement.addEventListener('pointerdown', onInteractStart);
    renderer.domElement.addEventListener('pointerup', onInteractEnd);
    renderer.domElement.addEventListener('wheel', onWheelInteract, { passive: true });

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(300, 500, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 2000;
    dirLight.shadow.camera.left = -500;
    dirLight.shadow.camera.right = 500;
    dirLight.shadow.camera.top = 500;
    dirLight.shadow.camera.bottom = -500;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x4488cc, 0.5);
    fillLight.position.set(-200, 200, -100);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(2000, 40, 0x333355, 0x222244);
    grid.position.y = -100;
    scene.add(grid);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(2000, 2000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -100;
    floor.receiveShadow = true;
    scene.add(floor);

    // Paper sheet + particles
    createPaperSheet(scene);
    createParticleSystem(scene);

    // Raycaster for hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredName: string | null = null;

    const onMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // FBX Loader
    const loader = new FBXLoader();
    const loadingEl = loadingRef.current;

    loader.load(
      '/Automated_Paper_Binding_Machine.fbx',
      (fbx) => {
        fbx.rotation.x = MODEL_UP_AXIS_FIX_X;

        const box = new THREE.Box3().setFromObject(fbx);
        const center = box.getCenter(new THREE.Vector3());
        fbx.position.sub(center);

        // Auto-scale to fit height ~400
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 400 / maxDim;
        fbx.scale.setScalar(scale);

        // Shadows
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        flattenConveyorAndTraySectionTilt(fbx);
        fbx.updateMatrixWorld(true);
        hideCadPaperMeshes(fbx);

        scene.add(fbx);
        modelRef.current = fbx;

        const paperCfg = computePaperPathConfig(fbx, findMeshesByName);
        paperPathRef.current = paperCfg;
        const sheet = paperSheetRef.current;
        if (sheet) {
          sheet.geometry.dispose();
          sheet.geometry = new THREE.BoxGeometry(
            paperCfg.paperLong,
            BOND_PAPER_THICKNESS,
            paperCfg.paperShort
          );
        }

        const prevBook = bookOutputRef.current;
        if (prevBook) {
          scene.remove(prevBook);
          disposeObjectMeshes(prevBook);
          bookOutputRef.current = null;
        }
        const bookGrp = createBoundBookGroup(paperCfg.paperLong, paperCfg.paperShort);
        bookGrp.visible = false;
        scene.add(bookGrp);
        bookOutputRef.current = bookGrp;

        const prevStackRoot = bookStackRootRef.current;
        if (prevStackRoot) {
          scene.remove(prevStackRoot);
          prevStackRoot.children.forEach((ch) => disposeObjectMeshes(ch as THREE.Group));
          bookStackSlotsRef.current = [];
          bookStackRootRef.current = null;
        }
        const stackRoot = new THREE.Group();
        stackRoot.name = 'Tray_Output_Stack';
        const pool = BOOK_STACK_POOL;
        const slots: THREE.Group[] = [];
        for (let i = 0; i < pool; i++) {
          const b = createBoundBookGroup(paperCfg.paperLong, paperCfg.paperShort);
          b.visible = false;
          b.traverse((ch) => {
            if (ch instanceof THREE.Mesh) {
              ch.castShadow = true;
              ch.receiveShadow = true;
            }
          });
          stackRoot.add(b);
          slots.push(b);
        }
        bookStackSlotsRef.current = slots;
        bookStackRootRef.current = stackRoot;
        scene.add(stackRoot);

        buildComponentMap(fbx);

        if (loadingEl) loadingEl.style.display = 'none';
      },
      (xhr) => {
        if (xhr.total > 0 && loadingEl) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          loadingEl.textContent = `Loading Model... ${pct}%`;
        }
      },
      (error) => {
        console.error('FBX load error:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorRef.current) errorRef.current.style.display = 'flex';
      }
    );

    // Animation loop
    const clock = clockRef.current;
    clock.start();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const state = controllerRef.current.update(performance.now());
      const deltaSim = controllerRef.current.isPaused() ? 0 : delta * controllerRef.current.getSpeed();
      onSimulationTick?.(deltaSim, state.currentStage);

      // Notify parent
      onStageChange(state.currentStage, state.stageProgress);
      onPausedChange(controllerRef.current.isPaused());
      onSpeedChange(controllerRef.current.getSpeed());

      // Animate stages
      animateStage(state.currentStage, state.stageProgress, state.elapsedTime);
      layoutTrayBookStack();

      // Outline effect on stage change
      if (state.currentStage !== lastStageRef.current) {
        applyOutlineEffect(state.currentStage);
        lastStageRef.current = state.currentStage;
      }

      // Update particles
      updateParticles(delta);

      // Camera smooth movement
      if (!userInteracting.current) {
        camera.position.lerp(targetCameraPos.current, 0.02);
        controls.target.lerp(targetCameraTarget.current, 0.02);
      }

      // Hover detection
      if (modelRef.current) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(modelRef.current, true);
        if (intersects.length > 0) {
          const obj = intersects[0].object;
          const name = obj.name || obj.parent?.name || null;
          if (name && name !== hoveredName) {
            hoveredName = name;
            onHoveredComponent(name.replace(/_/g, ' '));
          }
        } else if (hoveredName) {
          hoveredName = null;
          onHoveredComponent(null);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      const scForBook = sceneRef.current;
      const bkCleanup = bookOutputRef.current;
      if (bkCleanup && scForBook) {
        scForBook.remove(bkCleanup);
        disposeObjectMeshes(bkCleanup);
        bookOutputRef.current = null;
      }
      const stackRoot = bookStackRootRef.current;
      if (stackRoot && scForBook) {
        scForBook.remove(stackRoot);
        stackRoot.children.forEach((ch) => disposeObjectMeshes(ch as THREE.Group));
        bookStackRootRef.current = null;
        bookStackSlotsRef.current = [];
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('pointerdown', onInteractStart);
      renderer.domElement.removeEventListener('pointerup', onInteractEnd);
      renderer.domElement.removeEventListener('wheel', onWheelInteract);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle actions from parent
  useEffect(() => {
    if (!action) return;
    const ctrl = controllerRef.current;
    switch (action) {
      case 'toggle_pause':
        ctrl.togglePause();
        break;
      case 'reset':
        ctrl.reset();
        break;
      case 'speed':
        ctrl.setSpeed(ctrl.getSpeed() === 1 ? 2 : 1);
        break;
    }
    onActionConsumed();
  }, [action, onActionConsumed]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div
        ref={loadingRef}
        className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e] z-30"
      >
        <div className="text-center">
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-white text-lg">Loading Model... 0%</p>
        </div>
      </div>
      <div
        ref={errorRef}
        className="absolute inset-0 items-center justify-center bg-[#1a1a2e] z-30"
        style={{ display: 'none' }}
      >
        <div className="text-center">
          <p className="text-red-400 text-xl font-semibold mb-2">Failed to load 3D model</p>
          <p className="text-gray-400 text-sm">
            Make sure Automated_Paper_Binding_Machine.fbx is in the /public folder
          </p>
        </div>
      </div>
      <div
        ref={redFlashRef}
        className="absolute inset-0 bg-red-600 pointer-events-none z-20 transition-opacity duration-100"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
