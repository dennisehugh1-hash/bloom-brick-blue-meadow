import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadLevel, setTestKeys, sim, step, toggleDisplay, toggleOwned } from "./sim.ts";

function frames(n: number) {
  for (let i = 0; i < n; i++) step(1 / 60);
}

describe("probe controls", () => {
  it("turns left under A and drives the shown axis under W", () => {
    setTestKeys(null);
    loadLevel(0);
    sim.mode = "play";
    const yaw = sim.yaw;
    setTestKeys(["KeyA"]);
    frames(20);
    assert.ok(sim.yaw > yaw + 0.05);
    setTestKeys(["KeyW"]);
    const x = sim.pos[0];
    frames(45);
    assert.ok(sim.pos[0] > x + 0.3);
    assert.equal(sim.pos[1], 0);
    setTestKeys(null);
  });

  it("does not move when the display changes", () => {
    setTestKeys(null);
    loadLevel(0);
    sim.mode = "play";
    const before = sim.pos.slice();
    toggleDisplay(1);
    assert.deepEqual(sim.pos, before);
    assert.deepEqual(sim.order, [0, 1]);
  });

  it("level 4 stays put until W is owned, then the plane gate finishes", () => {
    setTestKeys(null);
    loadLevel(3);
    sim.mode = "play";
    frames(8);
    assert.equal(sim.mode, "play");
    assert.ok(Math.abs(sim.pos[0]) < 0.2);
    assert.equal(sim.pos[3], 0);
    toggleOwned(3);
    assert.equal(sim.mode, "win");
    assert.ok(Math.abs(sim.pos[0] - 4) < 1e-6);
    assert.ok(Math.abs(sim.pos[3] - 3) < 1e-6);
  });
});
