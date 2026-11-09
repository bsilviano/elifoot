(function (root) {
  const CD = typeof require !== "undefined" ? require("./clubs.js") : root.ClubData;
  const { COUNTRIES, LEAGUES, STATES, CONT } = CD;
  const FORMATIONS = { "4-4-2": [4,4,2], "4-3-3": [4,3,3], "3-5-2": [3,5,2], "4-5-1": [4,5,1], "5-3-2": [5,3,2] };
  const TACTICS = ["Defensiva", "Equilibrada", "Ofensiva"];
  const FIRST = ["João","Pedro","Lucas","Gabriel","Matheus","Rafael","Bruno","Diego","Felipe","Thiago","Carlos","André","Vitor","Marcos","Leandro","Rodrigo","Gustavo","Everton","Wesley","Caio","Renan","Igor","Danilo","Paulo","Fábio","Mateo","Hugo","Luca","Jonas","Declan","Marco","Jules"];
  const LAST = ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Ribeiro","Alves","Martins","Rocha","Carvalho","Gomes","Barbosa","Moreira","Araújo","Nunes","Teixeira","Cardoso","Freitas","Dias","Ramos","Pinto","Mendes","Müller","Rossi","Dupont","García","Smith","Fernández"];
  const CASH = [8000000, 3500000, 1500000];
  const FANS = [1500, 700, 300];
  const LG = {}; LEAGUES.forEach((l) => (LG[l.key] = l));
  const EU = ["ENG", "ESP", "GER", "ITA", "FRA", "POR"];
  const START_YEAR = 2027;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[ri(0, arr.length - 1)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  let PID = 1;

  function dateOf(T) {
    const d = new Date(Date.UTC(START_YEAR, 0, 1) + Math.round(T * 7) * 864e5);
    return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
  }
  const yearOf = (T) => START_YEAR + Math.floor(T / 52);

  function valueOf(ov, age) {
    let v = 20000 * Math.pow(10, (ov - 40) / 15);
    if (age <= 22) v *= 1.4; else if (age >= 32) v *= 0.5; else if (age >= 29) v *= 0.8;
    return Math.round(v / 1000) * 1000;
  }
  function mkPlayer(pos, ov, age) {
    ov = clamp(Math.round(ov), 35, 95);
    age = age || ri(18, 36);
    const value = valueOf(ov, age);
    const sp = pick({ GK: ["GOL"], DEF: ["ZAG", "ZAG", "LD", "LE"], MID: ["VOL", "MC", "MC", "ME", "MD"], ATT: ["CA", "CA", "PD", "PE"] }[pos]);
    return { id: PID++, name: pick(FIRST) + " " + pick(LAST), pos, sp, ov, age, value, wage: Math.round(value / 900) };
  }
  function genSquad(base, small) {
    const plan = small ? { GK: 2, DEF: 6, MID: 6, ATT: 4 } : { GK: 3, DEF: 8, MID: 7, ATT: 5 };
    const ps = [];
    for (const pos in plan) for (let i = 0; i < plan[pos]; i++) ps.push(mkPlayer(pos, base + rnd(-9, 8) - i * 0.8));
    return ps;
  }
  function resetPid(s) {
    let m = 0;
    for (const t of Object.values(s.teams)) for (const p of t.players) m = Math.max(m, p.id);
    PID = m + 1;
  }

  const avail = (p) => !(p.inj > 0) && !(p.sus > 0);
  const SLOTS = {
    DEF: { 3: ["ZAG", "ZAG", "ZAG"], 4: ["LE", "ZAG", "ZAG", "LD"], 5: ["LE", "ZAG", "ZAG", "ZAG", "LD"] },
    MID: { 3: ["VOL", "MC", "MC"], 4: ["ME", "MC", "MC", "MD"], 5: ["ME", "VOL", "MC", "MC", "MD"] },
    ATT: { 1: ["CA"], 2: ["CA", "CA"], 3: ["PE", "CA", "PD"] },
  };
  // Monta o time ideal; "miss" conta quantos jogadores ficaram fora da posição exata.
  function buildLineup(team, formation) {
    const f = FORMATIONS[formation || team.formation];
    const need = { GK: 1, DEF: f[0], MID: f[1], ATT: f[2] };
    const ids = []; let miss = 0;
    for (const pos in need) {
      const all = team.players.filter((p) => p.pos === pos).sort((a, b) => b.ov - a.ov);
      const pool = all.filter(avail), out = all.filter((p) => !avail(p));
      const slots = SLOTS[pos] && SLOTS[pos][need[pos]];
      const used = new Set();
      if (slots) {
        for (const sp of slots) { const c = pool.find((p) => !used.has(p.id) && p.sp === sp); if (c) { used.add(c.id); } else miss++; }
      }
      const pick1 = [...used].map((id) => pool.find((p) => p.id === id));
      const rest = pool.filter((p) => !used.has(p.id)).concat(out);
      const chosen = pick1.concat(rest.slice(0, need[pos] - pick1.length));
      chosen.forEach((p) => ids.push(p.id));
    }
    return { ids, miss };
  }
  function autoLineup(team, formation) { return buildLineup(team, formation).ids; }
  function bestFormation(team) {
    let best = null;
    for (const f in FORMATIONS) {
      const { ids, miss } = buildLineup(team, f);
      const set = new Set(ids), r = ratingsL(team.players.filter((p) => set.has(p.id)));
      const score = (r.A + r.D) / 2 - miss * 1.5;
      if (!best || score > best.score) best = { f, ids, score, ovr: r.ovr, miss };
    }
    return best;
  }
  function lineupPlayers(team) {
    const set = new Set(team.lineup);
    return team.players.filter((p) => set.has(p.id));
  }
  function avg(ps, d) { return ps.length ? ps.reduce((s, p) => s + p.ov, 0) / ps.length : d; }
  function ratings(team) { return ratingsL(lineupPlayers(team)); }
  function ratingsL(L) {
    const by = (pos) => L.filter((p) => p.pos === pos);
    const A = avg(by("ATT"), 35) * 0.55 + avg(by("MID"), 35) * 0.45;
    const D = avg(by("DEF"), 35) * 0.55 + avg(by("GK"), 30) * 0.25 + avg(by("MID"), 35) * 0.2;
    return { A, D, ovr: L.length ? avg(L, 0) : 0 };
  }
  function poisson(l) {
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
  function scorer(team) {
    const L = lineupPlayers(team);
    const w = { ATT: 3, MID: 1.5, DEF: 0.4, GK: 0.01 };
    const tot = L.reduce((s, p) => s + w[p.pos] * p.ov, 0);
    let r = Math.random() * tot;
    for (const p of L) { r -= w[p.pos] * p.ov; if (r <= 0) return p.name; }
    return L.length ? L[0].name : "?";
  }
  // Lesões, cartões amarelos (3 = 1 jogo) e vermelhos (1 a 4 jogos), em taxas próximas às do futebol real.
  function matchEvents(t) {
    const ev = [];
    for (const p of t.players) { if (p.sus > 0) p.sus--; if (p.inj > 0) p.inj--; }
    for (const p of lineupPlayers(t)) {
      const wy = { GK: 0.02, DEF: 0.15, MID: 0.15, ATT: 0.09 }[p.pos], wr = { GK: 0.0008, DEF: 0.0055, MID: 0.0045, ATT: 0.0035 }[p.pos];
      if (Math.random() < wr) { const n = pick([1, 1, 1, 1, 1, 2, 2, 3, 4]); p.sus = n; p.yc = 0; ev.push({ type: "red", name: p.name, n }); continue; }
      if (Math.random() < wy) { p.yc = (p.yc || 0) + 1; if (p.yc >= 3) { p.yc = 0; p.sus = 1; ev.push({ type: "yc3", name: p.name, n: 1 }); } }
      if (Math.random() < (p.age > 31 ? 0.022 : 0.017)) {
        const r = Math.random();
        const n = r < 0.5 ? ri(1, 2) : r < 0.8 ? ri(3, 5) : r < 0.96 ? ri(6, 12) : ri(13, 30);
        p.inj = n; ev.push({ type: "inj", name: p.name, n });
      }
    }
    return ev;
  }
  function simMatch(h, a) {
    const evh = matchEvents(h), eva = matchEvents(a);
    const rh = ratings(h), ra = ratings(a);
    const tf = (t) => (t.tactic === "Ofensiva" ? [1.06, 0.94] : t.tactic === "Defensiva" ? [0.94, 1.06] : [1, 1]);
    const [ah, dh] = tf(h), [aa, da] = tf(a);
    const redH = evh.some((e) => e.type === "red") ? 1 : 0, redA = eva.some((e) => e.type === "red") ? 1 : 0;
    const xh = 1.3 * Math.exp((rh.A * ah - ra.D * da + 3) / 22) * (redH ? 0.82 : 1) * (redA ? 1.12 : 1);
    const xa = 1.1 * Math.exp((ra.A * aa - rh.D * dh - 3) / 22) * (redA ? 0.82 : 1) * (redH ? 1.12 : 1);
    const gh = poisson(clamp(xh, 0.15, 5)), ga = poisson(clamp(xa, 0.15, 5));
    const sh = [], sa = [];
    for (let i = 0; i < gh; i++) sh.push(scorer(h));
    for (let i = 0; i < ga; i++) sa.push(scorer(a));
    return { gh, ga, sh, sa, evh, eva };
  }

  function roundRobin(ids) {
    const n = ids.length, arr = ids.slice(), rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const m = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        m.push(r % 2 ? [b, a] : [a, b]);
      }
      rounds.push(m);
      arr.splice(1, 0, arr.pop());
    }
    return rounds.concat(rounds.map((m) => m.map(([a, b]) => [b, a])));
  }
  const emptyRow = () => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  function sortTab(ids, tab) {
    return ids.slice().sort((a, b) => {
      const x = tab[a], y = tab[b];
      return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
    });
  }
  const ovrOf = (s, id) => ratings(s.teams[id]).ovr;
  const byStrength = (s, ids) => ids.slice().sort((a, b) => ovrOf(s, b) - ovrOf(s, a));

  // ---------- criação de competições ----------
  function newComp(s, id, name, ids, after, extra) {
    const c = Object.assign({ id, name, ids, after, tab: {}, rDone: 0, R: 0, ties: null, plan: null, si: 0, done: false, groups: null, order: ids }, extra || {});
    if (!extra || !extra.tab) ids.forEach((i) => (c.tab[i] = emptyRow()));
    s.comps[id] = c;
    return c;
  }
  function addRounds(s, c, fxRounds, Ts) {
    fxRounds.forEach((fx, i) => s.q.push({ T: Ts[i], c: c.id, k: "tab", fx: fx.map((m) => [m[0], m[1]]) }));
    c.R += fxRounds.length;
    s.q.sort((a, b) => a.T - b.T);
  }
  function pairBW(alive) {
    const p = [], n = alive.length;
    for (let i = 0; i < n / 2; i++) p.push([alive[i], alive[n - 1 - i]]);
    return p;
  }
  function startStage(s, c, pairs) {
    const st = c.plan[c.si];
    c.stage = st.name; c.closed = false;
    c.ties = pairs.map(([a, b]) => ({ a, b, res: [], w: null, pens: false, legs: st.legs }));
    for (let leg = 0; leg < st.legs; leg++) {
      const fx = c.ties.map((t, k) => (leg % 2 === 0 ? [t.a, t.b, k] : [t.b, t.a, k]));
      s.q.push({ T: st.T[leg], c: c.id, k: "ko", n: st.name + (st.legs === 2 ? (leg ? " (volta)" : " (ida)") : ""), fx });
    }
    s.q.sort((a, b) => a.T - b.T);
  }
  function drawGroups(s, ids, ng) {
    const sorted = byStrength(s, ids), size = ids.length / ng, groups = Array.from({ length: ng }, () => []);
    for (let p = 0; p < size; p++) shuffle(sorted.slice(p * ng, (p + 1) * ng)).forEach((id, g) => groups[g].push(id));
    return groups;
  }
  function groupRounds(groups) {
    const per = groups.map((g) => roundRobin(g));
    return per[0].map((_, r) => per.flatMap((p) => p[r]));
  }
  function plan(names, base) {
    // names: [[nome, pernas, [T...]]]
    return names.map(([name, legs, T]) => ({ name, legs, T: T.map((x) => base + x) }));
  }
  function qualifiers(s, def) {
    let ids = [];
    for (const [k, a, b] of def.slots) ids = ids.concat((s.rank[k] || []).slice(a - 1, b));
    return ids;
  }
  function teamByName(s, name) { return Object.values(s.teams).find((t) => t.name === name).id; }

  function createEuroLeagues(s, country, y0) {
    const base = 33 + 52 * (y0 - START_YEAR);
    s.season[country] = y0;
    for (const l of LEAGUES.filter((x) => x.country === country)) {
      const ids = shuffle(s.lg[l.key]);
      const n = ids.length, step = 19.5 / (n - 1);
      const c = newComp(s, l.key, l.name + " " + y0 + "/" + String(y0 + 1).slice(2), ids, "lg", { key: l.key, country });
      const fx = roundRobin(ids), Ts = fx.map((_, r) => (r < n - 1 ? base + r * step : base + 20 + (r - (n - 1)) * step));
      addRounds(s, c, fx, Ts);
    }
  }
  function createEuroCups(s, y0) {
    const B = 33 + 52 * (y0 - START_YEAR);
    s.season.EUCUPS = y0;
    ["UCL", "UEL", "UECL"].forEach((k, ci) => {
      const def = CONT[k], off = ci * 0.25;
      let ids = qualifiers(s, def).concat(def.extras.map((n) => teamByName(s, n)));
      ids = byStrength(s, ids);
      const c = newComp(s, k, def.name + " " + y0 + "/" + String(y0 + 1).slice(2), ids, "euS", { order: ids, prize: def.prize, cont: true });
      const fx = roundRobin(shuffle(ids)).slice(0, 8);
      addRounds(s, c, fx, [4, 6, 9, 11, 14, 16, 23, 24].map((x) => B + x + off));
      c.plan = plan([["Playoff", 2, [26, 27]], ["Oitavas", 2, [31, 32]], ["Quartas", 2, [35, 36]], ["Semifinal", 2, [39, 40]], ["Final", 1, [44]]].map(([n, l, T]) => [n, l, T.map((x) => x + off)]), B);
    });
  }
  function createSouthCups(s, Y) {
    const B = 52 * (Y - START_YEAR);
    s.season.SACUPS = Y;
    ["LIB", "SUL"].forEach((k, ci) => {
      const def = CONT[k], off = ci * 0.25;
      let ids = qualifiers(s, def).concat(def.extras.map((n) => teamByName(s, n)));
      ids = byStrength(s, ids);
      const groups = drawGroups(s, ids, 8);
      const c = newComp(s, k, def.name + " " + Y, ids, "gr", { order: ids, prize: def.prize, cont: true, groups });
      addRounds(s, c, groupRounds(groups), [15.5, 16.5, 17.5, 18.5, 19.5, 20.5].map((x) => B + x + off));
      c.plan = plan([["Oitavas", 2, [33.5, 35.5]], ["Quartas", 2, [37.5, 39.5]], ["Semifinal", 2, [41.5, 43.5]], ["Final", 1, [47.5]]].map(([n, l, T]) => [n, l, T.map((x) => x + off)]), B);
    });
  }
  function createBrazil(s, Y) {
    const B = 52 * (Y - START_YEAR);
    s.season.BRA = Y;
    // estaduais
    const byName = {};
    Object.values(s.teams).forEach((t) => (byName[t.name] = t.id));
    for (const st of STATES) {
      const ids = shuffle(st.clubs.map((n) => byName[n]).filter(Boolean));
      const id = "EST_" + st.key, n = ids.length;
      if (st.key === "SP") {
        const groups = drawGroups(s, ids, 4), gof = {};
        groups.forEach((g, gi) => g.forEach((i) => (gof[i] = gi)));
        const c = newComp(s, id, st.name + " " + Y, ids, "stRR", { groups, stKey: st.key, order: ids });
        const fx = roundRobin(ids).slice(0, n - 1).map((r) => r.filter(([a, b]) => gof[a] !== gof[b])).filter((r) => r.length);
        addRounds(s, c, fx, fx.map((_, r) => B + 2 + r * (11.5 / fx.length)));
      } else {
        const c = newComp(s, id, st.name + " " + Y, ids, "stRR", { stKey: st.key, order: ids });
        const fx = roundRobin(ids).slice(0, n - 1);
        addRounds(s, c, fx, fx.map((_, r) => B + 2 + r * (10.5 / fx.length)));
      }
      s.comps[id].B = B;
    }
    // Brasileirões
    ["BRA1", "BRA2"].forEach((key) => {
      const ids = shuffle(s.lg[key]);
      const c = newComp(s, key, LG[key].name + " " + Y, ids, "lg", { key, country: "BRA" });
      const fx = roundRobin(ids);
      addRounds(s, c, fx, fx.map((_, r) => B + 17 + r * 0.78));
    });
    {
      const ids = shuffle(s.lg.BRA3);
      const c = newComp(s, "BRA3", "Série C " + Y + " (1ª fase)", ids, "b3", { key: "BRA3", country: "BRA", B });
      const fx = roundRobin(ids).slice(0, 19);
      addRounds(s, c, fx, fx.map((_, r) => B + 17 + r));
    }
    // Copa do Brasil (64 clubes, simplificada)
    const bra = Object.values(s.teams).filter((t) => t.country === "BRA");
    const main = bra.filter((t) => !t.local).map((t) => t.id);
    const locals = byStrength(s, bra.filter((t) => t.local).map((t) => t.id)).slice(0, 4);
    const ids = byStrength(s, main.concat(locals));
    const c = newComp(s, "CDB", "Copa do Brasil " + Y, ids, "cup", { order: ids, prize: 500000, cont: true });
    c.plan = plan([["1ª fase", 1, [5]], ["2ª fase", 1, [9]], ["Oitavas", 2, [22, 24]], ["Quartas", 2, [29.5, 31.5]], ["Semifinal", 2, [36, 38]], ["Final", 2, [44, 45]]], B);
    startStage(s, c, pairBW(ids));
    createSouthCups(s, Y);
  }
  function createArgentina(s, Y) {
    const B = 52 * (Y - START_YEAR);
    s.season.ARG = Y;
    // Liga Profesional: 2 torneios por ano (Apertura e Clausura), 30 clubes em 2 zonas de 15.
    // Cada clube joga 14 jogos na zona + 1 interzonal; os 8 primeiros de cada zona vão ao mata-mata.
    s.annual = {};
    s.lg.ARG1.forEach((i) => (s.annual[i] = { pts: 0, g: 0 }));
    [[1, "Apertura", 3, [20, 21.5, 23, 24.5]], [2, "Clausura", 29, [45, 46.5, 48, 49.5]]].forEach(([t, nm, off, kt]) => {
      const ids = shuffle(s.lg.ARG1), zones = drawGroups(s, ids, 2);
      const c = newComp(s, "ARG1_" + t, "Liga Profesional " + nm + " " + Y, ids, "arG", { groups: zones, t, B, key: "ARG1", country: "ARG", kt, nm });
      const fx = zoneRounds(zones);
      addRounds(s, c, fx, fx.map((_, r) => B + off + r * 1.05));
    });
    // Primera Nacional: 36 clubes em 2 zonas de 18 (ida e volta); campeões das zonas fazem a final; os 2 finalistas sobem.
    const ids2 = shuffle(s.lg.ARG2), z2 = drawGroups(s, ids2, 2);
    const c2 = newComp(s, "ARG2", "Primera Nacional " + Y, ids2, "arN", { groups: z2, B, key: "ARG2", country: "ARG" });
    const fx2 = groupRounds(z2);
    addRounds(s, c2, fx2, fx2.map((_, r) => B + 3 + r * 1.2));
  }
  function zoneRounds(zones) {
    const per = zones.map((z) => roundRobin(z.concat([null])).slice(0, z.length));
    return per[0].map((_, r) => {
      const fx = [], idle = [];
      per.forEach((p) => p[r].forEach(([a, b]) => { if (a === null) idle.push(b); else if (b === null) idle.push(a); else fx.push([a, b]); }));
      if (idle.length === 2) fx.push(r % 2 ? [idle[0], idle[1]] : [idle[1], idle[0]]);
      return fx;
    });
  }

  function mkTeam(s, id, name, country, lkey, base, extra) {
    const t = Object.assign({ id, name, country, lkey, base, fans: 150, players: genSquad(base, !!extra.local), formation: "4-4-2", tactic: "Equilibrada", lineup: [] }, extra);
    t.lineup = autoLineup(t);
    s.teams[id] = t;
    return t;
  }
  function clubCash(t) { return t.local ? 1000000 : CASH[LG[t.lkey].tier - 1]; }
  function repFor(ovr) { return clamp(Math.round((ovr - 48) * 3.5), 5, 95); }

  function newGame(clubName) {
    const s = { T: 0, user: null, cash: 0, rep: 0, offers: [], honors: [], teams: {}, lg: {}, comps: {}, q: [], final: {}, rank: {}, season: {}, aged: 0, euDone: 0, prom: {} };
    let id = 1;
    for (const l of LEAGUES) {
      s.lg[l.key] = [];
      const c = COUNTRIES[l.country], n = l.clubs.length, base = c.base - 7 * (l.tier - 1);
      l.clubs.forEach((name, i) => {
        const b = base + ((n - 1) / 2 - i) * 0.35;
        mkTeam(s, id, name, l.country, l.key, b, { fans: Math.round(FANS[l.tier - 1] * c.fans * rnd(0.7, 1.4)) });
        s.lg[l.key].push(id); id++;
      });
    }
    const have = new Set(Object.values(s.teams).map((t) => t.name));
    for (const st of STATES) for (const name of st.clubs) {
      if (have.has(name)) continue;
      have.add(name);
      mkTeam(s, id, name, "BRA", null, 44, { local: true, fans: ri(60, 200) }); // base ajustada abaixo
      s.teams[id].players = genSquad(44 + rnd(-3, 3), true); s.teams[id].lineup = autoLineup(s.teams[id]); id++;
    }
    for (const k in CONT) CONT[k].extras.forEach((name) => {
      if (have.has(name)) return;
      have.add(name);
      const b = CONT[k].ovr + rnd(-3, 3);
      mkTeam(s, id, name, "EXT", null, b, { local: true, extra: true, fans: ri(200, 800) }); id++;
    });
    const u = Object.values(s.teams).find((t) => t.name === clubName && !t.local);
    s.user = u.id;
    s.cash = clubCash(u);
    s.rep = repFor(ratings(u).ovr);
    for (const k in s.lg) s.rank[k] = byStrength(s, s.lg[k]);
    // Europa: temporada 2026/27 já em andamento; 1ª metade é simulada automaticamente
    EU.forEach((c) => createEuroLeagues(s, c, 2026));
    createEuroCups(s, 2026);
    createBrazil(s, START_YEAR);
    createArgentina(s, START_YEAR);
    const res = { reports: [], notes: [], wages: 0, gate: 0 };
    while (s.q.length && s.q[0].T <= 0) { const rd = s.q.shift(); processRound(s, rd, res, true); }
    s.T = 0;
    return s;
  }

  // ---------- processamento de rodadas ----------
  function userComps(s) { return Object.values(s.comps).filter((c) => !c.done && c.ids.includes(s.user)); }
  function isMine(s, id) { return id === s.user || (s.clubs || []).includes(id); }
  function fixLineup(t) {
    const ok = () => t.lineup.length === 11 && t.lineup.every((i) => t.players.some((p) => p.id === i && avail(p))) &&
      lineupPlayers(t).filter((p) => p.pos === "GK").length === 1;
    if (ok()) return false;
    // tira indisponíveis e troca por reservas do mesmo setor (mesma posição exata primeiro)
    const bad = t.lineup.map((id) => t.players.find((p) => p.id === id)).filter((p) => !p || !avail(p));
    t.lineup = t.lineup.filter((id) => t.players.some((p) => p.id === id && avail(p)));
    for (const b of bad) {
      if (!b) continue;
      const bench = t.players.filter((p) => avail(p) && !t.lineup.includes(p.id) && p.pos === b.pos).sort((x, y) => (y.sp === b.sp) - (x.sp === b.sp) || y.ov - x.ov);
      if (bench[0]) t.lineup.push(bench[0].id);
    }
    if (!ok()) t.lineup = autoLineup(t);
    return true;
  }
  function ageCheck(s) {
    while (s.T >= (s.aged + 1) * 52) {
      s.aged++;
      for (const t of Object.values(s.teams)) {
        t.players.forEach((p) => {
          p.age++;
          const d = p.age <= 23 ? ri(0, 3) : p.age <= 29 ? ri(-2, 1) : ri(-4, 0);
          p.ov = clamp(p.ov + d, 35, 95);
          p.value = valueOf(p.ov, p.age); p.wage = Math.round(p.value / 900);
        });
        if (!isMine(s, t.id)) {
          const keep = t.players.filter((p) => p.age < 37), lost = t.players.length - keep.length;
          t.players = keep;
          for (let i = 0; i < lost; i++) t.players.push(mkPlayer(pick(["DEF","MID","ATT"]), t.base - 3, ri(18, 22)));
        }
        if (isMine(s, t.id)) fixLineup(t); else t.lineup = autoLineup(t);
      }
    }
  }
  // Artilheiros: chave nome|clube; total (g) e da temporada (sg, ano sy).
  function trackGoals(s, team, names) {
    s.scorers = s.scorers || {};
    const y = yearOf(s.T);
    s.scY = y;
    if (Object.keys(s.scorers).length > 3000) { // limita o tamanho do save: mantém os 600 maiores de sempre e os 600 da temporada
      const es = Object.entries(s.scorers);
      const keep = new Set(es.slice().sort((a, b) => b[1].g - a[1].g).slice(0, 600).map((x) => x[0]));
      es.filter((x) => x[1].sy === y).sort((a, b) => b[1].sg - a[1].sg).slice(0, 600).forEach((x) => keep.add(x[0]));
      for (const k of Object.keys(s.scorers)) if (!keep.has(k)) delete s.scorers[k];
    }
    for (const nm of names) {
      const k = nm + "|" + team.name;
      const e = s.scorers[k] || (s.scorers[k] = { n: nm, c: team.name, g: 0, sy: y, sg: 0 });
      if (e.sy !== y) { e.sy = y; e.sg = 0; }
      e.g++; e.sg++;
    }
  }
  // "De sempre" = gols da carreira real (cg, vindos do elencos.json) + gols feitos no jogo.
  function topScorers(s, kind, n) {
    const y = yearOf(s.T), mine = (id) => (s.clubs || [s.user]).concat(s.user).some((m) => s.teams[m] && s.teams[m].id === id);
    if (kind === "season") {
      return Object.values(s.scorers || {}).filter((e) => e.sy === y && e.sg > 0).sort((a, b) => b.sg - a.sg || b.g - a.g).slice(0, n || 30)
        .map((e) => ({ n: e.n, c: e.c, g: e.sg, real: 0, jogo: e.sg, mine: Object.values(s.teams).some((t) => t.name === e.c && mine(t.id)) }));
    }
    const out = [], seen = new Set();
    for (const t of Object.values(s.teams)) for (const p of t.players) {
      if (!(p.cg > 0)) continue;
      const k = p.name + "|" + t.name, jg = (s.scorers && s.scorers[k] && s.scorers[k].g) || 0;
      seen.add(k); out.push({ n: p.name, c: t.name, g: p.cg + jg, real: p.cg, jogo: jg, mine: mine(t.id) });
    }
    for (const [k, e] of Object.entries(s.scorers || {})) if (!seen.has(k)) out.push({ n: e.n, c: e.c, g: e.g, real: 0, jogo: e.g, mine: Object.values(s.teams).some((t) => t.name === e.c && mine(t.id)) });
    return out.sort((a, b) => b.g - a.g).slice(0, n || 30);
  }
  function processRound(s, rd, res, silent, pre) {
    const c = s.comps[rd.c];
    if (!c) return;
    let fi = -1;
    for (const [h, a, k] of rd.fx) {
      fi++;
      const H = s.teams[h], A = s.teams[a];
      if (!silent && h === s.user) { /* escalação do usuário ativo */ } else if (!silent && isMine(s, h)) fixLineup(H); else H.lineup = autoLineup(H);
      if (!silent && a === s.user) { /* escalação do usuário ativo */ } else if (!silent && isMine(s, a)) fixLineup(A); else A.lineup = autoLineup(A);
      const r = pre ? pre[fi] : simMatch(H, A);
      trackGoals(s, H, r.sh); trackGoals(s, A, r.sa);
      if (rd.k === "tab") {
        const th = c.tab[h], ta = c.tab[a];
        th.p++; ta.p++; th.gf += r.gh; th.ga += r.ga; ta.gf += r.ga; ta.ga += r.gh;
        if (r.gh > r.ga) { th.w++; th.pts += 3; ta.l++; } else if (r.gh < r.ga) { ta.w++; ta.pts += 3; th.l++; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
      } else c.ties[k].res.push([r.gh, r.ga]);
      if (!silent) {
        const lab = { red: "🟥 expulso", yc3: "🟨 suspenso (3º amarelo)", inj: "🚑 lesionado" };
        for (const [tm, evs] of [[H, r.evh], [A, r.eva]]) if (isMine(s, tm.id)) for (const e of evs) res.notes.push(`${lab[e.type]}: ${e.name} (${tm.name}), fora por ${e.n} jogo${e.n > 1 ? "s" : ""}.`);
      }
      if (!silent && (isMine(s, h) || isMine(s, a))) res.reports.push({ comp: c.name + (rd.n ? " · " + rd.n : ""), date: dateOf(rd.T), home: H.name, away: A.name, ...r });
    }
    if (rd.k === "tab") {
      c.rDone++;
      if (!silent && (c.after === "lg" || c.after === "arG") && c.ids.includes(s.user) && c.rDone === Math.round(c.R / 2)) midSeasonOffers(s, c, res);
      if (c.rDone >= c.R) finishComp(s, c, res, silent);
    } else koCheck(s, c, res, silent);
  }
  function koCheck(s, c, res, silent) {
    for (const t of c.ties) {
      if (t.w !== null || t.res.length < t.legs) continue;
      let ga = 0, gb = 0;
      t.res.forEach((r, i) => { if (i % 2 === 0) { ga += r[0]; gb += r[1]; } else { ga += r[1]; gb += r[0]; } });
      t.agg = [ga, gb];
      if (ga !== gb) t.w = ga > gb ? t.a : t.b;
      else { t.pens = true; const oa = ovrOf(s, t.a), ob = ovrOf(s, t.b); t.w = Math.random() < 0.5 + (oa - ob) * 0.01 ? t.a : t.b; }
      if (!silent && (t.a === s.user || t.b === s.user)) {
        const won = t.w === s.user;
        res.notes.push(`<b>${c.name} · ${c.stage}</b>: ${s.teams[t.a].name} ${ga} x ${gb} ${s.teams[t.b].name}${t.pens ? " (pênaltis)" : ""} — ${won ? "você avança!" : "você foi eliminado."}`);
        if (won && c.prize) { s.cash += c.prize; res.notes.push(`Premiação: +R$ ${Math.round(c.prize).toLocaleString("pt-BR")}`); }
      }
    }
    if (!c.closed && c.ties.every((t) => t.w !== null)) {
      c.closed = true;
      let alive = c.ties.map((t) => t.w).sort((x, y) => c.order.indexOf(x) - c.order.indexOf(y));
      if (c.fixedTop && c.si === 0) { alive = c.fixedTop.concat(alive); c.fixedTop = null; }
      c.si++;
      if (c.si >= c.plan.length) {
        c.champion = alive[0];
        s.honors.push({ year: yearOf(s.T), cup: c.name, club: s.teams[alive[0]].name });
        if (!silent) res.notes.push(`<b>${c.name}</b>: campeão ${s.teams[alive[0]].name}`);
        finishComp(s, c, res, silent, true);
      } else startStage(s, c, c.pairs ? c.pairs(alive) : pairBW(alive));
    }
  }

  function finishComp(s, c, res, silent, koEnd) {
    switch (c.after) {
      case "lg": {
        c.done = true;
        const final = sortTab(c.ids, c.tab);
        s.final[c.key] = final; s.rank[c.key] = final;
        if (!silent && c.ids.includes(s.user)) endOfSeasonUser(s, c, final, res);
        checkRollover(s, c.country, res, silent);
        break;
      }
      case "stRR": {
        c.done = true;
        const ranked = sortTab(c.ids, c.tab);
        let qual;
        const sp = c.stKey === "SP";
        if (sp) {
          qual = [];
          c.groups.forEach((g) => qual.push(...sortTab(g, c.tab).slice(0, 2)));
          qual = sortTab(qual, c.tab);
        } else qual = ranked.slice(0, 4);
        const k = newComp(s, c.id + "_K", c.name + " (mata-mata)", qual, "cup", { order: qual, prize: 150000, cont: true });
        const B = c.B;
        k.plan = plan(sp ? [["Quartas", 1, [14.2]], ["Semifinal", 1, [15]], ["Final", 2, [16.2, 16.9]]] : [["Semifinal", 1, [13.5]], ["Final", 2, [15.2, 16]]], B);
        startStage(s, k, pairBW(qual));
        break;
      }
      case "b3": {
        c.done = true;
        const ranked = sortTab(c.ids, c.tab);
        s.final.BRA3_P1 = ranked;
        const top8 = ranked.slice(0, 8);
        const groups = [[top8[0], top8[3], top8[4], top8[7]], [top8[1], top8[2], top8[5], top8[6]]];
        const g = newComp(s, "BRA3G", "Série C " + (s.season.BRA) + " (grupos)", top8, "b3g", { groups, B: c.B });
        addRounds(s, g, groupRounds(groups), [38, 39, 41, 42, 44, 45].map((x) => c.B + x));
        break;
      }
      case "b3g": {
        c.done = true;
        const gs = c.groups.map((g) => sortTab(g, c.tab));
        const ids = [gs[0][0], gs[1][0]];
        const f = newComp(s, "BRA3F", "Série C " + s.season.BRA + " (final)", ids, "b3f", { order: ids, prize: 100000, cont: true });
        f.plan = plan([["Final", 2, [47, 48]]], c.B);
        f.gs = gs;
        startStage(s, f, [ids]);
        break;
      }
      case "b3f": {
        c.done = true;
        const gs = c.gs, champ = c.champion, other = champ === gs[0][0] ? gs[1][0] : gs[0][0];
        const promoted = [champ, other, champ === gs[0][0] ? gs[0][1] : gs[1][1], other === gs[0][0] ? gs[0][1] : gs[1][1]];
        const p1 = s.final.BRA3_P1.filter((i) => !promoted.includes(i));
        const final = promoted.concat(p1);
        s.final.BRA3 = final;
        delete s.final.BRA3_P1;
        if (c.ids.includes(s.user) || final.includes(s.user)) { /* usuário em C: tratado no mid/fim via rollover */ }
        checkRollover(s, "BRA", res, silent);
        break;
      }
      case "cup": case "stK": c.done = true; break;
      case "arG": {
        c.done = true;
        c.ids.forEach((id) => { s.annual[id].pts += c.tab[id].pts; s.annual[id].g += c.tab[id].p; });
        const A = sortTab(c.groups[0], c.tab).slice(0, 8), Z = sortTab(c.groups[1], c.tab).slice(0, 8);
        const order = []; for (let i = 0; i < 8; i++) { order.push(A[i]); order.push(Z[i]); }
        const k = newComp(s, c.id + "_K", c.name + " (fase final)", order, "cup", { order, prize: 300000, cont: true });
        k.plan = plan([["Oitavas", 1, [c.kt[0]]], ["Quartas", 1, [c.kt[1]]], ["Semifinal", 1, [c.kt[2]]], ["Final", 1, [c.kt[3]]]], c.B);
        startStage(s, k, A.map((a, i) => [a, Z[7 - i]]));
        if (c.t === 2) {
          const ids = s.lg.ARG1, order2 = ids.slice().sort((a, b) => s.annual[b].pts - s.annual[a].pts);
          ids.forEach((id) => { const a = s.prom[id] || (s.prom[id] = [1.2, 1.2]); a.push(s.annual[id].pts / Math.max(1, s.annual[id].g)); if (a.length > 3) a.shift(); });
          const avgP = (id) => s.prom[id].reduce((x, y) => x + y, 0) / s.prom[id].length;
          const rel = ids.slice().sort((a, b) => avgP(a) - avgP(b)).slice(0, 2);
          const final = order2.filter((i) => !rel.includes(i)).concat(rel);
          s.final.ARG1 = final; s.rank.ARG1 = order2;
          if (!silent && ids.includes(s.user)) endOfSeasonUser(s, { name: "Liga Profesional (tabela anual)", key: "ARG1", ids }, final, res);
          checkRollover(s, "ARG", res, silent);
        }
        break;
      }
      case "arN": {
        c.done = true;
        const gs = c.groups.map((g) => sortTab(g, c.tab));
        const ids = [gs[0][0], gs[1][0]];
        const f = newComp(s, "ARG2F", "Primera Nacional " + s.season.ARG + " (final)", ids, "arNF", { order: ids, prize: 100000, cont: true, gs, B: c.B });
        f.plan = plan([["Final", 1, [48]]], c.B);
        startStage(s, f, [ids]);
        break;
      }
      case "arNF": {
        c.done = true;
        const champ = c.champion, other = c.ids.find((i) => i !== champ);
        const base = s.comps.ARG2, rest = sortTab(base.ids.filter((i) => i !== champ && i !== other), base.tab);
        s.final.ARG2 = [champ, other].concat(rest);
        checkRollover(s, "ARG", res, silent);
        break;
      }
      case "gr": {
        c.done = true;
        const W = [], R = [];
        c.groups.forEach((g) => { const o = sortTab(g, c.tab); W.push(o[0]); R.push(o[1]); });
        const ws = sortTab(W, c.tab), rs = sortTab(R, c.tab);
        const order = ws.concat(rs);
        const k = newComp(s, c.id + "_K", c.name + " (mata-mata)", order, "cup", { order, prize: c.prize, cont: true, tab: c.tab, groups: c.groups });
        k.plan = c.plan;
        startStage(s, k, ws.map((w, i) => [w, rs[i ^ 1]]));
        break;
      }
      case "euS": {
        c.done = true;
        const ranked = sortTab(c.ids, c.tab);
        c.final = ranked;
        const k = newComp(s, c.id + "_K", c.name + " (mata-mata)", ranked, "cup", { order: ranked, prize: c.prize, cont: true, tab: c.tab, fixedTop: ranked.slice(0, 8) });
        k.plan = c.plan;
        startStage(s, k, pairBW(ranked.slice(8, 24)));
        break;
      }
    }
  }

  // ---------- fim de temporada, promoção, convites ----------
  function endOfSeasonUser(s, c, final, res) {
    const ul = LG[c.key], pos = final.indexOf(s.user) + 1;
    const expPos = byStrength(s, c.ids).indexOf(s.user) + 1;
    const prize = (final.length + 1 - pos) * [400000, 150000, 60000][ul.tier - 1];
    s.cash += prize;
    let rep = s.rep + (expPos - pos) * 0.9 + (pos === 1 ? 4 : 0);
    s.honors.filter((h) => h.year === yearOf(s.T) && h.club === s.teams[s.user].name).forEach(() => (rep += 3));
    s.rep = clamp(Math.round(rep), 0, 100);
    res.notes.push(`<h2>Fim de campeonato: ${c.name}</h2>Você terminou em ${pos}º (esperado: ${expPos}º). Prêmio: +R$ ${Math.round(prize).toLocaleString("pt-BR")}. Reputação: ${s.rep}/100.`);
    const target = 48 + s.rep * 0.30;
    offersAround(s, target, 3, null, res);
  }
  function offersAround(s, target, n, why, res) {
    const have = new Set((s.offers || []).map((o) => o.tid));
    const cands = shuffle(Object.values(s.teams).filter((t) => t.id !== s.user && !t.local && !have.has(t.id) && Math.abs(ratings(t).ovr - target) <= 2.5)).slice(0, n);
    const add = cands.map((t) => ({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: CASH[LG[t.lkey].tier - 1], why }));
    s.offers = (s.offers || []).concat(add);
    if (add.length) res.notes.push(`<span class="warn">Você recebeu ${add.length} convite(s) de clube. Veja no topo.</span>`);
  }
  // fim do 1º turno / início do 2º (metade do campeonato)
  function midSeasonOffers(s, c, res) {
    const tab = sortTab(c.ids, c.tab), pos = tab.indexOf(s.user) + 1;
    const exp = byStrength(s, c.ids).indexOf(s.user) + 1, diff = exp - pos, u = s.teams[s.user];
    let target;
    if (diff >= 3) target = ratings(u).ovr + 1.5 + Math.min(diff, 8) * 0.5;
    else if (diff <= -4) target = ratings(u).ovr - 2.5;
    else return;
    offersAround(s, target, 2, diff >= 3 ? `Fim do 1º turno: você está em ${pos}º, acima do esperado (${exp}º).` : `Fim do 1º turno: você está em ${pos}º, abaixo do esperado (${exp}º).`, res);
  }
  function checkRollover(s, country, res, silent) {
    const tiers = LEAGUES.filter((l) => l.country === country).sort((a, b) => a.tier - b.tier);
    if (!tiers.every((l) => s.final[l.key])) return;
    const k = COUNTRIES[country].promo, tabs = tiers.map((l) => s.final[l.key]);
    const before = s.user;
    tiers.forEach((l, i) => {
      const mid = tabs[i].slice(i > 0 ? k : 0, tabs[i].length - (i < tiers.length - 1 ? k : 0));
      const dropped = i > 0 ? tabs[i - 1].slice(tabs[i - 1].length - k) : [];
      const up = i < tiers.length - 1 ? tabs[i + 1].slice(0, k) : [];
      s.lg[l.key] = mid.concat(dropped, up);
    });
    tiers.forEach((l) => s.lg[l.key].forEach((id) => (s.teams[id].lkey = l.key)));
    tiers.forEach((l) => delete s.final[l.key]);
    if (!silent && s.teams[before] && tiers.some((l) => tabs[l.tier - 1].includes(before))) {
      const nk = tiers.find((l) => s.lg[l.key].includes(before));
      if (nk) res.notes.push(`Na próxima temporada seu clube joga a ${nk.name}.`);
    }
    if (country === "BRA") createBrazil(s, s.season.BRA + 1);
    else if (country === "ARG") createArgentina(s, s.season.ARG + 1);
    else {
      createEuroLeagues(s, country, s.season[country] + 1);
      s.euDone++;
      if (s.euDone >= EU.length) { s.euDone = 0; createEuroCups(s, s.season.EUCUPS + 1); }
    }
  }

  function userMatches(s) {
    const out = [];
    for (const rd of s.q) { if (rd.fx.some((m) => m[0] === s.user || m[1] === s.user)) out.push(rd); }
    return out;
  }
  function nextUserRound(s) {
    for (const rd of s.q) {
      const m = rd.fx.find((m) => m[0] === s.user || m[1] === s.user);
      if (m) { const c = s.comps[rd.c]; return { T: rd.T, date: dateOf(rd.T), comp: c ? c.name + (rd.n ? " · " + rd.n : "") : "", home: s.teams[m[0]], away: s.teams[m[1]] }; }
    }
    return null;
  }

  // Estádio: capacidade real (stad) entre 10 mil e 100 mil; amplia de 10 em 10 mil por (capacidade atual x 10) reais.
  const STAD_MIN = 10000, STAD_MAX = 100000, STAD_STEP = 10000;
  function getStad(t) {
    if (t.stad) return Math.max(STAD_MIN, Math.min(STAD_MAX, t.stad));
    const tier = t.lkey && LG[t.lkey] ? LG[t.lkey].tier : 3;
    return tier === 1 ? 30000 : tier === 2 ? 18000 : STAD_MIN;
  }
  function stadCost(t) { return getStad(t) * 10; }
  function upgradeStadium(s) {
    const t = s.teams[s.user], cap = getStad(t);
    if (cap >= STAD_MAX) return "O estádio já está no tamanho máximo (100.000 lugares).";
    const cost = stadCost(t);
    if (s.cash < cost) return "Dinheiro insuficiente para ampliar o estádio.";
    s.cash -= cost; t.stad = Math.min(STAD_MAX, cap + STAD_STEP); t.stadUp = 1;
    return null;
  }
  // Renda do jogo: público x preço do ingresso; mandante fica com 70% e visitante com 30%.
  // O público varia com a torcida, o porte do adversário e o acaso.
  function gateOf(s, hid, aid) {
    const t = s.teams[hid], cap = getStad(t);
    const tier = t.lkey && LG[t.lkey] ? LG[t.lkey].tier : 3;
    const opp = aid != null && s.teams[aid] ? s.teams[aid] : null;
    const oppF = opp ? clamp(0.75 + 0.3 * Math.min(opp.fans / Math.max(t.fans, 1), 2), 0.75, 1.3) : 1;
    const att = Math.round(Math.min(cap, t.fans * 1000 * 0.12 * rnd(0.65, 1.3) * oppF));
    const price = [50, 30, 15][tier - 1];
    const rev = att * price;
    const home = Math.round(rev * 0.7);
    return { att, cap, price, rev, home, away: rev - home };
  }
  // Clubes meus que jogam na próxima rodada que envolve algum deles.
  function nextRoundClubs(s) {
    for (const rd of s.q) {
      const ids = [];
      for (const m of rd.fx) for (const id of [m[0], m[1]]) if (isMine(s, id) && !ids.includes(id)) ids.push(id);
      if (ids.length) return { T: rd.T, date: dateOf(rd.T), clubs: myClubs(s).filter((id) => ids.includes(id)) };
    }
    return null;
  }
  // Fecha uma rodada: tabela/copas (processRound) + finanças dos meus clubes.
  function settleRd(s, rd, res, pre) {
    processRound(s, rd, res, false, pre);
    const credit = (id, x, wage) => {
      if (id === s.user) { res.gate += x; res.wages += wage; return; }
      s.cashes = s.cashes || {};
      s.cashes[id] = (s.cashes[id] || 0) + x - wage;
    };
    rd.fx.forEach(([h, a], fi) => {
      if (!isMine(s, h) && !isMine(s, a)) return;
      const gt = (pre && pre[fi] && pre[fi].gate) || gateOf(s, h, a);
      res.gates = res.gates || [];
      res.gates.push({ home: s.teams[h].name, away: s.teams[a].name, att: gt.att, cap: gt.cap, rev: gt.rev, homeShare: gt.home, awayShare: gt.away, homeMine: isMine(s, h), awayMine: isMine(s, a) });
      if (isMine(s, h)) credit(h, gt.home, s.teams[h].players.reduce((x, p) => x + p.wage, 0));
      if (isMine(s, a)) credit(a, gt.away, s.teams[a].players.reduce((x, p) => x + p.wage, 0));
    });
  }
  function playRound(s) {
    const u = s.teams[s.user];
    const res = { reports: [], notes: [], wages: 0, gate: 0, skipped: 0, fixed: fixLineup(u) };
    const nOffers = s.offers.length;
    let guard = 0;
    while (s.q.length && guard++ < 5000) {
      const rd = s.q.shift();
      s.T = rd.T; ageCheck(s);
      const anyMine = rd.fx.some((m) => isMine(s, m[0]) || isMine(s, m[1]));
      settleRd(s, rd, res, null);
      if (anyMine) break;
      res.skipped++;
      if (s.offers.length > nOffers) break;
    }
    s.cash += res.gate - res.wages;
    res.date = dateOf(s.T);
    return res;
  }

  // ---- Jogo ao vivo: todos os confrontos da rodada avançam minuto a minuto ----
  const SUBS_MAX = 5;
  function liveRates(m) {
    const rh = ratingsL(m.on.h), ra = ratingsL(m.on.a);
    const nh = m.on.h.length, na = m.on.a.length;
    const tf = (t) => (t.tactic === "Ofensiva" ? [1.06, 0.94] : t.tactic === "Defensiva" ? [0.94, 1.06] : [1, 1]);
    const [ah, dh] = tf(m.H), [aa, da] = tf(m.A);
    let xh = clamp(1.3 * Math.exp((rh.A * ah - ra.D * da + 3) / 22), 0.15, 5);
    let xa = clamp(1.1 * Math.exp((ra.A * aa - rh.D * dh - 3) / 22), 0.15, 5);
    xh *= Math.pow(nh / 11, 1.3) * Math.pow(11 / Math.max(na, 1), 0.5);
    xa *= Math.pow(na / 11, 1.3) * Math.pow(11 / Math.max(nh, 1), 0.5);
    m.px = { h: xh / 90, a: xa / 90 };
  }
  function createLive(s, rd) {
    const c = s.comps[rd.c];
    const live = { rd, T: rd.T, date: dateOf(rd.T), comp: c ? c.name + (rd.n ? " · " + rd.n : "") : "", minute: 0, pending: [], done: false, matches: [] };
    rd.fx.forEach(([h, a, k], i) => {
      const H = s.teams[h], A = s.teams[a];
      for (const [t, id] of [[H, h], [A, a]]) { if (isMine(s, id)) fixLineup(t); else t.lineup = autoLineup(t); }
      const m = { i, hid: h, aid: a, H, A, gh: 0, ga: 0, sh: [], sa: [], evh: [], eva: [], ev: [], subs: { h: 0, a: 0 }, mine: { h: isMine(s, h), a: isMine(s, a) } };
      m.on = { h: lineupPlayers(H).slice(), a: lineupPlayers(A).slice() };
      const bench = (t) => t.players.filter((p) => avail(p) && !t.lineup.includes(p.id)).sort((x, y) => y.ov - x.ov);
      m.bench = { h: bench(H), a: bench(A) };
      m.gate = gateOf(s, h, a);
      live.matches.push(m);
    });
    if (!rd.dec) { // quem estava fora cumpre mais um jogo de suspensão/lesão
      for (const m of live.matches) for (const t of [m.H, m.A]) for (const p of t.players) { if (p.sus > 0) p.sus--; if (p.inj > 0) p.inj--; }
      rd.dec = 1;
    }
    live.matches.forEach(liveRates);
    return live;
  }
  function startRound(s) {
    const u = s.teams[s.user];
    const res = { reports: [], notes: [], wages: 0, gate: 0, skipped: 0, fixed: fixLineup(u) };
    const nOffers = s.offers.length;
    while (s.q.length) {
      const rd = s.q[0];
      if (rd.fx.some((m) => isMine(s, m[0]) || isMine(s, m[1]))) { s.T = rd.T; ageCheck(s); return { res, live: createLive(s, rd) }; }
      s.q.shift(); s.T = rd.T; ageCheck(s);
      processRound(s, rd, res, false); res.skipped++;
      if (s.offers.length > nOffers) break;
    }
    res.date = dateOf(s.T);
    return { res, live: null };
  }
  function wpickP(list, wf) {
    const tot = list.reduce((x, p) => x + wf(p), 0);
    let r = Math.random() * tot;
    for (const p of list) { r -= wf(p); if (r <= 0) return p; }
    return list[list.length - 1];
  }
  function autoReorg(m, side) { // sem goleiro em campo: o auxiliar troca o pior jogador de linha pelo goleiro reserva
    if (m.on[side].some((p) => p.pos === "GK") || m.subs[side] >= SUBS_MAX) return false;
    const gk = m.bench[side].find((p) => p.pos === "GK");
    if (!gk || !m.on[side].length) return false;
    const out = m.on[side].slice().sort((a, b) => a.ov - b.ov)[0];
    return swapPlayers(m, side, out.id, gk.id, "auto");
  }
  function swapPlayers(m, side, outId, inId, why) {
    const oi = m.on[side].findIndex((p) => p.id === outId), bi = m.bench[side].findIndex((p) => p.id === inId);
    if (oi < 0 || bi < 0 || m.subs[side] >= SUBS_MAX) return false;
    const pout = m.on[side][oi], pin = m.bench[side][bi];
    m.on[side][oi] = pin; m.bench[side].splice(bi, 1); m.subs[side]++;
    m.ev.push({ min: m.min || 0, type: "sub", side, name: pin.name, out: pout.name, club: (side === "h" ? m.H : m.A).name, why });
    liveRates(m);
    return true;
  }
  function liveSub(live, mi, side, outId, inId) {
    const m = live.matches[mi]; m.min = live.minute;
    return swapPlayers(m, side, outId, inId, "user");
  }
  function liveMinute(s, live, m) {
    const mn = live.minute; m.min = mn;
    for (const side of ["h", "a"]) {
      const team = side === "h" ? m.H : m.A, evs = side === "h" ? m.evh : m.eva;
      // gols
      if (m.on[side].length && Math.random() < m.px[side]) {
        const p = wpickP(m.on[side], (q) => ({ ATT: 3, MID: 1.5, DEF: 0.4, GK: 0.01 }[q.pos] * q.ov));
        if (side === "h") { m.gh++; m.sh.push(p.name); } else { m.ga++; m.sa.push(p.name); }
        m.ev.push({ min: mn, type: "goal", side, name: p.name, club: team.name });
      }
      // expulsão
      if (m.on[side].length > 8 && Math.random() < 0.05 / 90) {
        const p = wpickP(m.on[side], (q) => ({ GK: 0.2, DEF: 1.4, MID: 1, ATT: 0.7 }[q.pos]));
        m.on[side].splice(m.on[side].indexOf(p), 1);
        p.sus = pick([1, 1, 1, 1, 1, 2, 2, 3, 4]); p.yc = 0;
        evs.push({ type: "red", name: p.name, n: p.sus });
        m.ev.push({ min: mn, type: "red", side, name: p.name, n: p.sus, club: team.name });
        liveRates(m);
        if (isMine(s, team.id)) live.pending.push({ mi: m.i, side, name: p.name, club: team.name });
        else autoReorg(m, side);
      }
      // lesão (substituição automática por reserva do mesmo setor)
      if (m.on[side].length > 8 && Math.random() < 0.19 / 90) {
        const p = m.on[side][ri(0, m.on[side].length - 1)];
        const r = Math.random();
        p.inj = r < 0.5 ? ri(1, 2) : r < 0.8 ? ri(3, 5) : r < 0.96 ? ri(6, 12) : ri(13, 30);
        evs.push({ type: "inj", name: p.name, n: p.inj });
        m.ev.push({ min: mn, type: "inj", side, name: p.name, n: p.inj, club: team.name });
        const b = m.bench[side].find((q) => q.pos === p.pos);
        if (b && m.subs[side] < SUBS_MAX) swapPlayers(m, side, p.id, b.id, "lesao");
        else { m.on[side].splice(m.on[side].indexOf(p), 1); liveRates(m); autoReorg(m, side); }
      }
      // cartão amarelo (3º amarelo = suspenso na próxima rodada)
      if (m.on[side].length && Math.random() < 1.5 / 90) {
        const p = wpickP(m.on[side], (q) => ({ GK: 0.1, DEF: 1.4, MID: 1.3, ATT: 0.9 }[q.pos]));
        p.yc = (p.yc || 0) + 1;
        const third = p.yc >= 3;
        m.ev.push({ min: mn, type: "yellow", side, name: p.name, club: team.name, third });
        if (third) { p.yc = 0; p.sus = 1; evs.push({ type: "yc3", name: p.name, n: 1 }); }
      }
    }
  }
  function liveStep(s, live, n) {
    for (let k = 0; k < n && !live.done && !live.pending.length; k++) {
      live.minute++;
      for (const m of live.matches) liveMinute(s, live, m);
      if (live.minute >= 90) live.done = true;
    }
  }
  function liveResolve(live) { // fecha a tela de expulsão: o auxiliar garante um goleiro em campo
    const p = live.pending.shift();
    if (p) autoReorg(live.matches[p.mi], p.side);
  }
  function liveFinish(s, live, res) {
    const pre = live.matches.map((m) => ({ gh: m.gh, ga: m.ga, sh: m.sh, sa: m.sa, evh: m.evh, eva: m.eva, gate: m.gate }));
    const ix = s.q.indexOf(live.rd);
    if (ix >= 0) s.q.splice(ix, 1);
    s.T = live.rd.T; ageCheck(s);
    settleRd(s, live.rd, res, pre);
    s.cash += res.gate - res.wages;
    res.date = dateOf(s.T);
    return res;
  }

  function acceptOffer(s, tid) {
    const o = s.offers.find((x) => x.tid === tid);
    if (!o) return "Convite inválido.";
    s.user = tid; s.cash = o.cash; s.offers = [];
    s.teams[tid].lineup = autoLineup(s.teams[tid]);
    return null;
  }

  function market(s) {
    const out = [];
    for (const t of Object.values(s.teams)) if (!isMine(s, t.id)) for (const p of t.players) out.push({ ...p, team: t.name, tid: t.id });
    return out;
  }
  function findPlayer(s, pid) {
    for (const t of Object.values(s.teams)) {
      const i = t.players.findIndex((p) => p.id === pid);
      if (i >= 0) return { t, i, p: t.players[i] };
    }
    return null;
  }
  function buy(s, pid) {
    const u = s.teams[s.user];
    const f = findPlayer(s, pid);
    if (!f || isMine(s, f.t.id)) return "Jogador indisponível.";
    const price = Math.round(f.p.value * 1.15);
    if (s.cash < price) return "Dinheiro insuficiente.";
    if (u.players.length >= 30) return "Elenco cheio (máx. 30).";
    s.cash -= price;
    f.t.players.splice(f.i, 1);
    u.players.push(f.p);
    s.bought = s.bought || []; s.sold = s.sold || [];
    const bn = f.p.name.toLowerCase();
    if (!s.bought.includes(bn)) s.bought.push(bn);
    s.sold = s.sold.filter((x) => x.p.name.toLowerCase() !== bn);
    f.t.players.push(mkPlayer(f.p.pos, f.p.ov - 4 + rnd(-2, 2), ri(18, 30)));
    f.t.lineup = autoLineup(f.t);
    return null;
  }
  function sell(s, pid) {
    const u = s.teams[s.user];
    const i = u.players.findIndex((p) => p.id === pid);
    if (i < 0) return "Jogador não encontrado.";
    if (u.players.length <= 18) return "Elenco mínimo de 18 jogadores.";
    const p = u.players[i];
    s.cash += Math.round(p.value * 0.85);
    u.players.splice(i, 1);
    const ids = Object.keys(s.teams).filter((k) => !isMine(s, +k) && !s.teams[k].local);
    const buyer = s.teams[pick(ids)];
    s.sold = s.sold || [];
    s.sold.push({ p: { ...p }, tid: buyer.id });
    buyer.players.push(p);
    const spare = buyer.players.filter((q) => q.pos === p.pos && q.id !== p.id).sort((a, b) => a.ov - b.ov)[0];
    if (spare && buyer.players.length > 24) buyer.players.splice(buyer.players.indexOf(spare), 1);
    buyer.lineup = autoLineup(buyer);
    return null;
  }

  // Leilão: outros clubes dão lances pelo jogador; o usuário escolhe quem leva.
  function auction(s, pid) {
    const u = s.teams[s.user];
    const p = u.players.find((q) => q.id === pid);
    if (!p) return { err: "Jogador não encontrado." };
    if (u.players.length <= 18) return { err: "Elenco mínimo de 18 jogadores." };
    const ids = Object.keys(s.teams).filter((k) => !isMine(s, +k) && !s.teams[k].local);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const bids = [];
    for (const k of ids.slice(0, 40)) {
      const t = s.teams[k];
      const best = Math.max(0, ...t.players.filter((q) => q.pos === p.pos).map((q) => q.ov));
      if (p.ov < best - 8) continue;
      const f = p.ov > best + 2 ? 1.12 + Math.random() * 0.28 : p.ov >= best - 2 ? 1 + Math.random() * 0.15 : 1 + Math.random() * 0.05;
      const cap = CASH[LG[t.lkey].tier - 1] * 0.7;
      const bid = Math.round(Math.min(p.value * f, cap, p.value * 1.4) / 10000) * 10000;
      if (bid < p.value || bid < 10000) continue; // lance nunca abaixo do valor de mercado
      bids.push({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, bid });
    }
    bids.sort((a, b) => b.bid - a.bid);
    return { pid, name: p.name, pos: p.pos, sp: p.sp, ov: p.ov, value: p.value, bids: bids.slice(0, 8) };
  }
  function sellTo(s, pid, tid, price) {
    const u = s.teams[s.user], buyer = s.teams[tid];
    const i = u.players.findIndex((q) => q.id === pid);
    if (i < 0 || !buyer) return "Negócio inválido.";
    if (u.players.length <= 18) return "Elenco mínimo de 18 jogadores.";
    const p = u.players[i];
    s.cash += price;
    u.players.splice(i, 1);
    s.sold = s.sold || []; s.bought = s.bought || [];
    s.sold = s.sold.filter((x) => x.p.name.toLowerCase() !== p.name.toLowerCase());
    s.sold.push({ p: { ...p }, tid: +tid });
    s.bought = s.bought.filter((x) => x !== p.name.toLowerCase());
    const li = u.lineup.indexOf(pid); if (li >= 0) u.lineup.splice(li, 1);
    buyer.players.push(p);
    const spare = buyer.players.filter((q) => q.pos === p.pos && q.id !== p.id).sort((a, b) => a.ov - b.ov)[0];
    if (spare && buyer.players.length > 24) buyer.players.splice(buyer.players.indexOf(spare), 1);
    buyer.lineup = autoLineup(buyer);
    return null;
  }

  // Atualização: sobrescreve elencos de TODOS os times, menos o do usuário;
  // remove dos outros qualquer jogador (mesmo nome) que esteja no time do usuário.
  function applyUpdate(s, data) {
    const u = s.teams[s.user];
    const key = (x) => String(x).toLowerCase();
    // Saves antigos: sem registro de compras, ninguém sai do elenco nesta atualização
    s.sold = s.sold || [];
    const mine = new Set((s.clubs || [s.user]).concat(s.user).flatMap((id) => s.teams[id].players.map((p) => key(p.name))));
    const bought = mine; // meu elenco nunca é atualizado
    const realTeam = {}; // nome do jogador -> time real (no elencos.json), exceto o time do usuário
    for (const dt of data.teams || []) {
      const t = Object.values(s.teams).find((x) => x.name === dt.name);
      if (!t || isMine(s, t.id)) continue;
      for (const q of dt.players || []) realTeam[key(q.name)] = t.id;
    }
    // meu elenco não muda, mas ganha os gols de carreira real (cg) quando existirem
    for (const dt of data.teams || []) {
      const t = Object.values(s.teams).find((x) => x.name === dt.name);
      if (!t || !isMine(s, t.id)) continue;
      if (dt.stad && !t.stadUp) t.stad = dt.stad;
      const cgs = {}; for (const q of dt.players || []) if (q.cg) cgs[key(q.name)] = q.cg;
      for (const p of t.players) if (cgs[key(p.name)]) p.cg = cgs[key(p.name)];
    }
    let n = 0, removed = 0, left = [], kept = 0;
    for (const dt of data.teams || []) {
      const t = Object.values(s.teams).find((x) => x.name === dt.name);
      if (!t || isMine(s, t.id)) continue;
      const ps = [];
      for (const q of dt.players || []) {
        // jogador comprado por mim continua comigo; os que saíram de verdade vão para o novo clube
        if (mine.has(key(q.name)) && bought.has(key(q.name))) { removed++; continue; }
        const age = q.age || 25;
        const af = age <= 22 ? 1.4 : age >= 32 ? 0.5 : age >= 29 ? 0.8 : 1;
        const ov = q.ov || (q.value ? clamp(Math.round(40 + 15 * Math.log10(q.value / af / 20000)), 40, 92) : 55);
        const value = q.value || valueOf(ov, age);
        ps.push({ id: PID++, name: q.name, pos: q.pos, sp: q.sp, cg: q.cg || 0, ov, age, value, wage: Math.round(value / 900) });
      }
      if (dt.stad && !t.stadUp) t.stad = dt.stad;
      t.players = ps; t.lineup = autoLineup(t); n++;
    }
    // jogadores que eu vendi continuam no clube comprador, a menos que o elenco real já os traga em algum clube
    for (const x of s.sold) {
      const nm = key(x.p.name);
      if (realTeam[nm] !== undefined) continue;
      const b = s.teams[x.tid];
      if (!b || isMine(s, b.id) || b.players.some((p) => key(p.name) === nm)) continue;
      b.players.push({ ...x.p, id: PID++ }); kept++;
    }
    // jogadores originais do meu time que, no mundo real, foram para outro clube: transfere também aqui
    for (const p of u.players.slice()) {
      const nm = key(p.name);
      if (bought.has(nm) || realTeam[nm] === undefined) continue;
      u.players.splice(u.players.indexOf(p), 1);
      const li = u.lineup.indexOf(p.id); if (li >= 0) u.lineup.splice(li, 1);
      left.push(p.name + " → " + s.teams[realTeam[nm]].name);
    }
    for (const t of Object.values(s.teams)) {
      if (isMine(s, t.id)) continue;
      for (const pos of ["GK", "DEF", "MID", "ATT"]) {
        const min = { GK: 2, DEF: 6, MID: 6, ATT: 4 }[pos];
        while (t.players.filter((p) => p.pos === pos).length < min) t.players.push(mkPlayer(pos, t.base - 5, ri(18, 30)));
      }
      t.lineup = autoLineup(t);
    }
    return { teams: n, removed, kept, left };
  }


  // Vários clubes sob o meu comando: o ativo usa s.cash; os demais guardam o caixa em s.cashes.
  function myClubs(s) { return s.clubs && s.clubs.length ? s.clubs : [s.user]; }
  function addClub(s, id) {
    id = +id;
    if (!s.teams[id]) return "Time inválido.";
    if (myClubs(s).includes(id)) return "Você já comanda este time.";
    if (s.teams[id].local) return "Time indisponível.";
    s.clubs = myClubs(s).concat(id);
    s.cashes = s.cashes || {};
    s.cashes[id] = clubCash(s.teams[id]);
    s.teams[id].lineup = autoLineup(s.teams[id]);
    return null;
  }
  function switchClub(s, id) {
    id = +id;
    if (id === s.user || !myClubs(s).includes(id)) return "Time inválido.";
    s.cashes = s.cashes || {};
    s.cashes[s.user] = s.cash;
    s.user = id;
    s.cash = s.cashes[id] || 0;
    delete s.cashes[id];
    fixLineup(s.teams[id]);
    return null;
  }
  function dropClub(s, id) {
    id = +id;
    if (id === s.user || !myClubs(s).includes(id)) return "Troque para outro time antes de largar este.";
    s.clubs = s.clubs.filter((x) => x !== id);
    if (s.cashes) delete s.cashes[id];
    return null;
  }
  const api = { startRound, liveStep, liveSub, liveResolve, liveFinish, autoReorg, getStad, stadCost, upgradeStadium, topScorers, yearOf, bestFormation, avail, nextRoundClubs, myClubs, addClub, switchClub, dropClub, STATES, CONT, COUNTRIES, LEAGUES, LG, FORMATIONS, TACTICS, newGame, autoLineup, ratings, playRound, acceptOffer, market, buy, sell, auction, sellTo, applyUpdate, resetPid, lineupPlayers, fixLineup, nextUserRound, sortTab, dateOf, userComps, userMatches };
  if (typeof module !== "undefined") module.exports = api; else root.Game = api;
})(typeof window !== "undefined" ? window : globalThis);
