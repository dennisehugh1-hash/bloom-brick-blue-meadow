import { i as __toESM } from "../_runtime.mjs";
import { a as Color, c as MeshStandardMaterial, d as SRGBColorSpace, f as Texture, g as require_react, h as require_jsx_runtime, i as CanvasTexture, l as Object3D, n as useFrame, o as InstancedMesh, p as Vector3, r as BoxGeometry, s as MeshBasicMaterial, t as Canvas, u as RepeatWrapping } from "../_libs/@react-three/fiber+[...].mjs";
import { a as Aperture, i as Pause, n as RotateCcw, r as Play } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BWXIqI95.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CELL = (x, z) => (x + 32) * 128 + (z + 32);
function build(spec) {
	const { wCount, vCount } = spec;
	const n = wCount * vCount;
	const sets = Array.from({ length: n }, () => /* @__PURE__ */ new Set());
	const lists = Array.from({ length: n }, () => []);
	const at = (w, v) => w * vCount + v;
	const add = (x, z, w, v) => {
		if (w < 0 || v < 0 || w >= wCount || v >= vCount) return;
		if (x < spec.bounds.minX || x > spec.bounds.maxX) return;
		if (z < spec.bounds.minZ || z > spec.bounds.maxZ) return;
		const h = CELL(x, z);
		const s = sets[at(w, v)];
		if (s.has(h)) return;
		s.add(h);
		lists[at(w, v)].push({
			x,
			z,
			stable: false
		});
	};
	spec.paint(add);
	for (let w = 0; w < wCount; w++) for (let v = 0; v < vCount; v++) for (const wall of lists[at(w, v)]) {
		const h = CELL(wall.x, wall.z);
		let adj = 0;
		let has = 0;
		const look = (ww, vv) => {
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
	const ghosts = (axis) => {
		const out = Array.from({ length: n }, () => []);
		for (let w = 0; w < wCount; w++) for (let v = 0; v < vCount; v++) {
			const dest = out[at(w, v)];
			const seen = /* @__PURE__ */ new Set();
			const neighbors = axis === "w" ? [[w - 1, v], [w + 1, v]] : [[w, v - 1], [w, v + 1]];
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
		ghostsV: ghosts("v")
	};
}
var FACE = Math.PI;
var levels = [
	build({
		id: "first-axis",
		name: "初轴",
		kicker: "W AXIS",
		brief: "正前方那堵墙只存在于 W = 0。拨到另一层，它就从截面里消失。出口要在 W = 1 才亮。",
		hud: "墙只在 W=0。出口在 W=1。",
		wCount: 2,
		vCount: 1,
		bounds: {
			minX: -5,
			maxX: 5,
			minZ: -6,
			maxZ: 6
		},
		start: {
			x: 0,
			z: -5,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 1,
			v: 0
		},
		paint: (add) => {
			for (let x = -5; x <= 5; x++) add(x, 0, 0, 0);
		}
	}),
	build({
		id: "offset-seam",
		name: "错缝",
		kicker: "V SEAM",
		brief: "同一道闸在两条折叠层上错开一格。拨 V，中间那条缝才会出现。出口在 V = 1。",
		hud: "缝只在 V=1。出口也在这一层。",
		wCount: 1,
		vCount: 2,
		bounds: {
			minX: -5,
			maxX: 5,
			minZ: -6,
			maxZ: 6
		},
		start: {
			x: 0,
			z: -5,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 0,
			v: 1
		},
		paint: (add) => {
			for (let x = -5; x <= 5; x++) add(x, 0, 0, 0);
			for (let x = -5; x <= 5; x++) if (x !== 0) add(x, 0, 0, 1);
			add(-3, -3, 0, 0);
			add(3, -3, 0, 0);
			add(-3, -3, 0, 1);
			add(3, -3, 0, 1);
		}
	}),
	build({
		id: "interlock",
		name: "联锁",
		kicker: "TWO AXES",
		brief: "南门跟着显形轴 W，北门跟着折叠轴 V。两道都打开、并且停在那一层，出口光圈才算真正显形。",
		hud: "南门看 W，北门看 V。出口要 W=1 且 V=1。",
		wCount: 2,
		vCount: 2,
		bounds: {
			minX: -5,
			maxX: 5,
			minZ: -6,
			maxZ: 6
		},
		start: {
			x: 0,
			z: -5,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 1,
			v: 1
		},
		paint: (add) => {
			for (let v = 0; v < 2; v++) for (let x = -5; x <= 5; x++) add(x, -1, 0, v);
			for (let w = 0; w < 2; w++) for (let x = -5; x <= 5; x++) add(x, 2, w, 0);
		}
	}),
	build({
		id: "gallery",
		name: "侧廊",
		kicker: "GHOSTS",
		brief: "正中是每一层都在的实墙。西廊只在 W = 2 挖通；W = 1 只有一个死凹。线框是邻层的预告，不是现在能撞上的东西。",
		hud: "西廊在 W=2。铜线框是邻层。",
		wCount: 3,
		vCount: 1,
		bounds: {
			minX: -6,
			maxX: 6,
			minZ: -6,
			maxZ: 6
		},
		start: {
			x: 0,
			z: -5,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 2,
			v: 0
		},
		paint: (add) => {
			for (let w = 0; w < 3; w++) for (let x = -1; x <= 6; x++) add(x, 0, w, 0);
			for (let x = -6; x <= -2; x++) add(x, 0, 0, 0);
			for (let x = -5; x <= -2; x++) add(x, 0, 1, 0);
			add(-6, 1, 1, 0);
			add(4, -3, 0, 0);
			add(4, -3, 1, 0);
			add(4, -3, 2, 0);
		}
	}),
	build({
		id: "coupled",
		name: "耦合",
		kicker: "GEARED",
		brief: "两道闸咬合：你刚穿过的南缝，换层之后会关上。先从西缝过去，再把 W 和 V 都拨到 1，北闸中间才打开。",
		hud: "南缝会在换层后关闭。出口要 W=1 且 V=1。",
		wCount: 2,
		vCount: 2,
		bounds: {
			minX: -5,
			maxX: 5,
			minZ: -6,
			maxZ: 6
		},
		start: {
			x: 0,
			z: -5,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 1,
			v: 1
		},
		paint: (add) => {
			for (let w = 0; w < 2; w++) for (let v = 0; v < 2; v++) for (let x = -5; x <= 5; x++) {
				if (x !== (w === 0 ? -2 : 1)) add(x, 0, w, v);
				if (!(w === 1 && v === 1 && x === 0)) add(x, 3, w, v);
			}
		}
	}),
	build({
		id: "core",
		name: "芯室",
		kicker: "FIVE",
		brief: "三道闸各认一组坐标：先 W1 V0，再 W1 V1，最后 W2 V2。门洞在别的层是实心的——别站在门里换层。",
		hud: "三闸：W1V0 → W1V1 → W2V2。别在门洞里换层。",
		wCount: 3,
		vCount: 3,
		bounds: {
			minX: -6,
			maxX: 6,
			minZ: -7,
			maxZ: 7
		},
		start: {
			x: 0,
			z: -6,
			w: 0,
			v: 0,
			yaw: FACE
		},
		goal: {
			x: 0,
			z: 5,
			w: 2,
			v: 2
		},
		paint: (add) => {
			for (let w = 0; w < 3; w++) for (let v = 0; v < 3; v++) {
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
	})
];
function phaseIndex(level, w, v) {
	return w * level.vCount + v;
}
var PALETTE = {
	bg: "#121614",
	paper: "#e7e2d6",
	brass: "#c6a36a",
	brassDim: "#6e6758",
	signal: "#e25b3a",
	wall: "#3f4943",
	floor: "#1a211c",
	grid: "#2a332c",
	rail: "#8d7344"
};
var ctx = null;
var motor = null;
var motorGain = null;
function context() {
	if (typeof window === "undefined") return null;
	if (!ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
	}
	return ctx;
}
function unlockAudio() {
	const ac = context();
	if (!ac) return;
	if (ac.state === "suspended") ac.resume();
	if (!motor) {
		motor = ac.createOscillator();
		motor.type = "triangle";
		motor.frequency.value = 58;
		const filter = ac.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 220;
		motorGain = ac.createGain();
		motorGain.gain.value = 0;
		motor.connect(filter);
		filter.connect(motorGain);
		motorGain.connect(ac.destination);
		motor.start();
	}
}
function resumeAudio() {
	if (ctx && ctx.state === "suspended") ctx.resume();
}
function setMotor(speed) {
	if (!ctx || !motor || !motorGain) return;
	const amount = Math.min(.04, Math.abs(speed) / 4.8 * .04);
	motorGain.gain.setTargetAtTime(amount, ctx.currentTime, .06);
	motor.frequency.setTargetAtTime(54 + Math.abs(speed) * 7, ctx.currentTime, .08);
}
function blip(freq, dur, type, gain, delay = 0) {
	const ac = ctx;
	if (!ac) return;
	const t = ac.currentTime + delay;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(gain, t);
	g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	osc.connect(g);
	g.connect(ac.destination);
	osc.start(t);
	osc.stop(t + dur + .02);
}
function playShift() {
	blip(480, .09, "square", .03);
	blip(720, .12, "triangle", .025, .04);
}
function playDeny() {
	blip(96, .14, "sine", .05);
}
function playWin() {
	blip(523, .16, "triangle", .04, 0);
	blip(659, .18, "triangle", .04, .08);
	blip(784, .28, "triangle", .045, .16);
}
var STEP_TURN = 2.75;
var MAX_SPEED = 4.8;
var PLAYER_R = .28;
var sim = {
	mode: "menu",
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
	winSaved: false
};
var held = /* @__PURE__ */ new Set();
var keyOverride = null;
var steerOverride = null;
var shiftQueue = [];
var listeners = /* @__PURE__ */ new Set();
var view = emptyView();
var viewKey = "";
function emptyView() {
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
		total: levels.length
	};
}
function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
function getView() {
	return view;
}
function publish() {
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
		sim.best.toFixed(2)
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
		total: levels.length
	};
	for (const fn of listeners) fn();
}
var SAVE_KEY = "appearance-5d-v1";
function readSave() {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return {
			unlocked: 0,
			best: {}
		};
		const parsed = JSON.parse(raw);
		return {
			unlocked: typeof parsed.unlocked === "number" ? parsed.unlocked : 0,
			best: parsed.best && typeof parsed.best === "object" ? parsed.best : {}
		};
	} catch {
		return {
			unlocked: 0,
			best: {}
		};
	}
}
function writeSave(save) {
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify({
			version: 1,
			...save
		}));
	} catch {}
}
function bootSave() {
	sim.unlocked = Math.max(0, Math.min(levels.length - 1, readSave().unlocked));
	publish();
}
function loadLevel(index) {
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
function say(text) {
	if (sim.note === text) return;
	sim.note = text;
	if (text && text !== "出口在另一层才显形") sim.noteLeft = 1.7;
	publish();
}
function requestShift(axis, dir) {
	if (sim.mode !== "play") return;
	if (shiftQueue.length >= 2) return;
	shiftQueue.push({
		axis,
		dir
	});
}
function circleHits(x, z, level, w, v) {
	const b = level.bounds;
	if (x < b.minX - .5 + PLAYER_R || x > b.maxX + .5 - PLAYER_R) return true;
	if (z < b.minZ - .5 + PLAYER_R || z > b.maxZ + .5 - PLAYER_R) return true;
	const list = level.lists[phaseIndex(level, w, v)];
	const r2 = PLAYER_R * PLAYER_R;
	for (let i = 0; i < list.length; i++) {
		const wall = list[i];
		const cx = clamp(x, wall.x - .5, wall.x + .5);
		const cz = clamp(z, wall.z - .5, wall.z + .5);
		const dx = x - cx;
		const dz = z - cz;
		if (dx * dx + dz * dz < r2) return true;
	}
	return false;
}
function applyShift(axis, dir) {
	const level = levels[sim.levelIndex];
	const nw = axis === "w" ? sim.w + dir : sim.w;
	const nv = axis === "v" ? sim.v + dir : sim.v;
	if (nw < 0 || nv < 0 || nw >= level.wCount || nv >= level.vCount) {
		sim.shake = .2;
		sim.flash = .35;
		playDeny();
		say(axis === "w" ? "显形轴已到尽头" : "折叠轴已到尽头");
		return;
	}
	if (circleHits(sim.x, sim.z, level, nw, nv)) {
		sim.shake = .28;
		sim.flash = .45;
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
function pressed(code) {
	return (keyOverride ?? held).has(code);
}
function commitWin() {
	if (sim.winSaved) return;
	sim.winSaved = true;
	const save = readSave();
	const level = levels[sim.levelIndex];
	const prev = save.best[level.id];
	if (prev === void 0 || sim.time < prev) save.best[level.id] = sim.time;
	save.unlocked = Math.max(save.unlocked, Math.min(levels.length - 1, sim.levelIndex + 1));
	writeSave(save);
	sim.unlocked = save.unlocked;
	sim.best = save.best[level.id] ?? sim.time;
	playWin();
	publish();
}
function step(dt) {
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
		sim.shiftCd = .18;
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
	const target = throttle > 0 ? throttle * MAX_SPEED : throttle * MAX_SPEED * .55;
	const rate = throttle === 0 ? 12 : 16;
	if (sim.speed < target) sim.speed = Math.min(target, sim.speed + rate * dt);
	else sim.speed = Math.max(target, sim.speed - rate * dt);
	const reverse = sim.speed >= 0 ? 1 : -1;
	const speedFactor = Math.max(.7, Math.min(1, Math.abs(sim.speed) / 3));
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
	if (Math.hypot(sim.x - ox, sim.z - oz) < Math.abs(sim.speed) * dt * .2) sim.speed *= .45;
	const g = level.goal;
	const dx = sim.x - g.x;
	const dz = sim.z - g.z;
	const near = dx * dx + dz * dz < 1.35 * 1.35;
	const phaseOk = sim.w === g.w && sim.v === g.v;
	if (phaseOk && dx * dx + dz * dz < .5184) {
		sim.mode = "win";
		sim.speed = 0;
		commitWin();
		return;
	}
	if (near && !phaseOk) say("出口在另一层才显形");
	else if (sim.note === "出口在另一层才显形") say("");
	publish();
}
function bindKeys() {
	const onDown = (event) => {
		held.add(event.code);
		if (sim.mode === "play") {
			if ([
				"KeyW",
				"KeyA",
				"KeyS",
				"KeyD",
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Space"
			].includes(event.code)) event.preventDefault();
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
	const onUp = (event) => {
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
		}
	};
	return () => {
		window.removeEventListener("keydown", onDown);
		window.removeEventListener("keyup", onUp);
		window.removeEventListener("blur", onBlur);
		document.removeEventListener("visibilitychange", onHide);
		delete window.__controlsTest;
	};
}
function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n));
}
loadLevel(0);
var WALL_MAX = 700;
var GHOST_MAX = 500;
function makeGridTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	const g = canvas.getContext("2d");
	if (!g) return new Texture();
	g.fillStyle = PALETTE.floor;
	g.fillRect(0, 0, 128, 128);
	g.strokeStyle = PALETTE.grid;
	g.lineWidth = 4;
	g.strokeRect(2, 2, 124, 124);
	g.strokeStyle = PALETTE.brass;
	g.globalAlpha = .45;
	g.beginPath();
	g.moveTo(64, 8);
	g.lineTo(64, 120);
	g.moveTo(8, 64);
	g.lineTo(120, 64);
	g.stroke();
	const tex = new CanvasTexture(canvas);
	tex.wrapS = RepeatWrapping;
	tex.wrapT = RepeatWrapping;
	tex.colorSpace = SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}
function Stage() {
	const walls = (0, import_react.useMemo)(() => {
		const geo = new BoxGeometry(.9, 1.12, .9);
		const mat = new MeshStandardMaterial({
			color: PALETTE.wall,
			metalness: .48,
			roughness: .46
		});
		const mesh = new InstancedMesh(geo, mat, WALL_MAX);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.frustumCulled = false;
		mesh.count = 0;
		return mesh;
	}, []);
	const caps = (0, import_react.useMemo)(() => {
		const geo = new BoxGeometry(.9, .07, .9);
		const mat = new MeshStandardMaterial({
			color: "#ffffff",
			metalness: .62,
			roughness: .34
		});
		const mesh = new InstancedMesh(geo, mat, WALL_MAX);
		mesh.castShadow = true;
		mesh.frustumCulled = false;
		mesh.count = 0;
		return mesh;
	}, []);
	const ghostW = (0, import_react.useMemo)(() => makeGhost(PALETTE.brass), []);
	const ghostV = (0, import_react.useMemo)(() => makeGhost(PALETTE.signal), []);
	const floorTex = (0, import_react.useMemo)(() => makeGridTexture(), []);
	const floor = (0, import_react.useRef)(null);
	const skirt = (0, import_react.useRef)(null);
	const railS = (0, import_react.useRef)(null);
	const railN = (0, import_react.useRef)(null);
	const railE = (0, import_react.useRef)(null);
	const railW = (0, import_react.useRef)(null);
	const probe = (0, import_react.useRef)(null);
	const ringW = (0, import_react.useRef)(null);
	const ringV = (0, import_react.useRef)(null);
	const lens = (0, import_react.useRef)(null);
	const goal = (0, import_react.useRef)(null);
	const iris = (0, import_react.useRef)(null);
	const goalMat = (0, import_react.useRef)(null);
	const beamMat = (0, import_react.useRef)(null);
	const pad = (0, import_react.useRef)(null);
	const light = (0, import_react.useRef)(null);
	const goalLight = (0, import_react.useRef)(null);
	const token = (0, import_react.useRef)("");
	const dummy = (0, import_react.useMemo)(() => new Object3D(), []);
	const desired = (0, import_react.useMemo)(() => new Vector3(), []);
	const look = (0, import_react.useMemo)(() => new Vector3(), []);
	const capColor = (0, import_react.useMemo)(() => new Color(), []);
	const reduce = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
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
		const dt = Math.min(delta, .1);
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
		const pulse = .65 + Math.sin(state.clock.elapsedTime * 3) * .35;
		if (goal.current) goal.current.position.set(level.goal.x, 0, level.goal.z);
		if (iris.current) iris.current.rotation.z = state.clock.elapsedTime * (open ? .9 : .12);
		if (goalMat.current) goalMat.current.emissiveIntensity = open ? .45 + pulse : .06;
		if (beamMat.current) beamMat.current.opacity = open ? .16 + pulse * .18 : .03;
		if (goalLight.current) {
			goalLight.current.position.set(level.goal.x, 1.4, level.goal.z);
			goalLight.current.intensity = open ? 6 * pulse : .4;
		}
		if (pad.current) pad.current.position.set(level.start.x, .02, level.start.z);
		if (probe.current) {
			const bob = Math.abs(Math.sin(state.clock.elapsedTime * 14)) * Math.min(.04, Math.abs(sim.speed) * .008);
			probe.current.position.set(sim.x, bob, sim.z);
			probe.current.rotation.y = sim.yaw;
		}
		if (ringW.current) ringW.current.rotation.z = state.clock.elapsedTime * .8 + sim.w * 1.35;
		if (ringV.current) {
			ringV.current.rotation.y = Math.PI / 2;
			ringV.current.rotation.x = state.clock.elapsedTime * .5 + sim.v * 1.35;
		}
		if (lens.current) lens.current.emissiveIntensity = .35 + Math.min(1.4, Math.abs(sim.speed) * .22);
		const cam = state.camera;
		if (sim.mode === "menu") {
			const ang = reduce.current ? .7 : state.clock.elapsedTime * .16;
			desired.set(Math.sin(ang) * 12.5, 8.2, Math.cos(ang) * 10.5);
			look.set(0, .25, 0);
			cam.position.lerp(desired, 1 - Math.exp(-1.5 * dt));
		} else {
			const fx = -Math.sin(sim.yaw);
			const fz = -Math.cos(sim.yaw);
			const kick = sim.shake;
			desired.set(sim.x - fx * 9.2 + Math.sin(state.clock.elapsedTime * 46) * kick * .4, 6.5, sim.z - fz * 9.2 + Math.cos(state.clock.elapsedTime * 40) * kick * .4);
			look.set(sim.x + fx * 1.6, .5, sim.z + fz * 1.6);
			cam.position.lerp(desired, 1 - Math.exp(-3.6 * dt));
		}
		cam.lookAt(look);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", { object: walls }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", { object: caps }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", { object: ghostW }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", { object: ghostV }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			ref: skirt,
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				0,
				-.04,
				0
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [1, 1] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: PALETTE.bg })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			ref: floor,
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				0,
				0,
				0
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [1, 1] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				map: floorTex,
				roughness: .92,
				metalness: .06
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rail, { meshRef: railN }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rail, { meshRef: railS }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rail, { meshRef: railE }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rail, { meshRef: railW }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			ref: pad,
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				.34,
				.48,
				32
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: PALETTE.brass,
				emissive: PALETTE.brass,
				emissiveIntensity: .15
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			ref: goal,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					rotation: [
						-Math.PI / 2,
						0,
						0
					],
					position: [
						0,
						.03,
						0
					],
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
						.42,
						.62,
						40
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						ref: goalMat,
						color: PALETTE.signal,
						emissive: PALETTE.signal,
						emissiveIntensity: .2,
						roughness: .4,
						metalness: .3
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					ref: iris,
					position: [
						0,
						.72,
						0
					],
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("torusGeometry", { args: [
						.5,
						.03,
						10,
						36
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						color: PALETTE.signal,
						emissive: PALETTE.signal,
						emissiveIntensity: .7
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					position: [
						0,
						1.15,
						0
					],
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
						.05,
						.2,
						2.1,
						16,
						1,
						true
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
						ref: beamMat,
						color: PALETTE.signal,
						transparent: true,
						opacity: .1,
						depthWrite: false
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			ref: goalLight,
			color: PALETTE.signal,
			distance: 8,
			decay: 2,
			intensity: .4
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			ref: probe,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					rotation: [
						Math.PI / 2,
						0,
						0
					],
					castShadow: true,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
						.2,
						.26,
						.64,
						18
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						color: PALETTE.brass,
						metalness: .74,
						roughness: .28
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					position: [
						0,
						.04,
						-.4
					],
					castShadow: true,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
						.09,
						16,
						12
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						ref: lens,
						color: PALETTE.signal,
						emissive: PALETTE.signal,
						emissiveIntensity: .6,
						roughness: .32
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					ref: ringW,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("torusGeometry", { args: [
						.4,
						.018,
						8,
						28
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						color: PALETTE.brass,
						metalness: .8,
						roughness: .22
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					ref: ringV,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("torusGeometry", { args: [
						.5,
						.016,
						8,
						28
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						color: PALETTE.paper,
						metalness: .45,
						roughness: .35
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			ref: light,
			position: [
				7,
				14,
				5
			],
			intensity: 2.5,
			castShadow: true,
			color: PALETTE.paper
		})
	] });
}
function Rail({ meshRef }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		ref: meshRef,
		castShadow: true,
		receiveShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
			1,
			.14,
			.12
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
			color: PALETTE.rail,
			metalness: .7,
			roughness: .35
		})]
	});
}
function makeGhost(color) {
	const geo = new BoxGeometry(.98, 1.22, .98);
	const mat = new MeshBasicMaterial({
		color,
		wireframe: true,
		transparent: true,
		opacity: .38,
		depthWrite: false
	});
	const mesh = new InstancedMesh(geo, mat, GHOST_MAX);
	mesh.frustumCulled = false;
	mesh.count = 0;
	return mesh;
}
function paintSolid(walls, caps, list, dummy, color) {
	const n = Math.min(list.length, WALL_MAX);
	for (let i = 0; i < n; i++) {
		const wall = list[i];
		dummy.position.set(wall.x, .56, wall.z);
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
function paintGhost(mesh, list, dummy) {
	const n = Math.min(list.length, GHOST_MAX);
	for (let i = 0; i < n; i++) {
		dummy.position.set(list[i].x, .61, list[i].z);
		dummy.scale.set(1, 1, 1);
		dummy.rotation.set(0, 0, 0);
		dummy.updateMatrix();
		mesh.setMatrixAt(i, dummy.matrix);
	}
	mesh.count = n;
	mesh.instanceMatrix.needsUpdate = true;
}
function layoutFloor(bounds, floor, skirt, tex, railN, railS, railE, railW) {
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
		skirt.position.set(cx, -.05, cz);
		skirt.scale.set(width + 14, depth + 14, 1);
	}
	const y = .07;
	if (railN) {
		railN.scale.set(width + .12, 1, 1);
		railN.position.set(cx, y, bounds.maxZ + .5);
	}
	if (railS) {
		railS.scale.set(width + .12, 1, 1);
		railS.position.set(cx, y, bounds.minZ - .5);
	}
	if (railE) {
		railE.scale.set(depth + .12, 1, 1);
		railE.rotation.y = Math.PI / 2;
		railE.position.set(bounds.maxX + .5, y, cz);
	}
	if (railW) {
		railW.scale.set(depth + .12, 1, 1);
		railW.rotation.y = Math.PI / 2;
		railW.position.set(bounds.minX - .5, y, cz);
	}
}
function SceneHost() {
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setOn(true), []);
	if (!on) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-bg" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Canvas, {
		className: "absolute inset-0",
		shadows: true,
		dpr: [1, 1.5],
		camera: {
			position: [
				0,
				8,
				12
			],
			fov: 42,
			near: .1,
			far: 90
		},
		gl: {
			antialias: true,
			alpha: false,
			powerPreference: "high-performance"
		},
		onCreated: ({ gl }) => {
			gl.setClearColor(PALETTE.bg);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("color", {
				attach: "background",
				args: [PALETTE.bg]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("fog", {
				attach: "fog",
				args: [
					PALETTE.bg,
					16,
					42
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hemisphereLight", { args: [
				PALETTE.paper,
				PALETTE.bg,
				.48
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", { intensity: .12 }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {})
		]
	});
}
function Appearance() {
	const flashRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const unbind = bindKeys();
		bootSave();
		let raf = 0;
		let last = performance.now();
		let acc = 0;
		let alive = true;
		const tick = (now) => {
			if (!alive) return;
			const dt = Math.min(.1, (now - last) / 1e3);
			last = now;
			acc += dt;
			let n = 0;
			while (acc >= 1 / 60 && n < 6) {
				step(1 / 60);
				acc -= 1 / 60;
				n++;
			}
			setMotor(sim.mode === "play" ? sim.speed : 0);
			const el = flashRef.current;
			if (el) el.style.opacity = String(Math.min(.5, sim.flash * .42));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		const onVis = () => resumeAudio();
		document.addEventListener("visibilitychange", onVis);
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			unbind();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "game-root relative h-dvh w-full overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneHost, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "vignette pointer-events-none absolute inset-0" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: flashRef,
				className: "shutter pointer-events-none absolute inset-0 opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {})
		]
	});
}
function Hud() {
	const view = (0, import_react.useSyncExternalStore)(subscribe, getView, getView);
	const touch = useTouchDock();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		view.mode === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto w-full max-w-3xl rounded-2xl border border-line bg-surface/90 px-4 py-3 backdrop-blur-md",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg leading-none tracking-wide text-brass",
								children: "APPEARANCE"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 truncate text-sm",
								children: [
									String(view.level + 1).padStart(2, "0"),
									" ",
									view.name,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-muted",
										children: [" · ", view.kicker]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted tabular-nums",
								children: [
									formatTime(view.time),
									" · 距出口 ",
									Math.max(0, Math.round(view.dist))
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-display text-xl leading-none tabular-nums",
									children: [
										"W ",
										view.w,
										view.wCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted",
											children: ["/", view.wCount - 1]
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 font-display text-xl leading-none tabular-nums",
									children: [
										"V ",
										view.v,
										view.vCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted",
											children: ["/", view.vCount - 1]
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: view.phaseOk ? "mt-1 text-xs text-signal" : "mt-1 text-xs text-muted",
									children: view.phaseOk ? "出口已显形" : "出口未显形"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, {
								label: "暂停",
								onClick: () => setMode("paused"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, {
								label: "重置本层",
								onClick: () => restart(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
							})]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: view.note ? "mt-2 text-sm text-signal" : "mt-2 text-sm text-muted",
					children: view.note || view.hud
				})]
			})
		}) : null,
		view.mode === "play" && !touch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted",
			children: "W 前进 · S 倒车 · A 左转 · D 右转 · Q/E 显形轴 · Z/C 折叠轴"
		}) : null,
		view.mode === "play" && touch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchDock, {}) : null,
		view.mode === "menu" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 z-20 flex items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "w-full max-w-md rounded-2xl border border-line bg-surface/90 p-6 backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 text-brass",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Aperture, {
							className: "size-8",
							strokeWidth: 1.5
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl leading-none tracking-wide",
							children: "APPEARANCE"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 text-lg",
						children: "五维显形"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: "相位探针在五维腔体的三维截面里行驶。墙不是被搬走了，只是这一层看不见。把探针开到出口光圈亮起的坐标。"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "W / S"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "前进 / 倒车" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "A / D"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "左转 / 右转" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "Q / E"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "显形轴 W" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "Z / C"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: "折叠轴 V" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs leading-relaxed text-muted",
						children: "亮铜冠的墙换一层就会消失，暗铜冠在邻层也在。铜线框是 W 的邻层，赤线框是 V 的邻层。"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 flex flex-wrap gap-2",
						children: levels.map((level, index) => {
							const open = index <= view.unlocked;
							const active = index === view.level;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: !open,
								onClick: () => previewLevel(index),
								className: active ? "flex h-11 min-w-11 items-center justify-center rounded-full border border-brass bg-brass px-3 text-sm text-bg" : "flex h-11 min-w-11 items-center justify-center rounded-full border border-line px-3 text-sm text-fg disabled:opacity-40",
								children: [
									index + 1,
									" ",
									open ? level.name : ""
								]
							}, level.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: begin,
						className: "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brass text-bg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), "开始 Start"]
					})
				]
			})
		}) : null,
		view.mode === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 z-20 flex items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "w-full max-w-sm rounded-2xl border border-line bg-surface/95 p-6 text-center backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-2xl text-brass",
						children: "探针悬停"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: view.hud
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode("play"),
								className: "h-12 rounded-full bg-brass text-bg",
								children: "继续"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: restart,
								className: "h-12 rounded-full border border-line",
								children: "重置本层"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: toMenu,
								className: "h-12 rounded-full border border-line",
								children: "返回仪器台"
							})
						]
					})
				]
			})
		}) : null,
		view.mode === "win" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 z-20 flex items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "w-full max-w-sm rounded-2xl border border-line bg-surface/95 p-6 text-center backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-widest text-signal",
						children: "SECTION LOCKED"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-2 font-display text-3xl text-brass",
						children: "显形完成"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							view.name,
							" · ",
							formatTime(view.time),
							view.best > 0 ? ` · 最佳 ${formatTime(view.best)}` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-col gap-2",
						children: [view.level < view.total - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: nextLevel,
							className: "h-12 rounded-full bg-brass text-bg",
							children: "下一层"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: toMenu,
							className: "h-12 rounded-full bg-brass text-bg",
							children: "腔室已走通"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: restart,
							className: "h-12 rounded-full border border-line",
							children: "再走一次"
						})]
					})
				]
			})
		}) : null
	] });
}
function TouchDock() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "safe-b absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stick, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShiftButton, {
					label: "显−",
					name: "显形轴减",
					onPress: () => requestShift("w", -1)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShiftButton, {
					label: "显+",
					name: "显形轴加",
					onPress: () => requestShift("w", 1)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShiftButton, {
					label: "折−",
					name: "折叠轴减",
					onPress: () => requestShift("v", -1)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShiftButton, {
					label: "折+",
					name: "折叠轴加",
					onPress: () => requestShift("v", 1)
				})
			]
		})]
	});
}
function Stick() {
	const knob = (0, import_react.useRef)(null);
	const active = (0, import_react.useRef)(null);
	function place(clientX, clientY, el) {
		const rect = el.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = (clientX - cx) / (rect.width / 2);
		let dy = (clientY - cy) / (rect.height / 2);
		const mag = Math.hypot(dx, dy);
		if (mag > 1) {
			dx /= mag;
			dy /= mag;
		}
		sim.touchSteer = -dx;
		sim.touchThrottle = -dy;
		if (knob.current) knob.current.style.transform = `translate(${dx * 32}px, ${dy * 32}px)`;
	}
	function release() {
		active.current = null;
		sim.touchSteer = 0;
		sim.touchThrottle = 0;
		if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative mb-4 size-32 rounded-full border border-brass/50 bg-surface/80",
		onPointerDown: (event) => {
			unlockAudio();
			active.current = event.pointerId;
			event.currentTarget.setPointerCapture(event.pointerId);
			place(event.clientX, event.clientY, event.currentTarget);
		},
		onPointerMove: (event) => {
			if (active.current !== event.pointerId) return;
			place(event.clientX, event.clientY, event.currentTarget);
		},
		onPointerUp: release,
		onPointerCancel: release,
		role: "application",
		"aria-label": "推进与转向",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: knob,
			className: "absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass"
		})
	});
}
function ShiftButton({ label, name, onPress }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": name,
		className: "mb-0 flex size-14 items-center justify-center rounded-full border border-line bg-surface text-sm",
		onPointerDown: (event) => {
			event.preventDefault();
			unlockAudio();
			onPress();
		},
		children: label
	});
}
function IconButton({ label, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": label,
		onClick: () => {
			unlockAudio();
			onClick();
		},
		className: "flex size-11 items-center justify-center rounded-full border border-line bg-bg text-fg",
		children
	});
}
function useTouchDock() {
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const query = window.matchMedia("(max-width: 900px), (pointer: coarse)");
		const sync = () => setOn(query.matches);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);
	return on;
}
function begin() {
	unlockAudio();
	loadLevel(sim.levelIndex);
	sim.mode = "play";
	publish();
}
function restart() {
	unlockAudio();
	loadLevel(sim.levelIndex);
	sim.mode = "play";
	publish();
}
function nextLevel() {
	unlockAudio();
	loadLevel(Math.min(levels.length - 1, sim.levelIndex + 1));
	sim.mode = "play";
	publish();
}
function previewLevel(index) {
	loadLevel(index);
	sim.mode = "menu";
	publish();
}
function toMenu() {
	loadLevel(sim.levelIndex);
	sim.mode = "menu";
	publish();
}
function setMode(mode) {
	sim.mode = mode;
	publish();
}
function formatTime(time) {
	const safe = Math.max(0, time);
	const secs = Math.floor(safe);
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	const tenth = Math.floor((safe - secs) * 10);
	return `${m}:${s.toString().padStart(2, "0")}.${tenth}`;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Appearance, {});
}
//#endregion
export { Home as component };
