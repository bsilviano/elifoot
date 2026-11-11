// Campo animado da partida ao vivo. O motor do jogo é estatístico (não calcula a posição de cada jogador),
// então o campo é uma animação guiada pelos lances REAIS da partida (gols, pênaltis, cartões, lesões, substituições).
// As chances sem gol (defesa, trave, chute pra fora) são ilustrativas: não alteram o placar nem as estatísticas.
const Campo = (() => {
  const W = 105, H = 68, R = Math.random, M_ = 2, BAND = 10; // M_ = margem (m) ao redor do gramado
  const cv = document.createElement("canvas");
  cv.id = "campoCv";
  cv.style.cssText = "width:100%;display:block;border-radius:10px;aspect-ratio:" + (W + 2 * M_) + "/" + (H + 2 * M_ + BAND);
  const cx = cv.getContext("2d");
  let M = null, L = null, seen = 0, P = {}, ball, q = [], cur = null, feed = [], cap = "", capT = 0, capBig = false, marks = [];
  let stat = { h: { poss: 0, shots: 0, onT: 0 }, a: { poss: 0, shots: 0, onT: 0 } }, NUM = {}, USED = { h: {}, a: {} }, narr = "", narrT = 0, press = {}, shown = { h: 0, a: 0 }, raf = 0, last = 0, passT = 0, poss = "h", share = 0.5, flash = 0, over = {}, freeze = false, lastMin = -1, hh = 0, clock = 0;
  ball = { x: W / 2, y: H / 2, carrier: null, flight: null };

  const BASE = { GOL: [0.04, 0.5], ZAG: [0.2, 0.5, 1], LD: [0.24, 0.88], LE: [0.24, 0.12], VOL: [0.38, 0.5, 1], MC: [0.5, 0.5, 1], MEI: [0.62, 0.5, 1], ME: [0.5, 0.14], MD: [0.5, 0.86], PE: [0.78, 0.14], PD: [0.78, 0.86], SA: [0.7, 0.5, 1], CA: [0.84, 0.5, 1] };
  const pt = (side, ax, ay) => (side === "h" ? [ax * W, ay * H] : [(1 - ax) * W, (1 - ay) * H]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function pickW(a, w) { if (!a.length) return null; let t = w.reduce((x, y) => x + y, 0), r = R() * t; for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; }
  const team = (side) => Object.values(P).filter((o) => o.live && o.side === side);
  const other = (side) => (side === "h" ? "a" : "h");
  function nearest(list, x, y) { let b = null, bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; b = o; } } return b; }
  function findP(name, side) { return Object.values(P).find((o) => o.p.name === name && (!side || o.side === side)); }

  // ---------- cores ----------
  function col(name) { try { const c = (typeof TEAM_COLORS !== "undefined" && TEAM_COLORS[name]) || themeFor(name).ac; return /^#[0-9a-f]{6}$/i.test(c) ? c : "#c8102e"; } catch (e) { return "#c8102e"; } }
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
  const lum = (c) => { const l = rgb(c); return 0.3 * l[0] + 0.59 * l[1] + 0.11 * l[2]; };
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
          if (!o.init) { const t = pt(side, ax, ay); o.x = t[0]; o.y = t[1]; o.init = 1; }
        });
      }
    }
  }
  function target(o) {
    const gk = o.p.pos === "GK";
    if (over.run && over.run.o === o) return [over.run.x, over.run.y];
    if (gk && over.gk && over.gk.side === o.side) { const t = pt(o.side, 0.03, 0.5); return [t[0], over.gk.y]; }
    const bp = (o.side === "h" ? ball.x : W - ball.x) / W, by = ball.y / H, byN = o.side === "h" ? by : 1 - by;
    const k = gk ? 0.08 : o.p.pos === "DEF" ? 0.6 : o.p.pos === "MID" ? 1 : 0.9;
    let ax = o.ax + (bp - 0.5) * 0.55 * k + (gk ? 0 : poss === o.side ? 0.04 : -0.03) + (ball.carrier === o.p.id ? 0.02 : 0);
    ax += o.wx; const ay = o.ay + (byN - o.ay) * (gk ? 0.1 : 0.34) + o.wy;
    ax = clamp(ax, 0.03, 0.97); if (gk) ax = Math.min(ax, 0.12);
    return pt(o.side, ax, clamp(ay, 0.04, 0.96));
  }

  // ---------- bola ----------
  function flight(x0, y0, x1, y1, dur, done, h, ref) { ball.carrier = null; ball.flight = { x0, y0, x1, y1, t: 0, dur, done, h: h == null ? 2 : h, ref }; }
  function setCarrier(o) { if (!o) return; ball.carrier = o.p.id; poss = o.side; }
  function restart(side) { ball.flight = null; ball.x = W / 2; ball.y = H / 2; setCarrier(nearest(team(side).filter((o) => o.p.pos !== "GK"), W / 2, H / 2)); passT = 0.5; }
  function ambient() {
    const c = ball.carrier != null && P[ball.carrier];
    if (!c || !c.live) { setCarrier(nearest(team(poss).filter((o) => o.p.pos !== "GK"), ball.x, ball.y) || nearest(team(poss), ball.x, ball.y)); return; }
    const mates = team(c.side).filter((o) => o !== c), opp = team(other(c.side)), dir = c.side === "h" ? 1 : -1;
    const sh = c.side === "h" ? share : 1 - share, pI = clamp(0.15 * (1 - sh) / sh, 0.06, 0.3);
    const w = mates.map((o) => { const dx = (o.x - c.x) * dir, dy = Math.abs(o.y - c.y), d = Math.hypot(dx, dy); let v = d < 5 ? 0.05 : d < 12 ? 1.4 : d < 20 ? 1.2 : d < 28 ? 0.45 : 0.1; v *= dx > 0 ? 1.6 : dx > -8 ? 1 : 0.5; if (o.p.pos === "GK") v *= c.p.pos === "DEF" ? 0.4 : 0.03; return v; });
    const r = pickW(mates, w); if (!r) return;
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
  function narrate(t) { narr = t; narrT = 2.4; }
  function say(t, big, ms) { cap = t; capBig = !!big; capT = ms || 2.6; }
  function addFeed(txt) { feed.unshift({ m: M.min || 0, t: txt }); if (feed.length > 14) feed.pop(); }
  function shotSteps(st, side, kind, shooter, name) {
    const oside = other(side), gx = side === "h" ? W : 0, gk = team(oside).find((x) => x.p.pos === "GK"), opp = team(oside).filter((x) => x.p.pos !== "GK");
    const ty = 34 + (kind === "wide" ? (R() < 0.5 ? -1 : 1) * (5 + R() * 4) : kind === "post" ? (R() < 0.5 ? -1 : 1) * 3.66 : (R() - 0.5) * 5.4);
    stat[side].shots++; if (kind === "goal" || kind === "save") stat[side].onT++;
    if (kind === "block") {
      const d = nearest(opp, shooter.x + (side === "h" ? 6 : -6), shooter.y);
      st.push({ fl: 1, start() { flight(ball.x, ball.y, d.x, d.y, 0.25, () => setCarrier(d), 1, d); } });
      st.push(FN(() => { say("🧱 Bloqueio da zaga!"); addFeed(`🧱 Chute de ${name} é bloqueado`); }, 0.6));
      return;
    }
    st.push({ fl: 1, start() { over.run = null; if (gk) over.gk = { side: oside, y: ty }; flight(ball.x, ball.y, gx, ty, 0.38, () => {}, 1); } });
    if (kind === "goal") {
      st.push(FN(() => { flash = 1.6; shownGoalSide = side; shown[side]++; say("⚽ GOOOL! " + name, true, 3.2); addFeed(`⚽ <b>GOL!</b> ${esc(name)}`); }, 2));
      st.push(FN(() => { over.gk = null; restart(oside); }, 0.1));
    } else if (kind === "save") {
      st.push(FN(() => { over.gk = null; if (gk) setCarrier(gk); say("🧤 Defesa" + (gk ? " de " + gk.p.name : "") + "!"); addFeed(`🧤 Chute de ${esc(name)}, defesa${gk ? " de " + esc(gk.p.name) : ""}`); }, 0.8));
    } else if (kind === "wide") {
      st.push({ fl: 1, start() { flight(ball.x, ball.y, gx + (side === "h" ? 4 : -4), ball.y + (ball.y > 34 ? 2 : -2), 0.25, () => {}, 0.5); } });
      st.push(FN(() => { over.gk = null; if (gk) setCarrier(gk); say("Pra fora!"); addFeed(`🎯 Chute de ${esc(name)} passa perto`); }, 0.7));
    } else if (kind === "post") {
      st.push({ fl: 1, start() { flight(ball.x, ball.y, gx + (side === "h" ? -7 : 7), 34 + (ty > 34 ? 9 : -9), 0.45, () => {}, 2); } });
      st.push(FN(() => { over.gk = null; const d = nearest(opp, ball.x, ball.y); if (d) setCarrier(d); say("🥅 NA TRAVE!", true); addFeed(`🥅 Na trave! ${esc(name)}`); }, 1));
    }
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
      st.push(WAIT(0.15));
      shotSteps(st, side, o.kind, shooter, o.name || shooter.p.name);
    };
  }
  function penaltyWin(side, e) {
    return (cur) => {
      const sx = side === "h" ? W - 11 : 11;
      cur.steps.push(FN(() => { poss = side; say("🎯 PÊNALTI para o " + e.club + "!", true, 3); addFeed(`🎯 Pênalti para o ${esc(e.club)}`); flight(ball.x, ball.y, sx, 34, 0.6, () => {}, 2); }, 1.2));
      cur.steps.push(FN(() => { freeze = true; }, 0));
    };
  }
  function penaltyKick(side, e) {
    return (cur) => {
      freeze = false;
      const sx = side === "h" ? W - 11 : 11, st = cur.steps;
      const k = findP(e.name, side) || pickW(team(side), team(side).map((x) => x.p.ov));
      st.push(FN(() => { poss = side; ball.flight = null; ball.carrier = null; ball.x = sx; ball.y = 34; say("Cobrança: " + e.name); if (k) { k.x = sx + (side === "h" ? -5 : 5); k.y = 34; } }, 0.9));
      shotSteps(st, side, e.ok ? "goal" : R() < 0.6 ? "save" : "wide", k || { x: sx, y: 34 }, e.name);
      if (!e.ok) st.push(FN(() => addFeed(`❌ <b>Pênalti perdido</b> ${esc(e.name)}`), 0));
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
  function subScript(e) { return (cur) => { cur.steps.push(FN(() => { say(`🔁 Entra ${e.name}, sai ${e.out}`); addFeed(`🔁 Entra ${esc(e.name)}, sai ${esc(e.out)} (${esc(e.club)})`); }, 1)); }; }

  function handle(e) {
    const s = e.side;
    if (e.type === "goal") q.push(chance(s, { name: e.name, kind: "goal" }));
    else if (e.type === "penwin") q.push(penaltyWin(s, e));
    else if (e.type === "pen") q.push(penaltyKick(s, e));
    else if (e.type === "yellow") q.push(cardScript("yellow", e));
    else if (e.type === "red") q.push(cardScript("red", e));
    else if (e.type === "inj") q.push(cardScript("inj", e));
    else if (e.type === "sub") q.push(subScript(e));
  }
  function sync() {
    if (!M) return;
    while (seen < M.ev.length) handle(M.ev[seen++]);
    if (M.min != null && M.min !== lastMin) {
      lastMin = M.min;
      if (M.px) share = clamp(M.px.h / Math.max(M.px.h + M.px.a, 1e-9), 0.3, 0.7);
      for (const side of ["h", "a"]) {
        const sh = side === "h" ? share : 1 - share;
        if (q.length < 2 && !freeze && R() < 0.06 * 2 * sh) { // chance ilustrativa (sem gol)
          const kind = pickW(["save", "wide", "block", "post"], [5, 2.6, 1.6, 0.8]);
          q.push(chance(side, { kind }));
        }
      }
    }
  }
  function finishCur() { cur = null; }
  function runScript(dt) {
    if (!cur) { if (!q.length) return false; cur = { steps: [], i: 0, age: 0 }; q.shift()(cur); if (!cur.steps.length) { cur = null; return false; } }
    cur.age += dt;
    if (cur.age > 16) { ball.flight = null; over.gk = null; finishCur(); return false; }
    const s = cur.steps[cur.i];
    if (!s) { finishCur(); return false; }
    if (!s.on) { s.on = 1; s.t = 0; s.start(); }
    s.t += dt;
    if (s.fl ? !ball.flight : s.t >= s.dur) cur.i++;
    return true;
  }

  // ---------- quadro a quadro ----------
  function step(dt) {
    dt *= 0.85; clock += dt;
    sync(); layout();
    for (const sd of ["h", "a"]) press[sd] = team(sd).filter((o) => o.p.pos !== "GK" && o.p.id !== ball.carrier).sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y)).slice(0, 3);
    for (const id in P) {
      const o = P[id]; if (!o.live) continue;
      o.wt -= dt;
      if (o.wt <= 0) { o.wt = 1.6 + R() * 2.6; const gk = o.p.pos === "GK", rx = gk ? 0 : o.p.pos === "DEF" ? 0.14 : o.p.pos === "MID" ? 0.28 : 0.24; o.twx = (R() - 0.5) * 2 * rx; o.twy = gk ? 0 : (R() - 0.5) * 0.5; }
      o.wx += (o.twx - o.wx) * Math.min(1, dt * 0.9); o.wy += (o.twy - o.wy) * Math.min(1, dt * 0.9);
      const t = target(o), pr = press[o.side].indexOf(o);
      if (pr >= 0 && !over.gk) { const kk = poss === o.side ? 0.35 : 0.6; t[0] += (ball.x - t[0]) * kk; t[1] += (ball.y - t[1]) * kk; }
      const k = Math.min(1, dt * (ball.carrier === o.p.id ? 3.2 : o.p.pos === "GK" && over.gk ? 6 : 2));
      let mx = (t[0] - o.x) * k, my = (t[1] - o.y) * k;
      const sp = (over.run && over.run.o === o ? 9.5 : ball.carrier === o.p.id ? 5.2 : o.p.pos === "GK" ? 7 : 6.4) * dt, ml = Math.hypot(mx, my);
      if (ml > sp) { mx *= sp / ml; my *= sp / ml; }
      o.x += mx; o.y += my;
    }
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
    const scripted = runScript(dt);
    if (!scripted && !freeze && !ball.flight) { passT -= dt; if (passT <= 0) { ambient(); passT = 0.8 + R() * 0.8; } }
    stat[poss].poss += dt;
    if (capT > 0) capT -= dt;
    if (narrT > 0) narrT -= dt;
    if (flash > 0) flash -= dt;
    marks.forEach((m) => (m.t += dt)); marks = marks.filter((m) => m.t < 2.6);
  }

  // ---------- desenho ----------
  function draw() {
    const w = cv.clientWidth; if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(w * dpr), ph = Math.round(w * (H + 2 * M_ + BAND) / (W + 2 * M_) * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    hh = cv.clientHeight;
    const s = cv.width / (W + 2 * M_), X = (x) => (x + M_) * s, Y = (y) => (y + M_ + BAND) * s, bandPx = BAND * s;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = "#15202b"; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = "#24703a"; cx.fillRect(0, bandPx, cv.width, cv.height - bandPx);
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
      cx.fillStyle = flash > 0 && ((sd && shownGoalSide === "h") || (!sd && shownGoalSide === "a")) ? "rgba(255,230,90," + Math.min(1, flash) + ")" : "rgba(255,255,255,.25)";
      cx.fillRect(X(sd ? W : -M_ + 0.2), Y((H - 7.32) / 2), (M_ - 0.2) * s, 7.32 * s);
    }
    const k = kits();
    const ordered = Object.values(P).filter((o) => o.live).sort((a, b) => a.y - b.y), r = 1.45 * s;
    for (const o of ordered) {
      const px = X(o.x + Math.sin(clock * 1.7 + o.p.id) * 0.25), py = Y(o.y + Math.cos(clock * 1.3 + o.p.id) * 0.25), gk = o.p.pos === "GK";
      const fill = gk ? (o.side === "h" ? k.gh : k.ga) : k[o.side];
      cx.fillStyle = "rgba(0,0,0,.25)"; cx.beginPath(); cx.ellipse(px, py + r * 0.7, r * 0.95, r * 0.4, 0, 0, 7); cx.fill();
      cx.fillStyle = fill; cx.beginPath(); cx.arc(px, py, r, 0, 7); cx.fill();
      cx.lineWidth = Math.max(1, 0.2 * s); cx.strokeStyle = "#fff"; cx.stroke();
      if (r >= 6) { cx.fillStyle = lum(fill) > 150 ? "#111" : "#fff"; cx.font = "bold " + Math.round(r * 1.0) + "px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(o.n, px, py + 0.5); }
      if (ball.carrier === o.p.id) {
        cx.strokeStyle = "#ffd166"; cx.lineWidth = Math.max(2, 0.35 * s); cx.beginPath(); cx.arc(px, py, r + 0.6 * s, 0, 7); cx.stroke();
        const nm = o.p.name.split(" ").slice(-1)[0], fs = Math.max(9, Math.round(1.7 * s));
        cx.font = "600 " + fs + "px sans-serif"; const tw = cx.measureText(nm).width + 8;
        cx.fillStyle = "rgba(0,0,0,.65)"; cx.fillRect(px - tw / 2, py + r + 3, tw, fs + 4);
        cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "top"; cx.fillText(nm, px, py + r + 5);
      }
    }
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
    // placar fora do campo, em uma faixa acima dele
    const f1 = Math.max(14, Math.round(3.1 * s)), f2s = Math.max(11, Math.round(2.0 * s));
    const nm1 = M.H.name, nm2 = M.A.name, scr = ` ${shown.h} x ${shown.a} `;
    cx.font = "800 " + f1 + "px sans-serif"; const wN1 = cx.measureText(nm1).width, wN2 = cx.measureText(nm2).width, wS = cx.measureText(scr).width + 10, rr = f1 * 0.42;
    const sub = (L && L.done ? "⏱ Fim de jogo" : "⏱ " + (M.min || 0) + "'") + (L && L.rodada ? "  ·  " + L.rodada : "") + (L && L.date ? "  ·  " + L.date : "");
    const mid = cv.width / 2, cy1 = bandPx * 0.38;
    cx.textBaseline = "middle"; cx.font = "800 " + f1 + "px sans-serif";
    cx.textAlign = "right"; cx.fillStyle = "#fff"; cx.fillText(nm1, mid - wS / 2, cy1);
    cx.textAlign = "center"; cx.fillStyle = "#ffd166"; cx.fillText(scr, mid, cy1);
    cx.textAlign = "left"; cx.fillStyle = "#fff"; cx.fillText(nm2, mid + wS / 2, cy1);
    for (const [sd, xx] of [["h", mid - wS / 2 - wN1 - rr * 1.8], ["a", mid + wS / 2 + wN2 + rr * 1.8]]) { cx.fillStyle = k[sd]; cx.beginPath(); cx.arc(xx, cy1, rr, 0, 7); cx.fill(); cx.strokeStyle = "#fff"; cx.lineWidth = Math.max(1.5, rr * 0.2); cx.stroke(); }
    cx.font = "700 " + f2s + "px sans-serif"; cx.textAlign = "center"; cx.fillStyle = "#cfd8e0"; cx.fillText(sub, mid, bandPx * 0.78);
    if (narrT > 0 && narr && !(capT > 0 && cap && !capBig)) {
      const fn = Math.max(11, Math.round(2.1 * s)); cx.font = "600 " + fn + "px sans-serif";
      const wn = Math.min(cv.width - 10, cx.measureText(narr).width + 22), yn = bandPx + 6;
      cx.globalAlpha = Math.min(1, narrT * 1.5); cx.fillStyle = "rgba(0,0,0,.55)"; cx.fillRect(cv.width / 2 - wn / 2, yn, wn, fn + 10);
      cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText("🎙️ " + narr, cv.width / 2, yn + (fn + 10) / 2); cx.globalAlpha = 1;
    }
    if (capT > 0 && cap) {
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
    raf = requestAnimationFrame(frame);
    if (!M) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    try { step(dt); draw(); } catch (e) { console.error("campo", e); cur = null; q = []; ball.flight = null; }
  }

  return {
    start(live) {
      stopLoop();
      L = live; M = live.matches.find((m) => m.mine.h || m.mine.a) || live.matches[0];
      stat = { h: { poss: 0, shots: 0, onT: 0 }, a: { poss: 0, shots: 0, onT: 0 } }; P = {}; NUM = {}; USED = { h: {}, a: {} }; q = []; cur = null; feed = []; marks = []; over = {}; freeze = false; cap = ""; capT = 0; narr = ""; narrT = 0; flash = 0; lastMin = -1; poss = "h"; share = 0.5;
      seen = M.ev.length; shown = { h: M.gh || 0, a: M.ga || 0 };
      layout(); restart("h"); last = 0;
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
    kitsFor,
    dbg() { return { ball: { x: ball.x, y: ball.y, f: !!ball.flight }, pl: Object.values(P).filter((o) => o.live).map((o) => [o.x, o.y]) }; },
    stop() { stopLoop(); M = null; q = []; cur = null; },
    busy() { return !!M && (!!cur || q.length > 0); },
    sync,
    attach() { const h = document.getElementById("pcvh"); if (h && cv.parentNode !== h) h.appendChild(cv); },
    card() { return `<div class="card" style="padding:8px 8px 6px"><div id="pcvh" style="min-height:${hh}px"></div><div style="font-size:13px;margin-top:6px;max-height:150px;overflow:auto">${feed.slice(0, 8).map((f) => `<div style="padding:1px 0"><span class="mut">${f.m}'</span> ${f.t}</div>`).join("") || '<span class="mut">Sem lances ainda.</span>'}</div><p class="mut" style="font-size:11px;margin:4px 0 0">Gols, pênaltis, cartões, lesões e trocas são os lances reais. Chutes sem gol são ilustrativos.</p></div>`; },
  };
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
})();
