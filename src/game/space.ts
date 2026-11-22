/** Five equal axes. The picture is a projection of the axes you develop, never a slice. */

export const AXES = ["X", "Y", "Z", "W", "V"] as const;

export type Vec5 = [number, number, number, number, number];

export type Box = { min: Vec5; max: Vec5 };

export type Solid = Box & { tone: "wall" | "ghost" };

export type Portal = {
  id: string;
  /** Axes this gate rewrites. Length is its dimension: 1 point, 2 door, 3 volume, 4 or 5 the same rule. */
  axes: number[];
  min: Vec5;
  max: Vec5;
  dest: number[];
};

export const R_OWN = 0.28;
export const R_THIN = 0.05;
export const GOAL_R = 0.62;
export const THRUST = 3.4;
export const MAX_SPEED = 4.8;

const RAW4 = [0.64, 0.55, 0.54];
const RAW5 = [-0.5, 0.7, 0.51];

function unit3(v: number[]): readonly [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Slot 0 right, 1 depth, 2 up, 3 and 4 oblique so a 4th and 5th axis stay visible. */
export const SLOT: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  unit3(RAW4),
  unit3(RAW5),
];

export function zeros(): Vec5 {
  return [0, 0, 0, 0, 0];
}

export function copy5(v: readonly number[]): Vec5 {
  return [v[0], v[1], v[2], v[3], v[4]];
}

export function radius(owned: readonly boolean[], axis: number) {
  return owned[axis] ? R_OWN : R_THIN;
}

export function rankOf(owned: readonly boolean[]) {
  let n = 0;
  for (let i = 0; i < 5; i++) if (owned[i]) n += 1;
  return n;
}

export function project(pos: readonly number[], order: readonly number[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = Math.min(order.length, 5);
  for (let s = 0; s < n; s++) {
    const c = pos[order[s]];
    const d = SLOT[s];
    x += c * d[0];
    y += c * d[1];
    z += c * d[2];
  }
  return [x, y, z];
}

export function projectedDistance(a: readonly number[], b: readonly number[], order: readonly number[]) {
  const pa = project(a, order);
  const pb = project(b, order);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

export function dist5(a: readonly number[], b: readonly number[]) {
  let s = 0;
  for (let i = 0; i < 5; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function hits(pos: readonly number[], owned: readonly boolean[], box: Box) {
  for (let i = 0; i < 5; i++) {
    const r = radius(owned, i);
    if (pos[i] + r <= box.min[i] || pos[i] - r >= box.max[i]) return false;
  }
  return true;
}

export function inBounds(pos: readonly number[], owned: readonly boolean[], bounds: Box) {
  for (let i = 0; i < 5; i++) {
    const r = radius(owned, i);
    if (pos[i] - r < bounds.min[i] || pos[i] + r > bounds.max[i]) return false;
  }
  return true;
}

export function blocked(pos: readonly number[], owned: readonly boolean[], solids: readonly Box[]) {
  for (let i = 0; i < solids.length; i++) {
    if (hits(pos, owned, solids[i])) return true;
  }
  return false;
}

export function legal(pos: readonly number[], owned: readonly boolean[], solids: readonly Box[], bounds: Box) {
  return inBounds(pos, owned, bounds) && !blocked(pos, owned, solids);
}

/** Slide one axis at a time. Unowned axes ignore thrust — a needle has no push. */
export function tryDelta(
  pos: Vec5,
  owned: readonly boolean[],
  delta: readonly number[],
  solids: readonly Box[],
  bounds: Box,
) {
  let max = 0;
  for (let i = 0; i < 5; i++) max = Math.max(max, Math.abs(delta[i] || 0));
  const steps = Math.max(1, Math.ceil(max / 0.12));
  let moved = false;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < 5; i++) {
      const part = (delta[i] || 0) / steps;
      if (part === 0 || !owned[i]) continue;
      pos[i] += part;
      if (!legal(pos, owned, solids, bounds)) pos[i] -= part;
      else moved = true;
    }
  }
  return moved;
}

export function driveDelta(
  order: readonly number[],
  owned: readonly boolean[],
  yaw: number,
  speed: number,
  extra: readonly number[],
  dt: number,
): Vec5 {
  const delta = zeros();
  const a0 = order[0];
  const a1 = order[1];
  if (a0 !== undefined && a1 !== undefined && owned[a0] && owned[a1]) {
    delta[a0] += -Math.sin(yaw) * speed * dt;
    delta[a1] += -Math.cos(yaw) * speed * dt;
  } else if (a0 !== undefined && owned[a0]) {
    delta[a0] += speed * dt;
  } else if (a1 !== undefined && owned[a1]) {
    delta[a1] += speed * dt;
  }
  for (let s = 2; s < order.length && s < 5; s++) {
    const axis = order[s];
    const thrust = extra[s - 2] || 0;
    if (!owned[axis] || thrust === 0) continue;
    delta[axis] += thrust * THRUST * dt;
  }
  return delta;
}

/**
 * A gate rewrites only axes the probe owns (it can bite thickness, not a needle).
 * Axes the probe owns but the gate does not mention pass through unchanged —
 * the mouth's window on those axes is the calibre the thicker body must already meet.
 * A partial rewrite that would land inside a solid is refused whole.
 */
export function previewTransit(
  pos: readonly number[],
  owned: readonly boolean[],
  portal: Portal,
  solids: readonly Box[],
  bounds: Box,
): { ok: true; kind: "full" | "partial"; pos: Vec5; note: string } | { ok: false; reason: string } {
  const coupled: number[] = [];
  const loose: number[] = [];
  for (let k = 0; k < portal.axes.length; k++) {
    const axis = portal.axes[k];
    if (owned[axis]) coupled.push(axis);
    else loose.push(axis);
  }
  if (coupled.length === 0) {
    return { ok: false, reason: "探针与这扇门没有共有的维度" };
  }
  const next = copy5(pos);
  for (let k = 0; k < portal.axes.length; k++) {
    const axis = portal.axes[k];
    if (owned[axis]) next[axis] = portal.dest[k];
  }
  if (!legal(next, owned, solids, bounds)) {
    if (loose.length > 0) {
      return { ok: false, reason: `阶数不足，${portal.axes.length} 维门只咬住一部分，残缺落点是实体` };
    }
    return { ok: false, reason: "这一阶过不了这扇门的出口，降下多余的轴再试" };
  }
  if (loose.length > 0) {
    const names = coupled.map((axis) => AXES[axis]).join(" ");
    return {
      ok: true,
      kind: "partial",
      pos: next,
      note: `${portal.axes.length} 维门只咬住了 ${names}，没纳入的轴留在原地`,
    };
  }
  return { ok: true, kind: "full", pos: next, note: `通过 ${portal.axes.length} 维传送` };
}

export function centerInMouth(pos: readonly number[], portal: Portal) {
  for (let i = 0; i < 5; i++) {
    if (pos[i] < portal.min[i] || pos[i] > portal.max[i]) return false;
  }
  return true;
}

export function attemptPortals(
  pos: readonly number[],
  owned: readonly boolean[],
  portals: readonly Portal[],
  solids: readonly Box[],
  bounds: Box,
  latch: string | null,
): { pos: Vec5; latch: string | null; note: string; fired: boolean; deny: boolean } {
  let inside: Portal | null = null;
  for (let i = 0; i < portals.length; i++) {
    if (centerInMouth(pos, portals[i])) {
      inside = portals[i];
      break;
    }
  }
  if (!inside) return { pos: copy5(pos), latch: null, note: "", fired: false, deny: false };
  if (latch === inside.id) return { pos: copy5(pos), latch, note: "", fired: false, deny: false };
  const result = previewTransit(pos, owned, inside, solids, bounds);
  if (!result.ok) {
    return { pos: copy5(pos), latch: inside.id, note: result.reason, fired: false, deny: true };
  }
  return { pos: result.pos, latch: inside.id, note: result.note, fired: true, deny: false };
}

export function setOwnedAxis(
  owned: readonly boolean[],
  axis: number,
  on: boolean,
  pos: readonly number[],
  solids: readonly Box[],
  bounds: Box,
): { ok: true; owned: boolean[] } | { ok: false; reason: string } {
  if (axis < 0 || axis > 4) return { ok: false, reason: "没有这根轴" };
  if (owned[axis] === on) return { ok: true, owned: owned.slice() };
  const next = owned.slice();
  next[axis] = on;
  if (rankOf(next) < 1) return { ok: false, reason: "探针至少保留一根轴" };
  if (!legal(pos, next, solids, bounds)) {
    return { ok: false, reason: on ? "升维后会嵌进实体，先开到开阔处" : "降维后口径不对，先离开这处实体" };
  }
  return { ok: true, owned: next };
}

export function toggleShown(order: readonly number[], axis: number): { ok: true; order: number[] } | { ok: false; reason: string } {
  if (axis < 0 || axis > 4) return { ok: false, reason: "没有这根轴" };
  const at = order.indexOf(axis);
  if (at >= 0) {
    if (order.length <= 1) return { ok: false, reason: "至少显影一根轴" };
    const next = order.slice();
    next.splice(at, 1);
    return { ok: true, order: next };
  }
  return { ok: true, order: [...order, axis] };
}

export function boxesOverlap(a: Box, b: Box) {
  for (let i = 0; i < 5; i++) {
    if (a.max[i] <= b.min[i] || b.max[i] <= a.min[i]) return false;
  }
  return true;
}

export function subsetsOf5(): number[][] {
  const out: number[][] = [];
  for (let mask = 1; mask < 32; mask++) {
    const axes: number[] = [];
    for (let i = 0; i < 5; i++) if (mask & (1 << i)) axes.push(i);
    out.push(axes);
  }
  return out;
}
