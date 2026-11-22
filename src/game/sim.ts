import { playDeny, playShift, playWin } from "./audio.ts";
import { levels } from "./levels.ts";
import {
  AXES,
  GOAL_R,
  MAX_SPEED,
  attemptPortals,
  copy5,
  dist5,
  driveDelta,
  projectedDistance,
  rankOf,
  setOwnedAxis,
  toggleShown,
  tryDelta,
  zeros,
  type Vec5,
} from "./space.ts";

export type Mode = "menu" | "play" | "paused" | "win";

export type View = {
  mode: Mode;
  level: number;
  name: string;
  kicker: string;
  brief: string;
  hud: string;
  time: number;
  note: string;
  dist: number;
  stacked: boolean;
  unlocked: number;
  best: number;
  total: number;
  coords: number[];
  owned: boolean[];
  shown: boolean[];
  order: number[];
  rank: number;
  extras: string[];
};

const STEP_TURN = 2.75;

export const sim = {
  mode: "menu" as Mode,
  levelIndex: 0,
  pos: zeros(),
  owned: [true, false, false, false, false],
  order: [0] as number[],
  yaw: Math.PI,
  speed: 0,
  time: 0,
  flash: 0,
  shake: 0,
  note: "",
  noteLeft: 0,
  latch: null as string | null,
  touchThrottle: 0,
  touchSteer: 0,
  touchExtra: [0, 0, 0],
  unlocked: 0,
  best: 0,
  winSaved: false,
};

const held = new Set<string>();
let keyOverride: Set<string> | null = null;
let steerOverride: number | null = null;

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
    time: 0,
    note: "",
    dist: 0,
    stacked: false,
    unlocked: 0,
    best: 0,
    total: levels.length,
    coords: level.start.pos.slice(),
    owned: level.start.owned.slice(),
    shown: [true, false, false, false, false],
    order: level.start.order.slice(),
    rank: 1,
    extras: [],
  };
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getView() {
  return view;
}

function shownMask(order: readonly number[]) {
  const mask = [false, false, false, false, false];
  for (const axis of order) mask[axis] = true;
  return mask;
}

export function publish() {
  const level = levels[sim.levelIndex];
  const dist = dist5(sim.pos, level.goal);
  const shownDist = projectedDistance(sim.pos, level.goal, sim.order);
  const stacked = shownDist < 0.85 && dist > 0.9;
  const key = [
    sim.mode,
    sim.levelIndex,
    Math.floor(sim.time * 5),
    sim.note,
    sim.unlocked,
    Math.round(dist * 10),
    stacked ? 1 : 0,
    sim.best.toFixed(2),
    sim.order.join(""),
    sim.owned.map((on) => (on ? 1 : 0)).join(""),
    sim.pos.map((n) => n.toFixed(1)).join(","),
  ].join("|");
  if (key === viewKey) return;
  viewKey = key;
  const extras: string[] = [];
  for (let s = 2; s < sim.order.length; s++) extras.push(AXES[sim.order[s]]);
  view = {
    mode: sim.mode,
    level: sim.levelIndex,
    name: level.name,
    kicker: level.kicker,
    brief: level.brief,
    hud: level.hud,
    time: sim.time,
    note: sim.note,
    dist,
    stacked,
    unlocked: sim.unlocked,
    best: sim.best,
    total: levels.length,
    coords: sim.pos.slice(),
    owned: sim.owned.slice(),
    shown: shownMask(sim.order),
    order: sim.order.slice(),
    rank: rankOf(sim.owned),
    extras,
  };
  for (const fn of listeners) fn();
}

type Save = { unlocked: number; best: Record<string, number> };

const SAVE_KEY = "appearance-5d-v2";

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
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, ...save }));
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
  sim.pos = copy5(level.start.pos);
  sim.owned = level.start.owned.slice();
  sim.order = level.start.order.slice();
  sim.yaw = level.start.yaw;
  sim.speed = 0;
  sim.time = 0;
  sim.flash = 0;
  sim.shake = 0;
  sim.note = "";
  sim.noteLeft = 0;
  sim.latch = null;
  sim.touchThrottle = 0;
  sim.touchSteer = 0;
  sim.touchExtra = [0, 0, 0];
  sim.winSaved = false;
  sim.best = readSave().best[level.id] ?? 0;
}

function say(text: string, hold = 2.2) {
  sim.note = text;
  sim.noteLeft = text ? hold : 0;
  publish();
}

export function toggleDisplay(axis: number) {
  if (sim.mode !== "play") return;
  const result = toggleShown(sim.order, axis);
  if (!result.ok) {
    say(result.reason, 1.4);
    return;
  }
  sim.order = result.order;
  sim.flash = 0.45;
  publish();
}

export function toggleOwned(axis: number) {
  if (sim.mode !== "play") return;
  const level = levels[sim.levelIndex];
  const on = !sim.owned[axis];
  const result = setOwnedAxis(sim.owned, axis, on, sim.pos, level.solids, level.bounds);
  if (!result.ok) {
    sim.shake = 0.2;
    playDeny();
    say(result.reason, 1.6);
    return;
  }
  sim.owned = result.owned;
  sim.latch = null;
  sim.flash = 0.55;
  say(on ? `${AXES[axis]} 纳入探针` : `${AXES[axis]} 已释放`, 1.2);
  resolvePortal();
}

export function setTouchExtra(index: number, value: number) {
  if (index < 0 || index > 2) return;
  sim.touchExtra[index] = value;
}

function pressed(code: string) {
  return (keyOverride ?? held).has(code);
}

export function setTestKeys(codes: string[] | null) {
  keyOverride = codes ? new Set(codes) : null;
}

function extraInput(): [number, number, number] {
  const extra: [number, number, number] = [0, 0, 0];
  if (pressed("KeyQ")) extra[0] += 1;
  if (pressed("KeyE")) extra[0] -= 1;
  if (pressed("KeyZ")) extra[1] += 1;
  if (pressed("KeyC")) extra[1] -= 1;
  if (pressed("KeyR")) extra[2] += 1;
  if (pressed("KeyF")) extra[2] -= 1;
  for (let i = 0; i < 3; i++) extra[i] = clamp(extra[i] + sim.touchExtra[i], -1, 1);
  return extra;
}

function resolvePortal() {
  const level = levels[sim.levelIndex];
  const result = attemptPortals(sim.pos, sim.owned, level.portals, level.solids, level.bounds, sim.latch);
  sim.pos = result.pos;
  sim.latch = result.latch;
  if (result.fired) {
    sim.flash = 1;
    sim.speed *= 0.35;
    playShift();
    say(result.note);
  } else if (result.deny) {
    sim.shake = 0.28;
    sim.flash = 0.4;
    playDeny();
    say(result.note, 1.8);
  }
  if (sim.mode === "play" && dist5(sim.pos, level.goal) < GOAL_R) {
    sim.mode = "win";
    sim.speed = 0;
    commitWin();
  }
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
  if (sim.note) {
    sim.noteLeft -= dt;
    if (sim.noteLeft <= 0) {
      sim.note = "";
      sim.noteLeft = 0;
    }
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

  const level = levels[sim.levelIndex];
  const delta = driveDelta(sim.order, sim.owned, sim.yaw, sim.speed, extraInput(), dt);
  let moved = 0;
  const origin = copy5(sim.pos);
  tryDelta(sim.pos, sim.owned, delta, level.solids, level.bounds);
  for (let i = 0; i < 5; i++) {
    const d = sim.pos[i] - origin[i];
    moved += d * d;
  }
  if (Math.sqrt(moved) < Math.abs(sim.speed) * dt * 0.2 && Math.abs(sim.speed) > 0.4) {
    sim.speed *= 0.45;
  }

  resolvePortal();
  if (sim.mode === "play" && dist5(sim.pos, level.goal) < GOAL_R) {
    sim.mode = "win";
    sim.speed = 0;
    commitWin();
    return;
  }
  publish();
}

const DIGITS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];

export function bindKeys() {
  const onDown = (event: KeyboardEvent) => {
    held.add(event.code);
    if (sim.mode === "play") {
      const block = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
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
    const digit = DIGITS.indexOf(event.code);
    if (digit >= 0) {
      if (event.shiftKey) toggleOwned(digit);
      else toggleDisplay(digit);
    }
  };
  const onUp = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  const onBlur = () => {
    held.clear();
    sim.touchThrottle = 0;
    sim.touchSteer = 0;
    sim.touchExtra = [0, 0, 0];
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
      setTestKeys(codes);
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
export type { Vec5 };
