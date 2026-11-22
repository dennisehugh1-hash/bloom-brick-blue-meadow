import type { Box, Portal, Solid, Vec5 } from "./space.ts";

export type Level = {
  id: string;
  name: string;
  kicker: string;
  brief: string;
  hud: string;
  bounds: Box;
  solids: Solid[];
  ghosts: Solid[];
  portals: Portal[];
  start: { pos: Vec5; owned: boolean[]; order: number[]; yaw: number };
  goal: Vec5;
};

const FACE = Math.PI;

function v5(x: number, y: number, z: number, w: number, v: number): Vec5 {
  return [x, y, z, w, v];
}

function bounds(n: number): Box {
  return { min: v5(-n, -n, -n, -n, -n), max: v5(n, n, n, n, n) };
}

function full(box: Box, axis: number, a: number, b: number): Solid {
  const min = box.min.slice() as Vec5;
  const max = box.max.slice() as Vec5;
  min[axis] = a;
  max[axis] = b;
  return { min, max, tone: "wall" };
}

/** Two boxes that leave |gapAxis| < gapHalf empty, and fill every other axis. */
function slit(box: Box, blockAxis: number, a: number, b: number, gapAxis: number, gapHalf: number): Solid[] {
  const lo = full(box, blockAxis, a, b);
  const hi = full(box, blockAxis, a, b);
  lo.max[gapAxis] = -gapHalf;
  hi.min[gapAxis] = gapHalf;
  return [lo, hi];
}

function own(...axes: number[]): boolean[] {
  const mask = [false, false, false, false, false];
  for (const axis of axes) mask[axis] = true;
  return mask;
}

function portal(id: string, axes: number[], dest: number[], min: Vec5, max: Vec5): Portal {
  return { id, axes, dest, min, max };
}

function mouth(loose: Array<[number, number, number]>, tight = 0.45): { min: Vec5; max: Vec5 } {
  const min = v5(-tight, -tight, -tight, -tight, -tight);
  const max = v5(tight, tight, tight, tight, tight);
  for (const [axis, a, b] of loose) {
    min[axis] = a;
    max[axis] = b;
  }
  return { min, max };
}

export const levels: Level[] = [
  {
    id: "shadow",
    name: "投影",
    kicker: "SHADOW",
    brief: "显影不是切片。只展开 X 时，墙和另一处的纸色影子叠在同一条线上。把 Y 纳进探针再显影，才能从墙的上方绕过去。影子在 W 上，你碰不到。",
    hud: "显影 Y 并纳入它，再从墙的上方绕到出口。",
    bounds: bounds(5),
    solids: [
      {
        min: v5(1.5, -5, -5, -5, -5),
        max: v5(2.4, 0.5, 5, 5, 5),
        tone: "wall",
      },
    ],
    ghosts: [
      {
        min: v5(1.55, -5, -5, 2, -5),
        max: v5(2.35, 0.5, 5, 3.2, 5),
        tone: "ghost",
      },
    ],
    portals: [],
    start: { pos: v5(-2.2, 0, 0, 0, 0), owned: own(0), order: [0], yaw: FACE },
    goal: v5(4, 1.2, 0, 0, 0),
  },
  {
    id: "needle",
    name: "细针",
    kicker: "RANK",
    brief: "缝比探针的厚度窄。Y 还纳入着的时候过不去。把 Y 释放，探针在这根轴上变成细针，才能从缝里穿过去。",
    hud: "释放 Y，再沿 X 穿过细缝。",
    bounds: bounds(5),
    solids: slit(bounds(5), 0, 1.6, 2.5, 1, 0.16),
    ghosts: [],
    portals: [],
    start: { pos: v5(-2, 0, 0, 0, 0), owned: own(0, 1), order: [0, 1], yaw: -Math.PI / 2 },
    goal: v5(4, 0, 0, 0, 0),
  },
  {
    id: "point",
    name: "点门",
    kicker: "1-GATE",
    brief: "一维传送点只改一个坐标。整面墙封死了 X，点门把 X 咬到墙的另一侧。别的轴原样穿过。",
    hud: "把探针开进点门。它只改 X。",
    bounds: bounds(6),
    solids: [full(bounds(6), 0, 0.4, 1.2)],
    ghosts: [],
    portals: [
      portal("x-point", [0], [3.5], mouth([[0, -4.2, -1.4]]).min, mouth([[0, -4.2, -1.4]]).max),
    ],
    start: { pos: v5(-5, 0, 0, 0, 0), owned: own(0), order: [0], yaw: FACE },
    goal: v5(4.4, 0, 0, 0, 0),
  },
  {
    id: "plane",
    name: "面门",
    kicker: "2-GATE",
    brief: "二维门要同时咬住 X 和 W。只纳入 X 时，残缺落点埋在实体里，门会拒绝。把 W 显影并纳入，整扇门才放行。",
    hud: "纳入 W 后再进面门。只带 X 会被拒。",
    bounds: bounds(6),
    solids: [full(bounds(6), 0, 3.3, 4.7)],
    ghosts: [],
    portals: [
      portal("xw", [0, 3], [4, 3], mouth([[0, -0.9, 0.9]]).min, mouth([[0, -0.9, 0.9]]).max),
    ],
    start: { pos: v5(0, 0, 0, 0, 0), owned: own(0), order: [0], yaw: FACE },
    goal: v5(4, 0, 0, 3, 0),
  },
  {
    id: "volume",
    name: "体门",
    kicker: "3-GATE",
    brief: "三维体同时改 X、Y、Z。去门口要先穿过一条比厚度更窄的 V 缝，所以得先释放 V。体门不咬你没纳入的 Z：缺了 Z，落点是实的。",
    hud: "释放 V 过缝，纳入 Z，再进三维体。",
    bounds: bounds(6),
    solids: [
      ...slit(bounds(6), 0, -2.2, -1.4, 4, 0.16),
      full(bounds(6), 0, 0.8, 1.4),
      {
        min: v5(3, 1.4, -0.45, -6, -6),
        max: v5(4.2, 2.6, 0.55, 6, 6),
        tone: "wall",
      },
    ],
    ghosts: [],
    portals: [portal("xyz", [0, 1, 2], [3.5, 2, -2], mouth([[0, -0.55, 0.55]]).min, mouth([[0, -0.55, 0.55]]).max)],
    start: { pos: v5(-4, 0, 0, 0, 0), owned: own(0, 1, 4), order: [0, 1], yaw: -Math.PI / 2 },
    goal: v5(3.5, 2, -2, 0, 0),
  },
  {
    id: "all-five",
    name: "齐轴",
    kicker: "FIVE",
    brief: "细缝认 Y 的阶，点门认 Z，面门认 X 和 Y，体门认 X、W、V。少一根被咬住的轴，落点就是实体。五根轴都要轮到。",
    hud: "过 Y 缝，纳入 Y 进面门；纳入 Z 进点门；纳入 W 和 V 进体门。",
    bounds: bounds(6),
    solids: [
      ...slit(bounds(6), 0, -5.15, -4.75, 1, 0.16),
      full(bounds(6), 0, -1.3, -0.7),
      full(bounds(6), 2, 0.75, 1.35),
      full(bounds(6), 3, 0.65, 1.25),
      full(bounds(6), 4, -1.25, -0.65),
      {
        min: v5(1.55, -0.7, -6, -6, -6),
        max: v5(2.55, 0.7, 6, 6, 6),
        tone: "wall",
      },
      {
        min: v5(2.7, -6, -6, -0.55, -0.55),
        max: v5(3.4, 6, 6, 0.55, 0.55),
        tone: "wall",
      },
      {
        min: v5(2.7, -6, -6, -0.55, -3.4),
        max: v5(3.4, 6, 6, 0.55, -2.6),
        tone: "wall",
      },
      {
        min: v5(2.7, -6, -6, 2.6, -0.55),
        max: v5(3.4, 6, 6, 3.4, 0.55),
        tone: "wall",
      },
    ],
    ghosts: [],
    portals: [
      portal(
        "plane-xy",
        [0, 1],
        [2, 2],
        mouth([[0, -4.35, -3.55]]).min,
        mouth([[0, -4.35, -3.55]]).max,
      ),
      portal(
        "point-z",
        [2],
        [2],
        mouth([
          [0, 1.55, 2.55],
          [1, 1.55, 2.55],
          [2, -0.45, 0.45],
        ]).min,
        mouth([
          [0, 1.55, 2.55],
          [1, 1.55, 2.55],
          [2, -0.45, 0.45],
        ]).max,
      ),
      portal(
        "volume-xwv",
        [0, 3, 4],
        [3, 3, -3],
        mouth([
          [0, 1.55, 2.55],
          [1, 1.55, 2.55],
          [2, 1.55, 2.55],
        ]).min,
        mouth([
          [0, 1.55, 2.55],
          [1, 1.55, 2.55],
          [2, 1.55, 2.55],
        ]).max,
      ),
    ],
    start: { pos: v5(-5.5, 0, 0, 0, 0), owned: own(0), order: [0], yaw: FACE },
    goal: v5(3, 2, 2, 3, -3),
  },
];

const level4 = levels[3];
level4.solids[0].max[3] = 1;
level4.solids[0].min[3] = -1;
