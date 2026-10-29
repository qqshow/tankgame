
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
