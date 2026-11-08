(function (root) {
  const CD = typeof require !== "undefined" ? require("./clubs.js") : root.ClubData;
  const { COUNTRIES, LEAGUES, CUPS, STATES } = CD;
  const FORMATIONS = { "4-4-2": [4,4,2], "4-3-3": [4,3,3], "3-5-2": [3,5,2], "4-5-1": [4,5,1], "5-3-2": [5,3,2] };
  const TACTICS = ["Defensiva", "Equilibrada", "Ofensiva"];
  const FIRST = ["João","Pedro","Lucas","Gabriel","Matheus","Rafael","Bruno","Diego","Felipe","Thiago","Carlos","André","Vitor","Marcos","Leandro","Rodrigo","Gustavo","Everton","Wesley","Caio","Renan","Igor","Danilo","Paulo","Fábio","Mateo","Hugo","Luca","Jonas","Declan","Marco","Jules"];
  const LAST = ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Ribeiro","Alves","Martins","Rocha","Carvalho","Gomes","Barbosa","Moreira","Araújo","Nunes","Teixeira","Cardoso","Freitas","Dias","Ramos","Pinto","Mendes","Müller","Rossi","Dupont","García","Smith","Fernández"];
  const CASH = [8000000, 3500000, 1500000];
  const FANS = [1500, 700, 300];
  const LG = {}; LEAGUES.forEach((l) => (LG[l.key] = l));

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[ri(0, arr.length - 1)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let PID = 1;

  function valueOf(ov, age) {
    let v = 20000 * Math.pow(10, (ov - 40) / 15);
    if (age <= 22) v *= 1.4; else if (age >= 32) v *= 0.5; else if (age >= 29) v *= 0.8;
    return Math.round(v / 1000) * 1000;
  }
  function mkPlayer(pos, ov, age) {
    ov = clamp(Math.round(ov), 35, 95);
    age = age || ri(18, 36);
    const value = valueOf(ov, age);
    return { id: PID++, name: pick(FIRST) + " " + pick(LAST), pos, ov, age, value, wage: Math.round(value / 900) };
  }
  function genSquad(base) {
    const plan = { GK: 3, DEF: 8, MID: 7, ATT: 5 };
    const ps = [];
    for (const pos in plan) for (let i = 0; i < plan[pos]; i++) ps.push(mkPlayer(pos, base + rnd(-9, 8) - i * 0.8));
    return ps;
  }
  function resetPid(s) {
    let m = 0;
    for (const t of Object.values(s.teams)) for (const p of t.players) m = Math.max(m, p.id);
    PID = m + 1;
  }

  function autoLineup(team, formation) {
    const f = FORMATIONS[formation || team.formation];
    const need = { GK: 1, DEF: f[0], MID: f[1], ATT: f[2] };
    const ids = [];
    for (const pos in need)
      team.players.filter((p) => p.pos === pos).sort((a, b) => b.ov - a.ov).slice(0, need[pos]).forEach((p) => ids.push(p.id));
    return ids;
  }
  function lineupPlayers(team) {
    const set = new Set(team.lineup);
    return team.players.filter((p) => set.has(p.id));
  }
  function avg(ps, d) { return ps.length ? ps.reduce((s, p) => s + p.ov, 0) / ps.length : d; }
  function ratings(team) {
    const L = lineupPlayers(team);
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
  function simMatch(h, a) {
    const rh = ratings(h), ra = ratings(a);
    const tf = (t) => (t.tactic === "Ofensiva" ? [1.06, 0.94] : t.tactic === "Defensiva" ? [0.94, 1.06] : [1, 1]);
    const [ah, dh] = tf(h), [aa, da] = tf(a);
    const xh = 1.3 * Math.exp((rh.A * ah - ra.D * da + 3) / 22);
    const xa = 1.1 * Math.exp((ra.A * aa - rh.D * dh - 3) / 22);
    const gh = poisson(clamp(xh, 0.15, 5)), ga = poisson(clamp(xa, 0.15, 5));
    const sh = [], sa = [];
    for (let i = 0; i < gh; i++) sh.push(scorer(h));
    for (let i = 0; i < ga; i++) sa.push(scorer(a));
    return { gh, ga, sh, sa };
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

  function setupSeason(s) {
    s.fixtures = {}; s.table = {}; s.round = 0; s.phase = "league"; s.cups = null; s.maxRound = 0;
    // estaduais
    s.states = {}; s.stTable = {};
    const byName = {};
    Object.values(s.teams).forEach((t) => (byName[t.name] = t.id));
    for (const st of STATES) {
      const ids = st.clubs.map((n) => byName[n]).filter(Boolean).sort(() => Math.random() - 0.5);
      s.states[st.key] = { name: st.name, ko: st.ko, ids, fixtures: roundRobin(ids).slice(0, ids.length - 1), round: 0, cup: null };
      ids.forEach((id) => (s.stTable[id] = emptyRow()));
    }
    s.userState = Object.keys(s.states).find((k) => s.states[k].ids.includes(s.user)) || null;
    if (s.userState) s.phase = "state";
    for (const key in s.lg) {
      const ids = s.lg[key].slice().sort(() => Math.random() - 0.5);
      s.lg[key] = ids;
      s.fixtures[key] = roundRobin(ids);
      s.maxRound = Math.max(s.maxRound, s.fixtures[key].length);
      ids.forEach((id) => { s.table[id] = emptyRow(); s.teams[id].lkey = key; });
    }
  }

  function clubCash(t) { return CASH[LG[t.lkey].tier - 1]; }
  function repFor(ovr) { return clamp(Math.round((ovr - 48) * 3.5), 5, 95); }

  function newGame(clubName) {
    const s = { season: 2026, round: 0, lg: {}, teams: {}, user: null, cash: 0, rep: 0, offers: [], honors: [] };
    let id = 1;
    for (const l of LEAGUES) {
      s.lg[l.key] = [];
      const c = COUNTRIES[l.country], n = l.clubs.length;
      const base = c.base - 7 * (l.tier - 1);
      l.clubs.forEach((name, i) => {
        const b = base + ((n - 1) / 2 - i) * 0.35;
        const t = { id, name, country: l.country, lkey: l.key, fans: Math.round(FANS[l.tier - 1] * c.fans * rnd(0.7, 1.4)), players: genSquad(b), formation: "4-4-2", tactic: "Equilibrada", lineup: [] };
        t.lineup = autoLineup(t);
        s.teams[id] = t; s.lg[l.key].push(id); id++;
      });
    }
    // times que só disputam estaduais (fora das divisões modeladas)
    const have = new Set(Object.values(s.teams).map((t) => t.name));
    for (const st of STATES) for (const name of st.clubs) {
      if (have.has(name)) continue;
      have.add(name);
      const t = { id, name, country: "BRA", lkey: null, local: true, fans: ri(60, 200), players: genSquad(44 + rnd(-3, 3)), formation: "4-4-2", tactic: "Equilibrada", lineup: [] };
      t.lineup = autoLineup(t);
      s.teams[id] = t; id++;
    }
    const u = Object.values(s.teams).find((t) => t.name === clubName && !t.local);
    s.user = u.id;
    s.cash = clubCash(u);
    s.rep = repFor(ratings(u).ovr);
    setupSeason(s);
    return s;
  }

  function fixLineup(t) {
    const ok = t.lineup.length === 11 && t.lineup.every((i) => t.players.some((p) => p.id === i)) &&
      lineupPlayers(t).filter((p) => p.pos === "GK").length === 1;
    if (!ok) { t.lineup = autoLineup(t); return true; }
    return false;
  }

  function simRound(s, round, res) {
    for (const key in s.fixtures) {
      const fx = s.fixtures[key][round];
      if (!fx) continue;
      for (const [h, a] of fx) {
        const H = s.teams[h], A = s.teams[a];
        if (h !== s.user) H.lineup = autoLineup(H);
        if (a !== s.user) A.lineup = autoLineup(A);
        const r = simMatch(H, A);
        const th = s.table[h], ta = s.table[a];
        th.p++; ta.p++; th.gf += r.gh; th.ga += r.ga; ta.gf += r.ga; ta.ga += r.gh;
        if (r.gh > r.ga) { th.w++; th.pts += 3; ta.l++; } else if (r.gh < r.ga) { ta.w++; ta.pts += 3; th.l++; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
        if (h === s.user || a === s.user) res.report = { home: H.name, away: A.name, ...r };
      }
    }
  }
  function userMatchAt(s, round) {
    const fx = s.fixtures[s.teams[s.user].lkey][round];
    return fx ? fx.find(([h, a]) => h === s.user || a === s.user) : null;
  }

  function sortIds(ids, table) {
    return ids.slice().sort((a, b) => {
      const x = table[a], y = table[b];
      return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
    });
  }
  function playState(s) {
    const u = s.teams[s.user];
    const res = { report: null, wages: 0, gate: 0, skipped: 0, fixed: fixLineup(u), statePhase: true, cupReports: [], champions: [], prize: 0 };
    const open = () => Object.values(s.states).filter((st) => st.cup === null || st.cup.champion === null);
    while (true) {
      const us = s.userState ? s.states[s.userState] : null;
      let userPlays = false, userHome = false;
      if (us && us.cup === null) {
        const m = (us.fixtures[us.round] || []).find(([h, a]) => h === s.user || a === s.user);
        if (m) { userPlays = true; userHome = m[0] === s.user; }
      } else if (us && us.cup && us.cup.champion === null && us.cup.alive.includes(s.user)) userPlays = true;
      for (const st of open()) {
        if (st.cup === null) {
          for (const [h, a] of st.fixtures[st.round] || []) {
            const H = s.teams[h], A = s.teams[a];
            if (h !== s.user) H.lineup = autoLineup(H);
            if (a !== s.user) A.lineup = autoLineup(A);
            const r = simMatch(H, A);
            const th = s.stTable[h], ta = s.stTable[a];
            th.p++; ta.p++; th.gf += r.gh; th.ga += r.ga; ta.gf += r.ga; ta.ga += r.gh;
            if (r.gh > r.ga) { th.w++; th.pts += 3; ta.l++; } else if (r.gh < r.ga) { ta.w++; ta.pts += 3; th.l++; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
            if (h === s.user || a === s.user) res.report = { home: H.name, away: A.name, ...r };
          }
          st.round++;
          if (st.round >= st.fixtures.length) {
            const top = sortIds(st.ids, s.stTable).slice(0, st.ko);
            st.cup = { name: st.name + " (mata-mata)", prize: 150000, alive: top, round: 0, champion: null };
          }
        } else cupRound(s, st.cup, res);
      }
      if (userPlays && us.cup === null === false) { /* jogo de mata-mata já relatado */ }
      if (res.report && userPlays) {
        res.wages += u.players.reduce((x, p) => x + p.wage, 0);
        if (userHome) res.gate += Math.round(u.fans * 180 * rnd(0.85, 1.15));
      }
      if (!open().length) { s.phase = "league"; res.stateEnd = true; break; }
      if (userPlays) break;
      res.skipped++;
    }
    s.cash += res.gate - res.wages;
    return res;
  }

  function playRound(s) {
    if (s.phase === "state") return playState(s);
    if (s.phase === "league") return playLeague(s);
    if (s.phase === "cups") return playCups(s);
    return null;
  }
  function playLeague(s) {
    const u = s.teams[s.user];
    const res = { report: null, wages: 0, gate: 0, skipped: 0, fixed: fixLineup(u) };
    while (true) {
      const m = userMatchAt(s, s.round);
      simRound(s, s.round, res);
      if (m) {
        res.wages += u.players.reduce((x, p) => x + p.wage, 0);
        if (m[0] === s.user) res.gate += Math.round(u.fans * 180 * rnd(0.85, 1.15));
      }
      s.round++;
      if (m) res.newOffers = (res.newOffers || 0) + midSeasonOffers(s);
      if (s.round >= s.maxRound) { startCups(s); res.leagueEnd = true; break; }
      if (m) break;
      res.skipped++;
    }
    s.cash += res.gate - res.wages;
    return res;
  }

  // Convites durante a temporada: a cada 6 rodadas, conforme o desempenho vs. o esperado pela força do elenco.
  function midSeasonOffers(s) {
    const u = s.teams[s.user], key = u.lkey, n = s.lg[key].length;
    const played = s.table[s.user].p;
    // fim do 1º turno / início do 2º turno (metade do campeonato)
    if (played !== s.fixtures[key].length / 2) return 0;
    const tab = sortedTable(s, key);
    const pos = tab.indexOf(s.user) + 1;
    const exp = s.lg[key].slice().sort((a, b) => ratings(s.teams[b]).ovr - ratings(s.teams[a]).ovr).indexOf(s.user) + 1;
    const diff = exp - pos;
    let target;
    if (diff >= 3) target = ratings(u).ovr + 1.5 + Math.min(diff, 8) * 0.5;      // surpreendendo: clubes maiores chamam
    else if (diff <= -4) target = ratings(u).ovr - 2.5;                           // fracassando: só clubes menores chamam
    else return 0;
    const have = new Set((s.offers || []).map((o) => o.tid));
    const cands = Object.values(s.teams).filter((t) => t.id !== s.user && !t.local && !have.has(t.id) && Math.abs(ratings(t).ovr - target) <= 2.5)
      .sort(() => Math.random() - 0.5).slice(0, 2);
    s.offers = (s.offers || []).concat(cands.map((t) => {
      const lk = Object.keys(s.lg).find((k) => s.lg[k].includes(t.id));
      return { tid: t.id, name: t.name, league: LG[lk].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: CASH[LG[lk].tier - 1], why: diff >= 3 ? `Você está em ${pos}º, acima do esperado (${exp}º).` : `Você está em ${pos}º, abaixo do esperado (${exp}º).` };
    }));
    return cands.length;
  }

  function sortedTable(s, key) {
    return s.lg[key].slice().sort((a, b) => {
      const x = s.table[a], y = s.table[b];
      return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
    });
  }

  // ---- Copas continentais ----
  function startCups(s) {
    const tables = {};
    for (const k in s.lg) tables[k] = sortedTable(s, k);
    const ovr = (id) => ratings(s.teams[id]).ovr;
    s.cups = {};
    for (const ck in CUPS) {
      const c = CUPS[ck];
      let ids = [];
      for (const [lk, a, b] of c.slots) ids = ids.concat((tables[lk] || []).slice(a - 1, b));
      ids.sort((x, y) => ovr(y) - ovr(x));
      if (ids.length >= 2) s.cups[ck] = { name: c.name, prize: c.prize, alive: ids, round: 0, champion: null };
    }
    s.phase = Object.keys(s.cups).length ? "cups" : "end";
  }
  function cupRound(s, cup, res) {
    const alive = cup.alive, n = alive.length;
    let size = 1; while (size < n) size *= 2;
    const byes = size - n;
    const next = alive.slice(0, byes);
    const rest = alive.slice(byes);
    const names = (id) => s.teams[id].name;
    for (let i = 0; i < rest.length / 2; i++) {
      const h = rest[i], a = rest[rest.length - 1 - i];
      const H = s.teams[h], A = s.teams[a];
      if (h !== s.user) H.lineup = autoLineup(H);
      if (a !== s.user) A.lineup = autoLineup(A);
      const r = simMatch(H, A);
      let w = r.gh > r.ga ? h : r.gh < r.ga ? a : null, pens = false;
      if (w === null) { pens = true; const ph = ratings(H).ovr, pa = ratings(A).ovr; w = Math.random() < 0.5 + (ph - pa) * 0.01 ? h : a; }
      next.push(w);
      if (h === s.user || a === s.user) {
        res.cupReports.push({ cup: cup.name, home: H.name, away: A.name, gh: r.gh, ga: r.ga, pens, winner: names(w) });
        if (w === s.user) { s.cash += cup.prize; res.prize += cup.prize; }
      }
    }
    cup.alive = next.sort((x, y) => alive.indexOf(x) - alive.indexOf(y));
    cup.round++;
    if (cup.alive.length === 1) {
      cup.champion = cup.alive[0];
      s.honors.push({ season: s.season, cup: cup.name, club: names(cup.champion) });
      res.champions.push(`${cup.name}: ${names(cup.champion)}`);
    }
  }
  function playCups(s) {
    const res = { cupReports: [], champions: [], prize: 0, cupPhase: true };
    const userIn = () => Object.values(s.cups).some((c) => c.champion === null && c.alive.includes(s.user));
    const open = () => Object.values(s.cups).filter((c) => c.champion === null);
    const wasIn = userIn();
    do { open().forEach((c) => cupRound(s, c, res)); } while (!wasIn && open().length);
    if (wasIn && !open().length === false) { /* user ainda joga nas próximas rodadas */ }
    if (!open().length) { s.phase = "end"; res.cupsEnd = true; }
    return res;
  }

  function endSeason(s) {
    const u = s.teams[s.user], ukey = u.lkey, ul = LG[ukey];
    const info = { champion: s.teams[sortedTable(s, ul.key)[0]].name, up: [], down: [], userPos: 0, prize: 0, offers: [], honors: s.honors.filter((h) => h.season === s.season) };
    // expectativa vs. resultado
    const tab = sortedTable(s, ukey);
    info.userPos = tab.indexOf(s.user) + 1;
    const byOvr = s.lg[ukey].slice().sort((a, b) => ratings(s.teams[b]).ovr - ratings(s.teams[a]).ovr);
    const expPos = byOvr.indexOf(s.user) + 1;
    info.prize = (tab.length + 1 - info.userPos) * [400000, 150000, 60000][ul.tier - 1];
    s.cash += info.prize;
    // promoção e rebaixamento por país
    const n = COUNTRIES[ul.country] ? 0 : 0;
    let moved = null;
    for (const c in COUNTRIES) {
      const tiers = LEAGUES.filter((l) => l.country === c).sort((a, b) => a.tier - b.tier);
      const k = COUNTRIES[c].promo;
      const tabs = tiers.map((l) => sortedTable(s, l.key));
      const newLg = tiers.map((l, i) => {
        let ids = tabs[i].slice();
        if (i > 0) ids = ids.slice(k);                 // sobem os k melhores da divisão de baixo
        if (i < tiers.length - 1) ids = ids.slice(0, ids.length - k); // caem os k piores
        if (i > 0) ids = ids.concat(tabs[i - 1].slice(tabs[i - 1].length - k)); // vindos de cima
        if (i < tiers.length - 1) ids = ids.concat(tabs[i + 1].slice(0, k));    // vindos de baixo
        return ids;
      });
      // monta de forma consistente: cada divisão = meio + caídos de cima + subidos de baixo
      tiers.forEach((l, i) => {
        let mid = tabs[i].slice(i > 0 ? k : 0, tabs[i].length - (i < tiers.length - 1 ? k : 0));
        const dropped = i > 0 ? tabs[i - 1].slice(tabs[i - 1].length - k) : [];
        const up = i < tiers.length - 1 ? tabs[i + 1].slice(0, k) : [];
        s.lg[l.key] = mid.concat(dropped, up);
      });
      if (c === ul.country) {
        tiers.forEach((l, i) => {
          if (i < tiers.length - 1 && l.tier === 1) { info.down = tabs[i].slice(tabs[i].length - k).map((x) => s.teams[x].name); info.up = tabs[i + 1].slice(0, k).map((x) => s.teams[x].name); }
        });
      }
    }
    const newKey = Object.keys(s.lg).find((k) => s.lg[k].includes(s.user));
    const movedUp = LG[newKey].tier < ul.tier, movedDown = LG[newKey].tier > ul.tier;
    // reputação
    let rep = s.rep + (expPos - info.userPos) * 0.9 + (info.userPos === 1 ? 4 : 0) + (movedUp ? 4 : 0) + (movedDown ? -6 : 0);
    info.honors.forEach((h) => { if (h.club === u.name) rep += 3; });
    s.rep = clamp(Math.round(rep), 0, 100);
    // envelhecimento
    for (const t of Object.values(s.teams)) {
      t.players.forEach((p) => {
        p.age++;
        const d = p.age <= 23 ? ri(0, 4) : p.age <= 29 ? ri(-1, 2) : ri(-4, 0);
        p.ov = clamp(p.ov + d, 35, 95);
        p.value = valueOf(p.ov, p.age); p.wage = Math.round(p.value / 900);
      });
      if (t.id !== s.user) {
        const keep = t.players.filter((p) => p.age < 37);
        const lost = t.players.length - keep.length;
        t.players = keep;
        const lk = Object.keys(s.lg).find((k) => s.lg[k].includes(t.id));
        const b = lk ? COUNTRIES[t.country].base - 7 * (LG[lk].tier - 1) - 3 : 44;
        for (let i = 0; i < lost; i++) t.players.push(mkPlayer(pick(["DEF","MID","ATT"]), b, ri(18, 22)));
      }
      t.lineup = autoLineup(t);
    }
    // convites de outros clubes (mecanismo próprio: reputação define o nível dos clubes que te chamam)
    const target = 48 + s.rep * 0.30;
    const cands = Object.values(s.teams).filter((t) => t.id !== s.user && !t.local && Math.abs(ratings(t).ovr - target) <= 2.5);
    cands.sort(() => Math.random() - 0.5);
    s.offers = cands.slice(0, 3).map((t) => {
      const lk = Object.keys(s.lg).find((k) => s.lg[k].includes(t.id));
      return { tid: t.id, name: t.name, league: LG[lk].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: CASH[LG[lk].tier - 1] };
    });
    info.offers = s.offers;
    s.season++;
    setupSeason(s);
    return info;
  }

  function acceptOffer(s, tid) {
    const o = s.offers.find((x) => x.tid === tid);
    if (!o) return "Convite inválido.";
    s.user = tid;
    s.cash = o.cash;
    s.offers = [];
    s.userState = Object.keys(s.states || {}).find((k) => s.states[k].ids.includes(tid)) || null;
    s.teams[tid].lineup = autoLineup(s.teams[tid]);
    return null;
  }

  function market(s) {
    const out = [];
    for (const t of Object.values(s.teams)) if (t.id !== s.user && !t.local) for (const p of t.players) out.push({ ...p, team: t.name, tid: t.id });
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
    if (!f || f.t.id === s.user) return "Jogador indisponível.";
    const price = Math.round(f.p.value * 1.15);
    if (s.cash < price) return "Dinheiro insuficiente.";
    if (u.players.length >= 30) return "Elenco cheio (máx. 30).";
    s.cash -= price;
    f.t.players.splice(f.i, 1);
    u.players.push(f.p);
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
    const ids = Object.keys(s.teams).filter((k) => +k !== s.user && !s.teams[k].local);
    const buyer = s.teams[pick(ids)];
    buyer.players.push(p);
    const spare = buyer.players.filter((q) => q.pos === p.pos && q.id !== p.id).sort((a, b) => a.ov - b.ov)[0];
    if (spare && buyer.players.length > 24) buyer.players.splice(buyer.players.indexOf(spare), 1);
    buyer.lineup = autoLineup(buyer);
    return null;
  }

  // Atualização: sobrescreve elencos de TODOS os times, menos o do usuário;
  // remove dos outros qualquer jogador (mesmo nome) que esteja no time do usuário.
  function applyUpdate(s, data) {
    const mine = new Set(s.teams[s.user].players.map((p) => p.name.toLowerCase()));
    let n = 0, removed = 0;
    for (const dt of data.teams || []) {
      const t = Object.values(s.teams).find((x) => x.name === dt.name);
      if (!t || t.id === s.user) continue;
      const ps = [];
      for (const q of dt.players || []) {
        if (mine.has(String(q.name).toLowerCase())) { removed++; continue; }
        const age = q.age || 25, ov = q.ov || 55, value = q.value || valueOf(ov, age);
        ps.push({ id: PID++, name: q.name, pos: q.pos, ov, age, value, wage: Math.round(value / 900) });
      }
      const lk = Object.keys(s.lg).find((k) => s.lg[k].includes(t.id));
      const b = lk ? COUNTRIES[t.country].base - 7 * (LG[lk].tier - 1) : 44;
      for (const pos of ["GK", "DEF", "MID", "ATT"]) {
        const min = { GK: 2, DEF: 6, MID: 6, ATT: 4 }[pos];
        while (ps.filter((p) => p.pos === pos).length < min) ps.push(mkPlayer(pos, b - 5, ri(18, 30)));
      }
      t.players = ps; t.lineup = autoLineup(t); n++;
    }
    return { teams: n, removed };
  }

  const api = { STATES, sortIds, COUNTRIES, LEAGUES, LG, CUPS, FORMATIONS, TACTICS, newGame, autoLineup, ratings, playRound, sortedTable, endSeason, acceptOffer, market, buy, sell, applyUpdate, resetPid, lineupPlayers, fixLineup, userMatchAt };
  if (typeof module !== "undefined") module.exports = api; else root.Game = api;
})(typeof window !== "undefined" ? window : globalThis);
