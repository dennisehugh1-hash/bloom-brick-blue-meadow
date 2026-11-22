import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { levels } from "./levels";
import { PALETTE } from "./palette";
import { sim } from "./sim";

const WALL_MAX = 700;
const GHOST_MAX = 500;

function makeGridTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.Texture();
  g.fillStyle = PALETTE.floor;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = PALETTE.grid;
  g.lineWidth = 4;
  g.strokeRect(2, 2, 124, 124);
  g.strokeStyle = PALETTE.brass;
  g.globalAlpha = 0.45;
  g.beginPath();
  g.moveTo(64, 8);
  g.lineTo(64, 120);
  g.moveTo(8, 64);
  g.lineTo(120, 64);
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Stage() {
  const walls = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.9, 1.12, 0.9);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.wall,
      metalness: 0.48,
      roughness: 0.46,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, WALL_MAX);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
  }, []);
  const caps = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.9, 0.07, 0.9);
    const mat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      metalness: 0.62,
      roughness: 0.34,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, WALL_MAX);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
  }, []);
  const ghostW = useMemo(() => makeGhost(PALETTE.brass), []);
  const ghostV = useMemo(() => makeGhost(PALETTE.signal), []);
  const floorTex = useMemo(() => makeGridTexture(), []);
  const floor = useRef<THREE.Mesh>(null);
  const skirt = useRef<THREE.Mesh>(null);
  const railS = useRef<THREE.Mesh>(null);
  const railN = useRef<THREE.Mesh>(null);
  const railE = useRef<THREE.Mesh>(null);
  const railW = useRef<THREE.Mesh>(null);
  const probe = useRef<THREE.Group>(null);
  const ringW = useRef<THREE.Mesh>(null);
  const ringV = useRef<THREE.Mesh>(null);
  const lens = useRef<THREE.MeshStandardMaterial>(null);
  const goal = useRef<THREE.Group>(null);
  const iris = useRef<THREE.Mesh>(null);
  const goalMat = useRef<THREE.MeshStandardMaterial>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const pad = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const goalLight = useRef<THREE.PointLight>(null);
  const token = useRef("");
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const capColor = useMemo(() => new THREE.Color(), []);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sun = light.current;
    if (!sun) return;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -18;
    cam.right = 18;
    cam.top = 18;
    cam.bottom = -18;
    cam.far = 48;
    cam.updateProjectionMatrix();
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const level = levels[sim.levelIndex];
    const next = `${sim.levelIndex}:${sim.w}:${sim.v}`;
    if (token.current !== next) {
      token.current = next;
      const idx = sim.w * level.vCount + sim.v;
      paintSolid(walls, caps, level.lists[idx] ?? [], dummy, capColor);
      paintGhost(ghostW, level.ghostsW[idx] ?? [], dummy);
      paintGhost(ghostV, level.ghostsV[idx] ?? [], dummy);
      layoutFloor(level.bounds, floor.current, skirt.current, floorTex, railN.current, railS.current, railE.current, railW.current);
    }

    const open = sim.w === level.goal.w && sim.v === level.goal.v;
    const pulse = 0.65 + Math.sin(state.clock.elapsedTime * 3) * 0.35;
    if (goal.current) goal.current.position.set(level.goal.x, 0, level.goal.z);
    if (iris.current) iris.current.rotation.z = state.clock.elapsedTime * (open ? 0.9 : 0.12);
    if (goalMat.current) goalMat.current.emissiveIntensity = open ? 0.45 + pulse : 0.06;
    if (beamMat.current) beamMat.current.opacity = open ? 0.16 + pulse * 0.18 : 0.03;
    if (goalLight.current) {
      goalLight.current.position.set(level.goal.x, 1.4, level.goal.z);
      goalLight.current.intensity = open ? 6 * pulse : 0.4;
    }
    if (pad.current) pad.current.position.set(level.start.x, 0.02, level.start.z);

    if (probe.current) {
      const bob = Math.abs(Math.sin(state.clock.elapsedTime * 14)) * Math.min(0.04, Math.abs(sim.speed) * 0.008);
      probe.current.position.set(sim.x, bob, sim.z);
      probe.current.rotation.y = sim.yaw;
    }
    if (ringW.current) ringW.current.rotation.z = state.clock.elapsedTime * 0.8 + sim.w * 1.35;
    if (ringV.current) {
      ringV.current.rotation.y = Math.PI / 2;
      ringV.current.rotation.x = state.clock.elapsedTime * 0.5 + sim.v * 1.35;
    }
    if (lens.current) lens.current.emissiveIntensity = 0.35 + Math.min(1.4, Math.abs(sim.speed) * 0.22);

    const cam = state.camera;
    if (sim.mode === "menu") {
      const ang = reduce.current ? 0.7 : state.clock.elapsedTime * 0.16;
      desired.set(Math.sin(ang) * 12.5, 8.2, Math.cos(ang) * 10.5);
      look.set(0, 0.25, 0);
      cam.position.lerp(desired, 1 - Math.exp(-1.5 * dt));
    } else {
      const fx = -Math.sin(sim.yaw);
      const fz = -Math.cos(sim.yaw);
      const kick = sim.shake;
      desired.set(
        sim.x - fx * 9.2 + Math.sin(state.clock.elapsedTime * 46) * kick * 0.4,
        6.5,
        sim.z - fz * 9.2 + Math.cos(state.clock.elapsedTime * 40) * kick * 0.4,
      );
      look.set(sim.x + fx * 1.6, 0.5, sim.z + fz * 1.6);
      cam.position.lerp(desired, 1 - Math.exp(-3.6 * dt));
    }
    cam.lookAt(look);
  });

  return (
    <>
      <primitive object={walls} />
      <primitive object={caps} />
      <primitive object={ghostW} />
      <primitive object={ghostV} />
      <mesh ref={skirt} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={PALETTE.bg} />
      </mesh>
      <mesh ref={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={floorTex} roughness={0.92} metalness={0.06} />
      </mesh>
      <Rail meshRef={railN} />
      <Rail meshRef={railS} />
      <Rail meshRef={railE} />
      <Rail meshRef={railW} />
      <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.48, 32]} />
        <meshStandardMaterial color={PALETTE.brass} emissive={PALETTE.brass} emissiveIntensity={0.15} />
      </mesh>
      <group ref={goal}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.42, 0.62, 40]} />
          <meshStandardMaterial
            ref={goalMat}
            color={PALETTE.signal}
            emissive={PALETTE.signal}
            emissiveIntensity={0.2}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
        <mesh ref={iris} position={[0, 0.72, 0]}>
          <torusGeometry args={[0.5, 0.03, 10, 36]} />
          <meshStandardMaterial color={PALETTE.signal} emissive={PALETTE.signal} emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.05, 0.2, 2.1, 16, 1, true]} />
          <meshBasicMaterial ref={beamMat} color={PALETTE.signal} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      </group>
      <pointLight ref={goalLight} color={PALETTE.signal} distance={8} decay={2} intensity={0.4} />
      <group ref={probe}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.26, 0.64, 18]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.74} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.04, -0.4]} castShadow>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial
            ref={lens}
            color={PALETTE.signal}
            emissive={PALETTE.signal}
            emissiveIntensity={0.6}
            roughness={0.32}
          />
        </mesh>
        <mesh ref={ringW}>
          <torusGeometry args={[0.4, 0.018, 8, 28]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.8} roughness={0.22} />
        </mesh>
        <mesh ref={ringV}>
          <torusGeometry args={[0.5, 0.016, 8, 28]} />
          <meshStandardMaterial color={PALETTE.paper} metalness={0.45} roughness={0.35} />
        </mesh>
      </group>
      <directionalLight ref={light} position={[7, 14, 5]} intensity={2.5} castShadow color={PALETTE.paper} />
    </>
  );
}

function Rail({ meshRef }: { meshRef: RefObject<THREE.Mesh | null> }) {
  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[1, 0.14, 0.12]} />
      <meshStandardMaterial color={PALETTE.rail} metalness={0.7} roughness={0.35} />
    </mesh>
  );
}

function makeGhost(color: string) {
  const geo = new THREE.BoxGeometry(0.98, 1.22, 0.98);
  const mat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, GHOST_MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

function paintSolid(
  walls: THREE.InstancedMesh,
  caps: THREE.InstancedMesh,
  list: { x: number; z: number; stable: boolean }[],
  dummy: THREE.Object3D,
  color: THREE.Color,
) {
  const n = Math.min(list.length, WALL_MAX);
  for (let i = 0; i < n; i++) {
    const wall = list[i];
    dummy.position.set(wall.x, 0.56, wall.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
    dummy.position.set(wall.x, 1.155, wall.z);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);
    color.set(wall.stable ? PALETTE.brassDim : PALETTE.brass);
    caps.setColorAt(i, color);
  }
  walls.count = n;
  caps.count = n;
  walls.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
}

function paintGhost(mesh: THREE.InstancedMesh, list: { x: number; z: number }[], dummy: THREE.Object3D) {
  const n = Math.min(list.length, GHOST_MAX);
  for (let i = 0; i < n; i++) {
    dummy.position.set(list[i].x, 0.61, list[i].z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

function layoutFloor(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  floor: THREE.Mesh | null,
  skirt: THREE.Mesh | null,
  tex: THREE.Texture,
  railN: THREE.Mesh | null,
  railS: THREE.Mesh | null,
  railE: THREE.Mesh | null,
  railW: THREE.Mesh | null,
) {
  const width = bounds.maxX - bounds.minX + 1;
  const depth = bounds.maxZ - bounds.minZ + 1;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  tex.repeat.set(width, depth);
  tex.needsUpdate = true;
  if (floor) {
    floor.position.set(cx, 0, cz);
    floor.scale.set(width, depth, 1);
  }
  if (skirt) {
    skirt.position.set(cx, -0.05, cz);
    skirt.scale.set(width + 14, depth + 14, 1);
  }
  const y = 0.07;
  if (railN) {
    railN.scale.set(width + 0.12, 1, 1);
    railN.position.set(cx, y, bounds.maxZ + 0.5);
  }
  if (railS) {
    railS.scale.set(width + 0.12, 1, 1);
    railS.position.set(cx, y, bounds.minZ - 0.5);
  }
  if (railE) {
    railE.scale.set(depth + 0.12, 1, 1);
    railE.rotation.y = Math.PI / 2;
    railE.position.set(bounds.maxX + 0.5, y, cz);
  }
  if (railW) {
    railW.scale.set(depth + 0.12, 1, 1);
    railW.rotation.y = Math.PI / 2;
    railW.position.set(bounds.minX - 0.5, y, cz);
  }
}

export function SceneHost() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <div className="absolute inset-0 bg-bg" />;
  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 8, 12], fov: 42, near: 0.1, far: 90 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(PALETTE.bg);
      }}
    >
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 16, 42]} />
      <hemisphereLight args={[PALETTE.paper, PALETTE.bg, 0.48]} />
      <ambientLight intensity={0.12} />
      <Stage />
    </Canvas>
  );
}
