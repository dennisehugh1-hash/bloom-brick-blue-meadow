import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { levels, type Level } from "./levels.ts";
import {
  AXES,
  GOAL_R,
  R_OWN,
  R_THIN,
  SLOT,
  attemptPortals,
  blocked,
  boxesOverlap,
  centerInMouth,
  copy5,
  dist5,
  driveDelta,
  hits,
  legal,
  previewTransit,
  project,
  projectedDistance,
  setOwnedAxis,
  subsetsOf5,
  toggleShown,
  tryDelta,
  type Portal,
  type Vec5,
} from "./space.ts";

type Sim = { pos: Vec5; owned: boolean[]; order: number[]; latch: string | null };

function boot(level: Level): Sim {
  return {
    pos: copy5(level.start.pos),
    owned: level.start.owned.slice(),
    order: level.start.order.slice(),
    latch: null,
  };
}

function refresh(level: Level, s: Sim) {
  const result = attemptPortals(s.pos, s.owned, level.portals, level.solids, level.bounds, s.latch);
  s.pos = result.pos;
  s.latch = result.latch;
  return result;
}

function own(level: Level, s: Sim, axis: number, on: boolean) {
  const result = setOwnedAxis(s.owned, axis, on, s.pos, level.solids, level.bounds);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  if (!result.ok) return;
  s.owned = result.owned;
  s.latch = null;
  refresh(level, s);
}

function show(s: Sim, axis: number) {
  const result = toggleShown(s.order, axis);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  if (result.ok) s.order = result.order;
}

function go(level: Level, s: Sim, axis: number, dist: number) {
  const steps = Math.max(1, Math.ceil(Math.abs(dist) / 0.08));
  const step = dist / steps;
  for (let i = 0; i < steps; i++) {
    const delta: Vec5 = [0, 0, 0, 0, 0];
    delta[axis] = step;
    tryDelta(s.pos, s.owned, delta, level.solids, level.bounds);
    refresh(level, s);
  }
}

function solved(level: Level, s: Sim) {
  assert.ok(legal(s.pos, s.owned, level.solids, level.bounds), `${level.id} ended inside matter`);
  assert.ok(dist5(s.pos, level.goal) < GOAL_R, `${level.id} dist ${dist5(s.pos, level.goal)}`);
}

describe("projection is not a slice", () => {
  it("hides an axis by collapsing it, and keeps every shown axis", () => {
    const origin = project([0, 0, 0, 4, -3], [0]);
    const shifted = project([0, 0, 0, 0, 0], [0]);
    assert.deepEqual(origin, shifted);
    const shown = project([0, 0, 0, 4, -3], [0, 3]);
    assert.notDeepEqual(shown, project([0, 0, 0, 0, -3], [0, 3]));
  });

  it("maps each shown axis onto its own slot, for every non-empty subset", () => {
    for (const order of subsetsOf5()) {
      const base = project([1, 1, 1, 1, 1], order);
      for (let slot = 0; slot < order.length; slot++) {
        const pos: Vec5 = [1, 1, 1, 1, 1];
        pos[order[slot]] = 2;
        const next = project(pos, order);
        const dir = SLOT[slot];
        for (let k = 0; k < 3; k++) {
          assert.ok(Number.isFinite(next[k]));
          assert.ok(Math.abs(next[k] - base[k] - dir[k]) < 1e-9);
        }
      }
    }
    assert.equal(subsetsOf5().length, 31);
  });
});

describe("body and gates", () => {
  it("slides one axis when another is blocked", () => {
    const bounds = { min: [-5, -5, -5, -5, -5] as Vec5, max: [5, 5, 5, 5, 5] as Vec5 };
    const wall = { min: [0.4, -5, -5, -5, -5] as Vec5, max: [1, 5, 5, 5, 5] as Vec5 };
    const pos: Vec5 = [0, 0, 0, 0, 0];
    const owned = [true, true, false, false, false];
    tryDelta(pos, owned, [2, 1.5, 0, 0, 0], [wall], bounds);
    assert.ok(pos[0] < 0.4);
    assert.ok(Math.abs(pos[1] - 1.5) < 1e-9);
  });

  it("refuses thrust on an axis the probe does not own", () => {
    const bounds = { min: [-5, -5, -5, -5, -5] as Vec5, max: [5, 5, 5, 5, 5] as Vec5 };
    const pos: Vec5 = [0, 0, 0, 0, 0];
    tryDelta(pos, [true, false, false, false, false], [0, 1, 0, 0, 0], [], bounds);
    assert.equal(pos[1], 0);
  });

  it("a thick body cannot take the slit a needle can", () => {
    const level = levels[1];
    const thick: Vec5 = [2, 0, 0, 0, 0];
    const owned = [true, true, false, false, false];
    assert.equal(hits(thick, owned, level.solids[0]) || hits(thick, owned, level.solids[1]), true);
    const thin = owned.slice();
    thin[1] = false;
    assert.equal(blocked([2, 0, 0, 0, 0], thin, level.solids), false);
    assert.ok(R_THIN < 0.16 && R_OWN > 0.16);
  });

  it("couples only owned axes, and will not finish a landing inside a solid", () => {
    const bounds = { min: [-6, -6, -6, -6, -6] as Vec5, max: [6, 6, 6, 6, 6] as Vec5 };
    const solid = { min: [3, -6, -6, -1, -6] as Vec5, max: [5, 6, 6, 1, 6] as Vec5 };
    const gate: Portal = {
      id: "g",
      axes: [0, 3],
      dest: [4, 3],
      min: [-1, -1, -1, -1, -1],
      max: [1, 1, 1, 1, 1],
    };
    const partial = previewTransit([0, 0, 0, 0, 0], [true, false, false, false, false], gate, [solid], bounds);
    assert.equal(partial.ok, false);
    const full = previewTransit([0, 0, 0, 0, 0], [true, false, false, true, false], gate, [solid], bounds);
    assert.equal(full.ok, true);
    if (full.ok) assert.deepEqual(full.pos, [4, 0, 0, 3, 0]);
    const none = previewTransit([0, 0, 0, 0, 0], [false, true, false, false, false], gate, [], bounds);
    assert.equal(none.ok, false);
  });

  it("a low-rank probe keeps loose axes; a high-rank probe must already sit in the calibre", () => {
    const bounds = { min: [-8, -8, -8, -8, -8] as Vec5, max: [8, 8, 8, 8, 8] as Vec5 };
    const wide: Portal = {
      id: "wide",
      axes: [0, 1, 2, 3, 4],
      dest: [1, 2, 3, 4, 5],
      min: [-1, -1, -1, -1, -1],
      max: [1, 1, 1, 1, 1],
    };
    const low = previewTransit(copy5([0, 0, 0, 0, 0]), [true, false, false, false, false], wide, [], bounds);
    assert.equal(low.ok, true);
    if (low.ok) assert.deepEqual(low.pos, [1, 0, 0, 0, 0]);
    const point: Portal = {
      id: "point",
      axes: [0],
      dest: [4],
      min: [-1, -0.1, -0.1, -0.1, -0.1],
      max: [1, 0.1, 0.1, 0.1, 0.1],
    };
    assert.equal(centerInMouth([0, 0.4, 0, 0, 0], point), false);
    const high = previewTransit([0, 0, 0, 0, 0], [true, true, true, true, true], point, [], bounds);
    assert.equal(high.ok, true);
    if (high.ok) {
      assert.equal(high.pos[0], 4);
      assert.equal(high.pos[1], 0);
      assert.equal(high.kind, "full");
    }
  });

  it("latches a mouth so a gate cannot chain or repeat in the same stay", () => {
    const bounds = { min: [-8, -8, -8, -8, -8] as Vec5, max: [8, 8, 8, 8, 8] as Vec5 };
    const first: Portal = {
      id: "a",
      axes: [0],
      dest: [3],
      min: [-0.5, -0.5, -0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5, 0.5, 0.5],
    };
    const second: Portal = {
      id: "b",
      axes: [1],
      dest: [3],
      min: [2.5, -0.5, -0.5, -0.5, -0.5],
      max: [3.5, 0.5, 0.5, 0.5, 0.5],
    };
    const owned = [true, true, false, false, false];
    const once = attemptPortals([0, 0, 0, 0, 0], owned, [first, second], [], bounds, null);
    assert.equal(once.fired, true);
    assert.equal(once.pos[0], 3);
    assert.equal(once.pos[1], 0);
    const again = attemptPortals(once.pos, owned, [first, second], [], bounds, null);
    assert.equal(again.pos[1], 3);
    const held = attemptPortals([0, 0, 0, 0, 0], owned, [first], [], bounds, "a");
    assert.equal(held.fired, false);
    assert.equal(held.pos[0], 0);
  });

  it("rejects a rank change that would embed the body", () => {
    const bounds = { min: [-5, -5, -5, -5, -5] as Vec5, max: [5, 5, 5, 5, 5] as Vec5 };
    const wall = { min: [-5, 0.1, -5, -5, -5] as Vec5, max: [5, 5, 5, 5, 5] as Vec5 };
    const pos: Vec5 = [0, 0, 0, 0, 0];
    const bad = setOwnedAxis([true, false, false, false, false], 1, true, pos, [wall], bounds);
    assert.equal(bad.ok, false);
    const last = setOwnedAxis([true, false, false, false, false], 0, false, pos, [], bounds);
    assert.equal(last.ok, false);
    const hide = toggleShown([0], 0);
    assert.equal(hide.ok, false);
  });
});

describe("heading", () => {
  it("treats the first two shown owned axes as the driving plane", () => {
    const plane = driveDelta([0, 1], [true, true, false, false, false], Math.PI, 2, [0, 0, 0], 1);
    assert.ok(Math.abs(plane[0]) < 1e-9);
    assert.ok(Math.abs(plane[1] - 2) < 1e-9);
    const left = driveDelta([0, 1], [true, true, false, false, false], Math.PI + 0.4, 2, [0, 0, 0], 1);
    assert.ok(left[0] > 0);
    const line = driveDelta([3], [false, false, false, true, false], 0.2, 1.5, [0, 0, 0], 1);
    assert.ok(Math.abs(line[3] - 1.5) < 1e-9);
    const third = driveDelta([0, 1, 4], [true, true, false, false, true], Math.PI, 0, [1, 0, 0], 1);
    assert.ok(third[4] > 0);
    assert.equal(third[2], 0);
  });
});

describe("levels", () => {
  it("are geometrically sane", () => {
    const ids = new Set<string>();
    for (const level of levels) {
      assert.equal(ids.has(level.id), false);
      ids.add(level.id);
      assert.equal(level.start.pos.length, 5);
      assert.equal(level.goal.length, 5);
      assert.ok(legal(level.start.pos, level.start.owned, level.solids, level.bounds), level.id);
      assert.equal(blocked(level.goal, [true, true, true, true, true], level.solids), false, level.id);
      for (const portal of level.portals) {
        assert.equal(portal.dest.length, portal.axes.length);
        assert.equal(new Set(portal.axes).size, portal.axes.length);
        for (const axis of portal.axes) assert.ok(axis >= 0 && axis <= 4);
      }
      for (let i = 0; i < level.portals.length; i++) {
        for (let j = i + 1; j < level.portals.length; j++) {
          assert.equal(boxesOverlap(level.portals[i], level.portals[j]), false, `${level.id} mouths`);
        }
      }
    }
    assert.equal(levels.length, 6);
    assert.equal(AXES.length, 5);
  });

  it("level 1 needs Y on the probe, and the ghost is only a shadow", () => {
    const level = levels[0];
    const stuck = boot(level);
    go(level, stuck, 0, 8);
    assert.ok(dist5(stuck.pos, level.goal) > GOAL_R);
    const shadow = project(level.solids[0].min, [0]);
    const ghost = project(level.ghosts[0].min, [0]);
    assert.ok(Math.abs(shadow[0] - ghost[0]) < 0.2);
    assert.ok(projectedDistance(level.solids[0].min, level.ghosts[0].min, [0, 3]) > 1);
    const s = boot(level);
    show(s, 1);
    own(level, s, 1, true);
    go(level, s, 1, 1.2);
    go(level, s, 0, 6.2);
    solved(level, s);
  });

  it("level 2 is the needle", () => {
    const level = levels[1];
    const thick = boot(level);
    go(level, thick, 0, 8);
    assert.ok(thick.pos[0] < 1.6);
    const s = boot(level);
    own(level, s, 1, false);
    go(level, s, 0, 6.2);
    solved(level, s);
  });

  it("level 3 is a one-axis gate", () => {
    const level = levels[2];
    const s = boot(level);
    go(level, s, 0, 2);
    solved(level, s);
  });

  it("level 4 refuses the partial landing", () => {
    const level = levels[3];
    const s = boot(level);
    const denied = refresh(level, s);
    assert.equal(denied.deny, true);
    assert.equal(s.pos[0], 0);
    show(s, 3);
    own(level, s, 3, true);
    solved(level, s);
  });

  it("level 5 needs a descent and then Z", () => {
    const level = levels[4];
    const blockedRank = boot(level);
    go(level, blockedRank, 0, 5);
    assert.ok(blockedRank.pos[0] < -1.4);
    const early = boot(level);
    own(level, early, 4, false);
    go(level, early, 0, 4.2);
    assert.equal(early.latch !== null && early.pos[0] < 1, true);
    own(level, early, 2, true);
    solved(level, early);
  });

  it("level 6 uses every axis", () => {
    const level = levels[5];
    const s = boot(level);
    go(level, s, 0, 1.4);
    assert.ok(s.pos[0] > -4.5, "needle should clear the slit");
    own(level, s, 1, true);
    if (dist5(s.pos, [2, 2, 0, 0, 0]) > 0.2) go(level, s, 0, 1);
    assert.ok(dist5(s.pos, [2, 2, 0, 0, 0]) < 1e-6, s.pos.join(","));
    own(level, s, 2, true);
    assert.ok(Math.abs(s.pos[2] - 2) < 1e-9);
    own(level, s, 3, true);
    own(level, s, 4, true);
    solved(level, s);
    assert.ok(s.owned.every(Boolean));
  });
});
