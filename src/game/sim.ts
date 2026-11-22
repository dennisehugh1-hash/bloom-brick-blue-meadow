import { playDeny, playShift, playWin } from "./audio";
import { levels, phaseIndex, type Level } from "./levels";

export type Mode = "menu" | "play" | "paused" | "win";

export type View = {
  mode: Mode;
  level: number;
  name: string;
  kicker: string;
  brief: string;
  hud: string;
  w: number;
  v: number;
  wCount: number;
  vCount: number;
  time: number;
  note: string;
  dist: number;
  phaseOk: boolean;
  unlocked: number;
  best: number;
  total: number;
};

const STEP_TURN = 2.75;
const MAX_SPEED = 4.8;
const PLAYER_R = 0.28;

export const sim = {
  mode: "menu" as Mode,
  levelIndex: 0,
  x: 0,
  z: 0,
  yaw: Math.PI,
  speed: 0,
  w: 0,
  v: 0,
  time: 0,
  flash: 0,
  shake: 0,
  note: "",
  noteLeft: 0,
  touchThrottle: 0,
  touchSteer: 0,
  shiftCd: 0,
  unlocked: 0,
  best: 0,
  winSaved: false,
};

const held = new Set<string>();
let keyOverride: Set<string> | null = null;
let steerOverride: number | null = null;
const shiftQueue: Array<{ axis: "w" | "v"; dir: number }> = [];

const listeners = new Set<() => void>();
let view: View = emptyView();
let viewKey = "";

function emptyView(): View {
  const level = levels[0];
  return {
    mode: "menu",
    level: 0,
    name: level.name,
    kicker: level.kicker,
    brief: level.brief,
    hud: level.hud,
    w: level.start.w,
    v: level.start.v,
    wCount: level.wCount,
    vCount: level.vCount,
    time: 0,
    note: "",
    dist: 0,
    phaseOk: false,
    unlocked: 0,
    best: 0,
    total: levels.length,
  };
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getView() {
  return view;
}

export function publish() {
  const level = levels[sim.levelIndex];
  const dist = Math.hypot(sim.x - level.goal.x, sim.z - level.goal.z);
  const phaseOk = sim.w === level.goal.w && sim.v === level.goal.v;
  const key = [
    sim.mode,
    sim.levelIndex,
    sim.w,
    sim.v,
    Math.floor(sim.time * 5),
    sim.note,
    sim.unlocked,
    Math.round(dist),
    phaseOk ? 1 : 0,
    sim.best.toFixed(2),
  ].join("|");
  if (key === viewKey) return;
  viewKey = key;
  view = {
    mode: sim.mode,
    level: sim.levelIndex,
    name: level.name,
    kicker: level.kicker,
    brief: level.brief,
    hud: level.hud,
    w: sim.w,
    v: sim.v,
    wCount: level.wCount,
    vCount: level.vCount,
    time: sim.time,
    note: sim.note,
    dist,
    phaseOk,
    unlocked: sim.unlocked,
    best: sim.best,
    total: levels.length,
  };
  for (const fn of listeners) fn();
}

type Save = { unlocked: number; best: Record<string, number> };

const SAVE_KEY = "appearance-5d-v1";

function readSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { unlocked: 0, best: {} };
    const parsed = JSON.parse(raw) as Partial<Save>;
    return {
      unlocked: typeof parsed.unlocked === "number" ? parsed.unlocked : 0,
      best: parsed.best && typeof parsed.best === "object" ? parsed.best : {},
    };
  } catch {
    return { unlocked: 0, best: {} };
  }
}

function writeSave(save: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...save }));
  } catch {
    /* ignore quota / private mode */
  }
}

export function bootSave() {
  sim.unlocked = Math.max(0, Math.min(levels.length - 1, readSave().unlocked));
  publish();
}

export function loadLevel(index: number) {
  const i = Math.max(0, Math.min(levels.length - 1, index));
  const level = levels[i];
  sim.levelIndex = i;
  sim.x = level.start.x;
  sim.z = level.start.z;
  sim.yaw = level.start.yaw;
  sim.speed = 0;
  sim.w = level.start.w;
  sim.v = level.start.v;
  sim.time = 0;
  sim.flash = 0;
  sim.shake = 0;
  sim.note = "";
  sim.noteLeft = 0;
  sim.shiftCd = 0;
  sim.winSaved = false;
  sim.best = readSave().best[level.id] ?? 0;
  shiftQueue.length = 0;
}

function say(text: string) {
  if (sim.note === text) return;
  sim.note = text;
  if (text && text !== "出口在另一层才显形") sim.noteLeft = 1.7;
  publish();
}

export function requestShift(axis: "w" | "v", dir: number) {
  if (sim.mode !== "play") return;
  if (shiftQueue.length >= 2) return;
  shiftQueue.push({ axis, dir });
}

function circleHits(x: number, z: number, level: Level, w: number, v: number) {
  const b = level.bounds;
  if (x < b.minX - 0.5 + PLAYER_R || x > b.maxX + 0.5 - PLAYER_R) return true;
  if (z < b.minZ - 0.5 + PLAYER_R || z > b.maxZ + 0.5 - PLAYER_R) return true;
  const list = level.lists[phaseIndex(level, w, v)];
  const r2 = PLAYER_R * PLAYER_R;
  for (let i = 0; i < list.length; i++) {
    const wall = list[i];
    const cx = clamp(x, wall.x - 0.5, wall.x + 0.5);
    const cz = clamp(z, wall.z - 0.5, wall.z + 0.5);
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

function applyShift(axis: "w" | "v", dir: number) {
  const level = levels[sim.levelIndex];
  const nw = axis === "w" ? sim.w + dir : sim.w;
  const nv = axis === "v" ? sim.v + dir : sim.v;
  if (nw < 0 || nv < 0 || nw >= level.wCount || nv >= level.vCount) {
    sim.shake = 0.2;
    sim.flash = 0.35;
    playDeny();
    say(axis === "w" ? "显形轴已到尽头" : "折叠轴已到尽头");
    return;
  }
  if (circleHits(sim.x, sim.z, level, nw, nv)) {
    sim.shake = 0.28;
    sim.flash = 0.45;
    playDeny();
    say("这一层被实体占据");
    return;
  }
  sim.w = nw;
  sim.v = nv;
  sim.flash = 1;
  sim.note = "";
  playShift();
  publish();
}

function pressed(code: string) {
  const src = keyOverride ?? held;
  return src.has(code);
}

function commitWin() {
  if (sim.winSaved) return;
  sim.winSaved = true;
  const save = readSave();
  const level = levels[sim.levelIndex];
  const prev = save.best[level.id];
  if (prev === undefined || sim.time < prev) save.best[level.id] = sim.time;
  save.unlocked = Math.max(save.unlocked, Math.min(levels.length - 1, sim.levelIndex + 1));
  writeSave(save);
  sim.unlocked = save.unlocked;
  sim.best = save.best[level.id] ?? sim.time;
  playWin();
  publish();
}

export function step(dt: number) {
  sim.flash = Math.max(0, sim.flash - dt * 3.1);
  sim.shake = Math.max(0, sim.shake - dt);
  if (sim.mode !== "play") {
    sim.speed = 0;
    return;
  }

  sim.time += dt;
  sim.shiftCd = Math.max(0, sim.shiftCd - dt);
  if (sim.note && sim.note !== "出口在另一层才显形") {
    sim.noteLeft -= dt;
    if (sim.noteLeft <= 0) say("");
  }
  if (sim.shiftCd <= 0 && shiftQueue.length) {
    const job = shiftQueue.shift();
    if (job) applyShift(job.axis, job.dir);
    sim.shiftCd = 0.18;
  }

  let throttle = 0;
  let steer = 0;
  if (pressed("KeyW") || pressed("ArrowUp")) throttle += 1;
  if (pressed("KeyS") || pressed("ArrowDown")) throttle -= 1;
  if (pressed("KeyA") || pressed("ArrowLeft")) steer += 1;
  if (pressed("KeyD") || pressed("ArrowRight")) steer -= 1;
  if (steerOverride !== null) steer = steerOverride;
  throttle = clamp(throttle + sim.touchThrottle, -1, 1);
  steer = clamp(steer + (steerOverride !== null ? 0 : sim.touchSteer), -1, 1);

  const target = throttle > 0 ? throttle * MAX_SPEED : throttle * MAX_SPEED * 0.55;
  const rate = throttle === 0 ? 12 : 16;
  if (sim.speed < target) sim.speed = Math.min(target, sim.speed + rate * dt);
  else sim.speed = Math.max(target, sim.speed - rate * dt);

  const reverse = sim.speed >= 0 ? 1 : -1;
  const speedFactor = Math.max(0.7, Math.min(1, Math.abs(sim.speed) / 3));
  sim.yaw += steer * STEP_TURN * speedFactor * reverse * dt;

  const fx = -Math.sin(sim.yaw);
  const fz = -Math.cos(sim.yaw);
  const level = levels[sim.levelIndex];
  const ox = sim.x;
  const oz = sim.z;
  let nx = sim.x + fx * sim.speed * dt;
  if (circleHits(nx, sim.z, level, sim.w, sim.v)) nx = sim.x;
  let nz = sim.z + fz * sim.speed * dt;
  if (circleHits(nx, nz, level, sim.w, sim.v)) nz = sim.z;
  sim.x = nx;
  sim.z = nz;
  if (Math.hypot(sim.x - ox, sim.z - oz) < Math.abs(sim.speed) * dt * 0.2) {
    sim.speed *= 0.45;
  }

  const g = level.goal;
  const dx = sim.x - g.x;
  const dz = sim.z - g.z;
  const near = dx * dx + dz * dz < 1.35 * 1.35;
  const phaseOk = sim.w === g.w && sim.v === g.v;
  if (phaseOk && dx * dx + dz * dz < 0.72 * 0.72) {
    sim.mode = "win";
    sim.speed = 0;
    commitWin();
    return;
  }
  if (near && !phaseOk) say("出口在另一层才显形");
  else if (sim.note === "出口在另一层才显形") say("");

  publish();
}

export function bindKeys() {
  const onDown = (event: KeyboardEvent) => {
    held.add(event.code);
    if (sim.mode === "play") {
      const block = [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ];
      if (block.includes(event.code)) event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === "Escape") {
      if (sim.mode === "play") sim.mode = "paused";
      else if (sim.mode === "paused") sim.mode = "play";
      publish();
      return;
    }
    if (sim.mode !== "play") return;
    if (event.code === "KeyQ") requestShift("w", -1);
    if (event.code === "KeyE") requestShift("w", 1);
    if (event.code === "KeyZ") requestShift("v", -1);
    if (event.code === "KeyC") requestShift("v", 1);
  };
  const onUp = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  const onBlur = () => {
    held.clear();
    sim.touchThrottle = 0;
    sim.touchSteer = 0;
  };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);
  const onHide = () => {
    if (document.visibilityState !== "visible") onBlur();
  };
  document.addEventListener("visibilitychange", onHide);
  window.__controlsTest = {
    getYaw: () => sim.yaw,
    getSpeed: () => sim.speed,
    setSteer: (v) => {
      steerOverride = v;
    },
    setKeys: (codes) => {
      keyOverride = new Set(codes);
    },
  };
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onHide);
    delete window.__controlsTest;
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function blockedCell(level: Level, x: number, z: number, w: number, v: number) {
  if (x < level.bounds.minX || x > level.bounds.maxX) return true;
  if (z < level.bounds.minZ || z > level.bounds.maxZ) return true;
  if (w < 0 || v < 0 || w >= level.wCount || v >= level.vCount) return true;
  return level.sets[phaseIndex(level, w, v)].has((x + 32) * 128 + (z + 32));
}

export function solve(level: Level) {
  const startBlocked = blockedCell(level, level.start.x, level.start.z, level.start.w, level.start.v);
  const goalBlocked = blockedCell(level, level.goal.x, level.goal.z, level.goal.w, level.goal.v);
  const key = (x: number, z: number, w: number, v: number) =>
    ((w * level.vCount + v) << 16) ^ ((x + 32) << 8) ^ (z + 32);
  const q: number[][] = [[level.start.x, level.start.z, level.start.w, level.start.v, 0]];
  const seen = new Set<number>([key(level.start.x, level.start.z, level.start.w, level.start.v)]);
  let qi = 0;
  let length = -1;
  while (qi < q.length) {
    const [x, z, w, v, d] = q[qi++];
    if (x === level.goal.x && z === level.goal.z && w === level.goal.w && v === level.goal.v) {
      length = d;
      break;
    }
    const moves: Array<[number, number, number, number]> = [
      [x + 1, z, w, v],
      [x - 1, z, w, v],
      [x, z + 1, w, v],
      [x, z - 1, w, v],
      [x, z, w + 1, v],
      [x, z, w - 1, v],
      [x, z, w, v + 1],
      [x, z, w, v - 1],
    ];
    for (const [nx, nz, nw, nv] of moves) {
      if (blockedCell(level, nx, nz, nw, nv)) continue;
      const k = key(nx, nz, nw, nv);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, nz, nw, nv, d + 1]);
    }
  }
  return { length, startBlocked, goalBlocked, visited: seen.size };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}

loadLevel(0);
