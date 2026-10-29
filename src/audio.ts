// ---------- audio (Web Audio, all synthesized) ----------
interface Rig {
  ctx: BaseAudioContext;
  sfx: AudioNode;
  music: AudioNode;
  noise: AudioBuffer;
  live: boolean;
}
interface Track {
  bpm: number;
  roots: number[];
  chords: number[][];
  mel: number[][][];
  bassStyle: number;
  kick: number[];
  snare: number[];
  hatStep: number;
  arpGain: number;
  melGain: number;
}

const MENU_TRACK: Track = {
  bpm: 112,
  roots: [48, 45, 41, 43, 48, 45, 50, 43],
  chords: [[60, 64, 67], [57, 60, 64], [57, 60, 65], [59, 62, 67], [60, 64, 67], [57, 60, 64], [57, 62, 65], [59, 62, 67]],
  mel: [
    [[0, 76, 2], [2, 79, 2], [4, 84, 3], [8, 83, 2], [10, 79, 2], [12, 76, 3]],
    [[0, 76, 2], [2, 81, 2], [4, 84, 3], [8, 81, 2], [10, 76, 2], [12, 72, 3]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 3], [8, 81, 2], [10, 77, 2], [12, 72, 3]],
    [[0, 74, 2], [2, 79, 2], [4, 83, 3], [8, 79, 2], [10, 74, 2], [12, 79, 2], [14, 83, 2]],
    [[0, 79, 2], [2, 76, 2], [4, 79, 2], [6, 84, 2], [8, 86, 2], [10, 84, 2], [12, 79, 4]],
    [[0, 81, 2], [2, 76, 2], [4, 81, 2], [6, 84, 2], [8, 81, 4], [12, 76, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 86, 3], [8, 84, 2], [10, 81, 2], [12, 77, 4]],
    [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 2], [10, 74, 2], [12, 79, 4]],
  ],
  bassStyle: 0,
  kick: [0, 8],
  snare: [],
  hatStep: 2,
  arpGain: 0.05,
  melGain: 0.09,
};
const BATTLE_TRACK: Track = {
  bpm: 148,
  roots: [45, 41, 48, 43, 45, 41, 43, 43],
  chords: [[57, 60, 64], [57, 60, 65], [60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65], [59, 62, 67], [59, 62, 67]],
  mel: [
    [[0, 81, 2], [2, 81, 1], [3, 79, 1], [4, 76, 2], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 81, 4]],
    [[0, 77, 2], [2, 77, 1], [3, 76, 1], [4, 72, 2], [6, 69, 2], [8, 72, 2], [10, 77, 2], [12, 81, 4]],
    [[0, 79, 2], [2, 79, 1], [3, 77, 1], [4, 76, 2], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
    [[0, 83, 2], [2, 81, 1], [3, 79, 1], [4, 74, 2], [6, 79, 2], [8, 83, 2], [10, 81, 2], [12, 79, 4]],
    [[0, 76, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 76, 2], [10, 81, 2], [12, 84, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 77, 2], [10, 81, 2], [12, 77, 4]],
    [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 2], [10, 83, 2], [12, 86, 4]],
    [[0, 74, 2], [2, 79, 2], [4, 83, 2], [6, 79, 2], [8, 74, 4], [12, 79, 2], [14, 83, 2]],
  ],
  bassStyle: 1,
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hatStep: 2,
  arpGain: 0.045,
  melGain: 0.085,
};

interface AudState {
  ctx: AudioContext | null;
  rig: Rig | null;
  master: GainNode | null;
  musicG: GainNode | null;
  sfxG: GainNode | null;
  on: boolean;
  mv: number;
  sv: number;
  voices: number;
  track: string;
  want: string;
  bus: GainNode | null;
  tr: Track | null;
  timer: number;
  nextT: number;
  stepIdx: number;
  stepsRun: number;
  hidden: boolean;
  last: { [k: string]: number };
  log: string[];
  calls: number;
}
const AUD: AudState = {
  ctx: null, rig: null, master: null, musicG: null, sfxG: null,
  on: true, mv: 0.5, sv: 0.8, voices: 0, track: "none", want: "none", bus: null, tr: null,
  timer: 0, nextT: 0, stepIdx: 0, stepsRun: 0, hidden: false, last: {}, log: [], calls: 0,
};
const AUD_KEY = "tank.audio";

function audLoad(): void {
  const raw = lsGet(AUD_KEY);
  if (!raw) return;
  try {
    const o = JSON.parse(raw);
    if (typeof o.on === "boolean") AUD.on = o.on;
    if (typeof o.mv === "number" && o.mv >= 0 && o.mv <= 1) AUD.mv = o.mv;
    if (typeof o.sv === "number" && o.sv >= 0 && o.sv <= 1) AUD.sv = o.sv;
  } catch (e) {
    /* ignore */
  }
}
function audSave(): void {
  lsSet(AUD_KEY, JSON.stringify({ on: AUD.on, mv: AUD.mv, sv: AUD.sv }));
}
function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// --- voice helpers (rig-based so they can render offline in tests) ---
function vStart(rig: Rig, prio: boolean): boolean {
  if (!rig.live) return true;
  if (AUD.voices > 30 && !prio) return false;
  AUD.voices++;
  return true;
}
function vEnd(rig: Rig, node: AudioScheduledSourceNode): void {
  if (!rig.live) return;
  node.onended = () => {
    AUD.voices = Math.max(0, AUD.voices - 1);
  };
}
function env(g: GainNode, t: number, peak: number, att: number, dur: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
// tone with optional frequency sweep
function tn(rig: Rig, dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, prio?: boolean): void {
  if (!vStart(rig, !!prio)) return;
  const o = rig.ctx.createOscillator();
  const g = rig.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, peak, 0.005, dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
  vEnd(rig, o);
}
// filtered noise burst with optional filter sweep
function nz(rig: Rig, dest: AudioNode, ftype: BiquadFilterType, f0: number, f1: number, q: number, t: number, dur: number, peak: number, att?: number, prio?: boolean): void {
  if (!vStart(rig, !!prio)) return;
  const s = rig.ctx.createBufferSource();
  s.buffer = rig.noise;
  const f = rig.ctx.createBiquadFilter();
  f.type = ftype;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = rig.ctx.createGain();
  env(g, t, peak, att || 0.004, dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.03);
  vEnd(rig, s);
}
function jingle(rig: Rig, t: number, notes: number[][], peak: number): void {
  for (const n of notes) {
    tn(rig, rig.sfx, "square", mtof(n[1]), mtof(n[1]), t + n[0], n[2], peak, true);
    tn(rig, rig.sfx, "triangle", mtof(n[1] - 12), mtof(n[1] - 12), t + n[0], n[2], peak * 1.3, true);
  }
}

function sfxBuild(rig: Rig, name: string, t: number): boolean {
  const d = rig.sfx;
  switch (name) {
    case "fire":
      nz(rig, d, "bandpass", 1800, 600, 0.8, t, 0.09, 0.35);
      tn(rig, d, "square", 520, 110, t, 0.13, 0.16);
      tn(rig, d, "sine", 180, 60, t, 0.12, 0.3);
      return true;
    case "jam":
      tn(rig, d, "square", 160, 90, t, 0.06, 0.12);
      nz(rig, d, "lowpass", 600, 300, 0.5, t, 0.08, 0.15);
      return true;
    case "hit":
      nz(rig, d, "highpass", 2500, 2500, 0.7, t, 0.05, 0.14);
      tn(rig, d, "triangle", 900, 420, t, 0.06, 0.1);
      return true;
    case "crate":
      nz(rig, d, "bandpass", 900, 400, 0.9, t, 0.2, 0.3);
      tn(rig, d, "square", 320, 180, t, 0.07, 0.1);
      tn(rig, d, "square", 240, 140, t + 0.06, 0.08, 0.08);
      return true;
    case "bounce":
      tn(rig, d, "sine", 520, 1150, t, 0.11, 0.2);
      tn(rig, d, "triangle", 1040, 2300, t, 0.08, 0.05);
      return true;
    case "boom":
    case "bigboom": {
      const big = name === "bigboom";
      const L = big ? 1.3 : 0.8;
      nz(rig, d, "lowpass", big ? 3500 : 2600, 160, 0.7, t, L, big ? 0.6 : 0.5, 0.006, true);
      tn(rig, d, "sine", big ? 150 : 130, 30, t, L, big ? 0.7 : 0.6, true);
      tn(rig, d, "sawtooth", 90, 28, t, L * 0.7, 0.18, true);
      if (big) nz(rig, d, "bandpass", 1200, 300, 1.2, t + 0.12, 0.7, 0.2, 0.01, true);
      return true;
    }
    case "explode":
      nz(rig, d, "lowpass", 2400, 180, 0.7, t, 0.65, 0.45, 0.005, true);
      tn(rig, d, "sine", 120, 32, t, 0.6, 0.6, true);
      return true;
    case "mine":
      tn(rig, d, "square", 440, 330, t, 0.06, 0.12);
      tn(rig, d, "square", 330, 220, t + 0.07, 0.09, 0.12);
      return true;
    case "fuse":
      tn(rig, d, "square", 1400, 1400, t, 0.05, 0.08);
      return true;
    case "smoke":
      nz(rig, d, "bandpass", 2600, 1500, 0.6, t, 0.45, 0.28, 0.08);
      nz(rig, d, "highpass", 4000, 4000, 0.5, t, 0.3, 0.1, 0.05);
      return true;
    case "throw":
      tn(rig, d, "sine", 280, 760, t, 0.14, 0.22);
      nz(rig, d, "highpass", 3000, 3000, 0.5, t, 0.06, 0.08);
      return true;
    case "pickup":
      tn(rig, d, "triangle", 660, 660, t, 0.07, 0.3);
      tn(rig, d, "triangle", 880, 880, t + 0.07, 0.07, 0.3);
      tn(rig, d, "triangle", 1320, 1320, t + 0.14, 0.14, 0.3);
      tn(rig, d, "sine", 1760, 1760, t + 0.14, 0.14, 0.08);
      return true;
    case "bad":
      tn(rig, d, "triangle", 420, 420, t, 0.1, 0.3);
      tn(rig, d, "triangle", 300, 220, t + 0.1, 0.2, 0.3);
      return true;
    case "poison":
      tn(rig, d, "triangle", 520, 480, t, 0.12, 0.3, true);
      tn(rig, d, "triangle", 440, 400, t + 0.13, 0.12, 0.3, true);
      tn(rig, d, "triangle", 370, 330, t + 0.26, 0.12, 0.3, true);
      tn(rig, d, "triangle", 300, 120, t + 0.39, 0.35, 0.3, true);
      return true;
    case "tick":
      tn(rig, d, "sine", 660, 660, t, 0.12, 0.4, true);
      tn(rig, d, "triangle", 1320, 1320, t, 0.05, 0.08, true);
      return true;
    case "go":
      tn(rig, d, "square", 990, 990, t, 0.12, 0.2, true);
      tn(rig, d, "square", 1320, 1320, t + 0.1, 0.3, 0.2, true);
      tn(rig, d, "triangle", 660, 660, t + 0.1, 0.3, 0.35, true);
      return true;
    case "roundwin":
      jingle(rig, t, [[0, 72, 0.1], [0.1, 76, 0.1], [0.2, 79, 0.1], [0.3, 84, 0.4]], 0.14);
      return true;
    case "fanfare":
      jingle(rig, t, [[0, 67, 0.12], [0.15, 67, 0.12], [0.3, 67, 0.12], [0.45, 72, 0.4], [0.95, 69, 0.14], [1.12, 72, 0.14], [1.3, 76, 0.45], [1.85, 79, 0.2], [2.1, 84, 0.9]], 0.15);
      tn(rig, d, "sine", mtof(60), mtof(60), t + 2.1, 0.9, 0.2, true);
      return true;
  }
  return false;
}

// --- music scheduling ---
function mNote(rig: Rig, bus: AudioNode, type: OscillatorType, m: number, t: number, dur: number, peak: number): void {
  const o = rig.ctx.createOscillator();
  const g = rig.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(mtof(m), t);
  env(g, t, peak, 0.008, dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.03);
}
function mNoise(rig: Rig, bus: AudioNode, ftype: BiquadFilterType, f: number, t: number, dur: number, peak: number): void {
  const s = rig.ctx.createBufferSource();
  s.buffer = rig.noise;
  const fl = rig.ctx.createBiquadFilter();
  fl.type = ftype;
  fl.frequency.value = f;
  const g = rig.ctx.createGain();
  env(g, t, peak, 0.002, dur);
  s.connect(fl);
  fl.connect(g);
  g.connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.03);
}
function musicStep(rig: Rig, bus: AudioNode, tr: Track, idx: number, t: number): void {
  const sd = 60 / tr.bpm / 4;
  const bar = Math.floor(idx / 16) % tr.roots.length;
  const st = idx % 16;
  const root = tr.roots[bar];
  const ch = tr.chords[bar];
  // bass
  if (tr.bassStyle === 0) {
    if (st === 0) mNote(rig, bus, "triangle", root, t, sd * 3, 0.5);
    else if (st === 4) mNote(rig, bus, "triangle", root + 7, t, sd * 3, 0.42);
    else if (st === 8) mNote(rig, bus, "triangle", root, t, sd * 3, 0.5);
    else if (st === 10) mNote(rig, bus, "triangle", root + 12, t, sd * 2, 0.4);
    else if (st === 12) mNote(rig, bus, "triangle", root + 7, t, sd * 3, 0.42);
  } else if (st % 2 === 0) {
    mNote(rig, bus, "triangle", st % 4 === 2 ? root + 12 : root, t, sd * 1.6, 0.5);
  }
  // arpeggio
  const pat = tr.bassStyle === 0 ? st % 2 === 0 : true;
  if (pat) {
    const seq = [0, 1, 2, 1];
    const k = tr.bassStyle === 0 ? (st / 2) % 4 : st % 4;
    mNote(rig, bus, "square", ch[seq[k]] + (tr.bassStyle === 0 ? 0 : 12), t, sd * 0.9, tr.arpGain);
  }
  // melody
  const notes = tr.mel[bar];
  for (const n of notes) {
    if (n[0] === st) {
      mNote(rig, bus, "square", n[1], t, sd * n[2] * 0.92, tr.melGain);
      mNote(rig, bus, "triangle", n[1] - 12, t, sd * n[2] * 0.92, tr.melGain * 0.6);
    }
  }
  // drums
  if (tr.kick.indexOf(st) >= 0) {
    const o = rig.ctx.createOscillator();
    const g = rig.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(135, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, 0.6, 0.003, 0.16);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.2);
  }
  if (tr.snare.indexOf(st) >= 0) mNoise(rig, bus, "bandpass", 1800, t, 0.09, 0.22);
  if (st % tr.hatStep === 0) {
    mNoise(rig, bus, "highpass", 7500, t, 0.03, st % 4 === 2 ? 0.1 : 0.05);
  }
}

function audible(): boolean {
  return AUD.on && AUD.mv > 0.001;
}
function audTick(): void {
  const c = AUD.ctx;
  const rig = AUD.rig;
  if (!c || !rig || !AUD.tr || !AUD.bus) return;
  if (c.state !== "running") return;
  if (AUD.nextT < c.currentTime - 0.3) AUD.nextT = c.currentTime + 0.05;
  const sd = 60 / AUD.tr.bpm / 4;
  while (AUD.nextT < c.currentTime + 0.2) {
    if (audible()) musicStep(rig, AUD.bus, AUD.tr, AUD.stepIdx, AUD.nextT);
    AUD.nextT += sd;
    AUD.stepIdx += 1;
    AUD.stepsRun += 1;
  }
}
function audMusic(name: string): void {
  AUD.want = name;
  const c = AUD.ctx;
  const rig = AUD.rig;
  if (!c || !rig || name === AUD.track) return;
  const now = c.currentTime;
  if (AUD.bus) {
    const old = AUD.bus;
    old.gain.cancelScheduledValues(now);
    old.gain.setTargetAtTime(0, now, 0.15);
    window.setTimeout(() => {
      try {
        old.disconnect();
      } catch (e) {
        /* ignore */
      }
    }, 1500);
    AUD.bus = null;
  }
  AUD.track = name;
  if (name === "none") {
    AUD.tr = null;
    return;
  }
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.setTargetAtTime(1, now, 0.2);
  bus.connect(rig.music);
  AUD.bus = bus;
  AUD.tr = name === "battle" ? BATTLE_TRACK : MENU_TRACK;
  AUD.nextT = now + 0.06;
  AUD.stepIdx = 0;
  if (!AUD.timer) AUD.timer = window.setInterval(audTick, 25);
}
function audApply(): void {
  const c = AUD.ctx;
  if (!c || !AUD.master || !AUD.musicG || !AUD.sfxG) return;
  const now = c.currentTime;
  AUD.master.gain.setTargetAtTime(AUD.on ? 0.9 : 0, now, 0.04);
  AUD.musicG.gain.setTargetAtTime(AUD.mv * 0.28, now, 0.05);
  AUD.sfxG.gain.setTargetAtTime(AUD.sv * 0.9, now, 0.05);
}
function audResume(): void {
  const c = AUD.ctx;
  if (!c || AUD.hidden) return;
  if (c.state === "running") return;
  try {
    const r = c.resume();
    if (r && typeof r.catch === "function") r.catch(() => undefined);
  } catch (e) {
    /* ignore */
  }
}
function audEnsure(): void {
  if (!AUD.ctx) {
    const W2 = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W2.AudioContext || W2.webkitAudioContext;
    if (!Ctor) return;
    try {
      const c = new Ctor();
      const master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 20;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      const musicG = c.createGain();
      const sfxG = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      musicG.connect(lp);
      lp.connect(master);
      sfxG.connect(master);
      master.connect(comp);
      comp.connect(c.destination);
      AUD.ctx = c;
      AUD.master = master;
      AUD.musicG = musicG;
      AUD.sfxG = sfxG;
      AUD.rig = { ctx: c, sfx: sfxG, music: musicG, noise: makeNoise(c), live: true };
      audApply();
      audMusic(AUD.want);
    } catch (e) {
      AUD.ctx = null;
      return;
    }
  }
  audResume();
}
function audSfx(name: string): void {
  AUD.calls += 1;
  const c = AUD.ctx;
  const rig = AUD.rig;
  if (!c || !rig || !AUD.on || AUD.sv < 0.001 || c.state !== "running") return;
  const gap: { [k: string]: number } = { fire: 0.05, hit: 0.05, crate: 0.06, bounce: 0.05, fuse: 0.3, jam: 0.1 };
  const now = c.currentTime;
  if (gap[name] !== undefined) {
    if (AUD.last[name] !== undefined && now - AUD.last[name] < gap[name]) return;
    AUD.last[name] = now;
  }
  if (sfxBuild(rig, name, now + 0.005)) {
    AUD.log.push(name);
    if (AUD.log.length > 200) AUD.log.shift();
  }
}
function audSetOn(v: boolean): void {
  AUD.on = v;
  audSave();
  audApply();
  if (v) audEnsure();
}
function audVisibility(): void {
  const c = AUD.ctx;
  AUD.hidden = document.hidden;
  if (!c) return;
  try {
    if (document.hidden) {
      const r = c.suspend();
      if (r && typeof r.catch === "function") r.catch(() => undefined);
    } else {
      AUD.hidden = false;
      audResume();
    }
  } catch (e) {
    /* ignore */
  }
}
// offline render for tests: returns peak and rms of one sound
function audRenderTest(name: string, secs: number): Promise<{ peak: number; rms: number }> {
  const OC = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext });
  const Ctor = OC.OfflineAudioContext || OC.webkitOfflineAudioContext;
  if (!Ctor) return Promise.resolve({ peak: -1, rms: -1 });
  const oc = new Ctor(1, Math.floor(44100 * secs), 44100);
  const rig: Rig = { ctx: oc, sfx: oc.destination, music: oc.destination, noise: makeNoise(oc), live: false };
  if (name === "music-menu" || name === "music-battle") {
    const tr = name === "music-menu" ? MENU_TRACK : BATTLE_TRACK;
    const sd = 60 / tr.bpm / 4;
    for (let i = 0; i * sd < secs - 0.3; i++) musicStep(rig, oc.destination, tr, i, i * sd);
  } else if (!sfxBuild(rig, name, 0)) {
    return Promise.resolve({ peak: -2, rms: -2 });
  }
  return oc.startRendering().then((buf) => {
    const d = buf.getChannelData(0);
    let pk = 0;
    let sq = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > pk) pk = a;
      sq += d[i] * d[i];
    }
    return { peak: pk, rms: Math.sqrt(sq / d.length) };
  });
}
