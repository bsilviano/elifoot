// Campo animado da partida ao vivo. O motor do jogo é estatístico (não calcula a posição de cada jogador),
// então o campo é uma animação guiada pelos lances REAIS da partida (gols, pênaltis, cartões, lesões, substituições).
// As chances sem gol (defesa, trave, chute pra fora) são ilustrativas: não alteram o placar nem as estatísticas.
const Campo = (() => {
  const W = 105, H = 68, R = Math.random, M_ = 2, BAND = (window.innerWidth < 700 ? 15 : 10); // M_ = margem (m) ao redor do gramado
  const cv = document.createElement("canvas");
  cv.id = "campoCv";
  cv.style.cssText = "width:100%;display:block;border-radius:10px;aspect-ratio:" + (W + 2 * M_) + "/" + (H + 2 * M_ + BAND);
  const cx = cv.getContext("2d");
  let shotCool = 0, injF = null, injT = 0, wdT = 0, boxT = 0, injHold = false, koInit = false, penCam = null, endWait = 0, zoomF = 1, camMode = "auto", shotT = 0, shotGx = 0, slow = 0, lag = 0, flip = false, focus = null, leaving = [], meds = [], mounted = false, halfDone = false, ended = false, lastDt = 0.016, v3 = false, camX = W / 2; try { v3 = true; zoomF = parseFloat(localStorage.getItem("campoZoom")) || 1; } catch (e) {}
  let M = null, L = null, seen = 0, P = {}, ball, q = [], cur = null, feed = [], cap = "", capT = 0, capBig = false, marks = [];
  let lastAdded = null, stat = { h: { poss: 0, shots: 0, onT: 0 }, a: { poss: 0, shots: 0, onT: 0 } }, NUM = {}, USED = { h: {}, a: {} }, narr = "", narrT = 0, press = {}, shown = { h: 0, a: 0 }, raf = 0, last = 0, passT = 0, poss = "h", share = 0.5, flash = 0, over = {}, freeze = false, halt = false, lastMin = -1, hh = 0, clock = 0;
  ball = { x: W / 2, y: H / 2, carrier: null, flight: null };

  const BASE = { GOL: [0.04, 0.5], ZAG: [0.2, 0.5, 1], LD: [0.24, 0.88], LE: [0.24, 0.12], VOL: [0.38, 0.5, 1], MC: [0.5, 0.5, 1], MEI: [0.62, 0.5, 1], ME: [0.5, 0.14], MD: [0.5, 0.86], PE: [0.78, 0.14], PD: [0.78, 0.86], SA: [0.7, 0.5, 1], CA: [0.84, 0.5, 1] };
  const pt = (side, ax, ay) => (side === "h" ? [ax * W, ay * H] : [(1 - ax) * W, (1 - ay) * H]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function pickW(a, w) { if (!a.length) return null; let t = w.reduce((x, y) => x + y, 0), r = R() * t; for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; }
  const team = (side) => Object.values(P).filter((o) => o.live && !o.wait && o.side === side);
  const other = (side) => (side === "h" ? "a" : "h");
  function nearest(list, x, y) { let b = null, bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; b = o; } } return b; }
  function findP(name, side) { return Object.values(P).find((o) => o.p.name === name && (!side || o.side === side)); }

  // ---------- cores ----------
  function col(name) { try { const c = (typeof TEAM_COLORS !== "undefined" && TEAM_COLORS[name]) || themeFor(name).ac; return /^#[0-9a-f]{6}$/i.test(c) ? c : "#c8102e"; } catch (e) { return "#c8102e"; } }
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
  const lum = (c) => { const l = rgb(c); return 0.3 * l[0] + 0.59 * l[1] + 0.11 * l[2]; };
  const fmtMin = (m) => (m > 90 ? "90+" + (m - 90) : m);
  const dist3 = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  function kitsFor(hn, an) { // os dois times sempre com cores bem diferentes; goleiros também
    const h = col(hn); let a = col(an);
    if (dist3(h, a) < 150) {
      const c = ["#f4f4f4", "#ffd23f", "#2f80ed", "#e67e22", "#27ae60", "#9b59b6", "#e74c3c", "#111111"].filter((x) => x !== h);
      a = c.map((x) => [x, dist3(h, x)]).sort((p, q) => q[1] - p[1])[0][0];
    }
    const gc = ["#ffd23f", "#3fd0ff", "#ff7bd5", "#7dff6b", "#ff9f43"], pick = (avoid) => gc.map((x) => [x, Math.min(...avoid.map((y) => dist3(x, y)))]).sort((p, q) => q[1] - p[1])[0][0];
    const gh = pick([h, a]), ga = pick([h, a, gh]);
    return { h, a, gh, ga };
  }
  function kits() { return kitsFor(M.H.name, M.A.name); }

  // ---------- escalação em campo ----------
  // número da camisa pela posição (convenção brasileira); reservas e quem entra depois ficam com 12 em diante
  const NPOS = { GOL: [1], LD: [2], ZAG: [3, 4, 14, 15], VOL: [5, 8, 15], LE: [6, 16], MD: [7, 17], MC: [8, 10, 18], MEI: [10, 20], ME: [11, 21], PD: [7, 19], PE: [11, 22], SA: [9, 23], CA: [9, 19, 29] };
  function numFor(p, side, k) {
    if (NUM[p.id]) return NUM[p.id];
    const u = USED[side], free = (n) => !u[n];
    let n = (NPOS[k] || []).find(free);
    if (n == null && Object.keys(u).length < 11) for (let i = 2; i <= 11 && n == null; i++) if (free(i)) n = i;
    if (n == null) for (let i = 12; i <= 40 && n == null; i++) if (free(i)) n = i;
    u[n] = 1; NUM[p.id] = n; return n;
  }
  function layout() {
    const prev = Object.values(P).filter((o) => o.live);
    for (const id in P) P[id].live = 0;
    for (const side of ["h", "a"]) {
      const groups = {};
      M.on[side].forEach((p) => { const k = (typeof SPN === "function" ? SPN(p) : p.sp) || "MC"; (groups[k] = groups[k] || []).push(p); });
      for (const k in groups) {
        const g = groups[k].sort((a, b) => a.id - b.id), b = BASE[k] || BASE.MC, n = g.length;
        g.forEach((p, i) => {
          let ax = b[0], ay = b[1];
          if (b[2]) { const sp = n <= 3 ? 0.3 : 0.6 / (n - 1); ay = 0.5 + (i - (n - 1) / 2) * sp; } else if (n > 1) { ay += (i - (n - 1) / 2) * 0.12 * (b[1] < 0.5 ? 1 : -1); ax -= i * 0.04; }
          ay = clamp(ay, 0.05, 0.95);
          let o = P[p.id];
          if (!o) { o = P[p.id] = { x: 0, y: 0, init: 0, wx: 0, wy: 0, twx: 0, twy: 0, wt: R() * 2 }; }
          o.side = side; o.ax = ax; o.ay = ay; o.p = p; o.live = 1; o.n = numFor(p, side, k);
          if (!o.init) { const t = pt(side, ax, ay); o.x = t[0]; o.y = mounted ? (t[1] < H / 2 ? -1.6 : H + 1.6) : t[1]; o.init = 1; if (mounted) o.wait = true; }
        });
      }
    }
    for (const o of prev) if (!o.live && !o.leave) { o.leave = { go: false, age: 0 }; leaving.push(o); }
  }
  function target(o) {
    const gk = o.p.pos === "GK";
    if (over.run && over.run.o === o) return [over.run.x, over.run.y];
    if (over.pos && over.pos[o.p.id]) return over.pos[o.p.id].slice();
    if (gk && over.gk && over.gk.side === o.side) { const t = pt(o.side, 0.03, 0.5); return [t[0], over.gk.y]; }
    const bp = (o.side === "h" ? ball.x : W - ball.x) / W, by = ball.y / H, byN = o.side === "h" ? by : 1 - by;
    const k = gk ? 0.08 : o.p.pos === "DEF" ? 0.6 : o.p.pos === "MID" ? 1 : 0.9;
    let ax = o.ax + (bp - 0.5) * 0.55 * k + (gk ? 0 : poss === o.side ? 0.04 : -0.03) + (ball.carrier === o.p.id ? 0.07 : 0);
    if (!gk && o.p.pos === "DEF" && (o.ay < 0.25 || o.ay > 0.75) && poss === o.side && bp > 0.5) ax += 0.14; // lateral apoia o ataque
    ax += o.wx; const ay = o.ay + (byN - o.ay) * (gk ? 0.1 : poss === o.side ? 0.34 : 0.46) + o.wy;
    ax = clamp(ax, 0.03, 0.97); if (gk) ax = Math.min(ax, 0.12);
    return pt(o.side, ax, clamp(ay, 0.04, 0.96));
  }

  // ---------- bola ----------
  function flight(x0, y0, x1, y1, dur, done, h, ref) { sndKick(h > 2.5 || dur < 0.5 ? 1.4 : 0.8); { const kc = ball.carrier != null && P[ball.carrier]; if (kc) kc.kick = 0.45; } ball.carrier = null; ball.flight = { x0, y0, x1, y1, t: 0, dur, done, h: h == null ? 2 : h, ref }; }
  function setCarrier(o) { if (!o) return; ball.carrier = o.p.id; poss = o.side; }
  function restart(side) { ball.flight = null; ball.x = W / 2; ball.y = H / 2; setCarrier(nearest(team(side).filter((o) => o.p.pos !== "GK"), W / 2, H / 2)); passT = 0.5; }
  function ambient() {
    const c = ball.carrier != null && P[ball.carrier];
    if (!c || !c.live) { setCarrier(nearest(team(poss).filter((o) => o.p.pos !== "GK"), ball.x, ball.y) || nearest(team(poss), ball.x, ball.y)); return; }
    const gxx = c.side === "h" ? W : 0, dgl = Math.hypot(c.x - gxx, c.y - 34);
    const inBox = Math.abs(c.x - gxx) < 18 && Math.abs(c.y - 34) < 21, fimJ = !!(L && L.done); if (!fimJ && c.p.pos !== "GK" && (inBox || (dgl < 22 && lag < 4000))) { const sd = c.side, fn = (cu) => { const st = cu.steps; st.push(WAIT(0.2)); let kind = pickW(["save", "wide", "block", "post"], [5, 2.6, 1.6, 0.8]); if (kind === "save" && R() < 0.4) kind = "savec"; shotSteps(st, sd, kind, c, c.p.name); st.push(FN(() => { let f = null; if (kind === "wide") f = goalKick(other(sd)); else if (kind === "savec") f = corner(sd); if (f) { f.ill = true; q.unshift(f); } }, 0)); }; fn.ill = true; if (inBox || R() < 0.85) { q.push(fn); passT = 1; shotCool = 16; return; } }
    const mates = team(c.side).filter((o) => o !== c), opp = team(other(c.side)), dir = c.side === "h" ? 1 : -1;
    const sh = c.side === "h" ? share : 1 - share, prg = (c.side === "h" ? c.x : W - c.x) / W, pI = clamp(0.15 * (1 - sh) / sh, 0.06, 0.3) + (prg > 0.78 ? 0.45 : prg > 0.66 ? 0.28 : prg > 0.55 ? 0.1 : 0) + (shotCool > 0 && prg > 0.66 ? 0.6 : 0);
    const w = mates.map((o) => { const dx = (o.x - c.x) * dir, dy = Math.abs(o.y - c.y), d = Math.hypot(dx, dy); let v = d < 5 ? 0.05 : d < 12 ? 1.4 : d < 20 ? 1.2 : d < 28 ? 0.45 : (prg < 0.25 ? 1.1 : 0.1); if (prg < 0.25 && dx > 14) v *= 2.6; v *= dx > 2 ? 1.6 : dx > -1.5 ? 1.1 : 0.25; if (o.p.pos === "GK") v *= c.p.pos === "DEF" ? 0.4 : 0.03; if (fimJ) v *= 1 / (1 + Math.abs(o.x - W / 2) / 10); return v; });
    let r = w.some((v) => v > 0) ? pickW(mates, w) : null;
    if (!r) r = mates.slice().sort((a, b) => (b.x - a.x) * dir)[0]; // nunca para trás: se ninguém está à frente, toca no mais avançado ou conduz
    if (!r) return;
    if ((r.x - c.x) * dir < -1.5 && R() < 0.8) { // ninguém à frente: em vez de conduzir até a outra área, toca de lado ou para trás
      const wb = mates.map((o) => { const d = Math.hypot(o.x - c.x, o.y - c.y); let v = d < 5 ? 0.1 : d < 22 ? 1 : d < 30 ? 0.4 : 0.05; if (o.p.pos === "GK") v *= c.p.pos === "DEF" ? 0.3 : 0.02; return v; });
      if (wb.some((v) => v > 0)) r = pickW(mates, wb);
    }
    if ((r.x - c.x) * dir < -1.5 && !(Math.hypot(r.x - c.x, r.y - c.y) > 4 && R() < 0.9)) { const dr = c.side === "h" ? 1 : -1; c.twx = 0.12; c.wt = 3; passT = 0.6; return; } // conduz a bola em direção ao gol
    const dist = Math.hypot(r.x - c.x, r.y - c.y), dur = Math.max(0.35, dist / 18);
    const club = (sd) => (sd === "h" ? M.H.name : M.A.name), prog = (c.side === "h" ? c.x : W - c.x) / W;
    if (R() < pI && opp.length) { const it = nearest(opp, (c.x + r.x) / 2, (c.y + r.y) / 2); flight(ball.x, ball.y, it.x, it.y, dur * 0.7, () => { setCarrier(it); narrate(pickW([`Desarme de ${sur(it)}! A bola é do ${club(it.side)}`, `${sur(it)} intercepta o passe de ${sur(c)}`, `${sur(it)} corta e recupera a bola`], [1, 1, 1])); }, 1.2, it); }
    else {
      flight(ball.x, ball.y, r.x, r.y, dur, () => setCarrier(r), 1.5, r);
      if (R() < 0.8) narrate(prog > 0.7 ? pickW([`${club(c.side)} pressiona no ataque`, `${sur(c)} toca para ${sur(r)} perto da área`, `${sur(r)} recebe na frente da área`], [1, 1, 1]) : prog < 0.3 ? pickW([`${club(c.side)} toca a bola na defesa`, `${sur(c)} sai jogando para ${sur(r)}`], [1, 1]) : pickW([`${sur(c)} toca para ${sur(r)}`, `${sur(c)} lança para ${sur(r)}`, `${sur(r)} recebe e domina`, `${club(c.side)} troca passes no meio-campo`, `${sur(c)} procura ${sur(r)} em profundidade`], [3, 1, 2, 1, 1]));
    }
  }

  // ---------- roteiros de lances ----------
  const FN = (f, d) => ({ start: f, dur: d || 0 });
  const WAIT = (d) => ({ start() {}, dur: d });
  const PASS = (to, side) => ({ fl: 1, start() { poss = side; const dist = Math.hypot(to.x - ball.x, to.y - ball.y); flight(ball.x, ball.y, to.x, to.y, Math.max(0.35, dist / 18), () => setCarrier(to), 1.5, to); } });
  const sur = (o) => o.p.name.split(" ").slice(-1)[0];
  function narrate(t) {} // a caixa da tela usa os mesmos textos do feed abaixo do jogo (addFeed)
  // som: torcida, apito, chute e gol (WebAudio sintetizado, sem arquivos)
  let SND = { on: true, ctx: null, crowd: null, noise: null };
  try { SND.on = localStorage.getItem("campoSom") !== "0"; } catch (e) {}
  function sndInit() {
    if (SND.ctx || !SND.on) { if (SND.ctx && SND.ctx.state === "suspended") SND.ctx.resume(); return; }
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return; const c = new A(); SND.ctx = c;
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; SND.noise = buf;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.6; const g = c.createGain(); g.gain.value = 0.0; src.connect(f); f.connect(g); g.connect(c.destination); src.start(); SND.crowd = g;
    } catch (e) { SND.ctx = null; }
  }
  try { document.addEventListener("pointerdown", sndInit); } catch (e) {}
  function sndNoise(dur, freq, vol, type) { const c = SND.ctx; if (!c || !SND.on || !sndLive) return; const src = c.createBufferSource(); src.buffer = SND.noise; const f = c.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = freq; const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f); f.connect(g); g.connect(c.destination); src.start(t, Math.random()); src.stop(t + dur + 0.05); }
  function sndWhistle(n) { const c = SND.ctx; if (!c || !SND.on || !sndLive) return; const t = c.currentTime; for (let i = 0; i < (n || 1); i++) { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = "square"; o2.type = "square"; const t0 = t + i * 0.42; o.frequency.setValueAtTime(2900, t0); o2.frequency.setValueAtTime(3050, t0); o2.frequency.linearRampToValueAtTime(2980, t0 + 0.3); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02); g.gain.setValueAtTime(0.07, t0 + 0.28); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34); o.connect(g); o2.connect(g); g.connect(c.destination); o.start(t0); o2.start(t0); o.stop(t0 + 0.36); o2.stop(t0 + 0.36); } }
  function sndKick(v) { sndNoise(0.12, 380, 0.22 * (v || 1), "lowpass"); }
  function sndGoal() { const c = SND.ctx; if (!c || !SND.on || !sndLive) return; const t = c.currentTime; for (const [fr, q, v] of [[500, 0.7, 0.30], [1100, 0.9, 0.22]]) { const src = c.createBufferSource(); src.buffer = SND.noise; src.loop = true; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = fr; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.7); g.gain.setValueAtTime(v, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8); src.connect(f); f.connect(g); g.connect(c.destination); src.start(t, Math.random()); src.stop(t + 5); } }
  let sndLive = false;
  function sndOn() { sndLive = true; if (SND.ctx && SND.ctx.state === "suspended" && SND.on) SND.ctx.resume(); }
  function sndOff() { sndLive = false; try { if (SND.ctx && SND.crowd) SND.crowd.gain.cancelScheduledValues(0), SND.crowd.gain.setTargetAtTime(0, SND.ctx.currentTime, 0.15); } catch (e) {} }
  function sndTick() { if (!SND.ctx || !SND.crowd) return; if (!sndLive || ended) { SND.crowd.gain.setTargetAtTime(0, SND.ctx.currentTime, 0.3); return; } const base = 0.05 + (shotT > 0 ? 0.08 : 0) + (flash > 0 ? 0.2 : 0); if (!(flash > 0)) SND.crowd.gain.setTargetAtTime(SND.on ? base : 0, SND.ctx.currentTime, 0.4); }
  function say(t, big, ms) { if (big && SND.ctx) { if (/Gol|GOO/i.test(t)) {} else if (/p[êe]nalti|Fim|Come|Falta|Cart|Interv|Substit|Les/i.test(t)) sndWhistle(/p[êe]nalti|Fim|Come/i.test(t) ? 2 : 1); } cap = t; capBig = !!big; capT = ms || 2.6; }
  function addFeed(txt) { narr = String(txt).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); narrT = 4.5; if (!/GOL!|Expulso/.test(narr)) return; feed.unshift({ m: M.min || 0, t: txt }); if (feed.length > 14) feed.pop(); }
  const NEAR = (o, side, d) => ({ dur: 7, start() {}, until: () => { const gx = side === "h" ? W : 0; over.run = { o, x: gx + (side === "h" ? -(d - 6) : d - 6), y: 34 + (o.y - 34) * 0.4 }; return Math.hypot(o.x - gx, o.y - 34) <= d; } });
  const SNAP = (o, side, d) => FN(() => { const gx = side === "h" ? W : 0, dx = Math.abs(o.x - gx); if (dx > d + 14) { o.x = gx + (side === "h" ? -d : d); } if (ball.carrier === o.p.id) { ball.x = o.x; } }, 0);
  function shotSteps(st, side, kind, shooter, name) {
    const oside = other(side), gx = side === "h" ? W : 0, gk = team(oside).find((x) => x.p.pos === "GK"), opp = team(oside).filter((x) => x.p.pos !== "GK");
    const ty = 34 + (kind === "wide" ? (R() < 0.5 ? -1 : 1) * (5 + R() * 4) : kind === "post" ? (R() < 0.5 ? -1 : 1) * 3.66 : (R() - 0.5) * 5.4);
    stat[side].shots++; if (kind === "goal" || kind === "save" || kind === "savec") stat[side].onT++;
    if (kind === "block") {
      const d = nearest(opp, shooter.x + (side === "h" ? 6 : -6), shooter.y);
      const br = R(), mate = nearest(team(side).filter((o) => o !== shooter && o.p.pos !== "GK" && Math.hypot(o.x - d.x, o.y - d.y) > 3), d.x - (side === "h" ? 6 : -6), d.y);
      // bloqueio: a bola bate na zaga e sobra perto; 30% escanteio, 50% o ataque recupera a sobra, 20% a zaga fica com ela
      st.push({ fl: 1, start() { flight(ball.x, ball.y, d.x, d.y, 0.25, () => { if (br < 0.3) { ball.flight = null; ball.carrier = null; } else if (br < 0.8 && mate) flight(d.x, d.y, mate.x, mate.y, 0.45, () => setCarrier(mate), 1, mate); else setCarrier(d); }, 1, d); } });
      st.push(FN(() => { say("🧱 Bloqueio da zaga!"); addFeed(`🧱 Chute de ${name} é bloqueado`); if (br < 0.3) { const f = corner(side); if (f) { f.ill = true; q.unshift(f); } } }, 0.6));
      return;
    }
    st.push({ fl: 1, start() { shotT = 2.4; shotGx = gx; if (kind === "goal") slow = 1.7; over.run = null; if (gk) over.gk = { side: oside, y: ty }; flight(ball.x, ball.y, gx, ty, 0.38, () => {}, 1); } });
    if (kind === "goal") {
      st.push(FN(() => { flash = 1.6; sndGoal(); shownGoalSide = side; shown[side]++; say("⚽ GOOOL! " + name, true, 3.2); addFeed(`⚽ <b>GOL!</b> ${esc(name)} (${esc(side === "h" ? M.H.name : M.A.name)})`); }, 2));
      st.push(FN(() => {
        const sc = shooter, m = {}; if (sc && sc.p) {
          const fx = side === "h" ? W - 7 : 7, fy = sc.y < 34 ? 5 : H - 5; m[sc.p.id] = [fx, fy];
          fld(side).filter((x) => x !== sc).sort((a, b) => Math.hypot(a.x - fx, a.y - fy) - Math.hypot(b.x - fx, b.y - fy)).slice(0, 4).forEach((o, i) => { const a = i * 1.6 + 0.4; m[o.p.id] = [fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 2.2 + (fy < 34 ? 1 : -1)]; });
          over.pos = m; ball.carrier = null; focus = { x: fx, y: fy }; sc.cel = true; fld(side).forEach((o) => { if (m[o.p.id]) o.cel = true; });
        }
      }, 2.8));
      st.push(FN(() => { Object.values(P).forEach((o) => { o.cel = false; }); over.pos = null; over.gk = null; over.run = null; ball.flight = null; ball.carrier = null; const kq = kickoff(oside); q.unshift(kq); }, 0.1));
    } else if (kind === "save") {
      st.push(FN(() => { over.gk = null; if (gk) setCarrier(gk); say("🧤 Defesa" + (gk ? " de " + gk.p.name : "") + "!"); addFeed(`🧤 Chute de ${esc(name)}, defesa${gk ? " de " + esc(gk.p.name) : ""}`); }, 1.8));
    } else if (kind === "savec") { // goleiro defende e a bola sai pela linha de fundo, rente ao escanteio
      st.push({ fl: 1, start() { over.gk = null; flight(ball.x, ball.y, gx + (side === "h" ? 0.6 : -0.6), ty > 34 ? H - 0.8 : 0.8, 0.55, () => {}, 1.2); } });
      st.push(FN(() => { say("🧤 Defesa e escanteio!"); addFeed(`🧤 Chute de ${esc(name)}, defesa${gk ? " de " + esc(gk.p.name) : ""} e escanteio`); }, 0.5));
    } else if (kind === "wide") {
      st.push({ fl: 1, start() { flight(ball.x, ball.y, gx + (side === "h" ? 4 : -4), ball.y + (ball.y > 34 ? 2 : -2), 0.25, () => {}, 0.5); } });
      st.push(FN(() => { over.gk = null; if (gk) setCarrier(gk); say("Pra fora!"); addFeed(`🎯 Chute de ${esc(name)} passa perto`); }, 0.7));
    } else if (kind === "post") {
      st.push({ fl: 1, start() { flight(ball.x, ball.y, gx + (side === "h" ? -7 : 7), 34 + (ty > 34 ? 9 : -9), 0.45, () => {}, 2); } });
      st.push(FN(() => { over.gk = null; const d = nearest(opp, ball.x, ball.y); if (d) setCarrier(d); say("🥅 NA TRAVE!", true); addFeed(`🥅 Na trave! ${esc(name)}`); }, 1));
    }
  }
  // ---------- bolas paradas (regras: tiro de meta, escanteio, saída de bola, lateral, barreira) ----------
  const OWNX = (side, f) => (side === "h" ? f * W : (1 - f) * W);
  const yOf = (o) => pt(o.side, 0, o.ay)[1];
  const gkOf = (side) => team(side).find((x) => x.p.pos === "GK");
  const fld = (side) => team(side).filter((x) => x.p.pos !== "GK");
  const clubOf = (sd) => (sd === "h" ? M.H.name : M.A.name);
  const SNAPP = () => { if (over.pos) for (const id in over.pos) if (P[id]) { P[id].x = over.pos[id][0]; P[id].y = over.pos[id][1]; } };
  function placeBall(x, y) { ball.flight = null; ball.carrier = null; ball.x = x; ball.y = y; ball.z = 0; over.gk = null; over.run = null; }
  function goalKick(side) {
    return (cur) => {
      const st = cur.steps, sx = side === "h" ? 5.5 : W - 5.5, sy = 34 + (R() - 0.5) * 8; let tk = null;
      st.push({ fl: 1, start() { const d = Math.hypot(ball.x - sx, ball.y - sy); if (d > 9) { ball.carrier = null; over.run = null; over.gk = null; flight(ball.x, ball.y, sx, sy, Math.max(0.9, d / 22), () => {}, 5); } } });
      st.push(FN(() => {
        tk = gkOf(side); placeBall(sx, sy); poss = side; say("🥅 Tiro de meta", false, 2.2); narrate("Tiro de meta para o " + clubOf(side)); addFeed("🥅 Tiro de meta para o " + esc(clubOf(side)));
        const m = {};
        for (const o of team(side)) { if (o === tk) m[o.p.id] = [sx + (side === "h" ? -0.9 : 0.9), sy]; else if (o.p.pos !== "GK") m[o.p.id] = [OWNX(side, 0.12 + o.ax * 0.7), yOf(o)]; }
        for (const o of team(other(side))) if (o.p.pos !== "GK") m[o.p.id] = [OWNX(side, 0.3 + (1 - o.ax) * 0.5), yOf(o)]; // adversários fora da grande área
        over.pos = m;
      }, 2.8));
      st.push(FN(() => { SNAPP(); if (tk) setCarrier(tk); }, 0.3));
      st.push({ fl: 1, start() {
        const c = fld(side), r = pickW(c, c.map((x) => { const d = Math.abs(x.x - sx); return 1 / (1 + Math.abs(d - 40) / 15); }));
        if (r && tk) flight(sx, sy, r.x, r.y, Math.max(0.8, Math.hypot(r.x - sx, r.y - sy) / 24), () => setCarrier(r), 7, r);
      } });
      st.push(FN(() => { over.pos = null; }, 0));
    };
  }
  function corner(side, gname) {
    return (cur) => {
      const st = cur.steps, gx = side === "h" ? W : 0, cy = ball.y < H / 2 ? 0.6 : H - 0.6, cxp = gx === W ? W - 0.6 : 0.6, xg = (d) => (side === "h" ? W - d : d); let tk = null, tg = null;
      st.push({ fl: 1, start() { const d = Math.hypot(ball.x - cxp, ball.y - cy); if (d > 9) { ball.carrier = null; over.run = null; over.gk = null; flight(ball.x, ball.y, cxp, cy, Math.max(0.9, d / 22), () => {}, 5); } } });
      st.push(FN(() => {
        const att = fld(side); tk = nearest(att, cxp, cy); placeBall(cxp, cy); poss = side; say("🚩 Escanteio", false, 2.2); narrate("Escanteio para o " + clubOf(side)); addFeed("🚩 Escanteio para o " + esc(clubOf(side)));
        const rank = { ATT: 0, DEF: 1, MID: 2 }, ra = att.filter((x) => x !== tk).sort((a, b) => (rank[a.p.pos] - rank[b.p.pos]) || b.p.ov - a.p.ov), m = {};
        m[tk.p.id] = [cxp + (gx === W ? -0.8 : 0.8), cy + (cy < 1 ? 0.8 : -0.8)];
        const ys = [-9, -3, 3, 9];
        ra.forEach((o, i) => { if (i < 4) m[o.p.id] = [xg(8 + (i % 2) * 4), 34 + ys[i]]; else if (i < 6) m[o.p.id] = [xg(20), 34 + (i === 4 ? -12 : 12)]; });
        const dr = { DEF: 0, MID: 1, ATT: 2 }, df = fld(other(side)).sort((a, b) => dr[a.p.pos] - dr[b.p.pos]);
        df.forEach((o, i) => { if (i < 7) m[o.p.id] = [xg(2.5 + (i % 3) * 3.5), 34 + (i - 3) * 3.4]; else m[o.p.id] = [xg(38), yOf(o)]; });
        const dg = gkOf(other(side)); if (dg) m[dg.p.id] = [xg(3.5), 34];
        { const sc = gname && ra.find((x) => x.p.name === gname && x.p.pos !== "GK"); if (sc) { const slot = ra[0]; if (m[slot.p.id] && sc !== slot) { m[sc.p.id] = m[slot.p.id]; m[slot.p.id] = [xg(20), 34 + 12]; } else if (!m[sc.p.id]) m[sc.p.id] = [xg(8), 34 + 3]; tg = sc; } else tg = ra[0]; }
        over.pos = m;
      }, 3));
      st.push(FN(() => { SNAPP(); setCarrier(tk); }, 0.3));
      st.push({ fl: 1, start() { tg = tg || tk; flight(cxp, cy, tg.x, tg.y, 1.1, () => setCarrier(tg), 8, tg); } });
      st.push(WAIT(0.1));
      st.push(FN(() => { shotSteps(cur.steps, side, gname ? "goal" : pickW(["save", "wide", "block", "post"], [4, 3, 2, 0.8]), tg || tk, gname || ""); }, 0));
      st.push(FN(() => { over.pos = null; }, 0));
      st.push(FN(() => { over.pos = null; }, 0));
    };
  }
  function kickoff(side) {
    return (cur) => {
      const st = cur.steps, first = koInit; let kk = null, pa = null;
      st.push(FN(() => {
        { const dc = Math.hypot(ball.x - W / 2, ball.y - H / 2); if (dc > 2.5) { ball.carrier = null; over.run = null; over.gk = null; flight(ball.x, ball.y, W / 2, H / 2, Math.max(1, dc / 20), () => {}, 3); } else placeBall(W / 2, H / 2); } poss = side; narrate("Bola ao centro: recomeça o jogo, saída do " + clubOf(side));
        const m = {}, atk = fld(side).sort((a, b) => (b.p.pos === "ATT") - (a.p.pos === "ATT") || b.p.ov - a.p.ov); kk = atk[0]; pa = atk[1] || atk[0];
        for (const sd of ["h", "a"]) for (const o of team(sd)) {
          let x = OWNX(sd, clamp(o.ax * 0.5, 0.04, 0.45)), y = yOf(o);
          if (sd !== side) { const d = Math.hypot(x - W / 2, y - 34); if (d < 10.5) x = W / 2 + (sd === "h" ? -1 : 1) * Math.max(10.5, Math.abs(x - W / 2)); } // adversário fora do círculo central
          m[o.p.id] = [x, y];
        }
        m[kk.p.id] = [W / 2 + (side === "h" ? -0.9 : 0.9), 34]; m[pa.p.id] = [W / 2 + (side === "h" ? -1.5 : 1.5), 34 + 5];
        over.pos = m;
        if (first) { koInit = false; for (const id in m) { const o = P[id]; if (o) { o.x = m[id][0]; o.y = m[id][1]; } } } // início do jogo: todos já nas posições da saída de bola
      }, first ? 1 : 3));
      st.push(FN(() => { SNAPP(); if (kk) setCarrier(kk); }, 0.3));
      st.push({ fl: 1, start() { if (kk && pa) flight(W / 2, H / 2, pa.x, pa.y, 0.5, () => setCarrier(pa), 1, pa); } });
      st.push(FN(() => { over.pos = null; }, 0));
    };
  }
  function throwIn(side) {
    return (cur) => {
      const st = cur.steps; let tk = null, r1 = null;
      st.push(FN(() => {
        const sx = clamp(ball.x, 8, W - 8), sy = ball.y < H / 2 ? -0.2 : H + 0.2, inn = sy < 0 ? 1 : -1;
        const mates = fld(side), opp = fld(other(side)); tk = nearest(mates, sx, sy);
        const rest = mates.filter((x) => x !== tk).sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy)); r1 = rest[0];
        flight(ball.x, ball.y, sx, sy, Math.max(0.9, Math.hypot(ball.x - sx, ball.y - sy) / 13), () => {}, 3); poss = side; say("↔️ Lateral para o " + clubOf(side), false, 2); narrate("Lateral para o " + clubOf(side)); addFeed("↔️ Lateral para o " + esc(clubOf(side)));
        const m = {}; m[tk.p.id] = [sx, sy + inn * 0.3];
        if (rest[0]) m[rest[0].p.id] = [sx + 8, sy + inn * 6]; if (rest[1]) m[rest[1].p.id] = [sx - 7, sy + inn * 10];
        const ops = opp.sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy));
        if (ops[0]) m[ops[0].p.id] = [sx + 9.5, sy + inn * 6.5]; if (ops[1]) m[ops[1].p.id] = [sx - 8.5, sy + inn * 10.5];
        over.pos = m; tk._sx = sx; tk._sy = sy;
      }, 2.2));
      st.push(FN(() => { SNAPP(); placeBall(tk._sx, tk._sy); setCarrier(tk); }, 0.4));
      st.push({ fl: 1, start() { if (r1) flight(tk._sx, tk._sy, r1.x, r1.y, 0.8, () => setCarrier(r1), 3, r1); } });
      st.push(FN(() => { over.pos = null; }, 0));
    };
  }
  function chance(side, o) {
    return (cur) => {
      poss = side;
      const me = team(side), atk = me.filter((x) => x.p.pos !== "GK"), st = cur.steps;
      const shooter = (o.name && atk.find((x) => x.p.name === o.name)) || pickW(atk, atk.map((x) => ({ ATT: 3, MID: 1.3, DEF: 0.25 }[x.p.pos] || 1) * x.p.ov));
      if (!shooter) return;
      const gx0 = side === "h" ? W : 0, D = [gx0 + (side === "h" ? -20 : 20), 34 + (R() - 0.5) * 14];
      const dd = (a, b) => Math.hypot(a.x - b[0], a.y - b[1]);
      st.push(FN(() => { narrate(`Ataque do ${side === "h" ? M.H.name : M.A.name}! ${sur(shooter)} na jogada`); over.run = { o: shooter, x: D[0], y: D[1] }; }, 0));
      // cadeia de passes curtos rumo à área (sempre para companheiros próximos, nunca atravessando o campo)
      let c = nearest(atk.filter((x) => x !== shooter), ball.x, ball.y), guard = 0;
      if (c) { st.push(PASS(c, side)); st.push(WAIT(0.25)); }
      while (c && guard++ < 4 && dd(c, D) > 24) {
        const cs = atk.filter((x) => x !== c && x !== shooter && Math.hypot(x.x - c.x, x.y - c.y) <= 24 && dd(x, D) < dd(c, D) - 3);
        const nx = pickW(cs, cs.map((x) => 1 / (1 + dd(x, D) / 20)));
        if (!nx) break;
        st.push(PASS(nx, side)); st.push(WAIT(0.25)); c = nx;
      }
      st.push(PASS(shooter, side));
      const fkd = o.how === "fk" && o.kind === "goal" ? 26 : 21; st.push(NEAR(shooter, side, fkd)); st.push(SNAP(shooter, side, fkd + 1));
      if (o.how === "fk" && o.kind === "goal") { // gol de falta: falta na entrada da área, barreira e cobrança direta
        st.push(FN(() => {
          const gxx = side === "h" ? W : 0, a = Math.atan2(34 - shooter.y, gxx - shooter.x), dgl = Math.hypot(shooter.x - gxx, shooter.y - 34);
          ball.carrier = null; ball.flight = null; ball.x = shooter.x + (side === "h" ? 0.9 : -0.9) * 0 + Math.cos(a) * 0.8; ball.y = shooter.y + Math.sin(a) * 0.8; poss = side; halt = true; over.run = null;
          const def = team(other(side)).filter((x) => x.p.pos !== "GK").sort((p1, p2) => Math.hypot(p1.x - ball.x, p1.y - ball.y) - Math.hypot(p2.x - ball.x, p2.y - ball.y)).slice(0, dgl < 24 ? 5 : 4), bx = ball.x + 9.5 * Math.cos(a), by = ball.y + 9.5 * Math.sin(a), m = {};
          def.forEach((x, i) => { const off = (i - (def.length - 1) / 2) * 1.15; m[x.p.id] = [bx - Math.sin(a) * off, by + Math.cos(a) * off]; });
          over.pos = m; say("🚩 Falta perigosa!", false, 2.4); narrate("Falta perigosa na entrada da área: " + sur(shooter) + " vai cobrar"); addFeed(`🚩 Falta perigosa na entrada da área, ${esc(shooter.p.name)} vai cobrar`);
        }, 2.4));
        st.push(FN(() => { halt = false; setCarrier(shooter); }, 0.2));
      }
      st.push(WAIT(0.15));
      const kd = o.kind === "save" && R() < 0.4 ? "savec" : o.kind;
      shotSteps(st, side, kd, shooter, o.name || shooter.p.name);
      if (o.kind !== "goal") st.push(FN(() => { let f = null; if (o.kind === "wide") f = goalKick(other(side)); else if (kd === "savec") f = corner(side); if (f) { f.ill = true; q.unshift(f); } }, 0));
    };
  }
  function penaltyWin(side, e) {
    return (cur) => {
      const me = team(side), atk = me.filter((x) => x.p.pos !== "GK"), st = cur.steps, sx = side === "h" ? W - 11 : 11;
      const gx0 = side === "h" ? W : 0, D = [gx0 + (side === "h" ? -14 : 14), 34 + (R() - 0.5) * 14];
      const dd = (a, b) => Math.hypot(a.x - b[0], a.y - b[1]);
      const vic = pickW(atk, atk.map((x) => ({ ATT: 3, MID: 1.2, DEF: 0.2 }[x.p.pos] || 1)));
      st.push(FN(() => { poss = side; narrate(`Ataque do ${e.club}! ${sur(vic)} entra na área`); over.run = { o: vic, x: D[0], y: D[1] }; }, 0));
      let c = nearest(atk.filter((x) => x !== vic), ball.x, ball.y), guard = 0;
      if (c) { st.push(PASS(c, side)); st.push(WAIT(0.25)); }
      while (c && guard++ < 5 && dd(c, D) > 24) {
        const cs = atk.filter((x) => x !== c && x !== vic && Math.hypot(x.x - c.x, x.y - c.y) <= 24 && dd(x, D) < dd(c, D) - 3);
        const nx = pickW(cs, cs.map((x) => 1 / (1 + dd(x, D) / 20)));
        if (!nx) break;
        st.push(PASS(nx, side)); st.push(WAIT(0.25)); c = nx;
      }
      st.push(PASS(vic, side));
      st.push(NEAR(vic, side, 17)); st.push(SNAP(vic, side, 18));
      st.push(WAIT(1.0));
      st.push(FN(() => { over.run = null; halt = true; freeze = true; ball.flight = null; ball.carrier = null; say("🎯 PÊNALTI para o " + e.club + "!", true, 3); narrate("Falta dentro da área! O árbitro marca pênalti"); addFeed(`🎯 Pênalti para o ${esc(e.club)}`); }, 1.8));
    };
  }
  function penaltyKick(side, e) {
    return (cur) => {
      const sx = side === "h" ? W - 11 : 11, st = cur.steps, oside = other(side);
      const k = findP(e.name, side) || pickW(team(side).filter((x) => x.p.pos !== "GK"), team(side).map((x) => x.p.ov));
      st.push(FN(() => {
        penCam = side === "h" ? W : 0; freeze = true; halt = true; poss = side; ball.flight = null; ball.carrier = null; ball.x = sx; ball.y = 34; ball.z = 0;
        const inBox = (o) => (side === "h" ? o.x > W - 17 : o.x < 17) && o.y > 12 && o.y < 56;
        for (const id in P) { const o = P[id]; if (!o.live || o === k) continue; if (o.p.pos === "GK" && o.side === oside) { o.x = side === "h" ? W - 1 : 1; o.y = 34; } else if (inBox(o)) { o.x = side === "h" ? W - 20 - R() * 3 : 20 + R() * 3; } }
        if (k) { k.x = sx + (side === "h" ? -1.1 : 1.1); k.y = 34; }
        say("Cobrança: " + e.name);
      }, 1.2));
      st.push(FN(() => { halt = false; freeze = false; }, 0));
      shotSteps(st, side, e.ok ? "goal" : R() < 0.6 ? "save" : "wide", k || { x: sx, y: 34 }, e.name);
      if (!e.ok) st.push(FN(() => addFeed(`❌ <b>Pênalti perdido</b> ${esc(e.name)}`), 0));
      st.push(FN(() => { penCam = null; }, 0));
    };
  }
  function foulScript(kind, e, fside, shotDone) {
    return (cur) => {
      const st = cur.steps; let fo = null, vi = null, spot = null, near = false;
      // jogador já dentro da grande área adversária: primeiro finaliza (como em campo), e só depois vem a falta/cartão, sem "voltar" a bola
      if (e && !shotDone) {
        const c0 = ball.carrier != null && P[ball.carrier];
        if (c0 && c0.live && c0.p.pos !== "GK" && !ball.flight && Math.abs(c0.x - (c0.side === "h" ? W : 0)) < 18 && Math.abs(c0.y - 34) < 21) {
          const sd = c0.side; let sk = pickW(["save", "wide", "block", "post"], [5, 2.6, 1.6, 0.8]); if (sk === "save" && R() < 0.4) sk = "savec";
          st.push(WAIT(0.2)); shotSteps(st, sd, sk, c0, c0.p.name);
          st.push(FN(() => { q.unshift(foulScript(kind, e, fside, true)); let f = null; if (sk === "wide") f = goalKick(other(sd)); else if (sk === "savec") f = corner(sd); if (f) { f.ill = true; q.unshift(f); } }, 0));
          return;
        }
      }
      // 0) cartão só com o time do infrator na defesa: espera a posse mudar; se não mudar, o rival fica com a bola
      if (e) {
        const holder = () => { const c = ball.carrier != null && P[ball.carrier]; return c && c.live ? c.side : poss; };
        const inB = () => Math.min(ball.x, W - ball.x) < 20.5 && Math.abs(ball.y - 34) < 23.5;
        // o infrator é sempre do time sem a bola: se o time dele tem a posse, o marcador mais próximo desarma antes (a posse muda) e só então vem a falta
        st.push({ dur: 9, start() {}, until() { if (holder() !== e.side) return true; if (ball.flight) return false; const opp = team(other(e.side)).filter((x) => x.p.pos !== "GK"), v = nearest(opp, ball.x, ball.y); if (!v) return true; over.run = { o: v, x: ball.x, y: ball.y }; if (Math.hypot(v.x - ball.x, v.y - ball.y) < 1.8) { over.run = null; ball.flight = null; setCarrier(v); return true; } return false; } });
        // se o lance está dentro da área, quem tem a bola sai driblando para fora dela (nada de falta na área nem bola teletransportada)
        st.push({ dur: 16, start() {}, until() { if (!inB()) { const c0 = ball.carrier != null && P[ball.carrier]; if (c0 && c0.live) { over.run = null; over.pos = over.pos || {}; over.pos[c0.p.id] = [c0.x, c0.y]; } return true; } if (ball.flight) return false; const c = ball.carrier != null && P[ball.carrier]; if (!c || !c.live) return true; if (c.p.pos === "GK") { const r = nearest(team(c.side).filter((o) => o.p.pos !== "GK"), W / 2, 34); if (!r) return true; flight(ball.x, ball.y, r.x, r.y, Math.max(0.6, Math.hypot(r.x - ball.x, r.y - ball.y) / 16), () => setCarrier(r), 2, r); return false; } const gx0 = ball.x < W / 2 ? 0 : W; over.run = { o: c, x: gx0 + (gx0 === 0 ? 27 : -27), y: c.y + (c.y < 34 ? -3 : 3) }; return false; } });
      }
      // 1) o marcador corre até quem está com a bola (nada de falta surgindo do nada)
      st.push({ dur: e ? 10 : 5, start() {
        fo = (e && findP(e.name, e.side)) || null;
        const cr = ball.carrier != null && P[ball.carrier];
        if (!fo) { const sd = other(cr && cr.live ? cr.side : poss), c = team(sd).filter((x) => x.p.pos !== "GK"); fo = nearest(c, ball.x, ball.y); }
        if (cr && cr.live) { cr.twx = 0; cr.wt = 0; over.pos = over.pos || {}; over.pos[cr.p.id] = [cr.x, cr.y]; } // o jogador com a bola para (senão continua conduzindo para dentro da área enquanto o marcador corre)
        if (fo && cr && cr.live && fo.side === cr.side) { const v = nearest(team(other(fo.side)).filter((x) => x.p.pos !== "GK"), ball.x, ball.y); if (v) { ball.flight = null; setCarrier(v); } } // garantia: quem comete a falta nunca é do time com a bola
        if (fo) over.run = { o: fo, x: ball.x, y: ball.y };
      }, until() {
        if (!fo) return true;
        over.run = { o: fo, x: ball.x, y: ball.y };
        return Math.hypot(fo.x - ball.x, fo.y - ball.y) <= 2.2;
      } });
      st.push(FN(() => {
        over.run = null;
        if (!fo) { cur.steps.splice(cur.i + 1); return; }
        if (Math.hypot(fo.x - ball.x, fo.y - ball.y) > 3.2) { if (!e) { cur.steps.splice(cur.i + 1); return; } const a = Math.atan2(fo.y - ball.y, fo.x - ball.x); fo.x = ball.x + Math.cos(a) * 1.6; fo.y = ball.y + Math.sin(a) * 1.6; }
        const cr = ball.carrier != null && P[ball.carrier], opp = team(other(fo.side)).filter((x) => x.p.pos !== "GK");
        vi = cr && cr.live && cr.side !== fo.side && cr.p.pos !== "GK" ? cr : nearest(opp, ball.x, ball.y);
        if (!vi) return;
        spot = { x: clamp(ball.x, 2, W - 2), y: clamp(ball.y, 2, H - 2) };
        { const gx0 = fo.side === "h" ? 0 : W, dxg = Math.abs(spot.x - gx0); // falta de quem defende a própria área seria pênalti: fora disso a falta é na entrada da área
          if (dxg < 19.5 && Math.abs(spot.y - 34) < 23) { if (!e) { cur.steps.splice(cur.i + 1); return; } spot.x = gx0 + (fo.side === "h" ? 21 : -21); } }
        ball.flight = null; ball.carrier = null; ball.x = spot.x; ball.y = spot.y; ball.z = 0; over.gk = null;
        fo.x = spot.x + (fo.side === "h" ? -1.2 : 1.2); fo.y = spot.y; vi.x = spot.x; vi.y = spot.y + 1;
        halt = true; poss = vi.side; 
        const t = `🚩 Falta de ${fo.p.name} em ${vi.p.name}`; say(t, false, 2.4); narrate("Apito do árbitro! Falta marcada"); addFeed(`🚩 Falta de <b>${esc(fo.p.name)}</b> (${esc(fo.side === "h" ? M.H.name : M.A.name)})`);
      }, 1.6));
      if (kind !== "plain") st.push(FN(() => {
        if (fo) marks.push({ x: fo.x, y: fo.y, k: kind, t: 0 });
        const t = kind === "yellow" ? `🟨 Cartão amarelo: ${e.name}` : `🟥 Expulso: ${e.name}`;
        say(t, false, 2.4); addFeed(`${t.replace(e.name, "<b>" + esc(e.name) + "</b>")} (${esc(e.club)})`); if (kind === "red") release(e.name);
      }, kind === "red" ? 2.2 : 1.6));
      st.push(FN(() => { halt = false; if (!vi || !spot) return; const m = {}; const tgx = vi.side === "h" ? W : 0, dgl = Math.hypot(spot.x - tgx, spot.y - 34);
        near = dgl < 32 && dgl > 17;
        if (near) { // barreira: defensores em linha a 9,5 m da bola, na direção do gol
          const a = Math.atan2(34 - spot.y, tgx - spot.x), nw = dgl < 22 ? 5 : dgl < 27 ? 4 : 3, def = team(other(vi.side)).filter((o) => o.p.pos !== "GK").sort((p1, p2) => Math.hypot(p1.x - spot.x, p1.y - spot.y) - Math.hypot(p2.x - spot.x, p2.y - spot.y)).slice(0, nw);
          const bx = spot.x + 9.5 * Math.cos(a), by = spot.y + 9.5 * Math.sin(a);
          def.forEach((o, i) => { const off = (i - (def.length - 1) / 2) * 1.15; m[o.p.id] = [bx - Math.sin(a) * off, by + Math.cos(a) * off]; });
        }
        for (const o of team(other(vi.side))) { if (m[o.p.id]) continue; const d = Math.hypot(o.x - spot.x, o.y - spot.y); if (d < 10 && o.p.pos !== "GK") { const a = Math.atan2(o.y - spot.y, o.x - spot.x); m[o.p.id] = [spot.x + 10.5 * Math.cos(a), spot.y + 10.5 * Math.sin(a)]; } } over.pos = m; }, 2.4));
      st.push({ fl: 1, start() {
        halt = false; SNAPP();
        if (!vi || !spot) return;
        const kk = nearest(team(vi.side).filter((x) => x.p.pos !== "GK" && x !== fo), spot.x, spot.y) || vi;
        kk.x = spot.x - (vi.side === "h" ? 0.8 : -0.8); kk.y = spot.y; setCarrier(kk); narrate("Cobrança de falta, o jogo continua");
        if (near) { const kind2 = pickW(["save", "wide", "block", "savec"], [3, 3, 2.4, 1]); cur.steps.push(WAIT(0.5)); shotSteps(cur.steps, vi.side, kind2, kk, kk.p.name); cur.steps.push(FN(() => { over.pos = null; if (kind2 === "wide") { const f = goalKick(other(vi.side)); f.ill = true; q.unshift(f); } else if (kind2 === "savec") { const f = corner(vi.side); f.ill = true; q.unshift(f); } }, 0)); return; }
        const ms = team(vi.side).filter((x) => x !== kk && x.p.pos !== "GK"), r = nearest(ms, spot.x + (vi.side === "h" ? 10 : -10), spot.y);
        if (r) flight(spot.x, spot.y, r.x, r.y, Math.max(0.5, Math.hypot(r.x - spot.x, r.y - spot.y) / 18), () => setCarrier(r), 2, r); else ball.fl = 0;
      } });
    };
  }
  function cardScript(kind, e) {
    return (cur) => {
      cur.steps.push(FN(() => {
        const o = findP(e.name, e.side);
        if (o) marks.push({ x: o.x, y: o.y, k: kind, t: 0 });
        const t = kind === "yellow" ? `🟨 Cartão amarelo: ${e.name}` : kind === "red" ? `🟥 Expulso: ${e.name}` : `🚑 Lesão: ${e.name}`;
        say(t, false, 2.4); addFeed(`${t.replace(e.name, "<b>" + esc(e.name) + "</b>")} (${esc(e.club)})`);
      }, kind === "red" ? 2 : 1.3));
    };
  }
  function injScript(e) {
    return (cur) => {
      const st = cur.steps; let o = null; cur.inj = true;
      st.push(FN(() => {
        o = findP(e.name, e.side); if (!o) return; injHold = true; injF = o; injT = 0;
        halt = true; ball.flight = null; ball.carrier = null; ball.z = 0; over.run = null; over.gk = null; over.pos = null; o.down = true;
        const t = `🚑 Jogador caído: ${e.name}`; say(t, false, 2.8); narrate("Jogo parado: " + sur(o) + " recebe atendimento médico"); addFeed(`🚑 Lesão: <b>${esc(e.name)}</b> (${esc(e.club)})`);
        const up = o.y < 34, ey = up ? -1.8 : H + 1.8, ty = o.y + (up ? -1.3 : 1.3);
        meds = [{ x: o.x - 4, y: ey, tx: o.x - 1.2, ty }, { x: o.x + 4, y: ey, tx: o.x + 1.2, ty }];
      }, 0.3));
      st.push({ dur: 7, start() {}, until: () => !o || meds.every((m) => Math.hypot(m.x - m.tx, m.y - m.ty) < 0.5) });
      st.push(WAIT(3));
      st.push(FN(() => { if (o) o.down = false; meds.forEach((m) => { m.ty = o && o.y < 34 ? -2.2 : H + 2.2; }); }, 0.6));
      st.push({ dur: 5, start() {}, until: () => meds.every((m) => Math.hypot(m.x - m.tx, m.y - m.ty) < 0.5) });
      st.push(FN(() => { meds = []; halt = false; injHold = false; if (o) { poss = o.side; } }, 0));
    };
  }
  function release(name) { const o = leaving.find((x) => x.p.name === name); if (o && o.leave) o.leave.go = true; const n = Object.values(P).find((x) => x.p.name === name && x.wait); if (n) n.wait = false; }
  function subScript(e) { return (cur) => { cur.steps.push(FN(() => { release(e.out); release(e.name); say(`🔁 Entra ${e.name}, sai ${e.out}`); addFeed(`🔁 Entra ${esc(e.name)}, sai ${esc(e.out)} (${esc(e.club)})`); }, 1)); }; }

  function handle(e) {
    const s = e.side; q = q.filter((f) => !f.ill);
    if (e.type === "goal") q.push(e.how === "corner" ? corner(s, e.name) : chance(s, { name: e.name, kind: "goal", how: e.how }));
    else if (e.type === "penwin") q.push(penaltyWin(s, e));
    else if (e.type === "pen") q.push(penaltyKick(s, e));
    else if (e.type === "yellow") q.push(foulScript("yellow", e));
    else if (e.type === "red") q.push(foulScript("red", e));
    else if (e.type === "inj") q.push(injScript(e));
    else if (e.type === "sub") q.push(subScript(e));
  }
  function sync() {
    if (!M) return;
    while (seen < M.ev.length) handle(M.ev[seen++]);
    if (lag > 5000) q = q.filter((f) => !f.ill);
    if (L && L.added != null && L.added !== lastAdded && L.minute >= 90) { lastAdded = L.added; const n = L.added; q.push((cur) => { cur.steps.push(FN(() => { say("⏱ Acréscimos: " + n + " min", false, 2.4); addFeed("⏱ Acréscimos: " + n + " minutos"); }, 1)); }); }
    if (L && L.added == null) lastAdded = null;
    if (M.min != null && M.min !== lastMin) {
      lastMin = M.min;
      if (M.min >= 45 && !halfDone && L && !L.done) { halfDone = true; q.push((cur) => { let hw = 0; cur.steps.push({ dur: 16, start() { hw = 0; }, until() { if (Math.abs(ball.x - W / 2) < 18 && !ball.flight) return true; if (!ball.flight && !freeze) { hw += lastDt; if (hw > 6) { hw = -99; const nt = nearest(team(other(poss)).filter((o) => o.p.pos !== "GK"), W / 2, H / 2); flight(ball.x, ball.y, W / 2, H / 2 + (R() - 0.5) * 8, Math.max(0.9, Math.hypot(ball.x - W / 2, ball.y - H / 2) / 22), () => { if (nt) setCarrier(nt); }, 5); } } return false; } }); cur.steps.push(FN(() => { halt = true; say("⏸️ Fim do primeiro tempo", true, 3.2); narrate("Apita o árbitro: fim do primeiro tempo"); addFeed("⏸️ Fim do primeiro tempo"); }, 3.2)); cur.steps.push(FN(() => { halt = false; flip = true; q.unshift(kickoff("a")); say("▶️ Começa o segundo tempo", false, 2.4); }, 0)); }); }
      if (M.px) share = clamp(M.px.h / Math.max(M.px.h + M.px.a, 1e-9), 0.3, 0.7);
      for (const side of ["h", "a"]) {
        const sh = side === "h" ? share : 1 - share;
        if (q.length < 2 && !freeze && lag < 2500 && side === "h" && Math.abs(ball.y - H / 2) > 27 && ball.carrier != null && R() < 0.5) { const fn = throwIn(other(poss)); fn.ill = true; q.push(fn); }
        if (q.length < 2 && !freeze && lag < 2500 && side === "h" && R() < 0.03) { const fn = foulScript("plain", null); fn.ill = true; q.push(fn); }
        if (q.length < 2 && !freeze && lag < 2500 && R() < 0.06 * 2 * sh) { // chance ilustrativa (sem gol)
          const kind = pickW(["save", "wide", "block", "post"], [5, 2.6, 1.6, 0.8]);
          const fn = chance(side, { kind }); fn.ill = true; q.push(fn);
        }
      }
    }
  }
  function finishCur() { cur = null; over.pos = null; focus = null; }
  function runScript(dt) {
    if (!cur) { if (!q.length) return false; cur = { steps: [], i: 0, age: 0 }; q.shift()(cur); if (!cur.steps.length) { cur = null; return false; } }
    cur.age += dt;
    if (cur.age > 26) { ball.flight = null; over.gk = null; over.pos = null; focus = null; finishCur(); return false; }
    const s = cur.steps[cur.i];
    if (!s) { finishCur(); return false; }
    if (!s.on) { s.on = 1; s.t = 0; s.start(); }
    s.t += dt;
    if (s.fl ? !ball.flight : s.until ? (s.until() || s.t >= s.dur) : s.t >= s.dur) cur.i++;
    return true;
  }

  // ---------- quadro a quadro ----------
  function step(dt) {
    if (shotT > 0) shotT -= dt; if (slow > 0) { slow -= dt; dt *= 0.35; }
    dt *= 0.85 * (1 + clamp(lag / 8000, 0, 1.3)); clock += dt;
    sync(); layout();
    if (L && L.done && !cur && !q.length && !ended && endWait < 14 && !(Math.abs(ball.x - W / 2) < 18 && !ball.flight)) { endWait += lastDt; if (endWait > 0.5 && !ball.flight && !freeze) { const nt = nearest(team(other(poss)).filter((o) => o.p.pos !== "GK"), W / 2, H / 2); flight(ball.x, ball.y, W / 2, H / 2 + (R() - 0.5) * 8, Math.max(0.9, Math.hypot(ball.x - W / 2, ball.y - H / 2) / 22), () => { if (nt) setCarrier(nt); }, 5); } }
    else if (L && L.done && !cur && !q.length) { if (!ended) { ended = true; say("🏁 Fim de jogo", true, 4); narrate("Apita o árbitro: fim de jogo"); addFeed("🏁 Fim de jogo"); ball.flight = null; over.run = null; over.pos = null; } halt = true; freeze = true; }
    for (const sd of ["h", "a"]) press[sd] = team(sd).filter((o) => o.p.pos !== "GK" && o.p.id !== ball.carrier).sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y)).slice(0, 3);
    for (const id in P) {
      const o = P[id]; if (!o.live) continue;
      if (o.kick > 0) o.kick -= dt;
      if (o.wait) { o.waitT = (o.waitT || 0) + dt; if (o.waitT > 12) { o.wait = false; o.waitT = 0; } }
      if (halt || o.wait) continue;
      o.wt -= dt;
      if (o.wt <= 0) {
        o.wt = 1.6 + R() * 2.6; const gk = o.p.pos === "GK", atk = poss === o.side, role = o.p.pos;
        if (gk) { o.twx = 0; o.twy = 0; }
        else if (atk) { o.twx = role === "ATT" ? 0.04 + R() * 0.2 : role === "MID" ? 0.02 + R() * 0.15 : R() < 0.35 ? 0.05 + R() * 0.12 : (R() - 0.5) * 0.1; o.twy = (R() - 0.5) * 0.5; }
        else { o.twx = role === "ATT" ? -R() * 0.12 : -(0.02 + R() * 0.12); o.twy = (R() - 0.5) * 0.35; }
      }
      o.wx += (o.twx - o.wx) * Math.min(1, dt * 0.9); o.wy += (o.twy - o.wy) * Math.min(1, dt * 0.9);
      const t = target(o), pr = press[o.side].indexOf(o);
      if (pr >= 0 && !over.gk && !(over.pos && over.pos[o.p.id])) { const kk = poss === o.side ? 0.35 : 0.6; t[0] += (ball.x - t[0]) * kk; t[1] += (ball.y - t[1]) * kk; }
      const k = Math.min(1, dt * (over.pos && over.pos[o.p.id] ? 6 : ball.carrier === o.p.id ? 3.2 : o.p.pos === "GK" && over.gk ? 6 : 2));
      let mx = (t[0] - o.x) * k, my = (t[1] - o.y) * k;
      const sp = (over.run && over.run.o === o ? 9.5 : over.pos && over.pos[o.p.id] ? 9 : ball.carrier === o.p.id ? 5.2 : o.p.pos === "GK" ? 7 : 6.4) * dt, ml = Math.hypot(mx, my);
      if (ml > sp) { mx *= sp / ml; my *= sp / ml; }
      o.x += mx; o.y += my;
    }
    for (const m of meds) { const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy); if (d > 0.01) { const v = Math.min(d, 7.5 * dt); m.x += dx / d * v; m.y += dy / d * v; } }
    for (const o of leaving) { o.leave.age += dt; if (!o.leave.go && o.leave.age > 14) o.leave.go = true; if (o.leave.go && !o.down) { const ty = o.y < 34 ? -2 : H + 2, dy = ty - o.y, v = Math.min(Math.abs(dy), 4.8 * dt); o.y += Math.sign(dy) * v; if (Math.abs(dy) < 0.2) o.leave.done = true; } }
    leaving = leaving.filter((o) => o.leave && !o.leave.done);
    const b = ball.flight;
    if (b) {
      if (b.ref) { b.x1 = b.ref.x; b.y1 = b.ref.y; }
      b.t += dt; const f = Math.min(1, b.t / b.dur);
      ball.x = b.x0 + (b.x1 - b.x0) * f; ball.y = b.y0 + (b.y1 - b.y0) * f; ball.z = Math.sin(Math.PI * f) * b.h;
      if (f >= 1) { ball.flight = null; ball.z = 0; b.done && b.done(); }
    } else {
      ball.z = 0;
      const c = ball.carrier != null && P[ball.carrier];
      if (c && c.live) { const d = c.side === "h" ? 1 : -1; ball.x = c.x + d * 0.9; ball.y = c.y + 0.3; }
    }
    // vigia: se a fila de lances passar de 40 s seguidos sem esvaziar, descarta tudo para o relógio do jogo não travar
    if (cur || q.length) { wdT += dt; if (wdT > 40 && !(L && L.done)) { wdT = 0; q = []; cur = null; ball.flight = null; over.gk = null; over.pos = null; over.run = null; focus = null; halt = false; freeze = false; } } else wdT = 0;
    if (shotCool > 0) shotCool -= dt;
    if (injF) { injT += dt; const gone = !!(injF.leave && (injF.leave.done || (injF.leave.go && (injF.y < -1.5 || injF.y > H + 1.5)))); if (gone || injT > 70) { injF = null; focus = null; } else focus = { x: injF.x, y: injF.y }; }
    const scripted = runScript(dt);
    if (!scripted && !freeze && !ball.flight) { { const bc = ball.carrier != null && P[ball.carrier]; if (bc && bc.live && bc.p.pos !== "GK" && Math.abs(bc.x - (bc.side === "h" ? W : 0)) < 18 && Math.abs(bc.y - 34) < 21) { boxT += dt; if (boxT > 1.6) { passT = 0; boxT = 0; } } else boxT = 0; } passT -= dt; if (passT <= 0) { ambient(); passT = 0.4 + R() * 0.45; } }
    stat[poss].poss += dt;
    if (capT > 0) capT -= dt;
    if (narrT > 0) narrT -= dt;
    if (flash > 0) flash -= dt;
    marks.forEach((m) => (m.t += dt)); marks = marks.filter((m) => m.t < 2.6);
  }

  // ---------- visão 3D (perspectiva real calculada à mão sobre o mesmo canvas, sem biblioteca) ----------
  function field3d(s, bandPx, k) {
    const w = cv.width, hgt = cv.height - bandPx, tx = clamp(ball.x, 16, W - 16);
    camX += (tx - camX) * 0.07;
    const C = [camX, -13, 15], T = [camX, 30, 0];
    let f = [T[0] - C[0], T[1] - C[1], T[2] - C[2]]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
    const rt = [1, 0, 0], up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
    const FOC = w * fl / 40, ox = w / 2, oy = bandPx + hgt * 0.5;
    const pr = (x, y, z) => { const d = [x - C[0], y - C[1], (z || 0) - C[2]], dz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (dz < 1) return null; return [ox + FOC * (d[0] * rt[0]) / dz, oy - FOC * (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / dz, FOC / dz]; };
    cx.save(); cx.beginPath(); cx.rect(0, bandPx, w, hgt); cx.clip();
    const sky = cx.createLinearGradient(0, bandPx, 0, oy); sky.addColorStop(0, "#0c1824"); sky.addColorStop(1, "#1e3347"); cx.fillStyle = sky; cx.fillRect(0, bandPx, w, hgt);
    const poly = (pts, fill) => { cx.beginPath(); pts.forEach((p, i) => { if (p) (i ? cx.lineTo : cx.moveTo).call(cx, p[0], p[1]); }); cx.closePath(); cx.fillStyle = fill; cx.fill(); };
    // arquibancada ao fundo
    poly([pr(-12, H + 4, 0), pr(W + 12, H + 4, 0), pr(W + 12, H + 14, 9), pr(-12, H + 14, 9)], "#24323f");
    for (let i = 0; i < 520; i++) { const u = (i * 0.6180339) % 1, v = (i * 0.7548776) % 1, p = pr(-12 + u * (W + 24), H + 4.4 + v * 9.2, 0.2 + v * 8.6); if (p) { cx.fillStyle = ["#d9534f", "#f0ad4e", "#5bc0de", "#e8e8e8", "#7a8da0"][i % 5]; cx.globalAlpha = 0.75; cx.fillRect(p[0], p[1], Math.max(1.5, p[2] * 0.5), Math.max(1.5, p[2] * 0.6)); } }
    cx.globalAlpha = 1;
    poly([pr(-12, -6, 0), pr(W + 12, -6, 0), pr(W + 12, H + 4, 0), pr(-12, H + 4, 0)], "#1f6b36");
    const N = 14; for (let i = 0; i < N; i++) poly([pr(i * W / N, 0, 0), pr((i + 1) * W / N, 0, 0), pr((i + 1) * W / N, H, 0), pr(i * W / N, H, 0)], i % 2 ? "#2f9248" : "#2a8040");
    cx.strokeStyle = "rgba(255,255,255,.9)"; cx.lineWidth = Math.max(1.2, s * 0.22); cx.lineJoin = "round";
    const path = (pts) => { cx.beginPath(); let st = false; for (const p of pts) { if (!p) { st = false; continue; } if (!st) { cx.moveTo(p[0], p[1]); st = true; } else cx.lineTo(p[0], p[1]); } cx.stroke(); };
    const ln = (pts) => path(pts.map((q) => pr(q[0], q[1], 0)));
    const arc = (x0, y0, r, a0, a1) => { const o = []; for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40; o.push([x0 + r * Math.cos(a), y0 + r * Math.sin(a)]); } ln(o); };
    ln([[0, 0], [W, 0], [W, H], [0, H], [0, 0]]); ln([[W / 2, 0], [W / 2, H]]); arc(W / 2, H / 2, 9.15, 0, 7);
    const aa = Math.acos(5.5 / 9.15);
    for (const sd of [0, 1]) {
      const g = (x) => (sd ? W - x : x);
      ln([[g(0), (H - 40.32) / 2], [g(16.5), (H - 40.32) / 2], [g(16.5), (H + 40.32) / 2], [g(0), (H + 40.32) / 2]]);
      ln([[g(0), (H - 18.32) / 2], [g(5.5), (H - 18.32) / 2], [g(5.5), (H + 18.32) / 2], [g(0), (H + 18.32) / 2]]);
      arc(g(11), H / 2, 9.15, sd ? Math.PI - aa : -aa, sd ? Math.PI + aa : aa);
    }
    // traves e redes
    const gl = flash > 0 ? "rgba(255,230,90," + Math.min(1, flash) + ")" : "rgba(255,255,255,.95)";
    for (const sd of [0, 1]) {
      const gx = sd ? W : 0, bk = sd ? 2.2 : -2.2, y1 = (H - 7.32) / 2, y2 = (H + 7.32) / 2;
      const a = pr(gx, y1, 0), b = pr(gx, y1, 2.44), c = pr(gx, y2, 2.44), d = pr(gx, y2, 0), a2 = pr(gx + bk, y1, 0), b2 = pr(gx + bk, y1, 2.44), c2 = pr(gx + bk, y2, 2.44), d2 = pr(gx + bk, y2, 0);
      if (a && b && c && d && b2 && c2 && a2 && d2) {
        cx.strokeStyle = "rgba(255,255,255,.28)"; cx.lineWidth = 1; for (let i = 0; i <= 8; i++) { const yy = y1 + (y2 - y1) * i / 8; path([pr(gx, yy, 2.44), pr(gx + bk, yy, 2.44), pr(gx + bk, yy, 0)]); }
        path([b, b2, a2]); path([c, c2, d2]); path([b2, c2]);
        cx.strokeStyle = gl; cx.lineWidth = Math.max(2, s * 0.35); path([a, b, c, d]);
      }
    }
    // jogadores e bola, do mais distante para o mais próximo
    const ents = Object.values(P).filter((o) => o.live).map((o) => ({ o, y: o.y })); ents.push({ ball: 1, y: ball.y });
    ents.sort((a, b) => b.y - a.y);
    const drawBall = () => {
      const g = pr(ball.x, ball.y, 0), t = pr(ball.x, ball.y, 0.22 + (ball.z || 0) * 1.2); if (!g || !t) return;
      const br = Math.max(2.5, t[2] * 0.24);
      cx.fillStyle = "rgba(0,0,0,.35)"; cx.beginPath(); cx.ellipse(g[0], g[1], br * 1.1, br * 0.42, 0, 0, 7); cx.fill();
      cx.fillStyle = "#fff"; cx.strokeStyle = "#111"; cx.lineWidth = Math.max(1, br * 0.18); cx.beginPath(); cx.arc(t[0], t[1], br, 0, 7); cx.fill(); cx.stroke();
    };
    for (const e of ents) {
      if (e.ball) { drawBall(); continue; }
      const o = e.o, gk = o.p.pos === "GK", fill = gk ? (o.side === "h" ? k.gh : k.ga) : k[o.side];
      const g = pr(o.x, o.y, 0), hd = pr(o.x, o.y, 1.78); if (!g || !hd) continue;
      const mv = Math.hypot(o.x - (o._lx == null ? o.x : o._lx), o.y - (o._ly == null ? o.y : o._ly)); o._lx = o.x; o._ly = o.y; o._m = (o._m || 0) * 0.85 + Math.min(mv, 0.4) * 0.15;
      const hpx = g[1] - hd[1], u = hpx / 1.78, ph = clock * 9 + o.p.id, sw = Math.sin(ph) * clamp(o._m * 9, 0.05, 1) * 0.28 * u;
      const dir = o.x - (o._px == null ? o.x : o._px) >= 0 ? 1 : -1; o._px = o.x;
      cx.fillStyle = "rgba(0,0,0,.33)"; cx.beginPath(); cx.ellipse(g[0], g[1], u * 0.36, u * 0.13, 0, 0, 7); cx.fill();
      cx.lineCap = "round";
      cx.strokeStyle = "#e6b99a"; cx.lineWidth = Math.max(1.5, u * 0.14); cx.beginPath(); cx.moveTo(g[0] - u * 0.12, g[1] - u * 0.45); cx.lineTo(g[0] - u * 0.12 + sw, g[1]); cx.moveTo(g[0] + u * 0.12, g[1] - u * 0.45); cx.lineTo(g[0] + u * 0.12 - sw, g[1]); cx.stroke();
      cx.strokeStyle = "#1a1a1a"; cx.lineWidth = Math.max(1.5, u * 0.2); cx.beginPath(); cx.moveTo(g[0] - u * 0.12, g[1] - u * 0.62); cx.lineTo(g[0] - u * 0.12, g[1] - u * 0.42); cx.moveTo(g[0] + u * 0.12, g[1] - u * 0.62); cx.lineTo(g[0] + u * 0.12, g[1] - u * 0.42); cx.stroke();
      cx.strokeStyle = fill; cx.lineWidth = Math.max(2.5, u * 0.42); cx.beginPath(); cx.moveTo(g[0], g[1] - u * 0.66); cx.lineTo(g[0], g[1] - u * 1.2); cx.stroke();
      cx.strokeStyle = fill; cx.lineWidth = Math.max(1.5, u * 0.12); cx.beginPath(); cx.moveTo(g[0] - u * 0.22, g[1] - u * 1.15); cx.lineTo(g[0] - u * 0.26 - sw * 0.6, g[1] - u * 0.78); cx.moveTo(g[0] + u * 0.22, g[1] - u * 1.15); cx.lineTo(g[0] + u * 0.26 + sw * 0.6, g[1] - u * 0.78); cx.stroke();
      cx.fillStyle = "#e6b99a"; cx.beginPath(); cx.arc(g[0], g[1] - u * 1.4, Math.max(2, u * 0.17), 0, 7); cx.fill();
      cx.fillStyle = "#2b1d12"; cx.beginPath(); cx.arc(g[0], g[1] - u * 1.45, Math.max(2, u * 0.17), Math.PI, 0); cx.fill();
      if (u > 20) { cx.fillStyle = lum(fill) > 150 ? "#111" : "#fff"; cx.font = "bold " + Math.round(u * 0.3) + "px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(o.n, g[0], g[1] - u * 0.93); }
      if (ball.carrier === o.p.id) {
        cx.strokeStyle = "#ffd166"; cx.lineWidth = Math.max(2, u * 0.07); cx.beginPath(); cx.ellipse(g[0], g[1], u * 0.5, u * 0.19, 0, 0, 7); cx.stroke();
        const nm = o.p.name, fs = Math.max(10, Math.round(u * 0.36)); cx.font = "600 " + fs + "px sans-serif"; const tw = cx.measureText(nm).width + 8;
        const bc = k[o.p.side] || "#000", lt = lum(bc) > 150; cx.fillStyle = bc; cx.fillRect(g[0] - tw / 2, g[1] - u * 1.45 - fs - 14, tw, fs + 4); cx.strokeStyle = lt ? "#111" : "#fff"; cx.lineWidth = 1.5; cx.strokeRect(g[0] - tw / 2, g[1] - u * 1.45 - fs - 14, tw, fs + 4); cx.fillStyle = lt ? "#111" : "#fff"; cx.textAlign = "center"; cx.textBaseline = "top"; cx.fillText(nm, g[0], g[1] - u * 1.45 - fs - 12);
      }
    }
    for (const m of marks) {
      const p = pr(m.x, m.y, 2.5 + Math.min(m.t, 0.4)); if (!p) continue; const r = Math.max(5, p[2] * 0.5), a = m.t > 2 ? 1 - (m.t - 2) / 0.6 : 1;
      cx.globalAlpha = Math.max(0, a);
      if (m.k === "inj") { cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(p[0], p[1], r * 0.95, 0, 7); cx.fill(); cx.fillStyle = "#d33"; cx.fillRect(p[0] - r * 0.55, p[1] - r * 0.15, r * 1.1, r * 0.3); cx.fillRect(p[0] - r * 0.15, p[1] - r * 0.55, r * 0.3, r * 1.1); }
      else { cx.fillStyle = m.k === "red" ? "#e11" : "#ffd400"; cx.fillRect(p[0] - r * 0.55, p[1] - r * 0.85, r * 1.1, r * 1.7); cx.strokeStyle = "#000"; cx.lineWidth = 1; cx.strokeRect(p[0] - r * 0.55, p[1] - r * 0.85, r * 1.1, r * 1.7); }
      cx.globalAlpha = 1;
    }
    cx.restore();
  }
  // ---------- desenho ----------
  function draw() {
    const w = cv.clientWidth; if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(w * dpr), ph = Math.round((cv.clientHeight || w * (H + 2 * M_ + BAND) / (W + 2 * M_)) * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    hh = cv.clientHeight;
    const s = cv.width / (W + 2 * M_), bandPx = BAND * s; let X = (x) => (x + M_) * s, Y = (y) => (y + M_ + BAND) * s;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    const k = kits();
    cx.fillStyle = "#15202b"; cx.fillRect(0, 0, cv.width, cv.height);
    if (v3 && typeof Campo3D !== "undefined" && Campo3D.ready()) {
      const gw = cv.width, gh2 = cv.height - bandPx, st3 = { w: gw, h: gh2, dt: lastDt, k, ball, marks, focus, flip, cam: camMode, pen: penCam, zoom: zoomF, flash, shot: shotT > 0 ? { gx: shotGx } : null, players: Object.values(P).filter((o) => o.live).concat(leaving.filter((o) => !o.live)).map((o) => ({ id: o.p.id, x: o.x, y: o.y, side: o.side, gk: o.p.pos === "GK", n: o.n, name: o.p.name, carrier: ball.carrier === o.p.id, kick: o.kick > 0 ? 1 - o.kick / 0.45 : -1, down: !!o.down, cel: !!o.cel })).concat(meds.map((m, i) => ({ id: "med" + i, x: m.x, y: m.y, side: "m", gk: false, n: "", name: "", carrier: false, kick: -1, down: false, cel: false, kitCol: "#f4f4f4" }))) };
      const im = Campo3D.render(st3); if (im) cx.drawImage(im, 0, bandPx, gw, gh2);
    } else if (v3) { field3d(s, bandPx, k); if (typeof Campo3D !== "undefined" && Campo3D.state() === "loading") { cx.fillStyle = "rgba(0,0,0,.6)"; cx.fillRect(0, cv.height - 28, cv.width, 28); cx.fillStyle = "#fff"; cx.font = "600 14px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText("Carregando 3D...", cv.width / 2, cv.height - 14); } } else {
    cx.fillStyle = "#24703a"; cx.fillRect(0, bandPx, cv.width, cv.height - bandPx);
    const n = 14;
    for (let i = 0; i < n; i++) { cx.fillStyle = i % 2 ? "#2d8b43" : "#2a8040"; cx.fillRect(X(i * W / n), Y(0), Math.ceil(W / n * s) + 1, H * s); }
    cx.strokeStyle = "rgba(255,255,255,.85)"; cx.lineWidth = Math.max(1, 0.25 * s);
    const line = (a, b, c, d) => { cx.beginPath(); cx.moveTo(X(a), Y(b)); cx.lineTo(X(c), Y(d)); cx.stroke(); };
    cx.strokeRect(X(0), Y(0), W * s, H * s); line(W / 2, 0, W / 2, H);
    cx.beginPath(); cx.arc(X(W / 2), Y(H / 2), 9.15 * s, 0, 7); cx.stroke();
    cx.beginPath(); cx.arc(X(W / 2), Y(H / 2), 0.45 * s, 0, 7); cx.fillStyle = "#fff"; cx.fill();
    for (const sd of [0, 1]) {
      const f = (x) => (sd ? W - x : x), dirx = sd ? -1 : 1;
      cx.strokeRect(X(sd ? W - 16.5 : 0), Y((H - 40.32) / 2), 16.5 * s, 40.32 * s);
      cx.strokeRect(X(sd ? W - 5.5 : 0), Y((H - 18.32) / 2), 5.5 * s, 18.32 * s);
      cx.beginPath(); cx.arc(X(f(11)), Y(H / 2), 0.4 * s, 0, 7); cx.fill();
      const a = Math.acos(5.5 / 9.15);
      cx.beginPath(); cx.arc(X(f(11)), Y(H / 2), 9.15 * s, sd ? Math.PI - a : -a, sd ? Math.PI + a : a); cx.stroke();
      const sgs = flip ? (shownGoalSide === "h" ? "a" : "h") : shownGoalSide; cx.fillStyle = flash > 0 && ((sd && sgs === "h") || (!sd && sgs === "a")) ? "rgba(255,230,90," + Math.min(1, flash) + ")" : "rgba(255,255,255,.25)";
      cx.fillRect(X(sd ? W : -M_ + 0.2), Y((H - 7.32) / 2), (M_ - 0.2) * s, 7.32 * s);
    }
    if (flip) { X = (x) => (W - x + M_) * s; Y = (y) => (H - y + M_ + BAND) * s; }
    const ordered = Object.values(P).filter((o) => o.live).concat(leaving.filter((o) => !o.live)).sort((a, b) => a.y - b.y), r = 1.45 * s;
    for (const o of ordered) {
      const px = X(o.x + Math.sin(clock * 1.7 + o.p.id) * 0.25), py = Y(o.y + Math.cos(clock * 1.3 + o.p.id) * 0.25), gk = o.p.pos === "GK";
      const fill = gk ? (o.side === "h" ? k.gh : k.ga) : k[o.side];
      if (o.down) { cx.fillStyle = fill; cx.strokeStyle = "#fff"; cx.lineWidth = Math.max(1, 0.2 * s); cx.beginPath(); cx.ellipse(px, py, r * 1.7, r * 0.7, 0, 0, 7); cx.fill(); cx.stroke(); continue; }
      cx.fillStyle = "rgba(0,0,0,.25)"; cx.beginPath(); cx.ellipse(px, py + r * 0.7, r * 0.95, r * 0.4, 0, 0, 7); cx.fill();
      cx.fillStyle = fill; cx.beginPath(); cx.arc(px, py, r, 0, 7); cx.fill();
      cx.lineWidth = Math.max(1, 0.2 * s); cx.strokeStyle = "#fff"; cx.stroke();
      if (r >= 6) { cx.fillStyle = lum(fill) > 150 ? "#111" : "#fff"; cx.font = "bold " + Math.round(r * 1.0) + "px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(o.n, px, py + 0.5); }
      if (ball.carrier === o.p.id) {
        cx.strokeStyle = "#ffd166"; cx.lineWidth = Math.max(2, 0.35 * s); cx.beginPath(); cx.arc(px, py, r + 0.6 * s, 0, 7); cx.stroke();
        const nm = o.p.name, fs = Math.max(14, Math.round(2.7 * s));
        cx.font = "600 " + fs + "px sans-serif"; const tw = cx.measureText(nm).width + 8;
        cx.fillStyle = "rgba(0,0,0,.65)"; cx.fillRect(px - tw / 2, py + r + 3, tw, fs + 4);
        cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "top"; cx.fillText(nm, px, py + r + 5);
      }
    }
    for (const md of meds) { const mx = X(md.x), my = Y(md.y); cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(mx, my, r * 0.9, 0, 7); cx.fill(); cx.fillStyle = "#d33"; cx.fillRect(mx - r * 0.5, my - r * 0.14, r, r * 0.28); cx.fillRect(mx - r * 0.14, my - r * 0.5, r * 0.28, r); }
    for (const m of marks) {
      const mx = X(m.x), my = Y(m.y) - r * 2.4 - Math.min(m.t, 0.4) * 10, a = m.t > 2 ? 1 - (m.t - 2) / 0.6 : 1;
      cx.globalAlpha = Math.max(0, a);
      if (m.k === "inj") { cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(mx, my, r * 0.95, 0, 7); cx.fill(); cx.fillStyle = "#d33"; cx.fillRect(mx - r * 0.55, my - r * 0.15, r * 1.1, r * 0.3); cx.fillRect(mx - r * 0.15, my - r * 0.55, r * 0.3, r * 1.1); }
      else { cx.fillStyle = m.k === "red" ? "#e11" : "#ffd400"; cx.fillRect(mx - r * 0.55, my - r * 0.85, r * 1.1, r * 1.7); cx.strokeStyle = "#000"; cx.lineWidth = 1; cx.strokeRect(mx - r * 0.55, my - r * 0.85, r * 1.1, r * 1.7); }
      cx.globalAlpha = 1;
    }
    const bx = X(ball.x), by = Y(ball.y), z = (ball.z || 0) * s * 0.5, br = Math.max(3, 0.8 * s);
    cx.fillStyle = "rgba(0,0,0,.3)"; cx.beginPath(); cx.ellipse(bx, by + br * 0.5, br, br * 0.45, 0, 0, 7); cx.fill();
    cx.fillStyle = "#fff"; cx.strokeStyle = "#111"; cx.lineWidth = Math.max(1, 0.15 * s); cx.beginPath(); cx.arc(bx, by - z, br, 0, 7); cx.fill(); cx.stroke();
    }
    // placar fora do campo, em uma faixa acima dele
    let f1 = Math.max(17, Math.round(3.8 * s)); { const n1 = M.H.name, n2 = M.A.name; if (cv.width < 700) f1 = Math.max(f1, 28); while (f1 > 15) { cx.font = "800 " + f1 + "px sans-serif"; if (cx.measureText(n1).width + cx.measureText(n2).width + cx.measureText(" 0 x 0 ").width + f1 * 1.9 + 24 <= cv.width * 0.97) break; f1--; } }
    const f2s = Math.max(11, Math.round(2.0 * s));
    const nm1 = M.H.name, nm2 = M.A.name, scr = ` ${shown.h} x ${shown.a} `;
    cx.font = "800 " + f1 + "px sans-serif"; const wN1 = cx.measureText(nm1).width, wN2 = cx.measureText(nm2).width, wS = cx.measureText(scr).width + 10, rr = f1 * 0.42;
    const sub = [L && L.rodada, L && L.date].filter(Boolean).join("  ·  "), clk = L && L.done && !busy() ? "Fim de jogo" : "⏱ " + fmtMin(M.min || 0) + "'";
    const mid = cv.width / 2, cy1 = bandPx * 0.38;
    cx.textBaseline = "middle"; cx.font = "800 " + f1 + "px sans-serif";
    const pd = f1 * 0.35, bh = f1 * 1.35;
    for (const [sd, bx0, w0, t0, al] of [["h", mid - wS / 2 - wN1 - pd * 2, wN1 + pd * 2, nm1, "right"], ["a", mid + wS / 2, wN2 + pd * 2, nm2, "left"]]) {
      const bc = k[sd], lt = lum(bc) > 150; cx.fillStyle = bc; cx.fillRect(bx0, cy1 - bh / 2, w0, bh); cx.strokeStyle = lt ? "#111" : "#fff"; cx.lineWidth = 2; cx.strokeRect(bx0, cy1 - bh / 2, w0, bh);
      cx.fillStyle = lt ? "#111" : "#fff"; cx.textAlign = "center"; cx.fillText(t0, bx0 + w0 / 2, cy1);
    }
    cx.textAlign = "center"; cx.fillStyle = "#ffd166"; cx.fillText(scr, mid, cy1);
    cx.font = "700 " + f2s + "px sans-serif"; cx.textAlign = "center"; cx.fillStyle = "#cfd8e0"; { const ida = M.ida ? (() => { const [ra, rb] = M.ida.r; return "Ida: " + M.A.name + " " + (M.ida.home === 0 ? rb : ra) + " x " + (M.ida.home === 0 ? ra : rb) + " " + M.H.name; })() : ""; if (ida) { cx.fillStyle = "#ffd166"; cx.fillText(ida, mid, bandPx * 0.70); cx.fillStyle = "#cfd8e0"; cx.fillText(sub, mid, bandPx * 0.90); } else cx.fillText(sub, mid, bandPx * 0.78); }
    { const fc = cv.width < 700 ? Math.max(22, Math.round(3.3 * s)) : Math.max(16, Math.round(3.3 * s)); cx.font = "800 " + fc + "px sans-serif"; const wc = cx.measureText(clk).width + 18, hc = fc * 1.5, xc = cv.width - wc - 10, yc = (cv.width < 700 ? bandPx * 0.72 : cy1) - hc / 2; cx.fillStyle = "rgba(0,0,0,.72)"; cx.fillRect(xc, yc, wc, hc); cx.strokeStyle = "#ffd166"; cx.lineWidth = 2; cx.strokeRect(xc, yc, wc, hc); cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(clk, xc + wc / 2, yc + hc / 2); }
    // narração e avisos de lance: sempre na mesma faixa, no topo do campo, em letra grande
    const evTxt = capT > 0 && cap && !capBig ? cap : narrT > 0 && narr ? narr : "";
    if (evTxt && !(capT > 0 && cap && capBig)) {
      const fn = Math.max(14, Math.round(3.0 * s)); cx.font = "700 " + fn + "px sans-serif";
      const wn = Math.min(cv.width - 10, cx.measureText(evTxt).width + 26), yn = bandPx + (cv.height - bandPx) / 2 - (fn + 14) / 2;
      cx.globalAlpha = Math.min(1, (capT > 0 && cap && !capBig ? capT : narrT) * 1.5); const nbc = k[poss] || "#000", nlt = lum(nbc) > 150; cx.fillStyle = nbc; cx.fillRect(cv.width / 2 - wn / 2, yn, wn, fn + 14); cx.strokeStyle = nlt ? "#111" : "#fff"; cx.lineWidth = 2; cx.strokeRect(cv.width / 2 - wn / 2, yn, wn, fn + 14);
      cx.fillStyle = nlt ? "#111" : "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(evTxt, cv.width / 2, yn + (fn + 14) / 2, cv.width - 14); cx.globalAlpha = 1;
    }
    if (capT > 0 && cap && capBig) {
      const f2 = capBig ? Math.round(f1 * 1.5) : Math.round(f1 * 0.95);
      cx.font = "800 " + f2 + "px sans-serif"; const w2 = cx.measureText(cap).width + 24, yy = capBig ? bandPx + (cv.height - bandPx) / 2 - f2 : cv.height - f2 - 18;
      cx.globalAlpha = Math.min(1, capT * 2);
      cx.fillStyle = capBig ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.65)"; cx.fillRect(cv.width / 2 - w2 / 2, yy, w2, f2 + 12);
      cx.fillStyle = capBig ? "#ffd166" : "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(cap, cv.width / 2, yy + (f2 + 12) / 2);
      cx.globalAlpha = 1;
    }
  }
  let shownGoalSide = "h";

  function frame(ts) {
    raf = requestAnimationFrame(frame); sndTick();
    if (!M) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    lastDt = dt; try { step(dt); draw(); } catch (e) { console.error("campo", e); cur = null; q = []; ball.flight = null; }
  }

  return {
    start(live) {
      sndOn();
      stopLoop();
      L = live; M = live.matches.find((m) => (m.mine.h || m.mine.a) && !m.hold && !m.fin) || live.matches.find((m) => m.mine.h || m.mine.a) || live.matches[0];
      stat = { h: { poss: 0, shots: 0, onT: 0 }, a: { poss: 0, shots: 0, onT: 0 } }; lastAdded = null; P = {}; NUM = {}; USED = { h: {}, a: {} }; q = []; cur = null; feed = []; marks = []; over = {}; freeze = false; halt = false; ended = false; halfDone = false; flip = false; endWait = 0; penCam = null; ended = false; cap = ""; capT = 0; narr = ""; narrT = 0; flash = 0; lastMin = -1; poss = "h"; share = 0.5;
      seen = M.ev.length; shown = { h: M.gh || 0, a: M.ga || 0 };
      if (v3 && typeof Campo3D !== "undefined") Campo3D.load();
      leaving = []; meds = []; mounted = false; layout(); mounted = true; injF = null; restart("h"); placeBall(W / 2, H / 2); koInit = true; injHold = false; q.push(kickoff("h")); last = 0;
      raf = requestAnimationFrame(frame);
    },
    statsCard() {
      if (!M) return "";
      const evs = M.ev.slice(0, seen), cnt = (t, sd) => evs.filter((e) => e.type === t && e.side === sd).length, tot = stat.h.poss + stat.a.poss || 1, ph = Math.round(100 * stat.h.poss / tot), k = kits();
      const rows = [["Posse de bola", ph + "%", 100 - ph + "%"], ["Finalizações", stat.h.shots, stat.a.shots], ["Chutes no alvo", stat.h.onT, stat.a.onT], ["Gols", shown.h, shown.a], ["Pênaltis a favor", cnt("penwin", "h"), cnt("penwin", "a")], ["Cartões amarelos", cnt("yellow", "h"), cnt("yellow", "a")], ["Cartões vermelhos", cnt("red", "h"), cnt("red", "a")], ["Lesões", cnt("inj", "h"), cnt("inj", "a")], ["Substituições", M.subs ? M.subs.h : cnt("sub", "h"), M.subs ? M.subs.a : cnt("sub", "a")]];
      const dot = (c) => `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${c};border:1.5px solid #fff;vertical-align:-1px"></span>`;
      return `<div class="card"><h2>Estatísticas do jogo</h2><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:3px 10px;align-items:center;text-align:center;font-size:14px"><b style="text-align:left">${dot(k.h)} ${esc(M.H.name)}</b><span></span><b style="text-align:right">${esc(M.A.name)} ${dot(k.a)}</b>${rows.map((r) => `<b style="text-align:left;font-size:17px">${r[1]}</b><span class="mut">${r[0]}</span><b style="text-align:right;font-size:17px">${r[2]}</b>`).join("")}</div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin:10px 0 2px;border:1px solid #fff5"><div style="width:${ph}%;background:${k.h}"></div><div style="flex:1;background:${k.a}"></div></div>${M.gate ? `<p class="mut" style="margin:8px 0 0;font-size:13px">🏟️ Público ${M.gate.att.toLocaleString("pt-BR")} de ${M.gate.cap.toLocaleString("pt-BR")} · ingresso ${typeof money === "function" ? money(M.gate.price) : M.gate.price}</p>` : ""}<p class="mut" style="font-size:11px;margin:6px 0 0">Posse e finalizações vêm da animação (ilustrativas). Gols, cartões, lesões, pênaltis e trocas são reais.</p></div>`;
    },
    isTracked(m) { return m === M; },
    camNext() { const L3 = ["auto", "side", "aerial", "end"]; camMode = L3[(L3.indexOf(camMode) + 1) % 4]; const b = document.getElementById("c4b"); if (b) b.textContent = camLbl(); },
    dbgCarrier() { const o = team("h").filter((x) => x.p.pos !== "GK")[0]; if (o) { setCarrier(o); ball.flight = null; } },
    dbgBall(x, y) { q = []; cur = null; halt = true; placeBall(x, y); team("h").filter((o) => o.p.pos !== "GK").slice(0, 4).forEach((o, i) => { o.x = x + (i - 1) * 3; o.y = y + 1.5 + (i % 2) * 2; }); team("a").filter((o) => o.p.pos !== "GK").slice(0, 3).forEach((o, i) => { o.x = x + i * 3 - 2; o.y = y + 3; }); },
    setLag(v) { lag = v; },
    dbgFocus(f) { focus = f; },
    dbgPose() { q = []; cur = null; halt = true; const a = team("h").filter((o) => o.p.pos !== "GK").slice(0, 3); a.forEach((o, i) => { o.x = ball.x + 3 + i * 3; o.y = 26; if (i === 0) o.kick = 0.22; if (i === 1) o.down = true; if (i === 2) o.cel = true; }); },
    piece(k, side) { q = []; cur = null; over.pos = null; halt = false; q.push((k === "foul" ? foulScript("yellow", { name: (team(other(side)).find((x) => x.p.pos === "DEF") || {p:{name:""}}).p.name, side: other(side), club: "x" }) : { goal: goalKick, corner, kickoff, throw: throwIn }[k](side))); },
    score(m) { return m === M ? [shown.h, shown.a] : null; },
    zoom(d) { zoomF = Math.min(2.2, Math.max(0.6, +(zoomF * (d > 0 ? 1.15 : 1 / 1.15)).toFixed(3))); try { localStorage.setItem("campoZoom", zoomF); } catch (e) {} },
    som() { SND.on = !SND.on; try { localStorage.setItem("campoSom", SND.on ? "1" : "0"); } catch (e) {} if (SND.on) sndInit(); const b = document.getElementById("csb"); if (b) b.textContent = SND.on ? "🔊 Som" : "🔇 Mudo"; },
    toggle() { v3 = !v3; if (v3 && typeof Campo3D !== "undefined") Campo3D.load(); try { localStorage.setItem('campo3d', v3 ? '1' : '0'); } catch (e) {} const b = document.getElementById('c3b'); if (b) b.textContent = v3 ? '🎥 Voltar ao 2D' : '🎥 Ver em 3D'; },
    kitsFor,
    dbg() { return { scr: !!(cur || q.length), ball: { x: ball.x, y: ball.y, f: !!ball.flight }, pl: Object.values(P).filter((o) => o.live).map((o) => [o.x, o.y]) }; },
    stop() { stopLoop(); M = null; q = []; cur = null; sndOff(); },
    busy, decisionOK,
    fmtMin,
    sync,
    attach() { const h = document.getElementById("pcvh"); if (h && cv.parentNode !== h) h.appendChild(cv); },
    card() { return `<div class="card" style="padding:8px 8px 6px"><div style="text-align:right;margin:0 0 6px"><button onclick="Campo.zoom(-1)" style="font-size:13px;padding:4px 10px;border-radius:8px;margin-right:4px">🔍−</button><button onclick="Campo.zoom(1)" style="font-size:13px;padding:4px 10px;border-radius:8px;margin-right:6px">🔍+</button><button id="csb" onclick="Campo.som()" style="font-size:13px;padding:4px 10px;border-radius:8px;margin-right:6px">${SND.on ? "🔊 Som" : "🔇 Mudo"}</button><button id="c4b" onclick="Campo.camNext()" style="font-size:13px;padding:4px 10px;border-radius:8px;margin-right:6px">${camLbl()}</button></div><div id="pcvh" style="min-height:${hh}px"></div><div style="font-size:13px;margin-top:6px;max-height:150px;overflow:auto">${feed.slice(0, 8).map((f) => `<div style="padding:1px 0"><span class="mut">${fmtMin(f.m)}'</span> ${f.t}</div>`).join("") || '<span class="mut">Sem lances ainda.</span>'}</div><p class="mut" style="font-size:11px;margin:4px 0 0">Gols, pênaltis, cartões, lesões e trocas são os lances reais. Chutes sem gol são ilustrativos.</p></div>`; },
  };
  function camLbl() { return "📹 " + ({ auto: "Câmera: automática", side: "Câmera: lateral", aerial: "Câmera: aérea", end: "Câmera: atrás do gol" }[camMode]); }
  function decisionOK() { return !busy() || !!(cur && cur.inj && injHold && q.length === 0); }
  function busy() { return !!M && (!!cur || q.length > 0 || !!(L && L.done && !ended)); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
})();
