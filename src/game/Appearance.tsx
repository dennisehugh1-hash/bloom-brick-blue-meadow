import { Aperture, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SceneHost } from "./Scene";
import { resumeAudio, setMotor, unlockAudio } from "./audio";
import { levels } from "./levels";
import { bindKeys, bootSave, getView, loadLevel, publish, requestShift, sim, step, subscribe } from "./sim";

export function Appearance() {
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unbind = bindKeys();
    bootSave();
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
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
      if (el) el.style.opacity = String(Math.min(0.5, sim.flash * 0.42));
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

  return (
    <div className="game-root relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <SceneHost />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div ref={flashRef} className="shutter pointer-events-none absolute inset-0 opacity-0" />
      <Hud />
    </div>
  );
}

function Hud() {
  const view = useSyncExternalStore(subscribe, getView, getView);
  const touch = useTouchDock();

  return (
    <>
      {view.mode === "play" ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-line bg-surface/90 px-4 py-3 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg leading-none tracking-wide text-brass">APPEARANCE</p>
                <p className="mt-1 truncate text-sm">
                  {String(view.level + 1).padStart(2, "0")} {view.name}
                  <span className="text-muted"> · {view.kicker}</span>
                </p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {formatTime(view.time)} · 距出口 {Math.max(0, Math.round(view.dist))}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right">
                  <p className="font-display text-xl leading-none tabular-nums">
                    W {view.w}
                    {view.wCount > 1 ? <span className="text-muted">/{view.wCount - 1}</span> : null}
                  </p>
                  <p className="mt-1 font-display text-xl leading-none tabular-nums">
                    V {view.v}
                    {view.vCount > 1 ? <span className="text-muted">/{view.vCount - 1}</span> : null}
                  </p>
                  <p className={view.phaseOk ? "mt-1 text-xs text-signal" : "mt-1 text-xs text-muted"}>
                    {view.phaseOk ? "出口已显形" : "出口未显形"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <IconButton label="暂停" onClick={() => setMode("paused")}>
                    <Pause className="size-4" />
                  </IconButton>
                  <IconButton label="重置本层" onClick={() => restart()}>
                    <RotateCcw className="size-4" />
                  </IconButton>
                </div>
              </div>
            </div>
            <p className={view.note ? "mt-2 text-sm text-signal" : "mt-2 text-sm text-muted"}>{view.note || view.hud}</p>
          </div>
        </header>
      ) : null}

      {view.mode === "play" && !touch ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted">
          W 前进 · S 倒车 · A 左转 · D 右转 · Q/E 显形轴 · Z/C 折叠轴
        </p>
      ) : null}

      {view.mode === "play" && touch ? <TouchDock /> : null}

      {view.mode === "menu" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <section className="w-full max-w-md rounded-2xl border border-line bg-surface/90 p-6 backdrop-blur-md">
            <div className="flex items-center gap-3 text-brass">
              <Aperture className="size-8" strokeWidth={1.5} />
              <p className="font-display text-3xl leading-none tracking-wide">APPEARANCE</p>
            </div>
            <h1 className="mt-3 text-lg">五维显形</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              相位探针在五维腔体的三维截面里行驶。墙不是被搬走了，只是这一层看不见。把探针开到出口光圈亮起的坐标。
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">W / S</dt>
              <dd>前进 / 倒车</dd>
              <dt className="text-muted">A / D</dt>
              <dd>左转 / 右转</dd>
              <dt className="text-muted">Q / E</dt>
              <dd>显形轴 W</dd>
              <dt className="text-muted">Z / C</dt>
              <dd>折叠轴 V</dd>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              亮铜冠的墙换一层就会消失，暗铜冠在邻层也在。铜线框是 W 的邻层，赤线框是 V 的邻层。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {levels.map((level, index) => {
                const open = index <= view.unlocked;
                const active = index === view.level;
                return (
                  <button
                    key={level.id}
                    type="button"
                    disabled={!open}
                    onClick={() => previewLevel(index)}
                    className={
                      active
                        ? "flex h-11 min-w-11 items-center justify-center rounded-full border border-brass bg-brass px-3 text-sm text-bg"
                        : "flex h-11 min-w-11 items-center justify-center rounded-full border border-line px-3 text-sm text-fg disabled:opacity-40"
                    }
                  >
                    {index + 1} {open ? level.name : ""}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={begin}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brass text-bg"
            >
              <Play className="size-4" />
              开始 Start
            </button>
          </section>
        </div>
      ) : null}

      {view.mode === "paused" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <section className="w-full max-w-sm rounded-2xl border border-line bg-surface/95 p-6 text-center backdrop-blur-md">
            <p className="font-display text-2xl text-brass">探针悬停</p>
            <p className="mt-2 text-sm text-muted">{view.hud}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => setMode("play")} className="h-12 rounded-full bg-brass text-bg">
                继续
              </button>
              <button type="button" onClick={restart} className="h-12 rounded-full border border-line">
                重置本层
              </button>
              <button type="button" onClick={toMenu} className="h-12 rounded-full border border-line">
                返回仪器台
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {view.mode === "win" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <section className="w-full max-w-sm rounded-2xl border border-line bg-surface/95 p-6 text-center backdrop-blur-md">
            <p className="text-xs tracking-widest text-signal">SECTION LOCKED</p>
            <h2 className="mt-2 font-display text-3xl text-brass">显形完成</h2>
            <p className="mt-2 text-sm text-muted">
              {view.name} · {formatTime(view.time)}
              {view.best > 0 ? ` · 最佳 ${formatTime(view.best)}` : ""}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {view.level < view.total - 1 ? (
                <button type="button" onClick={nextLevel} className="h-12 rounded-full bg-brass text-bg">
                  下一层
                </button>
              ) : (
                <button type="button" onClick={toMenu} className="h-12 rounded-full bg-brass text-bg">
                  腔室已走通
                </button>
              )}
              <button type="button" onClick={restart} className="h-12 rounded-full border border-line">
                再走一次
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TouchDock() {
  return (
    <div className="safe-b absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4">
      <Stick />
      <div className="grid grid-cols-2 gap-2">
        <ShiftButton label="显−" name="显形轴减" onPress={() => requestShift("w", -1)} />
        <ShiftButton label="显+" name="显形轴加" onPress={() => requestShift("w", 1)} />
        <ShiftButton label="折−" name="折叠轴减" onPress={() => requestShift("v", -1)} />
        <ShiftButton label="折+" name="折叠轴加" onPress={() => requestShift("v", 1)} />
      </div>
    </div>
  );
}

function Stick() {
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  function place(clientX: number, clientY: number, el: HTMLDivElement) {
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

  return (
    <div
      className="relative mb-4 size-32 rounded-full border border-brass/50 bg-surface/80"
      onPointerDown={(event) => {
        unlockAudio();
        active.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        place(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (active.current !== event.pointerId) return;
        place(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      role="application"
      aria-label="推进与转向"
    >
      <div
        ref={knob}
        className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass"
      />
    </div>
  );
}

function ShiftButton({ label, name, onPress }: { label: string; name: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={name}
      className="mb-0 flex size-14 items-center justify-center rounded-full border border-line bg-surface text-sm"
      onPointerDown={(event) => {
        event.preventDefault();
        unlockAudio();
        onPress();
      }}
    >
      {label}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        unlockAudio();
        onClick();
      }}
      className="flex size-11 items-center justify-center rounded-full border border-line bg-bg text-fg"
    >
      {children}
    </button>
  );
}

function useTouchDock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
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

function previewLevel(index: number) {
  loadLevel(index);
  sim.mode = "menu";
  publish();
}

function toMenu() {
  loadLevel(sim.levelIndex);
  sim.mode = "menu";
  publish();
}

function setMode(mode: "play" | "paused") {
  sim.mode = mode;
  publish();
}

function formatTime(time: number) {
  const safe = Math.max(0, time);
  const secs = Math.floor(safe);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const tenth = Math.floor((safe - secs) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${tenth}`;
}
