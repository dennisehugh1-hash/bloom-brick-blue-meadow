import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { levels } from "./levels.ts";
import { PALETTE } from "./palette";
import { sim } from "./sim";
import { project, type Box, type Vec5 } from "./space.ts";

const EDGE_MAX = 2400;

function makeEdges(color: string, metal: boolean, opacity = 0.8) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = metal
    ? new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.32 })
    : new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, EDGE_MAX);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

function sample(box: Box, edge: number, others: readonly number[], mask: number, high: boolean): Vec5 {
  const p: Vec5 = [box.min[0], box.min[1], box.min[2], box.min[3], box.min[4]];
  p[edge] = high ? box.max[edge] : box.min[edge];
  for (let bit = 0; bit < others.length; bit++) {
    const axis = others[bit];
    p[axis] = mask & (1 << bit) ? box.max[axis] : box.min[axis];
  }
  return p;
}

function paintEdges(mesh: THREE.InstancedMesh, boxes: readonly Box[], order: readonly number[], dummy: THREE.Object3D, up: THREE.Vector3, dir: THREE.Vector3) {
  let n = 0;
  for (let b = 0; b < boxes.length; b++) {
    const box = boxes[b];
    for (let slot = 0; slot < order.length; slot++) {
      const axis = order[slot];
      const others: number[] = [];
      for (let i = 0; i < order.length; i++) if (order[i] !== axis) others.push(order[i]);
      const masks = 1 << others.length;
      for (let mask = 0; mask < masks; mask++) {
        if (n >= EDGE_MAX) break;
        const pa = project(sample(box, axis, others, mask, false), order);
        const pb = project(sample(box, axis, others, mask, true), order);
        dir.set(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
        const len = dir.length();
        if (len < 0.05) continue;
        dummy.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2);
        dummy.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
        dummy.scale.set(0.045, len, 0.045);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
    }
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

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
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(18, 18);
  return tex;
}

function Stage() {
  const cage = useMemo(() => makeEdges(PALETTE.brassDim, false, 0.28), []);
  const walls = useMemo(() => makeEdges(PALETTE.brass, true), []);
  const ghosts = useMemo(() => makeEdges(PALETTE.paper, false, 0.55), []);
  const gates = useMemo(() => makeEdges(PALETTE.signal, false, 0.9), []);
  const cores = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.16, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.signal,
      emissive: PALETTE.signal,
      emissiveIntensity: 0.7,
      metalness: 0.4,
      roughness: 0.35,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, 8);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
  }, []);
  const floorTex = useMemo(() => makeGridTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const probe = useRef<THREE.Group>(null);
  const goal = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const goalMat = useRef<THREE.MeshStandardMaterial>(null);
  const rings = useRef<Array<THREE.Mesh | null>>([]);
  const token = useRef("");
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const level = levels[sim.levelIndex];
    const next = `${sim.levelIndex}:${sim.order.join(",")}`;
    if (token.current !== next) {
      token.current = next;
      paintEdges(cage, [level.bounds], sim.order, dummy, up, dir);
      paintEdges(walls, level.solids, sim.order, dummy, up, dir);
      paintEdges(ghosts, level.ghosts, sim.order, dummy, up, dir);
      paintEdges(gates, level.portals, sim.order, dummy, up, dir);
      const count = Math.min(level.portals.length, 8);
      for (let i = 0; i < count; i++) {
        const portal = level.portals[i];
        const mid: Vec5 = [0, 0, 0, 0, 0];
        for (let k = 0; k < 5; k++) mid[k] = (portal.min[k] + portal.max[k]) / 2;
        const at = project(mid, sim.order);
        dummy.position.set(at[0], at[1], at[2]);
        dummy.quaternion.identity();
        const scale = 0.7 + portal.axes.length * 0.28;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        cores.setMatrixAt(i, dummy.matrix);
      }
      cores.count = count;
      cores.instanceMatrix.needsUpdate = true;
    }

    const at = project(sim.pos, sim.order);
    const exit = project(level.goal, sim.order);
    const pulse = 0.65 + Math.sin(state.clock.elapsedTime * 3) * 0.35;
    if (probe.current) {
      const bob = Math.abs(Math.sin(state.clock.elapsedTime * 14)) * Math.min(0.04, Math.abs(sim.speed) * 0.008);
      probe.current.position.set(at[0], at[1] + bob, at[2]);
      probe.current.rotation.y = sim.yaw;
    }
    const rank = sim.owned.reduce((n, on) => n + (on ? 1 : 0), 0);
    for (let i = 0; i < 5; i++) {
      const ring = rings.current[i];
      if (!ring) continue;
      ring.visible = i < rank;
      ring.rotation.z = state.clock.elapsedTime * (0.4 + i * 0.15);
      ring.rotation.x = i % 2 === 0 ? 0 : Math.PI / 2;
    }
    if (goal.current) goal.current.position.set(exit[0], exit[1], exit[2]);
    if (goalMat.current) {
      const near = Math.hypot(sim.pos[0] - level.goal[0], sim.pos[1] - level.goal[1], sim.pos[2] - level.goal[2], sim.pos[3] - level.goal[3], sim.pos[4] - level.goal[4]);
      goalMat.current.emissiveIntensity = near < 1.4 ? 0.4 + pulse : 0.12;
    }
    const span = beam.current;
    if (span) {
      dir.set(exit[0] - at[0], exit[1] - at[1], exit[2] - at[2]);
      const len = dir.length();
      span.visible = len > 0.08 && sim.mode !== "menu";
      if (span.visible) {
        span.position.set((at[0] + exit[0]) / 2, (at[1] + exit[1]) / 2, (at[2] + exit[2]) / 2);
        span.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
        span.scale.set(1, len, 1);
      }
    }

    const cam = state.camera;
    const kick = sim.shake;
    if (sim.mode === "menu") {
      const ang = reduce.current ? 0.7 : state.clock.elapsedTime * 0.16;
      desired.set(Math.sin(ang) * 12, 8, Math.cos(ang) * 12);
      look.set(0, 0.4, 0);
    } else if (sim.order.length < 2) {
      desired.set(at[0] + 0.4, at[1] + 5.4, at[2] + 10);
      look.set(at[0], at[1] + 0.2, at[2]);
    } else {
      const fx = -Math.sin(sim.yaw);
      const fz = -Math.cos(sim.yaw);
      desired.set(at[0] - fx * 8.6 + Math.sin(state.clock.elapsedTime * 46) * kick * 0.35, at[1] + 5.6, at[2] - fz * 8.6);
      look.set(at[0] + fx * 1.7, at[1] + 0.35, at[2] + fz * 1.7);
    }
    const follow = reduce.current ? 1 : 1 - Math.exp(-3.4 * dt);
    cam.position.lerp(desired, follow);
    cam.lookAt(look);
  });

  return (
    <>
      <primitive object={cage} />
      <primitive object={walls} />
      <primitive object={ghosts} />
      <primitive object={gates} />
      <primitive object={cores} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial map={floorTex} roughness={0.94} metalness={0.04} />
      </mesh>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshBasicMaterial color={PALETTE.signal} transparent opacity={0.45} />
      </mesh>
      <group ref={goal}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.035, 10, 28]} />
          <meshStandardMaterial
            ref={goalMat}
            color={PALETTE.signal}
            emissive={PALETTE.signal}
            emissiveIntensity={0.2}
            metalness={0.35}
            roughness={0.4}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshBasicMaterial color={PALETTE.signal} />
        </mesh>
      </group>
      <group ref={probe}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.22, 0.62, 16]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.76} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.02, -0.38]}>
          <sphereGeometry args={[0.08, 14, 10]} />
          <meshStandardMaterial color={PALETTE.signal} emissive={PALETTE.signal} emissiveIntensity={0.55} />
        </mesh>
        {[0.34, 0.44, 0.54, 0.64, 0.74].map((radius, index) => (
          <mesh
            key={radius}
            ref={(node) => {
              rings.current[index] = node;
            }}
          >
            <torusGeometry args={[radius, 0.012, 6, 24]} />
            <meshStandardMaterial color={index % 2 ? PALETTE.paper : PALETTE.brass} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <hemisphereLight args={[PALETTE.paper, PALETTE.bg, 0.55]} />
      <ambientLight intensity={0.14} />
      <directionalLight position={[8, 14, 6]} intensity={2.2} color={PALETTE.paper} />
      <pointLight position={[0, 3, 0]} color={PALETTE.brass} intensity={4} distance={18} />
    </>
  );
}

export function SceneHost() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <div className="absolute inset-0 bg-bg" />;
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.5]}
      camera={{ position: [0, 8, 12], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(PALETTE.bg);
      }}
    >
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 18, 46]} />
      <Stage />
    </Canvas>
  );
}
