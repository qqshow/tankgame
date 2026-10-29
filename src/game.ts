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

