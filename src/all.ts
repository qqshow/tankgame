type Phase = "menu" | "play" | "over" | "round";
type Mode = "ai" | "two";

const W = 800;
const H = 500;
const HUD = 40;
const TR = 17;
const BR = 5;
const EDGE = 10;
const START_LIVES = 1;

interface Rect { x: number; y: number; w: number; h: number; kind: "wall" | "crate"; hp: number }
interface Tank { x: number; y: number; a: number; lives: number; alive: boolean; inv: number; respawn: number; cd: number; recoil: number; tread: number; fast: number; dbl: number; slow: number; jam: number; frz: number; tri: number; rev: number; sk: number; sn: number; mines: number; smokes: number; ucd: number; gren: number }
type ItemKind = "tea" | "potion" | "box" | "shield" | "heart" | "spread" | "poison";
interface Item { kind: ItemKind; x: number; y: number; t: number }
interface Bullet { x: number; y: number; vx: number; vy: number; owner: number; age: number; bounces: number; dead: boolean; k?: number }
type PartKind = "fire" | "smoke" | "star" | "chunk" | "spark" | "wood";
interface Part { kind: PartKind; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; tint: string; rot: number; vr: number; fr: number }
interface Ring { kind: "flash" | "wave"; x: number; y: number; t: number; max: number; r: number }
interface Pop { x: number; y: number; t: number; max: number; text: string; tint: string }
interface Scorch { x: number; y: number; t: number; r: number }
interface Mine { x: number; y: number; owner: number; t: number; kind: number; fuse: number }
interface Smoke { x: number; y: number; t: number }
interface AI { aimErr: number; errT: number; think: number; stuckT: number; lastX: number; lastY: number; avoid: number; avoidDir: number }
interface Ctl { turn: number; move: number; fire: boolean; dx?: number; dy?: number; mine?: boolean; smoke?: boolean; gren?: boolean }
interface Pal { body: string; dark: string; light: string }
interface Game {
  mode: Mode;
  tanks: Tank[];
  bullets: Bullet[];
  obs: Rect[];
  parts: Part[];
  rings: Ring[];
  pops: Pop[];
  scorch: Scorch[];
  time: number;
  shake: number;
  flash: number;
  slow: number;
  intro: number;
  endT: number;
  finished: boolean;
  items: Item[];
  itemT: number;
  mines: Mine[];
  smokes: Smoke[];
  score: number[];
  round: number;
  ai: AI;
}

const PALS: Pal[] = [
  { body: "#4fb3ff", dark: "#2a7fd1", light: "#b4e0ff" },
  { body: "#ffab3d", dark: "#d8741a", light: "#ffdba3" },
];
const SPAWN = [
  { x: 60, y: 250, a: 0 },
  { x: W - 60, y: 250, a: Math.PI },
];
const BOOMS = ["BOOM!", "POW!", "KABOOM!", "砰!", "哎呀!"];

function buildObs(): Rect[] {
  const out: Rect[] = [];
  const near = (a: Rect, b: Rect, m: number) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
  const hitsSpawn = (r: Rect) => SPAWN.some((s) => Math.hypot(clamp(s.x, r.x, r.x + r.w) - s.x, clamp(s.y, r.y, r.y + r.h) - s.y) < 80);
  const tryAdd = (x: number, y: number, w: number, h: number, kind: "wall" | "crate"): boolean => {
    const hp = kind === "crate" ? 1 : 99;
    const r: Rect = { x, y, w, h, kind, hp };
    const mr: Rect = { x: W - x - w, y, w, h, kind, hp };
    const mirrored = Math.abs(mr.x - r.x) > 1;
    const m = kind === "crate" ? 38 : 44;
    if (hitsSpawn(r) || hitsSpawn(mr)) return false;
    if (mirrored && near(r, mr, m)) return false;
    for (const o of out) if (near(r, o, m) || near(mr, o, m)) return false;
    out.push(r);
    if (mirrored) out.push(mr);
    return true;
  };
  if (Math.random() < 0.6) {
    const h = Math.round(rand(60, 180));
    tryAdd(385, Math.round(rand(48, H - 48 - h)), 30, h, "wall");
  }
  const wallGoal = 7 + Math.floor(Math.random() * 4);
  let walls = 0;
  for (let tries = 0; tries < 300 && walls < wallGoal; tries++) {
    const long = Math.round(rand(50, 130));
    const short = Math.round(rand(18, 26));
    const horiz = Math.random() < 0.5;
    const w = horiz ? long : short;
    const h = horiz ? short : long;
    const x = Math.round(rand(48, W / 2 - 10));
    const y = Math.round(rand(48, H - 48 - h));
    if (tryAdd(x, y, w, h, "wall")) walls++;
  }
  const crateGoal = 6 + Math.floor(Math.random() * 5);
  let crates = 0;
  for (let tries = 0; tries < 400 && crates < crateGoal; tries++) {
    const x = Math.round(rand(48, W / 2 - 16));
    const y = Math.round(rand(48, H - 48 - 32));
    if (tryAdd(x, y, 32, 32, "crate")) crates++;
  }
  return out;
}

function newGame(mode: Mode, score: number[] = [0, 0], round: number = 1): Game {
  return {
    mode,
    tanks: SPAWN.map((s) => ({ x: s.x, y: s.y, a: s.a, lives: START_LIVES, alive: true, inv: 0, respawn: 0, cd: 0, recoil: 0, tread: 0, fast: 0, dbl: 0, slow: 0, jam: 0, frz: 0, tri: 0, rev: 0, sk: 0, sn: 0, mines: 1, smokes: 1, ucd: 0, gren: 1 })),
    bullets: [],
    obs: buildObs(),
    parts: [],
    rings: [],
    pops: [],
    scorch: [],
    time: 0,
    shake: 0,
    flash: 0,
    slow: 0,
    intro: 3.4,
    endT: -1,
    finished: false,
    items: [],
    itemT: 4,
    mines: [],
    smokes: [],
    score: [score[0], score[1]],
    round,
    ai: { aimErr: 0, errT: 0, think: 1, stuckT: 0, lastX: 0, lastY: 0, avoid: 0, avoidDir: 1 },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function wrapAngle(d: number): number {
  let v = d;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

function circleRect(cx: number, cy: number, r: number, o: Rect): boolean {
  const px = clamp(cx, o.x, o.x + o.w);
  const py = clamp(cy, o.y, o.y + o.h);
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

function pushOut(t: Tank, o: Rect): void {
  const px = clamp(t.x, o.x, o.x + o.w);
  const py = clamp(t.y, o.y, o.y + o.h);
  const dx = t.x - px;
  const dy = t.y - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= TR * TR) return;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    t.x = px + (dx / d) * TR;
    t.y = py + (dy / d) * TR;
  } else {
    const l = t.x - o.x;
    const r = o.x + o.w - t.x;
    const tp = t.y - o.y;
    const bt = o.y + o.h - t.y;
    const m = Math.min(l, r, tp, bt);
    if (m === l) t.x = o.x - TR;
    else if (m === r) t.x = o.x + o.w + TR;
    else if (m === tp) t.y = o.y - TR;
    else t.y = o.y + o.h + TR;
  }
}

function hasLos(g: Game, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / 10);
  for (let i = 1; i < steps; i++) {
    const px = ax + ((bx - ax) * i) / steps;
    const py = ay + ((by - ay) * i) / steps;
    for (const o of g.obs) {
      if (px > o.x - 4 && px < o.x + o.w + 4 && py > o.y - 4 && py < o.y + o.h + 4) return false;
    }
  }
  return true;
}

let sfxHook: (n: string) => void = () => {};

function emit(g: Game, kind: PartKind, x: number, y: number, ang: number, speed: number, size: number, life: number, tint: string, fr: number, vr: number): void {
  if (g.parts.length > 700) return;
  g.parts.push({ kind, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life, max: life, size, tint, rot: rand(0, 6.28), vr, fr });
}

function boom(g: Game, x: number, y: number, pal: Pal, big: boolean): void {
  g.rings.push({ kind: "flash", x, y, t: 0, max: 0.45, r: big ? 120 : 80 });
  g.rings.push({ kind: "wave", x, y, t: 0, max: 0.6, r: big ? 130 : 90 });
  const nf = big ? 46 : 30;
  for (let i = 0; i < nf; i++) emit(g, "fire", x, y, rand(0, 6.28), rand(60, 300), rand(6, 14), rand(0.45, 0.9), "", 2.5, 0);
  const ns = big ? 14 : 9;
  for (let i = 0; i < ns; i++) emit(g, "smoke", x, y, rand(0, 6.28), rand(20, 90), rand(12, 20), rand(0.9, 1.6), "", 1.5, 0);
  const nst = big ? 12 : 8;
  for (let i = 0; i < nst; i++) emit(g, "star", x, y, rand(0, 6.28), rand(120, 340), rand(7, 11), rand(0.7, 1.1), i % 2 === 0 ? "#ffe45c" : "#ffffff", 1.8, rand(-8, 8));
  const nc = big ? 14 : 9;
  const cols = [pal.body, pal.dark, pal.light];
  for (let i = 0; i < nc; i++) emit(g, "chunk", x, y, rand(0, 6.28), rand(100, 320), rand(4, 8), rand(0.9, 1.4), cols[i % 3], 1.8, rand(-12, 12));
  g.scorch.push({ x, y, t: 0, r: big ? 34 : 26 });
  g.shake = Math.max(g.shake, big ? 22 : 14);
  g.flash = Math.max(g.flash, big ? 0.55 : 0.3);
  g.pops.push({ x, y: y - 24, t: 0, max: 1.0, text: BOOMS[Math.floor(Math.random() * BOOMS.length)], tint: "#ffe45c" });
  if (big) g.slow = 0.9;
}

function shoot(g: Game, i: number): void {
  const t = g.tanks[i];
  const n = g.bullets.filter((b) => b.owner === i && !b.dead).length;
  if (t.cd > 0 || n >= (t.tri > 0 ? 12 : t.dbl > 0 ? 8 : 4)) return;
  if (t.jam > 0) {
    t.cd = 0.5;
    sfxHook("jam");
    for (let k = 0; k < 4; k++) emit(g, "smoke", t.x + Math.cos(t.a) * 26, t.y + Math.sin(t.a) * 26, rand(0, 6.28), rand(10, 30), rand(3, 5), rand(0.3, 0.5), "", 2, 0);
    return;
  }
  t.cd = 0.5;
  t.recoil = 1;
  const k = t.sn > 0 ? t.sk : 0;
  if (t.sn > 0) t.sn -= 1;
  const sp = k === 3 ? 300 : 340;
  const mx = t.x + Math.cos(t.a) * (TR + 12);
  const my = t.y + Math.sin(t.a) * (TR + 12);
  const offs = t.dbl > 0 ? [-7, 7] : [0];
  for (const off of offs) {
    g.bullets.push({ x: mx - Math.sin(t.a) * off, y: my + Math.cos(t.a) * off, vx: Math.cos(t.a) * sp, vy: Math.sin(t.a) * sp, owner: i, age: 0, bounces: 0, dead: false, k });
  }
  if (t.tri > 0) {
    for (const da of [-0.26, 0.26]) {
      g.bullets.push({ x: mx, y: my, vx: Math.cos(t.a + da) * sp, vy: Math.sin(t.a + da) * sp, owner: i, age: 0, bounces: 0, dead: false, k });
    }
  }
  sfxHook("fire");
  for (let k = 0; k < 6; k++) emit(g, "spark", mx, my, t.a + rand(-0.6, 0.6), rand(60, 160), rand(2, 4), rand(0.15, 0.3), k % 2 === 0 ? "#fff6b0" : "#ffffff", 3, 0);
}

function breakCrate(g: Game, o: Rect): void {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const cols = ["#e0a05a", "#b5763a", "#f2c27f"];
  for (let i = 0; i < 10; i++) emit(g, "wood", cx, cy, rand(0, 6.28), rand(60, 220), rand(4, 8), rand(0.6, 1.1), cols[i % 3], 2, rand(-10, 10));
  for (let i = 0; i < 4; i++) emit(g, "smoke", cx, cy, rand(0, 6.28), rand(10, 50), rand(10, 16), rand(0.6, 1.1), "", 1.5, 0);
  g.shake = Math.max(g.shake, 4);
  sfxHook("crate");
}

function killTank(g: Game, i: number): void {
  const t = g.tanks[i];
  t.alive = false;
  t.lives -= 1;
  const big = t.lives <= 0;
  sfxHook(big ? "bigboom" : "boom");
  boom(g, t.x, t.y, PALS[i], big);
  if (big) g.endT = 1.5;
  else t.respawn = 1.6;
}

function aiCtl(g: Game, dt: number): Ctl {
  const c: Ctl = { turn: 0, move: 0, fire: false };
  const me = g.tanks[1];
  const foe = g.tanks[0];
  const ai = g.ai;
  if (!me.alive || g.intro > 0) return c;
  ai.errT -= dt;
  if (ai.errT <= 0) {
    ai.errT = 0.7;
    ai.aimErr = (Math.random() - 0.5) * 0.5;
  }
  ai.think -= dt;
  ai.stuckT += dt;
  if (ai.stuckT > 0.45) {
    const moved = Math.hypot(me.x - ai.lastX, me.y - ai.lastY);
    ai.lastX = me.x;
    ai.lastY = me.y;
    ai.stuckT = 0;
    if (moved < 8 && ai.avoid <= 0) {
      ai.avoid = 0.8;
      ai.avoidDir = Math.random() < 0.5 ? -1 : 1;
    }
  }
  if (ai.avoid > 0) {
    ai.avoid -= dt;
    c.turn = ai.avoidDir;
    c.move = ai.avoid > 0.4 ? -0.85 : 0.85;
    return c;
  }
  if (!foe.alive) {
    c.turn = 0.4;
    return c;
  }
  const target = Math.atan2(foe.y - me.y, foe.x - me.x) + ai.aimErr;
  const diff = wrapAngle(target - me.a);
  c.turn = diff > 0.06 ? 1 : diff < -0.06 ? -1 : 0;
  const dist = Math.hypot(foe.x - me.x, foe.y - me.y);
  const vis = hasLos(g, me.x, me.y, foe.x, foe.y) && !inSmoke(g, foe.x, foe.y);
  if (vis && dist > 100 && dist < 240 && me.gren > 0 && Math.random() < 0.003) c.gren = true;
  if (me.mines > 0 && Math.random() < 0.002) c.mine = true;
  if (vis) {
    c.move = dist > 240 ? 0.85 : dist < 150 ? -0.85 : 0;
    if (Math.abs(diff) < 0.1 && ai.think <= 0 && foe.inv <= 0) {
      c.fire = true;
      ai.think = 0.5 + Math.random() * 0.8;
    }
  } else {
    c.move = 0.85;
  }
  return c;
}

interface PadIn { dx: number; dy: number; fire: boolean; mine: boolean; smoke: boolean; gren: boolean }

function humanCtl(keys: Set<string>, p: number, merged: boolean, pads?: PadIn[]): Ctl {
  const k = (code: string) => keys.has(code);
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let fire = false;
  let mine = false;
  let smoke = false;
  let gren = false;
  if (p === 0 || merged) {
    mine = mine || k("KeyE");
    smoke = smoke || k("KeyQ");
    gren = gren || k("KeyR");
    left = left || k("KeyA");
    right = right || k("KeyD");
    up = up || k("KeyW");
    down = down || k("KeyS");
    fire = fire || k("Space") || k("KeyF");
  }
  if (p === 1 || merged) {
    mine = mine || k("Period");
    smoke = smoke || k("Comma");
    gren = gren || k("Semicolon");
    left = left || k("ArrowLeft");
    right = right || k("ArrowRight");
    up = up || k("ArrowUp");
    down = down || k("ArrowDown");
    fire = fire || k("Enter") || k("Slash");
  }
  let dx = (right ? 1 : 0) - (left ? 1 : 0);
  let dy = (down ? 1 : 0) - (up ? 1 : 0);
  const pd = pads ? (merged ? pads[0] : pads[p]) : undefined;
  if (pd) {
    fire = fire || pd.fire;
    mine = mine || pd.mine;
    smoke = smoke || pd.smoke;
    gren = gren || pd.gren;
    if (pd.dx !== 0 || pd.dy !== 0) {
      dx = pd.dx;
      dy = pd.dy;
    }
  }
  return { turn: 0, move: 0, fire, mine, smoke, gren, dx, dy };
}

function stepTank(g: Game, i: number, c: Ctl, dt: number): void {
  const t = g.tanks[i];
  if (!t.alive) {
    if (t.lives > 0) {
      t.respawn -= dt;
      if (t.respawn <= 0) {
        const s = SPAWN[i];
        const other = g.tanks[1 - i];
        if (other.alive && Math.hypot(other.x - s.x, other.y - s.y) < 60) {
          t.respawn = 0.3;
        } else {
          t.alive = true;
          t.x = s.x;
          t.y = s.y;
          t.a = s.a;
          t.inv = 2.2;
          t.cd = 0.3;
          g.rings.push({ kind: "wave", x: s.x, y: s.y, t: 0, max: 0.5, r: 60 });
          for (let k = 0; k < 10; k++) emit(g, "star", s.x, s.y, rand(0, 6.28), rand(40, 120), rand(5, 8), rand(0.5, 0.8), "#ffffff", 2, rand(-6, 6));
        }
      }
    }
    return;
  }
  t.inv = Math.max(0, t.inv - dt);
  t.cd -= dt;
  t.recoil = Math.max(0, t.recoil - dt * 6);
  if (g.intro > 0) return;
  let mv = c.move;
  if (c.dx !== undefined && c.dy !== undefined) {
    if (c.dx !== 0 || c.dy !== 0) {
      const rs = t.rev > 0 ? -1 : 1;
      const diff = wrapAngle(Math.atan2(c.dy * rs, c.dx * rs) - t.a);
      const maxTurn = 6 * dt;
      t.a += clamp(diff, -maxTurn, maxTurn);
      mv = Math.abs(diff) < 1.0 ? 1 : 0;
    } else {
      mv = 0;
    }
  } else {
    t.a += c.turn * 3.3 * dt;
  }
  if (t.frz > 0) mv = 0;
  const sp = (mv > 0 ? 135 : 90) * (t.fast > 0 ? 1.5 : 1) * (t.slow > 0 ? 0.5 : 1);
  const ox = t.x;
  const oy = t.y;
  t.x += Math.cos(t.a) * mv * sp * dt;
  t.y += Math.sin(t.a) * mv * sp * dt;
  for (let pass = 0; pass < 2; pass++) for (const o of g.obs) pushOut(t, o);
  t.x = clamp(t.x, EDGE + TR, W - EDGE - TR);
  t.y = clamp(t.y, EDGE + TR, H - EDGE - TR);
  const other = g.tanks[1 - i];
  if (other.alive) {
    const dx = t.x - other.x;
    const dy = t.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d < TR * 2 && d > 0.001) {
      const push = (TR * 2 - d) / 2;
      t.x += (dx / d) * push;
      t.y += (dy / d) * push;
    }
  }
  const moved = Math.hypot(t.x - ox, t.y - oy);
  t.tread += mv >= 0 ? moved : -moved;
  if (moved > 0.5 && Math.random() < 0.25) {
    emit(g, "smoke", t.x - Math.cos(t.a) * 18 * Math.sign(mv), t.y - Math.sin(t.a) * 18 * Math.sign(mv), rand(0, 6.28), rand(5, 20), rand(3, 5), rand(0.3, 0.5), "", 2, 0);
  }
  if (c.fire) shoot(g, i);
}

function applyItem(g: Game, i: number, kind: "tea" | "potion" | "box" | "shield" | "heart" | "spread" | "poison"): void {
  const t = g.tanks[i];
  let text = "";
  let good = true;
  if (kind === "poison") {
    sfxHook("poison");
    g.pops.push({ x: t.x, y: t.y - 30, t: 0, max: 1.2, text: "吃到毒药！", tint: "#d9ccff" });
    t.lives = 1;
    t.inv = 0;
    killTank(g, i);
    return;
  }
  if (kind === "shield") {
    t.inv = 6;
    text = "护盾！暂时无敌";
  } else if (kind === "heart") {
    t.lives = Math.min(3, t.lives + 1);
    text = "加一条命！";
  } else if (kind === "spread") {
    t.tri = 10;
    text = "三连发！";
  } else if (kind === "tea") {
    t.fast = 8;
    text = "姜茶！跑得快";
  } else if (kind === "potion") {
    t.dbl = 10;
    text = "双发子弹！";
  } else {
    const r = Math.random();
    if (r < 0.07) {
      t.fast = 8;
      text = "盲盒：姜茶加速！";
    } else if (r < 0.14) {
      t.dbl = 10;
      text = "盲盒：双发！";
    } else if (r < 0.21) {
      t.tri = 10;
      text = "盲盒：三连发！";
    } else if (r < 0.28) {
      t.inv = 5;
      text = "盲盒：护盾！";
    } else if (r < 0.32) {
      t.lives = Math.min(3, t.lives + 1);
      text = "盲盒：加一条命！";
    } else if (r < 0.38) {
      t.sk = 1;
      t.sn = 3;
      text = "盲盒：穿墙弹×3！";
    } else if (r < 0.44) {
      t.sk = 2;
      t.sn = 3;
      text = "盲盒：反弹弹×3！";
    } else if (r < 0.5) {
      t.sk = 3;
      t.sn = 3;
      text = "盲盒：追踪弹×3！";
    } else if (r < 0.56) {
      t.mines += 2;
      text = "盲盒：地雷×2！";
    } else if (r < 0.62) {
      t.smokes += 2;
      text = "盲盒：烟雾弹×2！";
    } else if (r < 0.68) {
      t.gren += 2;
      text = "盲盒：手雷×2！";
    } else if (r < 0.75) {
      t.slow = 6;
      text = "盲盒：变慢了…";
      good = false;
    } else if (r < 0.82) {
      t.jam = 3;
      text = "盲盒：哑火了…";
      good = false;
    } else if (r < 0.9) {
      t.frz = 2;
      text = "盲盒：被冻住了…";
      good = false;
    } else {
      t.rev = 6;
      text = "盲盒：方向反了…";
      good = false;
    }
  }
  sfxHook(good ? "pickup" : "bad");
  g.pops.push({ x: t.x, y: t.y - 30, t: 0, max: 1.2, text, tint: good ? "#ffe45c" : "#d9ccff" });
  for (let k = 0; k < 12; k++) emit(g, "star", t.x, t.y, rand(0, 6.28), rand(60, 160), rand(5, 8), rand(0.5, 0.9), good ? "#ffe45c" : "#c9b8ff", 2, rand(-8, 8));
}

function stepItems(g: Game, dt: number): void {
  if (g.intro > 0) return;
  for (const t of g.tanks) {
    t.fast = Math.max(0, t.fast - dt);
    t.dbl = Math.max(0, t.dbl - dt);
    t.slow = Math.max(0, t.slow - dt);
    t.jam = Math.max(0, t.jam - dt);
    t.frz = Math.max(0, t.frz - dt);
    t.tri = Math.max(0, t.tri - dt);
    t.rev = Math.max(0, t.rev - dt);
  }
  g.itemT -= dt;
  if (g.itemT <= 0 && g.items.length < 7) {
    g.itemT = rand(2, 3.5);
    for (let tries = 0; tries < 30; tries++) {
      const x = rand(EDGE + 30, W - EDGE - 30);
      const y = rand(EDGE + 30, H - EDGE - 30);
      let ok = true;
      for (const o of g.obs) if (x > o.x - 24 && x < o.x + o.w + 24 && y > o.y - 24 && y < o.y + o.h + 24) ok = false;
      for (const t of g.tanks) if (Math.hypot(t.x - x, t.y - y) < 70) ok = false;
      for (const it of g.items) if (Math.hypot(it.x - x, it.y - y) < 60) ok = false;
      if (ok) {
        const r = Math.random();
        const kind: ItemKind = r < 0.12 ? "poison" : "box";
        g.items.push({ kind, x, y, t: 0 });
        for (let k = 0; k < 8; k++) emit(g, "star", x, y, rand(0, 6.28), rand(30, 90), rand(4, 7), rand(0.4, 0.7), "#ffffff", 2, rand(-6, 6));
        break;
      }
    }
  }
  for (const it of g.items) {
    it.t += dt;
    for (let i = 0; i < 2; i++) {
      const t = g.tanks[i];
      if (!t.alive || it.t > 100) continue;
      if (Math.hypot(t.x - it.x, t.y - it.y) < TR + 12) {
        applyItem(g, i, it.kind);
        it.t = 999;
      }
    }
  }
  g.items = g.items.filter((it) => it.t < 16);
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, time: number): void {
  if (16 - it.t < 3 && Math.floor(time * 8) % 2 === 0) return;
  const bob = Math.sin(time * 4 + it.x) * 2.5;
  const pop = Math.max(0.05, Math.min(1, it.t * 4));
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.scale(pop, pop);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, 19 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40,30,70,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, bob);
  if (it.kind === "tea") {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = 2;
    rr(ctx, -9, -7, 16, 15, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e0a05a";
    rr(ctx, -7, -3, 12, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.arc(-1, 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.arc(8, 1, 4.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.quadraticCurveTo(-7, -14, -4, -18);
    ctx.moveTo(2, -10);
    ctx.quadraticCurveTo(-1, -14, 2, -18);
    ctx.stroke();
  } else if (it.kind === "potion") {
    ctx.fillStyle = "#b36bff";
    ctx.strokeStyle = "#6a2fc4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8dcff";
    rr(ctx, -3.5, -11, 7, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c98a4b";
    rr(ctx, -4.5, -15, 9, 5, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(-4, 0, 2, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("x2", 1, 5);
  } else if (it.kind === "poison") {
    ctx.fillStyle = "#6fd13f";
    ctx.strokeStyle = "#2f7a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d8f5c8";
    rr(ctx, -3.5, -12, 7, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7a4a2a";
    rr(ctx, -4.5, -16, 9, 5, 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 1, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-3, 4, 6, 5);
    ctx.fillStyle = "#2b2547";
    ctx.beginPath();
    ctx.arc(-2.3, 1, 1.5, 0, Math.PI * 2);
    ctx.arc(2.3, 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-0.6, 4.5, 1.2, 4);
  } else if (it.kind === "shield") {
    ctx.fillStyle = "#5fc4ff";
    ctx.strokeStyle = "#1f7fc4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, -10);
    ctx.lineTo(10, 1);
    ctx.quadraticCurveTo(10, 10, 0, 14);
    ctx.quadraticCurveTo(-10, 10, -10, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 8);
    ctx.quadraticCurveTo(-6, 5, -6, 0);
    ctx.closePath();
    ctx.fill();
  } else if (it.kind === "heart") {
    ctx.fillStyle = "#ff5a7a";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    heart(ctx, 0, 0, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(-5, -4, 2.5, 1.6, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (it.kind === "spread") {
    ctx.fillStyle = "#ff7a3d";
    ctx.strokeStyle = "#b8431a";
    ctx.lineWidth = 2;
    rr(ctx, -11, -11, 22, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const a of [-0.7, 0, 0.7]) {
      ctx.beginPath();
      ctx.arc(-4 + Math.cos(a) * 11, Math.sin(a) * 11, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(-6, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#ffd24d";
    ctx.strokeStyle = "#d98a00";
    ctx.lineWidth = 2;
    rr(ctx, -11, -11, 22, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb02e";
    ctx.fillRect(-11, -6, 22, 3);
    outlinedText(ctx, "?", 0, 3, 17, "#ffffff", "#a05a00");
  }
  ctx.restore();
}

function drawMine(ctx: CanvasRenderingContext2D, m: Mine, time: number): void {
  ctx.save();
  ctx.translate(m.x, m.y);
  const pop = Math.min(1, 0.25 + m.t * 4);
  ctx.scale(pop, pop);
  ctx.fillStyle = "rgba(40,30,70,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (m.kind === 0) {
    ctx.fillStyle = "#4a4468";
    ctx.strokeStyle = "#2b2547";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7a7399";
    for (let q = 0; q < 4; q++) {
      ctx.beginPath();
      ctx.arc(Math.cos(q * 1.571 + 0.785) * 9, Math.sin(q * 1.571 + 0.785) * 9, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const armed = m.t > 1.2;
    ctx.fillStyle = armed ? (Math.floor(time * 3) % 2 === 0 ? "#ff5a7a" : "#7a2a3a") : "#ffd24d";
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#6aa83f";
    ctx.strokeStyle = "#2f4a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 1, 8.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a8aa0";
    rr(ctx, -3.5, -12, 7, 5, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.moveTo(-6, 4);
    ctx.lineTo(6, 4);
    ctx.stroke();
    if (m.fuse >= 0) {
      ctx.fillStyle = "rgba(255,70,70," + (0.35 + 0.35 * Math.sin(time * 24)) + ")";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      outlinedText(ctx, String(Math.ceil(m.fuse)), 0, -21, 16, "#ffffff", "#c2410c");
    } else {
      ctx.strokeStyle = "rgba(255,255,255," + (0.5 + 0.4 * Math.sin(time * 5)) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSmoke(ctx: CanvasRenderingContext2D, s: Smoke, time: number): void {
  const fadeIn = Math.min(1, s.t / 0.5);
  const fadeOut = s.t > 5.5 ? Math.max(0, (7 - s.t) / 1.5) : 1;
  const R = 62 * (0.5 + 0.5 * fadeIn);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = 0.93 * fadeIn * fadeOut;
  for (let j = 0; j < 7; j++) {
    const an = j * 0.9 + time * 0.3;
    ctx.fillStyle = j % 2 === 0 ? "#d9d3ee" : "#c4bce0";
    ctx.beginPath();
    ctx.arc(Math.cos(an) * R * 0.45, Math.sin(an * 1.3) * R * 0.4, R * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBadges(ctx: CanvasRenderingContext2D, t: Tank): void {
  const list: { c: string; s: string }[] = [];
  if (t.fast > 0) list.push({ c: "#ff9a1f", s: "快" });
  if (t.dbl > 0) list.push({ c: "#a05cf0", s: "双" });
  if (t.slow > 0) list.push({ c: "#7a7399", s: "慢" });
  if (t.jam > 0) list.push({ c: "#ff5a7a", s: "哑" });
  if (t.tri > 0) list.push({ c: "#ff7a3d", s: "三" });
  if (t.sn > 0) list.push({ c: t.sk === 1 ? "#8a4be0" : t.sk === 2 ? "#2faa4a" : "#e0344f", s: t.sk === 1 ? "穿" : t.sk === 2 ? "弹" : "追" });
  if (t.frz > 0) list.push({ c: "#3aa8e0", s: "冻" });
  if (t.rev > 0) list.push({ c: "#c04ad6", s: "反" });
  if (t.frz > 0) {
    ctx.fillStyle = "rgba(150,220,255,0.45)";
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    rr(ctx, t.x - 22, t.y - 22, 44, 44, 10);
    ctx.fill();
    ctx.stroke();
  }
  list.forEach((b, k) => {
    const x = t.x + (k - (list.length - 1) / 2) * 19;
    const y = t.y - 31;
    ctx.fillStyle = b.c;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 10px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.s, x, y + 0.5);
  });
}

function inSmoke(g: Game, x: number, y: number): boolean {
  for (const s of g.smokes) if (Math.hypot(s.x - x, s.y - y) < 62) return true;
  return false;
}

function useGear(g: Game, i: number, c: Ctl): void {
  const t = g.tanks[i];
  if (!t.alive || g.intro > 0 || t.ucd > 0) return;
  const cx = Math.cos(t.a);
  const cy = Math.sin(t.a);
  if (c.mine && t.mines > 0) {
    t.mines -= 1;
    t.ucd = 0.4;
    sfxHook("mine");
    g.mines.push({ x: t.x - cx * 24, y: t.y - cy * 24, owner: i, t: 0, kind: 0, fuse: -1 });
    g.pops.push({ x: t.x, y: t.y - 28, t: 0, max: 0.6, text: "埋雷", tint: "#ffe45c" });
  } else if (c.smoke && t.smokes > 0) {
    t.smokes -= 1;
    t.ucd = 0.4;
    const sx = clamp(t.x + cx * 60, EDGE + 20, W - EDGE - 20);
    const sy = clamp(t.y + cy * 60, EDGE + 20, H - EDGE - 20);
    sfxHook("smoke");
    g.smokes.push({ x: sx, y: sy, t: 0 });
    for (let k = 0; k < 8; k++) emit(g, "smoke", sx, sy, rand(0, 6.28), rand(20, 70), rand(8, 14), rand(0.5, 0.9), "", 1.5, 0);
  } else if (c.gren && t.gren > 0) {
    t.gren -= 1;
    t.ucd = 0.5;
    let gx = t.x + cx * 28;
    let gy = t.y + cy * 28;
    for (let d = 34; d <= 180; d += 6) {
      const nx = t.x + cx * d;
      const ny = t.y + cy * d;
      if (nx < EDGE + 12 || nx > W - EDGE - 12 || ny < EDGE + 12 || ny > H - EDGE - 12) break;
      let blocked = false;
      for (const o of g.obs) if (o.hp > 0 && circleRect(nx, ny, 8, o)) blocked = true;
      if (blocked) break;
      gx = nx;
      gy = ny;
    }
    sfxHook("throw");
    g.mines.push({ x: gx, y: gy, owner: i, t: 0, kind: 1, fuse: -1 });
    g.pops.push({ x: t.x, y: t.y - 28, t: 0, max: 0.6, text: "扔！", tint: "#ffe45c" });
  }
}

function explodeAt(g: Game, x: number, y: number, rad: number): void {
  sfxHook("explode");
  g.rings.push({ kind: "flash", x, y, t: 0, max: 0.5, r: rad * 1.6 });
  g.rings.push({ kind: "wave", x, y, t: 0, max: 0.6, r: rad * 1.5 });
  for (let k = 0; k < 30; k++) emit(g, "fire", x, y, rand(0, 6.28), rand(60, 300), rand(6, 14), rand(0.45, 0.9), "", 2.5, 0);
  for (let k = 0; k < 8; k++) emit(g, "smoke", x, y, rand(0, 6.28), rand(20, 90), rand(12, 20), rand(0.9, 1.6), "", 1.5, 0);
  for (let k = 0; k < 8; k++) emit(g, "star", x, y, rand(0, 6.28), rand(120, 320), rand(7, 11), rand(0.7, 1.1), k % 2 === 0 ? "#ffe45c" : "#ffffff", 1.8, rand(-8, 8));
  g.scorch.push({ x, y, t: 0, r: rad * 0.7 });
  g.shake = Math.max(g.shake, 16);
  g.flash = Math.max(g.flash, 0.3);
  g.pops.push({ x, y: y - 24, t: 0, max: 1.0, text: BOOMS[Math.floor(Math.random() * BOOMS.length)], tint: "#ffe45c" });
  for (const o of g.obs) {
    if (o.kind === "crate" && o.hp > 0 && Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y) < rad + 16) {
      o.hp = 0;
      breakCrate(g, o);
    }
  }
  for (let i = 0; i < 2; i++) {
    const t = g.tanks[i];
    if (t.alive && t.inv <= 0 && Math.hypot(t.x - x, t.y - y) < rad + TR - 4) killTank(g, i);
  }
}

function stepMines(g: Game, dt: number): void {
  if (g.intro > 0) return;
  for (const t of g.tanks) t.ucd = Math.max(0, t.ucd - dt);
  for (const m of g.mines) {
    m.t += dt;
    if (m.kind === 1) {
      if (m.fuse < 0) {
        for (const t of g.tanks) if (t.alive && Math.hypot(t.x - m.x, t.y - m.y) < TR + 6) {
            if (m.fuse < 0) sfxHook("fuse");
            m.fuse = 2.5;
          }
      } else {
        m.fuse -= dt;
        if (m.fuse <= 0) {
          explodeAt(g, m.x, m.y, 75);
          m.t = -999;
        }
      }
    } else if (m.t > 1.2) {
      for (const t of g.tanks) {
        if (t.alive && t.inv <= 0 && Math.hypot(t.x - m.x, t.y - m.y) < TR + 6) {
          explodeAt(g, m.x, m.y, 48);
          m.t = -999;
          break;
        }
      }
    }
  }
  g.mines = g.mines.filter((m) => m.t > -100);
  for (const s of g.smokes) s.t += dt;
  g.smokes = g.smokes.filter((s) => s.t < 7);
}

function stepBullets(g: Game, dt: number): void {
  for (const b of g.bullets) {
    if (b.dead) continue;
    b.age += dt;
    if (b.k === 3 && b.age < 3.5) {
      const foe = g.tanks[1 - b.owner];
      if (foe.alive) {
        const ang = Math.atan2(b.vy, b.vx);
        const d = wrapAngle(Math.atan2(foe.y - b.y, foe.x - b.x) - ang);
        const na = ang + clamp(d, -2.4 * dt, 2.4 * dt);
        const hs = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * hs;
        b.vy = Math.sin(na) * hs;
      }
    }
    const speed = Math.hypot(b.vx, b.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 4));
    const sdt = dt / steps;
    for (let s = 0; s < steps && !b.dead; s++) {
      const px = b.x;
      const py = b.y;
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      let bounced = false;
      if (b.x < EDGE + BR || b.x > W - EDGE - BR || b.y < EDGE + BR || b.y > H - EDGE - BR) {
        b.x = clamp(b.x, EDGE + BR, W - EDGE - BR);
        b.y = clamp(b.y, EDGE + BR, H - EDGE - BR);
        if (b.k === 2 && b.bounces < 3) {
          if ((b.x <= EDGE + BR && b.vx < 0) || (b.x >= W - EDGE - BR && b.vx > 0)) b.vx = -b.vx;
          if ((b.y <= EDGE + BR && b.vy < 0) || (b.y >= H - EDGE - BR && b.vy > 0)) b.vy = -b.vy;
          b.bounces += 1;
          sfxHook("bounce");
          for (let q = 0; q < 4; q++) emit(g, "spark", b.x, b.y, rand(0, 6.28), rand(40, 110), rand(2, 3.5), rand(0.15, 0.3), "#b6ffb0", 3, 0);
          break;
        }
        b.dead = true;
        sfxHook("hit");
        for (let k = 0; k < 5; k++) emit(g, "spark", b.x, b.y, rand(0, 6.28), rand(40, 110), rand(2, 3.5), rand(0.15, 0.3), "#ffffff", 3, 0);
        break;
      }
      for (const o of g.obs) {
        if (o.hp <= 0) continue;
        if (!circleRect(b.x, b.y, BR, o)) continue;
        if (o.kind === "crate") {
          o.hp -= 1;
          if (b.k !== 1) b.dead = true;
          for (let k = 0; k < 5; k++) emit(g, "spark", b.x, b.y, rand(0, 6.28), rand(40, 120), rand(2, 4), rand(0.2, 0.4), "#ffd9a0", 3, 0);
          if (o.hp <= 0) breakCrate(g, o);
          else sfxHook("hit");
        } else if (b.k === 1) {
          continue;
        } else if (b.k === 2 && b.bounces < 3) {
          const hitX = circleRect(b.x, py, BR, o);
          const hitY = circleRect(px, b.y, BR, o);
          if (hitX && !hitY) b.vx = -b.vx;
          else if (hitY && !hitX) b.vy = -b.vy;
          else {
            b.vx = -b.vx;
            b.vy = -b.vy;
          }
          b.x = px;
          b.y = py;
          bounced = true;
        } else {
          b.dead = true;
          sfxHook("hit");
          for (let k = 0; k < 6; k++) emit(g, "spark", px, py, rand(0, 6.28), rand(40, 120), rand(2, 3.5), rand(0.15, 0.3), "#e6dcff", 3, 0);
        }
        break;
      }
      if (bounced && !b.dead) {
        b.bounces += 1;
        sfxHook("bounce");
        for (let k = 0; k < 4; k++) emit(g, "spark", b.x, b.y, rand(0, 6.28), rand(40, 110), rand(2, 3.5), rand(0.15, 0.3), "#ffffff", 3, 0);
        if (b.bounces > 4) b.dead = true;
      }
    }
    if (b.age > 7) b.dead = true;
    if (!b.dead && Math.random() < 0.6) emit(g, "spark", b.x, b.y, rand(0, 6.28), 6, rand(2, 3.5), 0.25, "#ffffff", 4, 0);
    if (b.dead) continue;
    for (let i = 0; i < 2; i++) {
      const t = g.tanks[i];
      if (!t.alive || t.inv > 0) continue;
      if (b.owner === i && b.age < 0.25) continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < TR + BR - 3) {
        b.dead = true;
        killTank(g, i);
        break;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => !b.dead);
  g.obs = g.obs.filter((o) => o.hp > 0);
}

function stepFx(g: Game, dt: number): void {
  for (const p of g.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = Math.max(0, 1 - p.fr * dt);
    p.vx *= f;
    p.vy *= f;
    p.rot += p.vr * dt;
    p.life -= dt;
  }
  g.parts = g.parts.filter((p) => p.life > 0);
  for (const r of g.rings) r.t += dt;
  g.rings = g.rings.filter((r) => r.t < r.max);
  for (const p of g.pops) p.t += dt;
  g.pops = g.pops.filter((p) => p.t < p.max);
  for (const s of g.scorch) s.t += dt;
  g.scorch = g.scorch.filter((s) => s.t < 7);
  g.shake *= Math.pow(0.001, dt);
  if (g.shake < 0.2) g.shake = 0;
  g.flash = Math.max(0, g.flash - dt * 1.6);
}

function step(g: Game, rawDt: number, keys: Set<string>, logic: boolean, pads?: PadIn[]): string | null {
  let dt = rawDt;
  if (g.slow > 0) {
    g.slow -= rawDt;
    dt = rawDt * 0.35;
  }
  g.time += dt;
  stepFx(g, dt);
  if (!logic) return null;
  if (g.intro > 0) g.intro -= dt;
  const merged = g.mode === "ai";
  const c0 = humanCtl(keys, 0, merged, pads);
  const c1 = g.mode === "ai" ? aiCtl(g, dt) : humanCtl(keys, 1, false, pads);
  stepTank(g, 0, c0, dt);
  stepTank(g, 1, c1, dt);
  useGear(g, 0, c0);
  useGear(g, 1, c1);
  stepItems(g, dt);
  stepMines(g, dt);
  stepBullets(g, dt);
  if (g.endT >= 0 && !g.finished) {
    g.endT -= rawDt;
    if (g.endT <= 0) {
      g.finished = true;
      const a = g.tanks[0].lives > 0;
      const b = g.tanks[1].lives > 0;
      if (a && !b) return "W0";
      if (b && !a) return "W1";
      return "WD";
    }
  }
  return null;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const m = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + m, y);
  ctx.arcTo(x + w, y, x + w, y + h, m);
  ctx.arcTo(x + w, y + h, x, y + h, m);
  ctx.arcTo(x, y + h, x, y, m);
  ctx.arcTo(x, y, x + w, y, m);
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const FLOWERS: { x: number; y: number; c: string; s: number }[] = (() => {
  const out: { x: number; y: number; c: string; s: number }[] = [];
  let seed = 7;
  const nx = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const cols = ["#ffffff", "#ffd1e6", "#fff0a0"];
  for (let i = 0; i < 26; i++) out.push({ x: 20 + nx() * (W - 40), y: 20 + nx() * (H - 40), c: cols[i % 3], s: 2 + nx() * 2 });
  return out;
})();

function drawTank(ctx: CanvasRenderingContext2D, t: Tank, pal: Pal, time: number): void {
  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.inv > 0) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 22);
  ctx.fillStyle = "rgba(40,30,70,0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 7, 21, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.rotate(t.a);
  ctx.fillStyle = "#4a4468";
  rr(ctx, -18, -19, 36, 9, 4);
  ctx.fill();
  rr(ctx, -18, 10, 36, 9, 4);
  ctx.fill();
  ctx.fillStyle = "#7a7399";
  const off = ((t.tread % 8) + 8) % 8;
  for (let k = -3; k <= 3; k++) {
    const x = k * 8 + off - 1;
    if (x < -15 || x > 14) continue;
    ctx.fillRect(x, -17, 3, 5);
    ctx.fillRect(x, 12, 3, 5);
  }
  ctx.fillStyle = pal.body;
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2.5;
  rr(ctx, -16, -12, 32, 24, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.light;
  rr(ctx, -12, -9, 18, 5, 3);
  ctx.fill();
  const rc = t.recoil * 5;
  ctx.fillStyle = pal.dark;
  rr(ctx, 4 - rc, -4.5, 26, 9, 4);
  ctx.fill();
  ctx.fillStyle = pal.light;
  rr(ctx, 27 - rc, -6, 7, 12, 3);
  ctx.fill();
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.arc(-9, -9, 5, 0, Math.PI * 2);
  ctx.arc(9, -9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath();
  ctx.arc(-9, -9, 2.6, 0, Math.PI * 2);
  ctx.arc(9, -9, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const lx = Math.cos(t.a) * 1.5;
  const ly = Math.sin(t.a) * 1.5;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3d3560";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-4.5, -2, 3.6, 0, Math.PI * 2);
  ctx.arc(4.5, -2, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2b2547";
  ctx.beginPath();
  ctx.arc(-4.5 + lx, -2 + ly, 1.9, 0, Math.PI * 2);
  ctx.arc(4.5 + lx, -2 + ly, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,120,150,0.55)";
  ctx.beginPath();
  ctx.ellipse(-8.5, 3.5, 2.6, 1.7, 0, 0, Math.PI * 2);
  ctx.ellipse(8.5, 3.5, 2.6, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2547";
  ctx.fillStyle = "#2b2547";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (t.recoil > 0.3) {
    ctx.arc(0, 5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(0, 3.5, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  if (t.inv > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(170,225,255,0.22)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 25 + Math.sin(time * 8) * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawObs(ctx: CanvasRenderingContext2D, o: Rect): void {
  ctx.fillStyle = "rgba(40,30,70,0.14)";
  rr(ctx, o.x + 4, o.y + 9, o.w, o.h, 8);
  ctx.fill();
  if (o.kind === "wall") {
    ctx.fillStyle = "#8c7bd6";
    rr(ctx, o.x, o.y + 5, o.w, o.h, 8);
    ctx.fill();
    ctx.fillStyle = "#b9a8ff";
    rr(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    rr(ctx, o.x + 4, o.y + 4, Math.max(4, o.w - 8), 5, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = "#a8692f";
    rr(ctx, o.x, o.y + 4, o.w, o.h, 6);
    ctx.fill();
    ctx.fillStyle = "#e0a05a";
    rr(ctx, o.x, o.y, o.w, o.h, 6);
    ctx.fill();
    ctx.strokeStyle = "#b5763a";
    ctx.lineWidth = 3;
    rr(ctx, o.x + 3, o.y + 3, o.w - 6, o.h - 6, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x + 6, o.y + 6);
    ctx.lineTo(o.x + o.w - 6, o.y + o.h - 6);
    ctx.moveTo(o.x + o.w - 6, o.y + 6);
    ctx.lineTo(o.x + 6, o.y + o.h - 6);
    ctx.stroke();
    if (o.hp <= 0) {
      ctx.strokeStyle = "#5a3416";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + 14, o.y);
      ctx.lineTo(o.x + 10, o.y + 12);
      ctx.lineTo(o.x + 18, o.y + 18);
      ctx.lineTo(o.x + 12, o.y + o.h);
      ctx.stroke();
    }
  }
}

function drawPart(ctx: CanvasRenderingContext2D, p: Part): void {
  const r = p.life / p.max;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.kind === "fire") {
    const col = r > 0.7 ? "#fff2a8" : r > 0.4 ? "#ffb02e" : r > 0.2 ? "#ff5a36" : "#7a3a5a";
    ctx.globalAlpha = Math.min(1, r * 1.6);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * (0.35 + 0.65 * r), 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "smoke") {
    ctx.globalAlpha = r * 0.5;
    ctx.fillStyle = "#6a6190";
    ctx.beginPath();
    ctx.arc(0, 0, p.size * (1 + (1 - r) * 1.2), 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "star") {
    ctx.globalAlpha = Math.min(1, r * 2);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.tint;
    ctx.strokeStyle = "#ff9a1f";
    ctx.lineWidth = 1.5;
    star(ctx, p.size * (0.5 + 0.5 * r));
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === "chunk" || p.kind === "wood") {
    ctx.globalAlpha = Math.min(1, r * 2);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.tint;
    ctx.strokeStyle = "rgba(40,30,70,0.5)";
    ctx.lineWidth = 1;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
    ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
  } else {
    ctx.globalAlpha = Math.min(1, r * 2);
    ctx.fillStyle = p.tint;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * (0.4 + 0.6 * r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, stroke: string): void {
  ctx.font = "800 " + size + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function draw(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.clearRect(0, 0, W, H + HUD);
  ctx.fillStyle = "#3d3560";
  ctx.fillRect(0, 0, W, HUD);
  const names = g.mode === "ai" ? ["你", "电脑"] : ["玩家1", "玩家2"];
  ctx.font = '700 16px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = "middle";
  for (let i = 0; i < 2; i++) {
    const pal = PALS[i];
    const left = i === 0;
    const bx = left ? 22 : W - 22;
    ctx.fillStyle = pal.body;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, HUD / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = left ? "left" : "right";
    ctx.fillText(names[i], left ? bx + 16 : bx - 16, HUD / 2 + 1);
    const tw = ctx.measureText(names[i]).width;
    for (let k = 0; k < Math.max(START_LIVES, g.tanks[i].lives); k++) {
      const hx = left ? bx + 16 + tw + 22 + k * 28 : bx - 16 - tw - 22 - k * 28;
      heart(ctx, hx, HUD / 2, 9);
      if (k < g.tanks[i].lives) {
        ctx.fillStyle = "#ff5a7a";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  outlinedText(ctx, "第" + g.round + "局  " + g.score[0] + " : " + g.score[1], W / 2, HUD / 2 + 1, 18, "#ffe45c", "#3d3560");
  ctx.font = '700 13px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2; i++) {
    const tk = g.tanks[i];
    ctx.textAlign = i === 0 ? "left" : "right";
    ctx.fillText("雷" + tk.mines + " 烟" + tk.smokes + " 手雷" + tk.gren, i === 0 ? 200 : W - 200, HUD / 2 + 1);
  }
  ctx.save();
  ctx.translate(0, HUD);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (g.shake > 0) ctx.translate(rand(-g.shake, g.shake) * 0.5, rand(-g.shake, g.shake) * 0.5);
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? "#c4eaae" : "#b8e3a0";
      ctx.fillRect(i * 50, j * 50, 50, 50);
    }
  }
  for (const f of FLOWERS) {
    ctx.fillStyle = f.c;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb54d";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of g.scorch) {
    ctx.globalAlpha = 0.28 * (1 - s.t / 7);
    ctx.fillStyle = "#4a3b5e";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#6cbf5e";
  ctx.lineWidth = EDGE * 2;
  rr(ctx, 0, 0, W, H, 0);
  ctx.stroke();
  ctx.strokeStyle = "#8ed67a";
  ctx.lineWidth = 3;
  rr(ctx, EDGE, EDGE, W - EDGE * 2, H - EDGE * 2, 10);
  ctx.stroke();
  for (const o of g.obs) drawObs(ctx, o);
  for (const it of g.items) drawItem(ctx, it, g.time);
  for (const m of g.mines) drawMine(ctx, m, g.time);
  for (const p of g.parts) if (p.kind === "smoke") drawPart(ctx, p);
  for (let i = 0; i < 2; i++) {
    if (!g.tanks[i].alive) continue;
    drawTank(ctx, g.tanks[i], PALS[i], g.time);
    drawBadges(ctx, g.tanks[i]);
  }
  for (const b of g.bullets) {
    const bk = b.k ?? 0;
    ctx.fillStyle = bk === 1 ? "#8a4be0" : bk === 2 ? "#2faa4a" : bk === 3 ? "#e0344f" : PALS[b.owner].dark;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BR + 1.5 + (bk > 0 ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, BR - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of g.parts) if (p.kind !== "smoke") drawPart(ctx, p);
  for (const s of g.smokes) drawSmoke(ctx, s, g.time);
  for (const r of g.rings) {
    const k = r.t / r.max;
    const e = 1 - Math.pow(1 - k, 3);
    if (r.kind === "flash") {
      const rad = r.r * (0.3 + 0.7 * e);
      const grd = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
      grd.addColorStop(0, "rgba(255,255,255," + (1 - k) + ")");
      grd.addColorStop(0.5, "rgba(255,230,120," + 0.7 * (1 - k) + ")");
      grd.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255,255,255," + 0.9 * (1 - k) + ")";
      ctx.lineWidth = 8 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * e, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const p of g.pops) {
    const k = p.t / p.max;
    const grow = k < 0.2 ? 1.5 * (k / 0.2) - 0.2 * Math.sin((k / 0.2) * Math.PI) : 1.5 - 0.5 * ((k - 0.2) / 0.8);
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.translate(p.x, p.y - k * 24);
    ctx.rotate(-0.14);
    ctx.scale(Math.max(0.1, grow), Math.max(0.1, grow));
    outlinedText(ctx, p.text, 0, 0, 30, p.tint, "#c2410c");
    ctx.restore();
  }
  if (g.flash > 0) {
    ctx.fillStyle = "rgba(255,255,255," + g.flash + ")";
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  if (g.intro > 0 && g.time > 0) {
    const n = Math.ceil(g.intro - 0.4);
    const txt = n > 0 ? String(n) : "开打！";
    const fr = n > 0 ? g.intro - 0.4 - (n - 1) : g.intro / 0.4;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(1 + (1 - fr) * 0.25, 1 + (1 - fr) * 0.25);
    ctx.globalAlpha = n > 0 ? 0.4 + 0.6 * fr : clamp(fr * 1.5, 0, 1);
    outlinedText(ctx, txt, 0, 0, n > 0 ? 110 : 84, "#ffe45c", "#c2410c");
    ctx.restore();
  }
  ctx.restore();
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawWin(ctx: CanvasRenderingContext2D, w: number, t: number, title: string, sub: string): void {
  const pal = PALS[w];
  const cx = W / 2;
  const TH = H + HUD;
  const cols = ["#ffe45c", "#ff7aa8", "#6fd1ff", "#9dff8a", "#ffb04d", "#d9a0ff"];
  const pop = Math.min(1, t / 0.5);
  const ease = 1 - Math.pow(1 - pop, 3);
  const bob = Math.sin(t * 3) * 6;
  ctx.save();
  ctx.fillStyle = "rgba(30,20,60," + 0.84 * Math.min(1, t / 0.4) + ")";
  ctx.fillRect(0, 0, W, TH);
  ctx.save();
  ctx.translate(cx, 290);
  ctx.rotate(t * 0.25);
  ctx.fillStyle = "rgba(255,224,92,0.16)";
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(900, -70);
    ctx.lineTo(900, 70);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(cx, 290, 10, cx, 290, 170);
  glow.addColorStop(0, "rgba(255,228,92,0.55)");
  glow.addColorStop(1, "rgba(255,228,92,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, 290, 170, 0, Math.PI * 2);
  ctx.fill();
  const base = Math.floor(t / 0.55);
  for (let j = 0; j < 4; j++) {
    const n = base - j;
    if (n < 0) continue;
    const age = t - n * 0.55;
    if (age > 1.6) continue;
    const fx = 90 + hash(n) * (W - 180);
    const fy = 70 + hash(n + 50) * 200;
    const col = cols[n % cols.length];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + hash(n + k) * 0.3;
      const sp = 70 + hash(n * 3 + k) * 90;
      ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * sp * age, fy + Math.sin(a) * sp * age + 60 * age * age, 3.2 * (1 - age / 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(cx, 295 + bob);
  ctx.scale(3 * ease, 3 * ease);
  const tk: Tank = { x: 0, y: 0, a: -Math.PI / 2 + Math.sin(t * 2.2) * 0.25, lives: 1, alive: true, inv: 0, respawn: 0, cd: 0, recoil: Math.max(0, Math.sin(t * 5)), tread: t * 20, fast: 0, dbl: 0, slow: 0, jam: 0, frz: 0, tri: 0, rev: 0, sk: 0, sn: 0, mines: 0, smokes: 0, ucd: 0, gren: 0 };
  drawTank(ctx, tk, pal, t);
  ctx.restore();
  ctx.save();
  ctx.translate(cx, 195 + bob);
  ctx.scale(2 * ease, 2 * ease);
  ctx.fillStyle = "#ffd24d";
  ctx.strokeStyle = "#c2820a";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.lineTo(-26, -8);
  ctx.lineTo(-13, 2);
  ctx.lineTo(0, -14);
  ctx.lineTo(13, 2);
  ctx.lineTo(26, -8);
  ctx.lineTo(26, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const gems = ["#ff5a7a", "#6fd1ff", "#9dff8a"];
  for (let q = 0; q < 3; q++) {
    ctx.fillStyle = gems[q];
    ctx.beginPath();
    ctx.arc(-14 + q * 14, 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 80; i++) {
    const sp = 50 + hash(i) * 70;
    const x = hash(i + 7) * W + Math.sin(t * 2 + i) * 14;
    const y = ((t * sp + hash(i + 3) * (TH + 60)) % (TH + 60)) - 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (2 + hash(i + 9) * 3) + i);
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, 78);
  const ps = ease * (1 + 0.05 * Math.sin(t * 5));
  ctx.scale(ps, ps);
  outlinedText(ctx, "胜利！", 0, 0, 72, "#ffe45c", "#c2410c");
  ctx.restore();
  ctx.fillStyle = "#ffd24d";
  ctx.strokeStyle = "#c2820a";
  ctx.lineWidth = 3;
  rr(ctx, cx - 270, 382, 540, 48, 14);
  ctx.fill();
  ctx.stroke();
  outlinedText(ctx, title, cx, 407, 28, "#ffffff", "#c2410c");
  outlinedText(ctx, sub, cx, 452, 22, "#ffe45c", "#3d3560");
  ctx.restore();
}

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

// ================= standalone DOM app =================
function listPads(): Gamepad[] {
  const out: Gamepad[] = [];
  try {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (gp && gp.connected) out.push(gp);
    }
  } catch (e) {
    return out;
  }
  return out;
}

function hatDir(v: number): [number, number] | null {
  // Switch pro style hat axis: -1 up, then clockwise in steps of 2/7; ~1.29 neutral
  if (typeof v !== "number" || isNaN(v) || v > 1.1 || v < -1.1) return null;
  const idx = Math.round((v + 1) * 3.5);
  const dirs: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  if (Math.abs((idx / 3.5) - 1 - v) > 0.08) return null;
  return dirs[idx] || null;
}

interface TChip {
  idx: number;
  box: HTMLElement;
  act: HTMLElement;
}
interface TPanel {
  root: HTMLElement;
  dot: HTMLElement;
  info: HTMLElement;
  chips: TChip[];
  sel: HTMLSelectElement | null;
}
interface AxB { axis: number; sign: number; rest: number }
interface Bind { up: AxB | null; right: AxB | null; fire: number; mine: number; smoke: number; gren: number }
interface EBind { up: AxB | null; right: AxB | null; fire: number[]; mine: number[]; smoke: number[]; gren: number[]; dpad: number[]; custom: boolean }
const STEPS = ["up", "right", "fire", "mine", "smoke", "gren"];
const STEP_TXT = ["把摇杆往上推", "把摇杆往右推", "按一下开炮键", "按一下地雷键", "按一下烟雾键", "按一下手雷键"];
const BIND_KEY = "tank.split.bind3";

let splitOn = false;
let binds: (Bind | null)[] = [null, null];
let lastPads: PadIn[] = [];
let rots: number[] = [0, 0];
const ROT_TXT = ["正常", "左转90", "右转90", "180"];

function loadRot(): void {
  const raw = lsGet("tank.rot");
  rots = [0, 0];
  if (raw) {
    try {
      const a = JSON.parse(raw);
      if (Array.isArray(a) && a.length === 2) rots = [(a[0] | 0) & 3, (a[1] | 0) & 3];
    } catch (e) {
      rots = [0, 0];
    }
  }
}
function saveRot(): void {
  lsSet("tank.rot", JSON.stringify(rots));
}
function rotate(x: number, y: number, r: number): [number, number] {
  // screen coordinates, y down. 1 = rotate left (counter-clockwise) 90, 2 = right 90, 3 = 180
  if (r === 1) return [y, -x];
  if (r === 2) return [-y, x];
  if (r === 3) return [-x, -y];
  return [x, y];
}
function isJoyPair(gp: Gamepad): boolean {
  const id = gp.id || "";
  if (!/joy-?con/i.test(id)) return false;
  return /\(L\/R\)/i.test(id) || !/\((L|R)\)/i.test(id);
}
function splitActive(all: Gamepad[]): boolean {
  if (all.length !== 1) return false;
  return (isJoyPair(all[0]) && all[0].axes.length >= 4) || splitOn;
}

function lsGet(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
function lsSet(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch (e) {
    /* ignore */
  }
}
function loadSplit(): void {
  splitOn = lsGet("tank.split.on") === "1";
  binds = [null, null];
  const raw = lsGet(BIND_KEY);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 2) binds = [arr[0] || null, arr[1] || null];
    } catch (e) {
      binds = [null, null];
    }
  }
}
function saveSplit(): void {
  lsSet("tank.split.on", splitOn ? "1" : "0");
  lsSet(BIND_KEY, JSON.stringify(binds));
}
function bound(b: Bind | null): boolean {
  return !!b && (!!b.up || !!b.right || b.fire >= 0 || b.mine >= 0 || b.smoke >= 0 || b.gren >= 0);
}

// Default split layout for a merged standard-mapping pad (e.g. Safari "Joy-Con (L/R) Extended Gamepad").
// P1 = left Joy-Con (left stick, left-side buttons only), P2 = right Joy-Con (right stick, right-side buttons only).
function defBind(gp: Gamepad | null, p: number): EBind | null {
  if (!gp || gp.mapping !== "standard" || gp.axes.length < 4) return null;
  if (p === 0) {
    return { up: { axis: 1, sign: -1, rest: 0 }, right: { axis: 0, sign: 1, rest: 0 }, fire: [6], mine: [8], smoke: [10], gren: [4], dpad: [12, 13, 14, 15], custom: false };
  }
  return { up: { axis: 3, sign: -1, rest: 0 }, right: { axis: 2, sign: 1, rest: 0 }, fire: [0, 1, 7], mine: [2], smoke: [3], gren: [5], dpad: [], custom: false };
}
function effBind(gp: Gamepad | null, p: number): EBind | null {
  const sv = binds[p];
  const df = defBind(gp, p);
  if (!sv && !df) return null;
  const pick = (v: number, d: number[] | undefined): number[] => (v >= 0 ? [v] : d || []);
  return {
    up: (sv && sv.up) || (df ? df.up : null),
    right: (sv && sv.right) || (df ? df.right : null),
    fire: pick(sv ? sv.fire : -1, df ? df.fire : undefined),
    mine: pick(sv ? sv.mine : -1, df ? df.mine : undefined),
    smoke: pick(sv ? sv.smoke : -1, df ? df.smoke : undefined),
    gren: pick(sv ? sv.gren : -1, df ? df.gren : undefined),
    dpad: p === 0 ? [12, 13, 14, 15] : [],
    custom: bound(sv),
  };
}
function ebound(e: EBind | null): boolean {
  return !!e && (!!e.up || !!e.right || e.fire.length > 0 || e.mine.length > 0 || e.smoke.length > 0 || e.gren.length > 0);
}
function bindState(gp: Gamepad | null, p: number): string {
  const e = effBind(gp, p);
  if (!ebound(e)) return "未绑定";
  return e && e.custom ? "自定义" : "默认";
}
function splitStatus(): string {
  const all = listPads();
  if (!splitActive(all)) return "拆分：无（" + (all.length === 1 ? "单个手柄，不是 Joy-Con 合并手柄" : all.length + " 个手柄") + "）";
  return "拆分：自动开" + (splitOn ? "（强制）" : "") + "（玩家1" + bindState(all[0], 0) + "，玩家2" + bindState(all[0], 1) + "；横握方向 P1=" + ROT_TXT[rots[0]] + " P2=" + ROT_TXT[rots[1]] + "）";
}

function splitPad(gp: Gamepad, b: EBind | null, rot: number): PadIn {
  const none: PadIn = { dx: 0, dy: 0, fire: false, mine: false, smoke: false, gren: false };
  if (!b) return none;
  const val = (a: AxB | null): number => {
    if (!a) return 0;
    const v = gp.axes[a.axis];
    return typeof v === "number" && !isNaN(v) ? (v - a.rest) * a.sign : 0;
  };
  const btn = (ns: number[]): boolean => {
    for (const n of ns) if (n >= 0 && !!gp.buttons[n] && gp.buttons[n].pressed) return true;
    return false;
  };
  let ax = val(b.right);
  let ay = -val(b.up);
  const mag = Math.hypot(ax, ay);
  if (mag < 0.4) {
    ax = 0;
    ay = 0;
  } else {
    ax /= mag;
    ay /= mag;
  }
  if (b.dpad.length === 4) {
    const d = (n: number): number => (!!gp.buttons[n] && gp.buttons[n].pressed ? 1 : 0);
    ax += d(b.dpad[3]) - d(b.dpad[2]);
    ay += d(b.dpad[1]) - d(b.dpad[0]);
    const m2 = Math.hypot(ax, ay);
    if (m2 > 1) {
      ax /= m2;
      ay /= m2;
    }
  }
  const rv = rotate(ax, ay, rot);
  ax = rv[0];
  ay = rv[1];
  return { dx: ax, dy: ay, fire: btn(b.fire), mine: btn(b.mine), smoke: btn(b.smoke), gren: btn(b.gren) };
}

function readPads(): PadIn[] {
  const out: PadIn[] = [];
  const all = listPads();
  if (splitActive(all)) {
    out.push(splitPad(all[0], effBind(all[0], 0), rots[0]));
    out.push(splitPad(all[0], effBind(all[0], 1), rots[1]));
    return out;
  }
  for (const gp of all) {
    const b = (n: number): boolean => !!gp.buttons[n] && gp.buttons[n].pressed;
    let ax = gp.axes.length > 0 ? gp.axes[0] : 0;
    let ay = gp.axes.length > 1 ? gp.axes[1] : 0;
    if (typeof ax !== "number" || isNaN(ax)) ax = 0;
    if (typeof ay !== "number" || isNaN(ay)) ay = 0;
    const mag = Math.hypot(ax, ay);
    if (mag < 0.4) {
      ax = 0;
      ay = 0;
    } else {
      ax /= mag;
      ay /= mag;
    }
    if (gp.mapping === "standard" || gp.buttons.length >= 16) {
      if (b(14)) ax = -1;
      if (b(15)) ax = 1;
      if (b(12)) ay = -1;
      if (b(13)) ay = 1;
    }
    if (gp.mapping !== "standard" && gp.axes.length > 9) {
      const h = hatDir(gp.axes[9]);
      if (h) {
        ax = h[0];
        ay = h[1];
      }
    }
    out.push({ dx: ax, dy: ay, fire: b(0) || b(1) || b(6) || b(7), mine: b(2), smoke: b(3), gren: b(4) || b(5) });
  }
  return out;
}

interface Wiz {
  pi: number;
  last: number;
  si: number;
  bind: Bind;
  base: number[] | null;
  ignoreBtn: boolean[];
  waitRel: boolean;
  summary: boolean;
  msg: string;
}
function emptyBind(): Bind {
  return { up: null, right: null, fire: -1, mine: -1, smoke: -1, gren: -1 };
}
function newWiz(first: number, last: number): Wiz {
  return { pi: first, last, si: 0, bind: emptyBind(), base: null, ignoreBtn: [], waitRel: true, summary: false, msg: "" };
}
function boundButtons(b: Bind | null): number[] {
  return b ? [b.fire, b.mine, b.smoke, b.gren].filter((n) => n >= 0) : [];
}
function boundAxes(b: Bind | null): number[] {
  const r: number[] = [];
  if (b && b.up) r.push(b.up.axis);
  if (b && b.right) r.push(b.right.axis);
  return r;
}
function ebtns(e: EBind | null): number[] {
  return e ? e.fire.concat(e.mine, e.smoke, e.gren, e.dpad) : [];
}
function eaxes(e: EBind | null): number[] {
  const r: number[] = [];
  if (e && e.up) r.push(e.up.axis);
  if (e && e.right) r.push(e.right.axis);
  return r;
}
function wizAdvance(w: Wiz): boolean {
  // returns true when the whole wizard is finished
  w.si += 1;
  w.waitRel = true;
  if (w.si >= STEPS.length) {
    binds[w.pi] = bound(w.bind) ? w.bind : binds[w.pi];
    w.pi += 1;
    w.si = 0;
    w.bind = emptyBind();
    w.base = null;
    if (w.pi > w.last) {
      w.summary = true;
      saveSplit();
      return true;
    }
  }
  return false;
}
function wizTick(w: Wiz, gp: Gamepad): boolean {
  if (w.summary) return false;
  if (!w.base) {
    w.base = [];
    for (let i = 0; i < gp.axes.length; i++) w.base.push(typeof gp.axes[i] === "number" && !isNaN(gp.axes[i]) ? gp.axes[i] : 0);
    w.ignoreBtn = [];
    for (let i = 0; i < gp.buttons.length; i++) w.ignoreBtn.push(!!gp.buttons[i] && gp.buttons[i].pressed);
    w.waitRel = true;
  }
  const base = w.base;
  const other = effBind(gp, w.pi === 0 ? 1 : 0);
  const usedAxes = eaxes(other).concat(boundAxes(w.bind));
  const usedBtns = ebtns(other).concat(boundButtons(w.bind));
  const dAxis = (i: number): number => {
    const v = gp.axes[i];
    return (typeof v === "number" && !isNaN(v) ? v : 0) - (base[i] || 0);
  };
  let anyBtn = -1;
  for (let i = 0; i < gp.buttons.length; i++) {
    if (!w.ignoreBtn[i] && gp.buttons[i] && gp.buttons[i].pressed && usedBtns.indexOf(i) < 0) {
      anyBtn = i;
      break;
    }
  }
  let bestAxis = -1;
  let bestV = 0;
  for (let i = 0; i < gp.axes.length; i++) {
    if (usedAxes.indexOf(i) >= 0) continue;
    const d = dAxis(i);
    if (Math.abs(d) > Math.abs(bestV)) {
      bestV = d;
      bestAxis = i;
    }
  }
  if (w.waitRel) {
    let anyDown = false;
    for (let i = 0; i < gp.buttons.length; i++) if (!w.ignoreBtn[i] && gp.buttons[i] && gp.buttons[i].pressed) anyDown = true;
    if (!anyDown && Math.abs(bestV) < 0.3) w.waitRel = false;
    return false;
  }
  const st = STEPS[w.si];
  if (st === "up" || st === "right") {
    if (bestAxis >= 0 && Math.abs(bestV) > 0.6) {
      const ab: AxB = { axis: bestAxis, sign: bestV > 0 ? 1 : -1, rest: base[bestAxis] || 0 };
      if (st === "up") w.bind.up = ab;
      else w.bind.right = ab;
      return wizAdvance(w);
    }
  } else if (anyBtn >= 0) {
    if (st === "fire") w.bind.fire = anyBtn;
    else if (st === "mine") w.bind.mine = anyBtn;
    else if (st === "smoke") w.bind.smoke = anyBtn;
    else w.bind.gren = anyBtn;
    return wizAdvance(w);
  }
  return false;
}
function bindTxt(b: EBind | null): string {
  if (!b || !ebound(b)) return "未绑定";
  const ax = (a: AxB | null): string => (a ? "轴" + a.axis + (a.sign > 0 ? "(+)" : "(-)") : "无");
  const bt = (n: number[]): string => (n.length > 0 ? n.map((x) => "B" + x).join("/") : "无");
  return "上=" + ax(b.up) + "　右=" + ax(b.right) + "　开炮=" + bt(b.fire) + "　地雷=" + bt(b.mine) + "　烟雾=" + bt(b.smoke) + "　手雷=" + bt(b.gren) + (b.dpad.length ? "　十字键=移动" : "");
}
function padLive(): string {
  if (lastPads.length === 0) return "";
  const names: [string, string][] = [["开炮", "fire"], ["地雷", "mine"], ["烟雾", "smoke"], ["手雷", "gren"]];
  return lastPads.map((p, i) => {
    const on = names.filter((n) => (p as unknown as Record<string, boolean>)[n[1]]).map((n) => n[0]);
    return "输入P" + (i + 1) + "：dx=" + p.dx.toFixed(2) + " dy=" + p.dy.toFixed(2) + " 按下[" + (on.join(" ") || "无") + "]";
  }).join("　");
}

function padDebug(): string {
  const pads = listPads();
  if (pads.length === 0) return "手柄调试：0 个手柄（配对后按一下手柄任意键）";
  const gp = pads[0];
  const pressed: string[] = [];
  for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i] && gp.buttons[i].pressed) pressed.push("B" + i);
  const axes: string[] = [];
  for (let i = 0; i < gp.axes.length; i++) {
    const v = gp.axes[i];
    if (typeof v === "number" && Math.abs(v) > 0.2) axes.push("A" + i + "=" + v.toFixed(2));
  }
  return "手柄调试：" + pads.length + " 个手柄；第一个 id=" + gp.id + "；mapping=" + (gp.mapping || "(空)") + "；按钮数=" + gp.buttons.length + "，轴数=" + gp.axes.length + "；按下：" + (pressed.join(" ") || "无") + "；轴：" + (axes.join(" ") || "无");
}

function el(tag: string, css: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}
function mkBtn(label: string, primary: boolean, onClick: () => void): HTMLElement {
  const b = el("button", "font:inherit;font-size:15px;padding:10px 18px;border-radius:12px;cursor:pointer;border:1px solid " + (primary ? "#6d4aff" : "#cfcbe3") + ";background:" + (primary ? "#6d4aff" : "#ffffff") + ";color:" + (primary ? "#ffffff" : "#2b2547"), label);
  b.addEventListener("click", onClick);
  return b;
}

function boot(): void {
  let phase: Phase = "menu";
  let mode: Mode = "ai";
  let result = "";
  let game: Game = newGame("ai");
  const keys = new Set<string>();
  let winSide = -1;
  let cel = 0;
  let winTxt: string[] = ["", ""];
  let padN = 0;
  let wiz: Wiz | null = null;
  let wizSig = "";
  let padSig = "";
  let introGame: Game | null = null;
  let introN = 99;
  let testOpen = false;
  let testEl: HTMLElement | null = null;
  let testSig = "";
  let testPanels: TPanel[] = [];
  let testOther: HTMLElement | null = null;
  let testBind: HTMLElement | null = null;
  let testMsg: HTMLElement | null = null;
  let testPanelsBox: HTMLElement | null = null;
  loadSplit();
  loadRot();
  audLoad();
  sfxHook = audSfx;
  let roundTimer = 0;

  document.title = "坦克大战 · 萌萌对战";
  document.body.style.cssText = "margin:0;background:#f6f5fb;color:#2b2547;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',Arial,sans-serif";
  const root = el("div", "padding:16px;display:flex;flex-direction:column;align-items:center;gap:12px;min-height:100vh;box-sizing:border-box");
  document.body.appendChild(root);
  const stage = el("div", "position:relative;width:100%;max-width:880px");
  root.appendChild(stage);
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = (H + HUD) * 2;
  canvas.style.cssText = "width:100%;height:auto;aspect-ratio:" + W + "/" + (H + HUD) + ";display:block;border-radius:16px;border:1px solid #dcd8ee";
  stage.appendChild(canvas);
  const overlay = el("div", "position:absolute;top:0;left:0;right:0;bottom:0;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center");
  stage.appendChild(overlay);
  const bar = el("div", "width:100%;max-width:880px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap");
  root.appendChild(bar);
  const hintEl = el("div", "color:#5a5478;font-size:14px;flex:1;min-width:220px;line-height:1.5");
  bar.appendChild(hintEl);
  const menuBtn = mkBtn("回到菜单", false, () => toMenu());
  bar.appendChild(menuBtn);
  const dbg = el("div", "width:100%;max-width:880px;color:#7a7498;font-size:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all;line-height:1.5;white-space:pre-line");
  const dbgBox = document.createElement("details");
  dbgBox.style.cssText = "width:100%;max-width:880px;font-size:11px;color:#8a85a6";
  const dsum = document.createElement("summary");
  dsum.textContent = "调试信息";
  dsum.style.cssText = "cursor:pointer;font-size:11px;color:#8a85a6";
  dbgBox.appendChild(dsum);
  dbgBox.appendChild(dbg);
  root.appendChild(dbgBox);
  let dbgLast = "";

  const hintAi = "你：W A S D 或方向键移动，空格或回车开炮，E 埋地雷，Q 放烟雾弹，R 扔手雷（落地后被碰到才开始倒计时）。三局两胜。手柄（Joy-Con 合并时用左手）：十字键或左摇杆移动，ZL 开炮，L 手雷，减号地雷，按下左摇杆烟雾（具体看“手柄测试”）。";
  const hintTwo = "玩家1：W A S D 移动，空格开炮，E 地雷，Q 烟雾，R 手雷。玩家2：方向键移动，回车开炮，句号键地雷，逗号键烟雾，分号键手雷。三局两胜。手柄（左右 Joy-Con 合并时）：左手=玩家1：十字键或摇杆移动，ZL 开炮，L 手雷，减号地雷，按下摇杆烟雾；右手=玩家2：右摇杆移动，ZR、A、B 开炮，Y 地雷，X 烟雾，R 手雷。";

  function render(): void {
    hintEl.textContent = mode === "ai" ? hintAi : hintTwo;
    menuBtn.style.display = phase === "play" ? "" : "none";
    overlay.style.display = phase === "play" ? "none" : "flex";
    overlay.style.alignItems = phase === "over" ? "flex-end" : "center";
    overlay.textContent = "";
    if (phase === "play") return;
    overlay.appendChild(el("div", "position:absolute;top:0;left:0;right:0;bottom:0;background:#f6f5fb;opacity:" + (phase === "over" ? 0 : 0.88)));
    const box = el("div", "position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px;text-align:center");
    overlay.appendChild(box);
    const btns = el("div", "display:flex;gap:12px;flex-wrap:wrap;justify-content:center");
    if (phase === "menu") {
      box.appendChild(el("div", "font-size:30px;font-weight:600", "萌萌坦克大战"));
      box.appendChild(el("div", "color:#5a5478;font-size:14px;line-height:1.5", "三局两胜，每局每人一条命，先打爆对手的坦克就赢，每局换新地图。每人自带 1 颗地雷、1 个烟雾弹、1 颗手雷。木箱一发就碎，紫色石墙挡得住子弹。地上会刷出两种东西：外观一模一样的“?”盲盒，开出来可能加速、双发、三连发、护盾、多一条命、穿墙弹、反弹弹、追踪弹、地雷、烟雾弹、手雷，也可能变慢、哑火、被冻住或方向反过来；还有画着骷髅的绿色毒药，吃了直接死亡，千万别碰。"));
      btns.appendChild(mkBtn("人机对战（你 对 电脑）", true, () => start("ai")));
      btns.appendChild(mkBtn("双人对战（两人一个键盘）", false, () => start("two")));
      box.appendChild(btns);
      box.appendChild(el("div", "color:#8a85a6;font-size:12px", "先点一下游戏画面，再用键盘操作"));
      const ps = el("div", "font-size:13px;white-space:pre-line;line-height:1.6;color:" + (padN > 0 ? "#2b2547" : "#8a85a6"));
      ps.id = "padstatus";
      ps.textContent = padStatusText();
      box.appendChild(ps);
      const tb = mkBtn("手柄测试", false, () => openTest());
      tb.id = "testbtn";
      box.appendChild(tb);
    } else {
      if (phase !== "over") box.appendChild(el("div", "font-size:30px;font-weight:600", result));
      if (phase === "round") {
        box.appendChild(el("div", "color:#5a5478;font-size:14px", "马上换新地图，准备好…"));
      } else {
        btns.appendChild(mkBtn("再来一场", true, () => start(mode)));
        btns.appendChild(mkBtn("回到菜单", false, () => toMenu()));
        box.appendChild(btns);
      }
    }
  }
  function padStatusText(): string {
    if (splitActive(listPads())) return "已检测到手柄：系统把左右 Joy-Con 合并成一个，游戏已自动拆成：左手=玩家1，右手=玩家2\n人机对战用左手 Joy-Con。想看看摇杆和按键有没有反应，点下面的“手柄测试”。";
    if (padN >= 2) return "已检测到 " + padN + " 个手柄：手柄1=玩家1，手柄2=玩家2";
    return padN > 0 ? "已检测到手柄，可以直接玩" : "手柄：先在电脑蓝牙里配对，再按一下手柄上任意键，这里就会显示“已检测到手柄”";
  }

  const LEFT_CHIPS: [number, string][] = [[12, "十字键上"], [13, "十字键下"], [14, "十字键左"], [15, "十字键右"], [4, "L"], [6, "ZL"], [8, "－"], [10, "摇杆按下"]];
  const RIGHT_CHIPS: [number, string][] = [[1, "A"], [0, "B"], [3, "X"], [2, "Y"], [5, "R"], [7, "ZR"], [9, "＋"], [11, "摇杆按下"]];
  const ACT_NAMES: [keyof EBind, string][] = [["fire", "开炮"], ["mine", "地雷"], ["smoke", "烟雾"], ["gren", "手雷"]];

  function actOf(e: EBind | null, idx: number): string {
    if (!e) return "";
    const r: string[] = [];
    if (e.dpad.indexOf(idx) >= 0) r.push("移动");
    for (const an of ACT_NAMES) {
      const arr = e[an[0]] as number[];
      if (arr.indexOf(idx) >= 0) r.push(an[1]);
    }
    return r.join("、");
  }
  function mkPanel(title: string, chips: [number, string][], p: number): TPanel {
    const root2 = el("div", "background:#fff;border-radius:16px;padding:16px;min-width:300px;flex:1;max-width:460px;box-shadow:0 2px 10px rgba(80,70,140,.12);display:flex;flex-direction:column;align-items:center;gap:10px");
    root2.appendChild(el("div", "font-size:20px;font-weight:600", title));
    const ring = el("div", "position:relative;width:130px;height:130px;border-radius:50%;border:3px solid #cfc9e8;background:#faf9ff");
    ring.appendChild(el("div", "position:absolute;left:50%;top:0;bottom:0;width:1px;background:#e4e0f4"));
    ring.appendChild(el("div", "position:absolute;top:50%;left:0;right:0;height:1px;background:#e4e0f4"));
    const dot = el("div", "position:absolute;width:22px;height:22px;border-radius:50%;background:#7c5cff;left:54px;top:54px");
    ring.appendChild(dot);
    root2.appendChild(ring);
    const info = el("div", "font-size:11px;color:#8a85a6;font-family:ui-monospace,Menlo,monospace");
    root2.appendChild(info);
    const grid = el("div", "display:flex;flex-wrap:wrap;gap:8px;justify-content:center");
    const els: TChip[] = [];
    for (const c of chips) {
      const box2 = el("div", "min-width:76px;padding:6px 8px;border-radius:10px;border:2px solid #e4e0f4;background:#faf9ff;text-align:center;line-height:1.3");
      const nm = el("div", "font-size:15px;font-weight:600", c[1]);
      const raw = el("div", "font-size:10px;color:#8a85a6", "#" + c[0]);
      const ac = el("div", "font-size:10px;color:#5a5478;min-height:12px");
      box2.appendChild(nm);
      box2.appendChild(raw);
      box2.appendChild(ac);
      grid.appendChild(box2);
      els.push({ idx: c[0], box: box2, act: ac });
    }
    root2.appendChild(grid);
    let sel: HTMLSelectElement | null = null;
    if (p >= 0) {
      const row = el("label", "font-size:14px;display:flex;gap:8px;align-items:center");
      row.appendChild(document.createTextNode("横握方向"));
      sel = document.createElement("select");
      sel.id = "rot" + p;
      for (let i = 0; i < 4; i++) {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = ROT_TXT[i];
        sel.appendChild(o);
      }
      sel.value = String(rots[p]);
      const sl = sel;
      sel.addEventListener("change", () => {
        rots[p] = parseInt(sl.value, 10) & 3;
        saveRot();
      });
      row.appendChild(sel);
      root2.appendChild(row);
      root2.appendChild(el("div", "font-size:11px;color:#8a85a6", "圆点就是坦克会走的方向。推摇杆“向前”时圆点没往上，就换一个横握方向。"));
    }
    return { root: root2, dot, info, chips: els, sel };
  }
  function openTest(): void {
    testOpen = true;
    testSig = "";
    if (!testEl) {
      testEl = el("div", "position:fixed;top:0;left:0;right:0;bottom:0;z-index:40;background:#f6f5fb;overflow:auto;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:14px");
      testEl.id = "padtest";
      const top = el("div", "display:flex;align-items:center;gap:16px;width:100%;max-width:980px;justify-content:space-between");
      top.appendChild(el("div", "font-size:26px;font-weight:600", "手柄测试"));
      const back = mkBtn("返回游戏", true, () => closeTest());
      back.id = "testback";
      top.appendChild(back);
      testEl.appendChild(top);
      testMsg = el("div", "font-size:14px;color:#2b2547;line-height:1.6;max-width:980px;width:100%;white-space:pre-line");
      testEl.appendChild(testMsg);
      testPanelsBox = el("div", "display:flex;gap:16px;flex-wrap:wrap;justify-content:center;width:100%;max-width:980px");
      testEl.appendChild(testPanelsBox);
      testOther = el("div", "font-size:13px;color:#5a5478;max-width:980px;width:100%;line-height:1.6");
      testEl.appendChild(testOther);
      const adv = document.createElement("details");
      adv.id = "advanced";
      adv.style.cssText = "max-width:980px;width:100%;font-size:13px;color:#5a5478";
      const asum = document.createElement("summary");
      asum.textContent = "高级：重新绑定";
      asum.style.cssText = "cursor:pointer;font-size:13px;color:#8a85a6";
      adv.appendChild(asum);
      const arow = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin:10px 0");
      const wb = mkBtn("设置按键", false, () => openWiz(0, 1));
      wb.id = "wizbtn";
      arow.appendChild(wb);
      const w1 = mkBtn("只设置玩家1", false, () => openWiz(0, 0));
      w1.id = "wiz1";
      arow.appendChild(w1);
      const w2 = mkBtn("只设置玩家2", false, () => openWiz(1, 1));
      w2.id = "wiz2";
      arow.appendChild(w2);
      const rb = mkBtn("恢复默认", false, () => {
        binds = [null, null];
        rots = [0, 0];
        saveSplit();
        saveRot();
        testSig = "";
      });
      rb.id = "resetbtn";
      arow.appendChild(rb);
      adv.appendChild(arow);
      const fl = el("label", "display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "splitcb";
      cb.checked = splitOn;
      cb.addEventListener("change", () => {
        splitOn = cb.checked;
        saveSplit();
      });
      fl.appendChild(cb);
      fl.appendChild(document.createTextNode("强制拆分（只有一个不是 Joy-Con 的手柄时才需要）"));
      adv.appendChild(fl);
      testBind = el("div", "font-size:11px;color:#8a85a6;white-space:pre-line;line-height:1.5");
      adv.appendChild(testBind);
      testEl.appendChild(adv);
      root.appendChild(testEl);
    }
    testEl.style.display = "flex";
    updateTest(listPads());
  }
  function closeTest(): void {
    testOpen = false;
    if (testEl) testEl.style.display = "none";
  }
  function setPanel(pn: TPanel, gp: Gamepad, vx: number, vy: number, ax: string, e: EBind | null): void {
    pn.dot.style.left = 54 + vx * 44 + "px";
    pn.dot.style.top = 54 + vy * 44 + "px";
    pn.info.textContent = ax;
    for (const c of pn.chips) {
      const on = !!gp.buttons[c.idx] && gp.buttons[c.idx].pressed;
      c.box.style.background = on ? "#7c5cff" : "#faf9ff";
      c.box.style.color = on ? "#fff" : "#2b2547";
      c.box.style.borderColor = on ? "#5b3df5" : "#e4e0f4";
      c.act.style.color = on ? "#fff" : "#5a5478";
      c.act.textContent = actOf(e, c.idx);
    }
  }
  function updateTest(all: Gamepad[]): void {
    if (!testEl || !testPanelsBox || !testOther || !testMsg) return;
    const split = splitActive(all);
    const sig = split ? "split" : "n" + all.length + ":" + (all[0] ? all[0].buttons.length : 0) + ":" + (all[1] ? all[1].buttons.length : 0);
    if (sig !== testSig) {
      testSig = sig;
      testPanelsBox.textContent = "";
      testPanels = [];
      if (split) {
        testPanels.push(mkPanel("左手 Joy-Con（玩家1）", LEFT_CHIPS, 0));
        testPanels.push(mkPanel("右手 Joy-Con（玩家2）", RIGHT_CHIPS, 1));
      } else {
        for (let i = 0; i < Math.min(2, all.length); i++) {
          const ch: [number, string][] = [];
          for (let k = 0; k < all[i].buttons.length; k++) ch.push([k, "按钮" + k]);
          testPanels.push(mkPanel("手柄" + (i + 1) + "（玩家" + (i + 1) + "）", ch, -1));
        }
      }
      for (const pn of testPanels) testPanelsBox.appendChild(pn.root);
    }
    if (all.length === 0) {
      testMsg.textContent = "还没有检测到手柄。先在电脑蓝牙里配对，再按一下手柄上任意键。";
      testOther.textContent = "";
    } else if (split) {
      testMsg.textContent = "系统把左右 Joy-Con 合并成一个，游戏已自动拆开：左手=玩家1，右手=玩家2。按一下按键，对应的格子会亮。";
      const gp = all[0];
      const e0 = effBind(gp, 0);
      const e1 = effBind(gp, 1);
      const pd = lastPads;
      const fx = (n: number): string => (n >= 0 ? "+" : "") + n.toFixed(2);
      const ax = (i: number): number => (gp.axes[i] === undefined ? 0 : gp.axes[i]);
      setPanel(testPanels[0], gp, pd[0] ? pd[0].dx : 0, pd[0] ? pd[0].dy : 0, "原始摇杆 轴0=" + fx(ax(0)) + " 轴1=" + fx(ax(1)), e0);
      setPanel(testPanels[1], gp, pd[1] ? pd[1].dx : 0, pd[1] ? pd[1].dy : 0, "原始摇杆 轴2=" + fx(ax(2)) + " 轴3=" + fx(ax(3)), e1);
      testPanels[0].sel && (testPanels[0].sel.value = String(rots[0]));
      testPanels[1].sel && (testPanels[1].sel.value = String(rots[1]));
      const known: number[] = [];
      for (const c of LEFT_CHIPS) known.push(c[0]);
      for (const c of RIGHT_CHIPS) known.push(c[0]);
      const pressed: string[] = [];
      const own: string[] = [];
      for (let k = 0; k < gp.buttons.length; k++) {
        if (known.indexOf(k) >= 0) continue;
        own.push("#" + k);
        if (gp.buttons[k].pressed) pressed.push("#" + k);
      }
      const extraAx: string[] = [];
      for (let k = 4; k < gp.axes.length; k++) if (Math.abs(gp.axes[k]) > 0.3) extraAx.push("轴" + k + "=" + fx(gp.axes[k]));
      testOther.textContent = "其他按键（不属于左右两边）：" + (own.length ? own.join(" ") : "无") + "　现在按下：" + (pressed.length || extraAx.length ? pressed.concat(extraAx).join(" ") : "无") + "。要是 Home、截图、＋ 没反应，按住它们，把这里显示的编号告诉我。";
    } else {
      testMsg.textContent = all.length === 1 ? "当前这个手柄不是合并的 Joy-Con，按普通手柄处理，下面显示它原始的按钮和摇杆。" : "检测到 2 个手柄：手柄1=玩家1，手柄2=玩家2。下面显示它们原始的按钮和摇杆。";
      for (let i = 0; i < testPanels.length; i++) {
        const gp = all[i];
        const hx = gp.axes.length > 0 ? gp.axes[0] : 0;
        const hy = gp.axes.length > 1 ? gp.axes[1] : 0;
        setPanel(testPanels[i], gp, hx, hy, "轴0=" + hx.toFixed(2) + " 轴1=" + hy.toFixed(2), null);
      }
      testOther.textContent = "";
    }
    if (testBind) {
      const gp0 = all[0] || null;
      testBind.textContent = split ? "玩家1 " + bindTxt(effBind(gp0, 0)) + "\n玩家2 " + bindTxt(effBind(gp0, 1)) : "";
    }
  }
  function setPhase(p: Phase): void {
    phase = p;
    window.clearTimeout(roundTimer);
    if (p === "round") roundTimer = window.setTimeout(() => nextRound(), 2200);
    if (p === "menu") audMusic("menu");
    else if (p === "play" || p === "round") audMusic("battle");
    else {
      audMusic("none");
      window.setTimeout(() => {
        if (phase === "over") audMusic("menu");
      }, 4200);
    }
    render();
  }
  function start(m: Mode): void {
    keys.clear();
    game = newGame(m);
    mode = m;
    result = "";
    setPhase("play");
  }
  function nextRound(): void {
    const g0 = game;
    keys.clear();
    game = newGame(g0.mode, g0.score, g0.round + 1);
    result = "";
    setPhase("play");
  }
  function toMenu(): void {
    keys.clear();
    game = newGame(mode);
    game.intro = 0;
    setPhase("menu");
  }


  // ---------- sound control ----------
  const sndBox = el("div", "position:fixed;right:10px;bottom:10px;z-index:60;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12px;color:#2b2547");
  sndBox.id = "sndbox";
  const sndPop = el("div", "display:none;background:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 2px 12px rgba(80,70,140,.25);flex-direction:column;gap:8px;min-width:170px");
  const mkSlider = (label: string, id: string, get: () => number, set: (v: number) => void): void => {
    const row = el("label", "display:flex;align-items:center;gap:8px;justify-content:space-between");
    row.appendChild(document.createTextNode(label));
    const sl = document.createElement("input");
    sl.type = "range";
    sl.min = "0";
    sl.max = "100";
    sl.id = id;
    sl.value = String(Math.round(get() * 100));
    sl.style.cssText = "width:100px";
    sl.addEventListener("input", () => {
      set(parseInt(sl.value, 10) / 100);
      audSave();
      audApply();
      audEnsure();
    });
    sl.addEventListener("change", () => sl.blur());
    row.appendChild(sl);
    sndPop.appendChild(row);
  };
  mkSlider("音乐", "musicvol", () => AUD.mv, (v) => (AUD.mv = v));
  mkSlider("音效", "sfxvol", () => AUD.sv, (v) => (AUD.sv = v));
  sndBox.appendChild(sndPop);
  const sndRow = el("div", "display:flex;align-items:center;gap:6px");
  const sndHint = el("div", "background:#fff7d6;color:#7a5b00;border-radius:10px;padding:5px 9px;box-shadow:0 1px 6px rgba(80,70,140,.2);display:none", "点一下页面开启声音");
  sndHint.id = "sndhint";
  sndRow.appendChild(sndHint);
  const sndCss = "border:0;border-radius:18px;background:#fff;box-shadow:0 1px 6px rgba(80,70,140,.25);height:36px;cursor:pointer;font-size:18px;padding:0 10px;color:#2b2547";
  const sndMenu = document.createElement("button");
  sndMenu.id = "sndmenu";
  sndMenu.textContent = "▾";
  sndMenu.title = "音量";
  sndMenu.style.cssText = sndCss;
  sndMenu.addEventListener("click", () => {
    sndPop.style.display = sndPop.style.display === "none" ? "flex" : "none";
    sndMenu.blur();
  });
  sndRow.appendChild(sndMenu);
  const sndBtn = document.createElement("button");
  sndBtn.id = "sndbtn";
  sndBtn.style.cssText = sndCss;
  sndBtn.addEventListener("click", () => {
    audSetOn(!AUD.on);
    updateSndUi();
    sndBtn.blur();
  });
  sndRow.appendChild(sndBtn);
  sndBox.appendChild(sndRow);
  document.body.appendChild(sndBox);
  function updateSndUi(): void {
    sndBtn.textContent = AUD.on ? "🔊" : "🔇";
    sndBtn.title = AUD.on ? "声音开（按 M 静音）" : "声音关（按 M 开启）";
    const running = !!AUD.ctx && AUD.ctx.state === "running";
    sndHint.style.display = AUD.on && !running && !document.hidden ? "block" : "none";
  }
  updateSndUi();

  const wizEl = el("div", "position:fixed;top:0;left:0;right:0;bottom:0;z-index:50;background:rgba(246,245,251,0.98);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;box-sizing:border-box");
  wizEl.id = "wizard";
  document.body.appendChild(wizEl);
  let wizDbg: HTMLElement | null = null;
  function wizSignature(): string {
    return wiz ? wiz.pi + "/" + wiz.si + "/" + (wiz.summary ? 1 : 0) : "";
  }
  function renderWiz(): void {
    wizEl.textContent = "";
    if (!wiz) {
      wizEl.style.display = "none";
      return;
    }
    wizEl.style.display = "flex";
    const w = wiz;
    wizEl.appendChild(el("div", "font-size:28px;font-weight:600", "Joy-Con 按键设置"));
    if (w.summary) {
      wizEl.appendChild(el("div", "font-size:18px", "设置完成，已保存"));
      wizEl.appendChild(el("div", "font-size:14px;line-height:1.8;white-space:pre-line;color:#2b2547", "玩家1（左手）：" + bindTxt(effBind(listPads()[0] || null, 0)) + "\n玩家2（右手）：" + bindTxt(effBind(listPads()[0] || null, 1)) + "\n（跳过的项目沿用默认按键）"));
      wizEl.appendChild(mkBtn("完成", true, () => closeWiz()));
    } else {
      const who = w.pi === 0 ? "玩家1（左手 Joy-Con）" : "玩家2（右手 Joy-Con）";
      wizEl.appendChild(el("div", "font-size:16px;color:#5a5478", who + "　第 " + (w.si + 1) + "/" + STEPS.length + " 步"));
      const pr = el("div", "font-size:34px;font-weight:700;color:#6d4aff", STEP_TXT[w.si]);
      pr.id = "wizprompt";
      wizEl.appendChild(pr);
      wizEl.appendChild(el("div", "font-size:13px;color:#5a5478;max-width:640px;line-height:1.6", "把这个 Joy-Con 横握在手里，按你拿着时看到的方向操作；松开后才会进入下一步。上一步用过的按键不会重复识别。“跳过这一步”会保持默认按键。"));
      const row = el("div", "display:flex;gap:12px;flex-wrap:wrap;justify-content:center");
      row.appendChild(mkBtn("跳过这一步", false, () => {
        if (wiz && !wiz.summary) {
          const fin = wizAdvance(wiz);
          if (fin) wiz.waitRel = false;
          wizSig = wizSignature();
          renderWiz();
        }
      }));
      row.appendChild(mkBtn("重来（这个玩家）", false, () => {
        if (wiz) {
          wiz.si = 0;
          wiz.bind = emptyBind();
          wiz.base = null;
          wiz.waitRel = true;
          wizSig = wizSignature();
          renderWiz();
        }
      }));
      row.appendChild(mkBtn("取消 (Esc)", false, () => closeWiz()));
      wizEl.appendChild(row);
    }
    wizDbg = el("div", "max-width:880px;color:#7a7498;font-size:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all;line-height:1.5;margin-top:12px;white-space:pre-line");
    wizDbg.id = "wizdbg";
    wizDbg.textContent = dbgLast;
    wizEl.appendChild(wizDbg);
  }
  function openWiz(first: number, last: number): void {
    wiz = newWiz(first, last);
    wizSig = wizSignature();
    renderWiz();
  }
  function closeWiz(): void {
    wiz = null;
    wizDbg = null;
    renderWiz();
    render();
  }

  const block = ["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Slash"];
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (wiz && e.code === "Escape") {
      closeWiz();
      return;
    }
    if (e.code === "KeyM" && !e.repeat) {
      audSetOn(!AUD.on);
      updateSndUi();
    }
    if (testOpen && e.code === "Escape") {
      closeTest();
      return;
    }
    if (phase === "play" && block.indexOf(e.code) >= 0) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener("keyup", (e: KeyboardEvent) => {
    keys.delete(e.code);
  });
  window.addEventListener("blur", () => keys.clear());
  let evNote = "";
  window.addEventListener("gamepadconnected", (e: Event) => {
    evNote = "事件：手柄已连接 " + (e as GamepadEvent).gamepad.id;
  });
  window.addEventListener("gamepaddisconnected", (e: Event) => {
    evNote = "事件：手柄已断开 " + (e as GamepadEvent).gamepad.id;
  });

  let last = performance.now();
  let dbgT = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const g = game;
    const playing = phase === "play";
    const pads = readPads();
    lastPads = pads;
    const rawN = listPads().length;
    if (wiz && !wiz.summary) {
      const all = listPads();
      if (all.length > 0) wizTick(wiz, all[0]);
      if (wizSignature() !== wizSig) {
        wizSig = wizSignature();
        renderWiz();
      }
    }
    if (rawN > 0 && (!AUD.ctx || AUD.ctx.state !== "running")) {
      for (const gp of listPads()) {
        let any = false;
        for (let k = 0; k < gp.buttons.length; k++) if (gp.buttons[k] && gp.buttons[k].pressed) any = true;
        if (any) audEnsure();
      }
    }
    if (g !== introGame) {
      introGame = g;
      introN = 99;
    }
    if (playing && g.time > 0 && g.intro > 0) {
      const n = Math.max(0, Math.ceil(g.intro - 0.4));
      if (n !== introN && n <= 3) {
        introN = n;
        audSfx(n > 0 ? "tick" : "go");
      }
    }
    const sigNow = rawN + "/" + (splitActive(listPads()) ? 1 : 0);
    if (sigNow !== padSig) {
      padSig = sigNow;
      padN = rawN;
      if (phase === "menu" && !wiz) render();
    }
    const res = step(g, dt, keys, playing, pads);
    if (res !== null) {
      const sc = g.score;
      if (res === "W0") sc[0] += 1;
      else if (res === "W1") sc[1] += 1;
      const nm = g.mode === "ai" ? ["你", "电脑"] : ["玩家1", "玩家2"];
      const done = sc[0] >= 2 || sc[1] >= 2;
      let txt = "";
      if (done) {
        const w = sc[0] >= 2 ? 0 : 1;
        txt = g.mode === "ai" ? (w === 0 ? "你赢下了整场比赛！" : "电脑赢下了整场比赛！") : nm[w] + " 赢下了整场比赛！";
        winSide = w;
        cel = 0;
        winTxt = [txt, "最终比分 " + sc[0] + " : " + sc[1]];
      } else {
        txt = res === "WD" ? "这一局平局" : nm[res === "W0" ? 0 : 1] + " 赢下这一局";
      }
      audSfx(done ? "fanfare" : "roundwin");
      result = txt + "（比分 " + sc[0] + " : " + sc[1] + "）";
      setPhase(done ? "over" : "round");
    }
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      draw(ctx, g);
      if (phase === "over" && winSide >= 0) {
        cel += dt;
        drawWin(ctx, winSide, cel, winTxt[0], winTxt[1]);
      }
    }
    dbgT += dt;
    if (dbgT > 0.1) {
      dbgT = 0;
      const t = padDebug() + "；" + splitStatus() + (evNote ? "　" + evNote : "") + "\n" + padLive();
      if (t !== dbgLast) {
        dbgLast = t;
        dbg.textContent = t;
        if (wizDbg) wizDbg.textContent = t;
      }
    }
    if (testOpen) updateTest(listPads());
    requestAnimationFrame(frame);
  };
  (window as unknown as { __tankGame: () => Game }).__tankGame = () => game;
  (window as unknown as { __tankAudio: () => unknown }).__tankAudio = () => ({
    state: AUD.ctx ? AUD.ctx.state : "none",
    on: AUD.on, mv: AUD.mv, sv: AUD.sv, track: AUD.track, want: AUD.want,
    steps: AUD.stepsRun, voices: AUD.voices, calls: AUD.calls, log: AUD.log.slice(),
  });
  (window as unknown as { __tankRender: typeof audRenderTest }).__tankRender = audRenderTest;
  const unlock = (): void => {
    audEnsure();
    updateSndUi();
  };
  for (const ev of ["pointerdown", "mousedown", "touchend", "keydown", "click"]) window.addEventListener(ev, unlock, true);
  document.addEventListener("visibilitychange", () => audVisibility());
  window.setInterval(updateSndUi, 300);
  render();
  audMusic("menu");
  requestAnimationFrame(frame);
}

boot();
