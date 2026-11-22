import { Aperture, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SceneHost } from "./Scene";
import { resumeAudio, setMotor, unlockAudio } from "./audio";
import { levels } from "./levels.ts";
import { bindKeys, bootSave, getView, loadLevel, publish, setTouchExtra, sim, step, subscribe, toggleDisplay, toggleOwned } from "./sim";
import { AXES } from "./space.ts";

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
  const [right, forward, up] = view.order;

  return (
    <>
      {view.mode === "play" ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-line bg-surface/90 px-3 py-3 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg leading-none tracking-wide text-brass">APPEARANCE</p>
                <p className="mt-1 truncate text-sm">
                  {String(view.level + 1).padStart(2, "0")} {view.name}
                  <span className="text-muted"> · {view.kicker}</span>
                </p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {formatTime(view.time)} · 五维距 {view.dist.toFixed(1)} · 阶 {view.rank}
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
            <div className="mt-2 flex gap-1.5">
              {AXES.map((name, axis) => (
                <AxisChip
                  key={name}
                  axis={axis}
                  name={name}
                  coord={view.coords[axis] ?? 0}
                  shown={view.shown[axis] ?? false}
                  owned={view.owned[axis] ?? false}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              右 {axisName(right)} · 前 {axisName(forward)} · 上 {axisName(up)}
              {view.order.length > 3 ? " · 其余为斜轴" : ""}
            </p>
            <p className={view.note || view.stacked ? "mt-1 text-sm text-signal" : "mt-1 text-sm text-muted"}>
              {view.note || (view.stacked ? "投影已经叠上出口，还有轴没对准。" : view.hud)}
            </p>
          </div>
        </header>
      ) : null}

      {view.mode === "play" && !touch ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 px-4 text-center text-xs text-muted">
          W/S 推进 · A/D 转向 · 1–5 显影 · Shift+1–5 升降阶 · Q/E Z/C R/F 推动后几根轴
        </p>
      ) : null}

      {view.mode === "play" && touch ? <TouchDock extras={view.extras} /> : null}

      {view.mode === "menu" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto p-4">
          <section className="my-auto w-full max-w-md rounded-2xl border border-line bg-surface/92 p-6 backdrop-blur-md">
            <div className="flex items-center gap-3 text-brass">
              <Aperture className="size-8" strokeWidth={1.5} />
              <p className="font-display text-3xl leading-none tracking-wide">APPEARANCE</p>
            </div>
            <h1 className="mt-3 text-lg">五维显形</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              X Y Z W V 五根轴等价。你点哪几根，仪器就按点选的顺序把它们投影出来——这不是切片，没点亮的轴还在，影子会叠在一起。
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              探针的阶是它真正占有的轴。纳入的轴才有厚度，才能被门咬住，也才能沿显影方向推进。一维点门改一个坐标，二维门改两个，三维体改三个。阶不够，门只带走已经纳入的轴；阶太高，得多余的轴自己对准门口。
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
            <p className="mt-3 text-sm text-muted">{levels[view.level]?.brief}</p>
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

function AxisChip({
  axis,
  name,
  coord,
  shown,
  owned,
}: {
  axis: number;
  name: string;
  coord: number;
  shown: boolean;
  owned: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <button
        type="button"
        aria-label={`${name} 显影`}
        aria-pressed={shown}
        onClick={() => {
          unlockAudio();
          toggleDisplay(axis);
        }}
        className={
          shown
            ? "flex h-11 items-center justify-center rounded-full bg-brass text-sm text-bg"
            : "flex h-11 items-center justify-center rounded-full border border-line text-sm"
        }
      >
        <span className="font-display">{name}</span>
        <span className="ml-1 tabular-nums text-xs">{coord.toFixed(1)}</span>
      </button>
      <button
        type="button"
        aria-label={owned ? `释放 ${name}` : `纳入 ${name}`}
        aria-pressed={owned}
        onClick={() => {
          unlockAudio();
          toggleOwned(axis);
        }}
        className={
          owned
            ? "h-8 rounded-full border border-brass text-xs text-brass"
            : "h-8 rounded-full border border-line text-xs text-muted"
        }
      >
        {owned ? "阶" : "纳"}
      </button>
    </div>
  );
}

function TouchDock({ extras }: { extras: string[] }) {
  return (
    <div className="safe-b absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-3">
      <Stick />
      {extras.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {extras.map((name, index) => (
            <span key={name} className="contents">
              <HoldButton label={`${name}+`} name={`${name} 正方向`} onDown={() => setTouchExtra(index, 1)} onUp={() => setTouchExtra(index, 0)} />
              <HoldButton label={`${name}−`} name={`${name} 负方向`} onDown={() => setTouchExtra(index, -1)} onUp={() => setTouchExtra(index, 0)} />
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-6 max-w-40 text-right text-xs text-muted">点轴名显影，点「纳」把它纳入探针</p>
      )}
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
      className="relative mb-4 size-28 rounded-full border border-brass/50 bg-surface/80"
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
      <div ref={knob} className="absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass" />
    </div>
  );
}

function HoldButton({ label, name, onDown, onUp }: { label: string; name: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      aria-label={name}
      className="flex h-12 min-w-14 items-center justify-center rounded-full border border-line bg-surface text-sm"
      onPointerDown={(event) => {
        event.preventDefault();
        unlockAudio();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
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

function axisName(axis: number | undefined) {
  return axis === undefined ? "—" : AXES[axis];
}

function formatTime(time: number) {
  const safe = Math.max(0, time);
  const secs = Math.floor(safe);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const tenth = Math.floor((safe - secs) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${tenth}`;
}
