let ctx: AudioContext | null = null;
let motor: OscillatorNode | null = null;
let motorGain: GainNode | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
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

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setMotor(speed: number) {
  if (!ctx || !motor || !motorGain) return;
  const amount = Math.min(0.04, (Math.abs(speed) / 4.8) * 0.04);
  motorGain.gain.setTargetAtTime(amount, ctx.currentTime, 0.06);
  motor.frequency.setTargetAtTime(54 + Math.abs(speed) * 7, ctx.currentTime, 0.08);
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const ac = ctx;
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playShift() {
  blip(480, 0.09, "square", 0.03);
  blip(720, 0.12, "triangle", 0.025, 0.04);
}

export function playDeny() {
  blip(96, 0.14, "sine", 0.05);
}

export function playWin() {
  blip(523, 0.16, "triangle", 0.04, 0);
  blip(659, 0.18, "triangle", 0.04, 0.08);
  blip(784, 0.28, "triangle", 0.045, 0.16);
}
