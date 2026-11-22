export type Wall = { x: number; z: number; stable: boolean };

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type Level = {
  id: string;
  name: string;
  kicker: string;
  brief: string;
  hud: string;
  wCount: number;
  vCount: number;
  start: { x: number; z: number; w: number; v: number; yaw: number };
  goal: { x: number; z: number; w: number; v: number };
  bounds: Bounds;
  lists: Wall[][];
  ghostsW: Wall[][];
  ghostsV: Wall[][];
  sets: Set<number>[];
};

const CELL = (x: number, z: number) => (x + 32) * 128 + (z + 32);

function build(
  spec: Omit<Level, "lists" | "ghostsW" | "ghostsV" | "sets"> & {
    paint: (add: (x: number, z: number, w: number, v: number) => void) => void;
  },
): Level {
  const { wCount, vCount } = spec;
  const n = wCount * vCount;
  const sets = Array.from({ length: n }, () => new Set<number>());
  const lists: Wall[][] = Array.from({ length: n }, () => []);
  const at = (w: number, v: number) => w * vCount + v;

  const add = (x: number, z: number, w: number, v: number) => {
    if (w < 0 || v < 0 || w >= wCount || v >= vCount) return;
    if (x < spec.bounds.minX || x > spec.bounds.maxX) return;
    if (z < spec.bounds.minZ || z > spec.bounds.maxZ) return;
    const h = CELL(x, z);
    const s = sets[at(w, v)];
    if (s.has(h)) return;
    s.add(h);
    lists[at(w, v)].push({ x, z, stable: false });
  };

  spec.paint(add);

  for (let w = 0; w < wCount; w++) {
    for (let v = 0; v < vCount; v++) {
      for (const wall of lists[at(w, v)]) {
        const h = CELL(wall.x, wall.z);
        let adj = 0;
        let has = 0;
        const look = (ww: number, vv: number) => {
          if (ww < 0 || vv < 0 || ww >= wCount || vv >= vCount) return;
          adj += 1;
          if (sets[at(ww, vv)].has(h)) has += 1;
        };
        look(w - 1, v);
        look(w + 1, v);
        look(w, v - 1);
        look(w, v + 1);
        wall.stable = adj > 0 && has === adj;
      }
    }
  }

  const ghosts = (axis: "w" | "v") => {
    const out: Wall[][] = Array.from({ length: n }, () => []);
    for (let w = 0; w < wCount; w++) {
      for (let v = 0; v < vCount; v++) {
        const dest = out[at(w, v)];
        const seen = new Set<number>();
        const neighbors: Array<[number, number]> =
          axis === "w"
            ? [
                [w - 1, v],
                [w + 1, v],
              ]
            : [
                [w, v - 1],
                [w, v + 1],
              ];
        for (const [ww, vv] of neighbors) {
          if (ww < 0 || vv < 0 || ww >= wCount || vv >= vCount) continue;
          for (const wall of lists[at(ww, vv)]) {
            const h = CELL(wall.x, wall.z);
            if (sets[at(w, v)].has(h) || seen.has(h)) continue;
            seen.add(h);
            dest.push(wall);
          }
        }
      }
    }
    return out;
  };

  return {
    id: spec.id,
    name: spec.name,
    kicker: spec.kicker,
    brief: spec.brief,
    hud: spec.hud,
    wCount,
    vCount,
    start: spec.start,
    goal: spec.goal,
    bounds: spec.bounds,
    lists,
    sets,
    ghostsW: ghosts("w"),
    ghostsV: ghosts("v"),
  };
}

const FACE = Math.PI;

export const levels: Level[] = [
  build({
    id: "first-axis",
    name: "初轴",
    kicker: "W AXIS",
    brief: "正前方那堵墙只存在于 W = 0。拨到另一层，它就从截面里消失。出口要在 W = 1 才亮。",
    hud: "墙只在 W=0。出口在 W=1。",
    wCount: 2,
    vCount: 1,
    bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    start: { x: 0, z: -5, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 1, v: 0 },
    paint: (add) => {
      for (let x = -5; x <= 5; x++) add(x, 0, 0, 0);
    },
  }),
  build({
    id: "offset-seam",
    name: "错缝",
    kicker: "V SEAM",
    brief: "同一道闸在两条折叠层上错开一格。拨 V，中间那条缝才会出现。出口在 V = 1。",
    hud: "缝只在 V=1。出口也在这一层。",
    wCount: 1,
    vCount: 2,
    bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    start: { x: 0, z: -5, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 0, v: 1 },
    paint: (add) => {
      for (let x = -5; x <= 5; x++) add(x, 0, 0, 0);
      for (let x = -5; x <= 5; x++) if (x !== 0) add(x, 0, 0, 1);
      add(-3, -3, 0, 0);
      add(3, -3, 0, 0);
      add(-3, -3, 0, 1);
      add(3, -3, 0, 1);
    },
  }),
  build({
    id: "interlock",
    name: "联锁",
    kicker: "TWO AXES",
    brief: "南门跟着显形轴 W，北门跟着折叠轴 V。两道都打开、并且停在那一层，出口光圈才算真正显形。",
    hud: "南门看 W，北门看 V。出口要 W=1 且 V=1。",
    wCount: 2,
    vCount: 2,
    bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    start: { x: 0, z: -5, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 1, v: 1 },
    paint: (add) => {
      for (let v = 0; v < 2; v++) {
        for (let x = -5; x <= 5; x++) add(x, -1, 0, v);
      }
      for (let w = 0; w < 2; w++) {
        for (let x = -5; x <= 5; x++) add(x, 2, w, 0);
      }
    },
  }),
  build({
    id: "gallery",
    name: "侧廊",
    kicker: "GHOSTS",
    brief: "正中是每一层都在的实墙。西廊只在 W = 2 挖通；W = 1 只有一个死凹。线框是邻层的预告，不是现在能撞上的东西。",
    hud: "西廊在 W=2。铜线框是邻层。",
    wCount: 3,
    vCount: 1,
    bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
    start: { x: 0, z: -5, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 2, v: 0 },
    paint: (add) => {
      for (let w = 0; w < 3; w++) {
        for (let x = -1; x <= 6; x++) add(x, 0, w, 0);
      }
      for (let x = -6; x <= -2; x++) add(x, 0, 0, 0);
      for (let x = -5; x <= -2; x++) add(x, 0, 1, 0);
      add(-6, 1, 1, 0);
      add(4, -3, 0, 0);
      add(4, -3, 1, 0);
      add(4, -3, 2, 0);
    },
  }),
  build({
    id: "coupled",
    name: "耦合",
    kicker: "GEARED",
    brief: "两道闸咬合：你刚穿过的南缝，换层之后会关上。先从西缝过去，再把 W 和 V 都拨到 1，北闸中间才打开。",
    hud: "南缝会在换层后关闭。出口要 W=1 且 V=1。",
    wCount: 2,
    vCount: 2,
    bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },
    start: { x: 0, z: -5, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 1, v: 1 },
    paint: (add) => {
      for (let w = 0; w < 2; w++) {
        for (let v = 0; v < 2; v++) {
          for (let x = -5; x <= 5; x++) {
            const southGap = w === 0 ? -2 : 1;
            if (x !== southGap) add(x, 0, w, v);
            const northOpen = w === 1 && v === 1 && x === 0;
            if (!northOpen) add(x, 3, w, v);
          }
        }
      }
    },
  }),
  build({
    id: "core",
    name: "芯室",
    kicker: "FIVE",
    brief: "三道闸各认一组坐标：先 W1 V0，再 W1 V1，最后 W2 V2。门洞在别的层是实心的——别站在门里换层。",
    hud: "三闸：W1V0 → W1V1 → W2V2。别在门洞里换层。",
    wCount: 3,
    vCount: 3,
    bounds: { minX: -6, maxX: 6, minZ: -7, maxZ: 7 },
    start: { x: 0, z: -6, w: 0, v: 0, yaw: FACE },
    goal: { x: 0, z: 5, w: 2, v: 2 },
    paint: (add) => {
      for (let w = 0; w < 3; w++) {
        for (let v = 0; v < 3; v++) {
          for (let x = -6; x <= 6; x++) {
            if (!(w === 1 && v === 0 && x === 0)) add(x, -4, w, v);
            if (!(w === 1 && v === 1 && x === 2)) add(x, -1, w, v);
            if (!(w === 2 && v === 2 && x === 0)) add(x, 2, w, v);
          }
          add(-5, -6, w, v);
          add(5, -6, w, v);
          add(-5, 6, w, v);
          add(5, 6, w, v);
        }
      }
    },
  }),
];

export function phaseIndex(level: Level, w: number, v: number) {
  return w * level.vCount + v;
}
