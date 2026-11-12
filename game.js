(function (root) {
  const CD = typeof require !== "undefined" ? require("./clubs.js") : root.ClubData;
  const { COUNTRIES, LEAGUES, STATES, CONT } = CD;
  const FORMATIONS = {}; // todos os desenhos de 10 jogadores de linha (3 a 5 defensores, 2 a 6 meias, 1 a 4 atacantes)
  [[4,4,2],[4,3,3],[3,5,2],[4,5,1],[5,3,2],[5,4,1],[3,4,3],[4,2,4],[5,2,3],[3,6,1],[3,3,4],[4,6,0]].filter((x) => x[2] > 0).forEach((x) => (FORMATIONS[x.join("-")] = x));
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

  // ---- Valor de mercado <-> OVR (v153) ----
  // Fator de idade suave: o mercado cobra mais pelos jovens (potencial) e menos pelos veteranos.
  const AGE_PTS = [[17, 1.55], [19, 1.5], [22, 1.35], [25, 1.08], [27, 1], [29, 0.9], [31, 0.72], [33, 0.52], [36, 0.35], [40, 0.25]];
  function ageF(age) {
    if (age <= AGE_PTS[0][0]) return AGE_PTS[0][1];
    for (let i = 1; i < AGE_PTS.length; i++) if (age <= AGE_PTS[i][0]) { const [a0, f0] = AGE_PTS[i - 1], [a1, f1] = AGE_PTS[i]; return f0 + (f1 - f0) * (age - a0) / (a1 - a0); }
    return AGE_PTS[AGE_PTS.length - 1][1];
  }
  // Prêmio de mercado por posição (calibrado nos dados reais): atacantes e pontas custam mais que zagueiros e goleiros com a mesma qualidade.
  const POS_F = { GOL: 0.7, ZAG: 1.05, LD: 0.99, LE: 0.99, VOL: 1.04, MC: 1.1, MEI: 1.1, ME: 1.05, MD: 1.05, PD: 1.15, PE: 1.2, SA: 1.2, CA: 1.15 }; // calibrado (11/11/2026) com os 11.645 jogadores reais do elencos.json: OVR médio igualado entre posições (correção de 60%)
  // Prêmio de mercado por liga (ESTIMATIVA): os valores do Transfermarkt na Inglaterra são inflados pelo dinheiro da liga.
  const LIGA_F = { ENG1: 1.15, ENG2: 1.1 };
  const mktF = (age, sp, lkey) => ageF(age) * (POS_F[sp] || 1) * (LIGA_F[lkey] || 1);
  const ovFromValue = (value, age, sp, lkey) => Math.max(1, Math.round(40 + 15 * Math.log10(value / mktF(age, sp, lkey) / 20000)));
  function valueOf(ov, age, sp, lkey) {
    const v = 20000 * Math.pow(10, (ov - 40) / 15) * mktF(age, sp, lkey);
    return Math.round(v / 1000) * 1000;
  }
  const oldValueOf = (ov, age) => { let v = 20000 * Math.pow(10, (ov - 40) / 15); if (age <= 22) v *= 1.4; else if (age >= 32) v *= 0.5; else if (age >= 29) v *= 0.8; return v; };
  // Motor da partida (calibrado com as tabelas reais de 2025/26): divisor por liga e vantagem de mandar o jogo.
  const SIM_S = { BRA1: 40, BRA2: 40, BRA3: 40, ARG1: 40, ARG2: 40 };
  const simS = (a, b) => ((SIM_S[a.lkey] || 21) + (SIM_S[b.lkey] || 21)) / 2;
  const HOME_ADV = 1;
  function mkPlayer(pos, ov, age) {
    ov = Math.max(1, Math.round(ov)); // sem teto: só o mínimo é 1
    age = age || ri(18, 36);
    const value = valueOf(ov, age);
    const sp = pick({ GK: ["GOL"], DEF: ["ZAG", "ZAG", "LD", "LE"], MID: ["VOL", "MC", "MC", "ME", "MD", "MEI"], ATT: ["CA", "CA", "PD", "PE", "SA"] }[pos]);
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
    for (const p of s.ext || []) m = Math.max(m, p.id);
    PID = m + 1;
  }

  const avail = (p) => !(p.inj > 0) && !(p.sus > 0);
  const SLOTS = {
    DEF: { 3: ["ZAG", "ZAG", "ZAG"], 4: ["LE", "ZAG", "ZAG", "LD"], 5: ["LE", "ZAG", "ZAG", "ZAG", "LD"] },
    MID: { 3: ["VOL", "MC", "MEI"], 4: ["ME", "MC", "MC", "MD"], 5: ["ME", "VOL", "MC", "MEI", "MD"] },
    ATT: { 1: ["CA"], 2: ["CA", "SA"], 3: ["PE", "CA", "PD"] },
  };
  // Posições alternativas de cada jogador (além da principal do Transfermarkt): joga de graça nelas. Fora delas rende menos.
  const ALTS = { GOL: [], ZAG: [], LE: ["LD"], LD: ["LE"], VOL: ["MC"], MC: ["VOL", "MEI"], MEI: ["MC", "SA"], ME: ["MEI", "MC", "PE"], MD: ["MEI", "MC", "PD"], PE: ["PD", "ME"], PD: ["PE", "MD"], SA: ["CA", "MEI"], CA: ["SA"] };
  // Quem pode cobrir cada vaga quando não há o jogador exato (a posição exata sempre tem prioridade).
  const COMPAT = {}; Object.keys(ALTS).forEach((sp) => { COMPAT[sp] = [sp].concat(Object.keys(ALTS).filter((o) => ALTS[o].includes(sp))); });
  // Meia central e meia ofensivo cobrem a vaga de meia lateral na escalação automática (meia lateral é raro no Transfermarkt).
  ["ME", "MD"].forEach((sp) => { COMPAT[sp] = COMPAT[sp].concat(["MEI", "MC"].filter((x) => !COMPAT[sp].includes(x))); });
  // Variantes de vagas por quantidade de jogadores em cada setor (o goleiro é sempre 1; o resto pode inovar).
  const VARS = {
    DEF: { 3: [["ZAG", "ZAG", "ZAG"]], 4: [["LE", "ZAG", "ZAG", "LD"]], 5: [["LE", "ZAG", "ZAG", "ZAG", "LD"]] },
    MID: {
      2: [["VOL", "MC"], ["VOL", "VOL"], ["MC", "MEI"]],
      3: [["VOL", "MC", "MEI"], ["VOL", "VOL", "MEI"], ["MC", "MC", "MEI"], ["VOL", "MC", "MC"]],
      4: [["ME", "MC", "MC", "MD"], ["VOL", "MC", "MEI", "MC"], ["VOL", "VOL", "MEI", "MEI"], ["VOL", "MC", "MEI", "MEI"]],
      5: [["ME", "VOL", "MC", "MEI", "MD"], ["VOL", "MC", "MC", "MEI", "MEI"], ["VOL", "VOL", "MC", "MEI", "MEI"]],
      6: [["ME", "VOL", "VOL", "MEI", "MEI", "MD"]],
    },
    ATT: { 1: [["CA"]], 2: [["CA", "SA"], ["CA", "CA"], ["SA", "SA"]], 3: [["PE", "CA", "PD"], ["PE", "SA", "PD"], ["CA", "SA", "CA"]], 4: [["PE", "CA", "SA", "PD"], ["PE", "CA", "CA", "PD"]] },
  };
  const fitOf = (sp, slot) => (sp === slot || (ALTS[sp] || []).includes(slot) ? 1 : 0.95); // posição principal ou secundária: mantém o OVR; fora delas rende menos
  // Escolhe, para um setor, os jogadores e a variante de vagas que somam mais qualidade (ov x encaixe). Retorna {chosen, eff, miss}.
  function pickGroup(pool, out, n, pos) {
    const vs = VARS[pos][n] || [new Array(n).fill(null)];
    let best = null;
    for (const slots of vs) {
      const pairs = [];
      pool.forEach((p, pi) => slots.forEach((sl, si) => pairs.push({ pi, si, v: p.ov * (sl ? fitOf(p.sp, sl) : 1) })));
      pairs.sort((x, y) => y.v - x.v);
      const usedP = new Set(), usedS = new Set(), pick = [];
      let eff = 0, miss = 0;
      for (const q of pairs) {
        if (usedP.has(q.pi) || usedS.has(q.si)) continue;
        usedP.add(q.pi); usedS.add(q.si); pick.push(pool[q.pi]); eff += q.v;
        if (slots[q.si] && pool[q.pi].sp !== slots[q.si] && fitOf(pool[q.pi].sp, slots[q.si]) < 0.99) miss++;
        if (pick.length === n) break;
      }
      if (!best || eff > best.eff) best = { pick, eff, miss };
    }
    const chosen = best.pick.slice();
    for (const p of out) { if (chosen.length >= n) break; chosen.push(p); }
    return { chosen, eff: best.eff, miss: best.miss };
  }
  // Posição em que cada titular joga na formação (pode ser diferente da de origem): devolve { idDoJogador: "ZAG" | "VOL" | ... }
  function slotMap(ps) {
    const out = {};
    for (const pos of ["GK", "DEF", "MID", "ATT"]) {
      const grp = ps.filter((p) => p.pos === pos);
      if (!grp.length) continue;
      if (pos === "GK") { grp.forEach((p) => { out[p.id] = "GOL"; }); continue; }
      const vs = VARS[pos][grp.length] || [grp.map((p) => p.sp || ({ DEF: "ZAG", MID: "MC", ATT: "CA" })[pos])];
      let best = null;
      for (const slots of vs) {
        const pairs = [];
        grp.forEach((p, pi) => slots.forEach((sl, si) => pairs.push({ pi, si, v: p.ov * fitOf(p.sp, sl) })));
        pairs.sort((x, y) => y.v - x.v);
        const uP = new Set(), uS = new Set(), as = {}; let eff = 0;
        for (const q of pairs) { if (uP.has(q.pi) || uS.has(q.si)) continue; uP.add(q.pi); uS.add(q.si); as[grp[q.pi].id] = slots[q.si]; eff += q.v; }
        if (!best || eff > best.eff) best = { as, eff };
      }
      Object.assign(out, best.as);
    }
    return out;
  }
  // Monta o melhor onze para a formação (goleiro sempre 1; "miss" = jogadores fora de posição e fora das alternativas).
  function buildLineup(team, formation) {
    const f = FORMATIONS[formation || team.formation] || FORMATIONS["4-4-2"];
    const need = { GK: 1, DEF: f[0], MID: f[1], ATT: f[2] };
    const ids = []; let miss = 0, eff = 0;
    for (const pos in need) {
      const all = team.players.filter((p) => p.pos === pos).sort((a, b) => b.ov - a.ov);
      const pool = all.filter(avail), out = all.filter((p) => !avail(p));
      const r = pos === "GK" ? { chosen: pool.concat(out).slice(0, 1), eff: (pool[0] || { ov: 0 }).ov, miss: 0 } : pickGroup(pool, out, need[pos], pos);
      r.chosen.forEach((p) => ids.push(p.id)); miss += r.miss; eff += r.eff;
    }
    return { ids, miss, eff };
  }
  // Sem formação indicada e com a formação automática ligada (fAuto !== false), usa a melhor formação do time.
  function autoLineup(team, formation) {
    if (!formation && team.fAuto !== false) { const b = bestFormation(team); team.formation = b.f; return b.ids; }
    return buildLineup(team, formation).ids;
  }
  // Melhor formação = a que escala o onze de maior qualidade (soma de OVR com encaixe de posição), qualquer desenho.
  function bestFormation(team) {
    let best = null;
    for (const f in FORMATIONS) {
      const { ids, miss, eff } = buildLineup(team, f);
      if (!best || eff > best.score + 1e-9) best = { f, ids, score: eff, miss };
    }
    const set = new Set(best.ids);
    best.ovr = ratingsL(team.players.filter((p) => set.has(p.id))).ovr;
    return best;
  }
  function lineupPlayers(team) {
    const set = new Set(team.lineup);
    return team.players.filter((p) => set.has(p.id));
  }
  function avg(ps, d) { return ps.length ? ps.reduce((s, p) => s + p.ov, 0) / ps.length : d; }
  function ratings(team) { return ratingsL(lineupPlayers(team)); }
  const DEFSP = { GK: "GOL", DEF: "ZAG", MID: "MC", ATT: "CA" };
  function ratingsL(L0) {
    // quem joga fora da posição principal e das secundárias perde OVR (mesma regra de liveReposition); com secundária mantém o OVR
    const sm = slotMap(L0), L = L0.map((p) => { const sl = sm[p.id], sp = p.sp || DEFSP[p.pos]; if (!sl || p.rp || sl === sp || (ALTS[sp] || []).includes(sl)) return p; const g = SP_GROUP[sl]; const f = g === p.pos ? 0.95 : (g === "GK" || p.pos === "GK") ? 0.6 : 0.85; return { pos: p.pos, ov: Math.max(1, Math.round(p.ov * f)) }; });
    const by = (pos) => L.filter((p) => p.pos === pos);
    // A formação mexe no jogo: mais defensores = mais defesa e menos ataque (e vice-versa); meias contam para os dois lados.
    // Soma zero em relação a 4-4-2/4-3-3 (4 defensores, 3,5 meias, 2,5 atacantes), então a calibração geral não muda.
    const nd = by("DEF").length, nm = by("MID").length, na = by("ATT").length;
    const A = avg(by("ATT"), 35) * 0.55 + avg(by("MID"), 35) * 0.45 + 1.6 * (na - 2.5) + 0.8 * (nm - 3.5);
    const D = avg(by("DEF"), 35) * 0.55 + avg(by("GK"), 30) * 0.25 + avg(by("MID"), 35) * 0.2 + 1.6 * (nd - 4) + 0.8 * (nm - 3.5);
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
    const S = simS(h, a), xh = 1.33 * Math.exp((rh.A * ah - ra.D * da + HOME_ADV) / S) * (redH ? 0.82 : 1) * (redA ? 1.12 : 1);
    const xa = 1.125 * Math.exp((ra.A * aa - rh.D * dh - HOME_ADV) / S) * (redA ? 0.82 : 1) * (redH ? 1.12 : 1);
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
      // critério de desempate da competição: Brasil/Libertadores/Sul-Americana/estaduais = vitórias, saldo, gols pró; demais = saldo, gols pró, vitórias
      if (x.cr === "BR") return y.pts - x.pts || y.w - x.w || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
      return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || y.w - x.w;
    });
  }
  const ovrOf = (s, id) => ratings(s.teams[id]).ovr;
  const byStrength = (s, ids) => ids.slice().sort((a, b) => ovrOf(s, b) - ovrOf(s, a));

  // ---------- criação de competições ----------
  function newComp(s, id, name, ids, after, extra) {
    if (s.comps[id + "_K"] && s.comps[id + "_K"].done) delete s.comps[id + "_K"]; // mata-mata da temporada anterior
    const c = Object.assign({ id, name, ids, after, tab: {}, rDone: 0, R: 0, ties: null, plan: null, si: 0, done: false, groups: null, order: ids }, extra || {});
    const ctry = c.key && LG[c.key] ? LG[c.key].country : null;
    const cr = ctry ? (ctry === "BRA" ? "BR" : "EN") : /^(EST_|LIB|SUL|BRA|CDB)/.test(id) ? "BR" : "EN";
    if (!extra || !extra.tab) ids.forEach((i) => (c.tab[i] = Object.assign(emptyRow(), { cr })));
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
  // Chaveamento por cabeça de chave (1x16, 8x9, 4x13...) para n = potência de 2; devolve [melhor, pior]
  function seededPairs(ranked) {
    let o = [1];
    while (o.length < ranked.length) { const m = o.length * 2; o = o.flatMap((x) => [x, m + 1 - x]); }
    const p = [];
    for (let i = 0; i < o.length; i += 2) p.push([ranked[o[i] - 1], ranked[o[i + 1] - 1]]);
    return p;
  }
  // Mando: jogo único = o melhor cabeça de chave joga em casa; ida e volta = o melhor decide em casa (a volta)
  function hostPair(c, better, worse) { return c.plan[c.si].legs === 1 ? [better, worse] : [worse, better]; }
  // Playoff da UEFA: cabeças 9-16 contra não cabeças 17-24 (9/10 x 23/24, 11/12 x 21/22, 13/14 x 19/20, 15/16 x 17/18), sorteio dentro de cada grupo
  function uefaPlayoff(c, ranked) {
    const r = ranked.slice(8, 24), pairs = [];
    for (const [s1, s2, u1, u2] of [[0, 1, 14, 15], [2, 3, 12, 13], [4, 5, 10, 11], [6, 7, 8, 9]]) {
      const us = shuffle([r[u1], r[u2]]);
      pairs.push([us[0], r[s1]], [us[1], r[s2]]);
    }
    return pairs;
  }
  // Oitavas da UEFA: 1/2 pegam os vencedores de 15-18, 3/4 os de 13/14-19/20, 5/6 os de 11/12-21/22 e 7/8 os de 9/10-23/24; 1/2 em lados opostos da chave
  function uefaR16(c, wins) {
    const t = c.top8, g = (i) => shuffle([wins[2 * i], wins[2 * i + 1]]);
    const G1 = g(0), G2 = g(1), G3 = g(2), G4 = g(3);
    const sp = (a, b) => (Math.random() < 0.5 ? [a, b] : [b, a]);
    const [s1, s2] = sp(t[0], t[1]), [s3, s4] = sp(t[2], t[3]), [s5, s6] = sp(t[4], t[5]), [s7, s8] = sp(t[6], t[7]);
    return [[G4[0], s1], [G1[0], s7], [G2[0], s5], [G3[0], s3], [G4[1], s2], [G1[1], s8], [G2[1], s6], [G3[1], s4]];
  }
  function nextPairs(s, c, wins, alive) {
    const rk = (id) => c.order.indexOf(id);
    if (c.mode === "uefa" && c.si === 1) return uefaR16(c, wins);
    if (c.mode === "uefa" || c.mode === "tree") { // a chave é fixa: o vencedor do confronto 2k enfrenta o do 2k+1
      const p = [];
      for (let i = 0; i + 1 < wins.length; i += 2) { const x = wins[i], y = wins[i + 1]; p.push(hostPair(c, rk(x) < rk(y) ? x : y, rk(x) < rk(y) ? y : x)); }
      return p;
    }
    if (c.mode === "draw") { // sorteio puro a cada fase (Copa do Brasil)
      const w = shuffle(wins.slice()), p = [];
      for (let i = 0; i + 1 < w.length; i += 2) p.push([w[i], w[i + 1]]);
      return p;
    }
    return pairBW(alive);
  }
  function startStage(s, c, pairs) {
    const st = c.plan[c.si];
    if (c.ties && c.stage) (c.past = c.past || []).push({ name: c.stage, ties: c.ties }); // guarda as fases anteriores para a tabela
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
    c.mode = "draw";
    { // 1ª fase: metade mais forte (cabeças) contra a metade mais fraca, sorteio entre elas; o menos cotado joga em casa
      const half = Math.floor(ids.length / 2), top = shuffle(ids.slice(0, half)), bot = shuffle(ids.slice(ids.length - half));
      startStage(s, c, top.map((t, i) => [bot[i], t]));
    }
    createSouthCups(s, Y);
    if (Y >= 2029 && (Y - 2029) % 4 === 0) createClubWorldCup(s, Y);
  }
  // Mundial de Clubes (a cada 4 anos a partir de 2029): 32 clubes, 8 grupos de 4, oitavas, quartas, semi e final em jogo único.
  function createClubWorldCup(s, Y) {
    const B = 52 * (Y - START_YEAR), def = CONT.MUN;
    const champs = (cup) => { const out = []; s.honors.filter((h) => h.cup.indexOf(cup) === 0).sort((a, b) => b.year - a.year).forEach((h) => { const t = Object.values(s.teams).find((x) => x.name === h.club); if (t && !out.includes(t.id)) out.push(t.id); }); return out.slice(0, 4); };
    const take = (first, pool, n) => { const out = first.slice(0, n); byStrength(s, pool).forEach((id) => { if (out.length < n && !out.includes(id)) out.push(id); }); return out; };
    def.extras.forEach((n) => { // saves antigos ainda não têm esses clubes
      if (Object.values(s.teams).some((t) => t.name === n)) return;
      const nid = Math.max(...Object.keys(s.teams).map(Number)) + 1;
      mkTeam(s, nid, n, "EXT", null, def.ovr + rnd(-3, 3), { local: true, extra: true, fans: ri(200, 800) });
    });
    const eu = take(champs(CONT.UCL.name), s.comps.UCL ? s.comps.UCL.ids : qualifiers(s, CONT.UCL), 12);
    const sa = take(champs(CONT.LIB.name), s.comps.LIB ? s.comps.LIB.ids : qualifiers(s, CONT.LIB), 6);
    const ids = byStrength(s, eu.concat(sa, def.extras.map((n) => teamByName(s, n))));
    const groups = drawGroups(s, ids, 8);
    const c = newComp(s, "MUN", def.name + " " + Y, ids, "gr", { order: ids, prize: def.prize, cont: true, groups });
    addRounds(s, c, groupRounds(groups).slice(0, 3), [48.1, 49.1, 50.1].map((x) => B + x));
    c.plan = plan([["Oitavas", 1, [50.8]], ["Quartas", 1, [51.2]], ["Semifinal", 1, [51.5]], ["Final", 1, [51.8]]], B);
    s.q.sort((a, b) => a.T - b.T);
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
  // ---- Finanças realistas ----
  // Receita anual dos 20 maiores clubes: Deloitte Football Money League (temporada 2025), em milhões de euros.
  const EURBRL = 6.13;
  const REV_REAL = { "Real Madrid": 1161, "Barcelona": 975, "Bayern de Munique": 861, "PSG": 837, "Liverpool": 836, "Manchester City": 829, "Arsenal": 822, "Manchester United": 793, "Tottenham": 673, "Chelsea": 584, "Inter de Milão": 537, "Borussia Dortmund": 531, "Atlético de Madrid": 455, "Aston Villa": 450, "Milan": 410, "Juventus": 402, "Newcastle": 398, "VfB Stuttgart": 296, "Benfica": 283, "West Ham": 276 };
  // Demais clubes (ESTIMATIVA): [valor médio do elenco da liga em R$ mi, receita ÷ valor do elenco do clube médio]. Série A do Brasil calibrada nos R$ 14,9 bi de 2025 (EY).
  const REV_LG = { BRA1: [660, 1.13], BRA2: [57, 1.3], BRA3: [5, 3], ARG1: [214, 1.1], ARG2: [19, 1], GER1: [1732, 0.9], GER2: [213, 1.6], ENG1: [4222, 0.6], ENG2: [701, 0.47], ESP1: [1831, 0.65], ESP2: [194, 0.8], POR1: [665, 0.6], POR2: [56, 0.45], ITA1: [1809, 0.63], ITA2: [230, 0.53], FRA1: [1449, 0.68], FRA2: [136, 0.9] };
  const squadValue = (t) => t.players.reduce((x, p) => x + (p.value || 0), 0);
  function clubRev(t) { // receita anual estimada, em R$
    if (REV_REAL[t.name]) return REV_REAL[t.name] * 1e6 * EURBRL;
    const L = REV_LG[t.lkey] || [100, 0.8], ref = L[0] * 1e6;
    return Math.max(2e6, L[1] * ref * Math.pow(Math.max(squadValue(t), 1) / ref, 0.85));
  }
  const wageRate = (t) => 0.55 * (REV_LG[t.lkey] ? REV_LG[t.lkey][1] : 0.7); // folha anual = valor do elenco × taxa (≈ 55–65% da receita)
  const payroll = (t) => Math.round(squadValue(t) * wageRate(t)); // folha anual em R$
  // Poder de compra: 40% da receita anual do clube.
  function clubCash(t) {
    if (t.local) return 1000000;
    return Math.max(500000, Math.round((clubRev(t) * 0.4) / 10000) * 10000);
  }
  // Migração única (v153): saves antigos passam a usar a nova conversão valor <-> OVR (idade suave, posição, liga).
  function migrateOvr2(s) {
    if (s.ovrV2) return;
    s.ovrV2 = 1;
    for (const t of Object.values(s.teams)) {
      const mine = isMine(s, t.id);
      for (const p of t.players) {
        if (!p.value) continue;
        const sim = mine && !p.real && Math.abs(p.value - oldValueOf(p.ov, p.age)) / Math.max(oldValueOf(p.ov, p.age), 1) < 0.1;
        if (sim) p.value = valueOf(p.ov, p.age, p.sp, t.lkey);
        else { p.ov = ovFromValue(p.value, p.age, p.sp, t.lkey); p.of = p.ov; }
      }
      t.lineup = mine ? (fixLineup(t), t.lineup) : autoLineup(t);
    }
    for (const p of s.ext || []) if (p.value) { p.ov = ovFromValue(p.value, p.age, p.sp); p.of = p.ov; }
  }
  // Migração única (saves antigos): caixa dos meus clubes sobe até o poder de compra realista.
  function migrateFin(s) {
    if (s.finV) return;
    s.finV = 1;
    if (s.teams[s.user]) s.cash = Math.max(s.cash, clubCash(s.teams[s.user]));
    s.cashes = s.cashes || {};
    for (const id of myClubs(s)) if (id !== s.user && s.teams[id]) s.cashes[id] = Math.max(s.cashes[id] || 0, clubCash(s.teams[id]));
  }
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
    // Brasileirão: vagas das copas sul-americanas seguem a classificação real do Brasileirão 2026 (após a 34ª rodada, 08/11/2026)
    {
      const real = ["Flamengo","Palmeiras","Cruzeiro","Fluminense","Athletico-PR","Bahia","Atlético-MG","Bragantino","Santos","São Paulo","Botafogo","Coritiba","Vasco","Mirassol","Vitória","Internacional","Corinthians","Grêmio","Remo","Chapecoense"];
      const ids = real.map((n) => Object.values(s.teams).find((t) => t.name === n && s.lg.BRA1.includes(t.id))).filter(Boolean).map((t) => t.id);
      s.rank.BRA1 = ids.concat(s.rank.BRA1.filter((i) => !ids.includes(i)));
    }
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
  function isMine(s, id) { if (s.free) return false; return id === s.user || (s.clubs || []).includes(id); }
  const isMineG = isMine;
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
  // Evolução do OVR: a cada 13 rodadas (4x por ano), por idade, talento individual (p.dv) e teto.
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5; // ~N(0,1) limitado
  function evoDelta(p) {
    if (p.dv == null) p.dv = clamp(gauss() * 0.6, -1, 1);
    const a = p.age;
    let e = a <= 19 ? 1.1 : a <= 21 ? 0.8 : a <= 23 ? 0.5 : a <= 26 ? 0.2 : a <= 29 ? -0.1 : a <= 31 ? -0.4 : a <= 33 ? -0.75 : -1.1;
    if (a <= 25) e += 0.45 * p.dv; else e += 0.15 * p.dv;
    if (e > 0) e *= p.ov >= 85 ? 0.35 : p.ov >= 78 ? 0.6 : p.ov >= 70 ? 0.85 : 1.1;
    else if (p.ov < 55) e *= 0.6;
    return e + gauss() * 0.45;
  }
  function evolve(s) {
    for (const t of Object.values(s.teams)) {
      if (!isMine(s, t.id)) continue; // os outros times seguem o Transfermarkt (atualização diária)
      t.players.forEach((p) => {
        if (p.real) return; // quem tem dado real é atualizado pelo Transfermarkt
        if (p.of == null || Math.round(p.of) !== p.ov) p.of = p.ov;
        p.of = Math.max(1, p.of + evoDelta(p));
        const n = Math.round(p.of);
        if (n !== p.ov) { p.ov = n; p.value = valueOf(p.ov, p.age, p.sp, t.lkey); p.wage = Math.round(p.value / 900); }
      });
      fixLineup(t);
    }
  }
  // OVR sem teto: jogadores que estavam travados em 92 (ou 95) voltam a valer o que o valor de mercado real pede
  function migrateOvr(s) {
    // mata-mata (_K) concluído de temporada anterior que ficou guardado: some quando a competição da nova temporada está em andamento
    for (const id of Object.keys(s.comps || {})) if (id.endsWith("_K")) { const base = s.comps[id.slice(0, -2)]; if (base && !base.done && s.comps[id].done) delete s.comps[id]; }
    if (s.ovrV) return;
    s.ovrV = 1;
    for (const t of Object.values(s.teams)) {
      for (const p of t.players) {
        if (p.ov < 90 || !p.value) continue;
        const af = p.age <= 22 ? 1.4 : p.age >= 32 ? 0.5 : p.age >= 29 ? 0.8 : 1;
        const d = Math.max(1, Math.round(40 + 15 * Math.log10(p.value / af / 20000)));
        if (d > p.ov) { p.ov = d; p.of = d; }
      }
    }
  }
  function ageCheck(s) {
    migrateOvr(s);
    if (s.evo == null) s.evo = Math.floor(s.T / 13);
    while (s.T >= (s.evo + 1) * 13) { s.evo++; evolve(s); }
  }
  // fim de temporada de um país: todos os jogadores envelhecem 1 ano e os de 40 (ou 45) se aposentam
  function seasonAging(s, ids) {
    for (const t of ids.map((id) => s.teams[id]).filter(Boolean)) {
        t.players.forEach((p) => {
          if (p.long == null) p.long = p.age > 40 ? 1 : 0; // já passava dos 40 na vida real: aposenta aos 45
          p.age++;
          p.value = valueOf(p.ov, p.age, p.sp, t.lkey); p.wage = Math.round(p.value / 900);
        });
        // aposentadoria em todos os times: 40 anos (45 para quem já jogava depois dos 40 na vida real)
        const keep = t.players.filter((p) => p.age < (p.long ? 45 : 40)), retired = t.players.filter((p) => !keep.includes(p));
        t.players = keep;
        if (isMine(s, t.id)) {
          s.notices = s.notices || [];
          retired.forEach((p) => s.notices.push(`🏁 ${p.name} (${p.age} anos) se aposentou do ${t.name}.`));
        } else {
          for (let i = 0; i < retired.length; i++) t.players.push(mkPlayer(pick(["DEF","MID","ATT"]), t.base - 3, ri(18, 22)));
        }
        if (isMine(s, t.id)) fixLineup(t); else t.lineup = autoLineup(t);
      }
  }
  // Artilheiros: chave nome|clube; total (g) e da temporada (sg, ano sy).
  function trackGoals(s, team, names, c) {
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
      if (c) { // gols por campeonato (reinicia a cada edição)
        const cid = c.id.replace(/_K$/, ""), bc = s.comps[cid] || c;
        e.cs = e.cs || {};
        if (!e.cs[cid] || e.cs[cid].k !== bc.name) e.cs[cid] = { k: bc.name, g: 0 };
        e.cs[cid].g++;
      }
    }
  }
  function topScorersComp(s, cid, n) {
    const bc = s.comps[cid]; if (!bc) return [];
    const mine = (id) => (s.clubs || [s.user]).concat(s.user).some((m) => s.teams[m] && s.teams[m].id === id);
    return Object.values(s.scorers || {}).filter((e) => e.cs && e.cs[cid] && e.cs[cid].k === bc.name && e.cs[cid].g > 0)
      .sort((a, b) => b.cs[cid].g - a.cs[cid].g || b.g - a.g).slice(0, n || 30)
      .map((e) => ({ n: e.n, c: e.c, g: e.cs[cid].g, mine: Object.values(s.teams).some((t) => t.name === e.c && mine(t.id)) }));
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
      trackGoals(s, H, r.sh, c); trackGoals(s, A, r.sa, c);
      if (rd.k === "tab") {
        const th = c.tab[h], ta = c.tab[a];
        th.p++; ta.p++; th.gf += r.gh; th.ga += r.ga; ta.gf += r.ga; ta.ga += r.gh;
        if (r.gh > r.ga) { th.w++; th.pts += 3; ta.l++; } else if (r.gh < r.ga) { ta.w++; ta.pts += 3; th.l++; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
      } else c.ties[k].res.push([r.gh, r.ga]);
      if (!silent) {
        const lab = { red: "🟥 expulso", yc3: "🟨 suspenso (3º amarelo)", inj: "🚑 lesionado" };
        for (const [tm, evs] of [[H, r.evh], [A, r.eva]]) if (isMine(s, tm.id)) for (const e of evs) res.notes.push(`${lab[e.type]}: ${e.name} (${tm.name}), fora por ${e.n} jogo${e.n > 1 ? "s" : ""}.`);
      }
      if (!silent) for (const tm of [H, A]) if (isMine(s, tm.id)) { // contador de jogos por clube: ofertas a cada 10 jogos (5 se procurando emprego)
        s.offGc = s.offGc || {}; const n = (s.offGc[tm.id] = (s.offGc[tm.id] || 0) + 1);
        if (n % (jobMode(s, tm.id) === "seek" ? 5 : 10) === 0) { if (!Array.isArray(s.offDue)) s.offDue = []; s.offDue.push(tm.id); }
      }
      for (const tm of [H, A]) if (isMine(s, tm.id)) {
        s.hist = s.hist || {}; const hl = (s.hist[tm.id] = s.hist[tm.id] || []);
        hl.push({ y: yearOf(rd.T), T: rd.T, date: dateOf(rd.T), comp: c.name + (rd.n ? " \u00b7 " + rd.n : ""), h: H.name, a: A.name, gh: r.gh, ga: r.ga, home: tm === H });
        if (hl.length > 400) hl.splice(0, hl.length - 400);
      }
      if (!silent && (isMine(s, h) || isMine(s, a))) res.reports.push({ cid: c.id, comp: c.name + (rd.n ? " · " + rd.n : ""), date: dateOf(rd.T), home: H.name, away: A.name, ...r });
    }
    if (!silent) dupOffers(s, res);
    if (Array.isArray(s.offDue) && s.offDue.length && !silent) { const due = s.offDue; s.offDue = []; due.forEach((id) => periodicOffers(s, res, id)); }
    if (rd.k === "tab") {
      c.rDone++;
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
      else if (t.pre) { t.pens = true; t.w = t.pre.w; t.pk = t.pre.pk; }
      else { t.pens = true; const oa = ovrOf(s, t.a), ob = ovrOf(s, t.b); t.w = Math.random() < 0.5 + (oa - ob) * 0.01 ? t.a : t.b; const wn = ri(4, 6), ls = Math.random() < 0.3 ? wn - 1 : ri(Math.max(wn - 3, 2), wn - 1); t.pk = t.w === t.a ? [wn, ls] : [ls, wn]; }
      if (!silent && (t.a === s.user || t.b === s.user)) {
        const won = t.w === s.user;
        res.notes.push(`<b>${c.name} · ${c.stage}</b>: ${s.teams[t.a].name} ${ga} x ${gb} ${s.teams[t.b].name}${t.pens ? (t.pk ? ` (pênaltis ${t.pk[0]} x ${t.pk[1]})` : " (pênaltis)") : ""} — ${won ? "você avança!" : "você foi eliminado."}`);
        if (won && c.prize) { const pz = Math.round(c.prize * (CUP_PRIZE_X[String(c.id).replace(/_K$/, "")] || 3)); s.cash += pz; led(s, s.user, `Premiação: ${c.name} · ${c.stage}`, pz); res.notes.push(`Premiação: +R$ ${pz.toLocaleString("pt-BR")}`); }
      }
    }
    if (!c.closed && c.ties.every((t) => t.w !== null)) {
      c.closed = true;
      const wins = c.ties.map((t) => t.w);
      let alive = wins.slice().sort((x, y) => c.order.indexOf(x) - c.order.indexOf(y));
      if (c.fixedTop && c.si === 0) { alive = c.fixedTop.concat(alive); c.fixedTop = null; }
      c.si++;
      if (c.si >= c.plan.length) {
        c.champion = alive[0];
        s.honors.push({ year: yearOf(s.T), cup: c.name, club: s.teams[alive[0]].name });
        if (!silent) { const ft = c.ties.find((t) => t.w === alive[0]); res.notes.push(`<b>${c.name}</b>: campeão ${s.teams[alive[0]].name}` + (ft && ft.pens ? ` — final empatada em ${ft.agg[0]} x ${ft.agg[1]} no agregado; decidida nos pênaltis${ft.pk ? ` (${ft.pk[0]} x ${ft.pk[1]})` : ""}` : "")); }
        finishComp(s, c, res, silent, true);
      } else startStage(s, c, nextPairs(s, c, wins, alive));
    }
  }

  function finishComp(s, c, res, silent, koEnd) {
    const nc0 = Object.keys(s.comps).length;
    finishComp0(s, c, res, silent, koEnd);
    try {
      if (silent || !c.ids.includes(s.user)) return;
      const fin = ["lg", "cup", "stK", "arNF", "b3f"].includes(c.after) || Object.keys(s.comps).length === nc0;
      if (!fin || !c.done) return;
      const hasTab = c.tab && c.ids.every((i) => c.tab[i]);
      const rows = hasTab ? sortTab(c.ids, c.tab).map((i) => ({ n: s.teams[i].name, p: c.tab[i].p, w: c.tab[i].w, d: c.tab[i].d, l: c.tab[i].l, gp: c.tab[i].gf, gc: c.tab[i].ga, sg: c.tab[i].gf - c.tab[i].ga, pts: c.tab[i].pts, me: myClubs(s).includes(i) })) : null;
      const champ = c.champion != null && s.teams[c.champion] ? s.teams[c.champion].name : rows ? rows[0].n : null;
      const prizes = (s.ledger || []).filter((x) => x.T === s.T && x.id === s.user && /^Premia/.test(x.d) && x.d.includes(c.name)).map((x) => ({ d: x.d, v: x.v }));
      (res.ends = res.ends || []).push({ name: c.name, rows, champ, prizes, art: topScorersComp(s, c.id, 10) });
    } catch (e) {}
  }
  function finishComp0(s, c, res, silent, koEnd) {
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
        k.mode = "tree";
        startStage(s, k, seededPairs(qual).map(([b, w]) => hostPair(k, b, w)));
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
        k.mode = "tree"; // chave fixa da Liga Profesional: 1A-8B, 4B-5A, 3A-6B, 2B-7A | 2A-7B, 3B-6A, 4A-5B, 1B-8A
        startStage(s, k, [[A[0], Z[7]], [Z[3], A[4]], [A[2], Z[5]], [Z[1], A[6]], [A[1], Z[6]], [Z[2], A[5]], [A[3], Z[4]], [Z[0], A[7]]]);
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
        k.plan = c.plan; k.mode = "tree";
        if (/^MUN/.test(c.id) && W.length === 8) startStage(s, k, [0, 2, 4, 6, 1, 3, 5, 7].map((i) => hostPair(k, W[i], R[i ^ 1]))); // A1xB2, C1xD2, E1xF2, G1xH2, B1xA2, D1xC2, F1xE2, H1xG2
        else startStage(s, k, seededPairs(order).map(([b, w]) => hostPair(k, b, w))); // campanha: 1ºx16º, 8ºx9º, 4ºx13º, 5ºx12º...
        break;
      }
      case "euS": {
        c.done = true;
        const ranked = sortTab(c.ids, c.tab);
        c.final = ranked;
        const k = newComp(s, c.id + "_K", c.name + " (mata-mata)", ranked, "cup", { order: ranked, prize: c.prize, cont: true, tab: c.tab, mode: "uefa", top8: ranked.slice(0, 8) });
        k.plan = c.plan;
        startStage(s, k, uefaPlayoff(k, ranked));
        break;
      }
    }
  }

  // ---------- fim de temporada, promoção, convites ----------
  function endOfSeasonUser(s, c, final, res) {
    const ul = LG[c.key], pos = final.indexOf(s.user) + 1;
    const expPos = byStrength(s, c.ids).indexOf(s.user) + 1;
    const prize = Math.round(clubRev(s.teams[s.user]) * 0.07 * (final.length + 1 - pos) / final.length);
    s.cash += prize; led(s, s.user, `Premiação da temporada: ${c.name} (${pos}º lugar)`, prize);
    let rep = s.rep + (expPos - pos) * 0.9 + (pos === 1 ? 4 : 0);
    s.honors.filter((h) => h.year === yearOf(s.T) && h.club === s.teams[s.user].name).forEach(() => (rep += 3));
    s.rep = clamp(Math.round(rep), 0, 100);
    res.notes.push(`<h2>Fim de campeonato: ${c.name}</h2>Você terminou em ${pos}º (esperado: ${expPos}º). Prêmio: +R$ ${Math.round(prize).toLocaleString("pt-BR")}. Reputação: ${s.rep}/100.`);
  }
  function offersAround(s, target, n, why, res) {
    const have = new Set((s.offers || []).map((o) => o.tid));
    const cands = shuffle(Object.values(s.teams).filter((t) => t.id !== s.user && !t.local && !have.has(t.id) && Math.abs(ratings(t).ovr - target) <= 2.5)).slice(0, n);
    const add = cands.map((t) => ({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: clubCash(t), why }));
    s.offers = (s.offers || []).concat(add);
    if (add.length) res.notes.push(`<span class="warn">Você recebeu ${add.length} convite(s) de clube. Veja no topo.</span>`);
  }
  // Propostas de outros clubes: a cada 10 jogos do time ativo (substituem as anteriores não aceitas).
  // Demissão: se o desempenho é muito ruim o clube demite o técnico e o jogo oferece novos empregos.
  function fireUser(s, res, why) {
    const old = s.teams[s.user], others = myClubs(s).filter((x) => x !== s.user);
    s.rep = clamp(s.rep - 6, 0, 100);
    if (others.length) { // tem outro clube: apenas deixa este
      const oid = s.user;
      switchClub(s, others[0]); dropClub(s, oid);
      res.notes.push(`<span class="bad">🚫 Você foi demitido do ${old.name}. ${why} Você segue no ${s.teams[s.user].name}.</span>`);
      return;
    }
    const target = ratings(old).ovr - 1.5 + (s.rep - 50) * 0.03;
    const cands = Object.values(s.teams).filter((t) => t.id !== s.user && !t.local)
      .sort((a, b) => Math.abs(ratings(a).ovr - target) - Math.abs(ratings(b).ovr - target)).slice(0, 30);
    s.offers = shuffle(cands).slice(0, 5).map((t) => ({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: clubCash(t), why: "Oportunidade após a demissão." }));
    s.fired = { club: old.name, why };
    res.notes.push(`<span class="bad">🚫 Você foi demitido do ${old.name}! ${why} Escolha um novo emprego na aba Jogo.</span>`);
  }
  // Nível do clube: divisão + percentil. "esp" = pelo valor do elenco dentro do próprio campeonato; "atu" = pela posição atual na tabela.
  function clubVal(t) { return t.players.reduce((x, p) => x + (p.value || 0), 0); }
  function level(s, tid) {
    const t = s.teams[tid], tier = LG[t.lkey] ? LG[t.lkey].tier : 3;
    const ids = (s.lg && s.lg[t.lkey]) || [tid], n = Math.max(ids.length, 2);
    const rk = ids.slice().sort((a, b) => clubVal(s.teams[b]) - clubVal(s.teams[a])).indexOf(tid);
    const esp = (tier - 1) + (rk < 0 ? 0.5 : rk / (n - 1));
    let atu = esp;
    const c = Object.values(s.comps).find((x) => x.key === t.lkey && !x.done && x.tab && x.tab[tid] && x.ids.includes(tid));
    if (c && c.ids.some((i) => c.tab[i].p > 0)) {
      const pos = sortTab(c.ids, c.tab).indexOf(tid);
      atu = (tier - 1) + pos / (Math.max(c.ids.length, 2) - 1);
    }
    return { tier, esp, atu, rk: rk + 1 };
  }
  // Porte do clube para convites: média ponderada dos percentis de OVR (50%), torcida (20%) e caixa (30%) entre todos os clubes.
  function prestige(s) {
    const ts = Object.values(s.teams).filter((t) => !t.local && LG[t.lkey]);
    const pct = (f) => { const v = ts.map(f).sort((a, b) => a - b), m = {}; ts.forEach((t) => { const x = f(t); let lo = 0, hi = v.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] < x) lo = mid + 1; else hi = mid; } m[t.id] = lo / Math.max(v.length - 1, 1); }); return m; };
    const ov = {}; ts.forEach((t) => { ov[t.id] = ratings(t).ovr; });
    const po = pct((t) => ov[t.id]), pf = pct((t) => t.fans || 0), pc = pct((t) => clubCash(t)), out = {};
    ts.forEach((t) => { out[t.id] = { score: 0.5 * po[t.id] + 0.2 * pf[t.id] + 0.3 * pc[t.id], ovr: ov[t.id], po: po[t.id], pf: pf[t.id], pc: pc[t.id] }; });
    return out;
  }
  // Convites: clubes melhores que o meu (pelo valor), desde que minha posição atual seja compatível com o valor do clube.
  // Nunca de divisão inferior (nem em outro país).
  function jobOffers(s, why, res, cid, isDup) {
    cid = cid != null ? cid : s.user;
    const me = level(s, cid), SLACK = 0.1;
    const myOvr = ratings(s.teams[cid]).ovr; // nunca convida para clube com OVR menor que o do meu time
    const lv = {};
    // Nunca convida de uma liga onde já tenho clube. Se tenho 2+ clubes na mesma divisão, os convites servem para trocar
    // um deles por clube de outra liga (mesma divisão ou melhor, OVR parecido).
    const held = new Set(myClubs(s).map((id) => s.teams[id].lkey));
    // Exceção: a liga do próprio clube que recebe o convite é permitida (aceitar substitui o clube, continuo com um por liga),
    // desde que eu não tenha outro clube nela.
    const ownL = s.teams[cid].lkey;
    if (myClubs(s).filter((id) => s.teams[id].lkey === ownL).length === 1) held.delete(ownL);
    const dup = !!isDup;
    const myTier = LG[s.teams[cid].lkey] ? LG[s.teams[cid].lkey].tier : 3;
    // Convite normal: o clube precisa ter porte maior (OVR, torcida e caixa juntos) e não pode ser de divisão inferior.
    // Quanto melhor minha campanha em relação ao esperado, mais alto o porte que pode me convidar.
    const P = dup ? null : prestige(s), mp = P && P[cid] ? P[cid] : { score: 0 };
    const perf = Math.max(0, me.esp - me.atu), capUp = 0.25 + 1.0 * perf;
    const elig = Object.values(s.teams).filter((t) => {
      if (t.id === cid || t.local || isMine(s, t.id) || !LG[t.lkey] || held.has(t.lkey)) return false;
      const L = (lv[t.id] = level(s, t.id));
      if (dup) return L.tier <= myTier && ratings(t).ovr >= myOvr - 4;
      const d = P[t.id].score - mp.score;
      return L.tier <= myTier && d > 0.03 && d <= capUp && P[t.id].ovr >= myOvr - 2;
    });
    if (dup) elig.sort((a, b) => Math.abs(ratings(a).ovr - myOvr) - Math.abs(ratings(b).ovr - myOvr));
    else elig.sort((a, b) => Math.abs(P[a.id].score - mp.score - 0.1) - Math.abs(P[b.id].score - mp.score - 0.1));
    // Um convite por país (sorteando os países), para não concentrar tudo no país com mais clubes elegíveis.
    const byC = {};
    elig.slice(0, 60).forEach((t) => { (byC[t.country] = byC[t.country] || []).push(t); });
    const picks = shuffle(Object.keys(byC)).slice(0, 3).map((k) => shuffle(byC[k].slice(0, 5))[0]);
    const mine = picks.map((t) => ({ for: cid, forName: s.teams[cid].name, tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, ovr: Math.round(ratings(t).ovr * 10) / 10, cash: clubCash(t), why: (dup ? "Você tem 2 clubes nesta divisão: aceite para trocar este clube. " : why + " ") + (dup ? `Clube com o ${lv[t.id].rk}º maior elenco da ${LG[t.lkey].name}.` : `OVR ${Math.round(P[t.id].ovr * 10) / 10} (seu clube: ${Math.round(myOvr * 10) / 10}), torcida maior que ${Math.round(P[t.id].pf * 100)}% dos clubes, caixa maior que ${Math.round(P[t.id].pc * 100)}%.`) }));
    s.offers = (s.offers || []).filter((o) => o.for !== cid).concat(mine);
    if (picks.length) res.notes.push(`<span class="warn">Você recebeu ${picks.length} convite(s) de clube. Veja no topo.</span>`);
  }
  // Convite de troca, uma única vez: quando um clube meu passa a ficar na mesma divisão de outro clube meu
  // (subiu/desceu, ou foi adicionado). Só o clube que chegou recebe convites; eu escolho se saio dele.
  function dupOffers(s, res) {
    if (s.free) return;
    const cl = myClubs(s), cnt = {}, first = !s.lk0, prev = s.lk0 || {};
    cl.forEach((id) => { const k = s.teams[id].lkey; cnt[k] = (cnt[k] || 0) + 1; });
    const arrived = cl.filter((id) => prev[id] !== s.teams[id].lkey && cnt[s.teams[id].lkey] > 1);
    s.lk0 = {}; cl.forEach((id) => { s.lk0[id] = s.teams[id].lkey; });
    arrived.forEach((id) => jobOffers(s, "", res, id, true));
  }
  const jobMode = (s, id) => (s.jobModes && s.jobModes[id] != null ? s.jobModes[id] : s.jobMode || "");
  function periodicOffers(s, res, cid) {
    cid = cid != null ? cid : s.user;
    const u = s.teams[cid];
    const c = Object.values(s.comps).find((x) => (x.after === "lg" || x.after === "arG") && !x.done && x.tab && x.ids.includes(cid));
    let diff = 0, why = "Propostas de outros clubes.";
    if (c && c.tab[cid] && c.tab[cid].p > 0) {
      const tab = sortTab(c.ids, c.tab), pos = tab.indexOf(cid) + 1, exp = byStrength(s, c.ids).indexOf(cid) + 1;
      diff = exp - pos;
      why = `Você está em ${pos}º (esperado: ${exp}º).`;
    }
    if (cid === s.user && (s.offGc && s.offGc[cid]) % 10 === 0 && myClubs(s).length === 1 && c && c.tab[cid] && c.tab[cid].p >= 6) { // com vários clubes ninguém é demitido
      const tab = sortTab(c.ids, c.tab), pos = tab.indexOf(cid) + 1;
      if (diff <= -7 || (pos >= c.ids.length - 1 && diff <= -4)) { fireUser(s, res, `Após 10 jogos, o time está em ${pos}º, muito abaixo do esperado (${pos + diff}º).`); return; }
    }
    if (jobMode(s, cid) === "refuse") return; // este clube não quer ofertas de emprego
    jobOffers(s, why, res, cid);
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
    seasonAging(s, tiers.flatMap((l) => s.lg[l.key]));
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
  // "Série A - Rodada 10/38": nome da competição sem o ano + rodada atual/total (mata-mata mostra só a fase)
  function rodLabel(c, rd) {
    if (!c) return "";
    if (rd.k === "tab" && c.R) return `${c.name.replace(/\s+\d{4}(\/\d{2})?$/, "")} - Rodada ${Math.min(c.rDone + 1, c.R)}/${c.R}`;
    return rd.n || "";
  }
  function nextUserRound(s) {
    for (const rd of s.q) {
      const m = rd.fx.find((m) => m[0] === s.user || m[1] === s.user);
      if (m) {
        const c = s.comps[rd.c];
        const pos = (id) => { if (rd.k === "ko") { const o = c && c.order ? c.order.indexOf(id) : -1; return o >= 0 ? o + 1 : null; } if (rd.k !== "tab" || !c || !c.tab || !c.tab[id]) return null; const grp = c.groups && c.groups.find((x) => x.includes(id)); return sortTab(grp || c.ids, c.tab).indexOf(id) + 1; };
        return { cid: rd.c, ko: rd.k === "ko", fx: rd.fx.map((x) => [x[0], x[1]]), rodada: rodLabel(c, rd), hp: pos(m[0]), ap: pos(m[1]), T: rd.T, date: dateOf(rd.T), comp: c ? c.name + (rd.n ? " · " + rd.n : "") : "", home: s.teams[m[0]], away: s.teams[m[1]] }; }
    }
    return null;
  }

  // Estádio: capacidade real (stad) entre 10 mil e 100 mil; amplia de 10 em 10 mil por (capacidade atual x 100) reais.
  const STAD_MIN = 10000, STAD_MAX = 100000, STAD_STEP = 10000;
  function getStad(t) {
    const tier = t.lkey && LG[t.lkey] ? LG[t.lkey].tier : 3;
    const raw = t.stad || (tier === 1 ? 30000 : tier === 2 ? 20000 : STAD_MIN);
    return Math.max(STAD_MIN, Math.min(STAD_MAX, Math.round(raw / STAD_STEP) * STAD_STEP));
  }
  // Custo real de ampliar: cerca de € 8.000 por lugar (x 6,13), ou seja, ~R$ 490 milhões por 10 mil lugares: só clube muito rico amplia.
  const SEAT_COST = 8000 * 6.13;
  function stadCost(t) { return STAD_STEP * SEAT_COST; }
  function upgradeStadium(s) {
    const t = s.teams[s.user], cap = getStad(t);
    if (cap >= STAD_MAX) return "O estádio já está no tamanho máximo (100.000 lugares).";
    const cost = stadCost(t);
    if (s.cash < cost) return "Dinheiro insuficiente para ampliar o estádio.";
    led(s, s.user, `Ampliação do estádio para ${Math.min(STAD_MAX, cap + STAD_STEP).toLocaleString("pt-BR")} lugares`, -cost);
    s.cash -= cost; t.stad = Math.min(STAD_MAX, cap + STAD_STEP); t.stadUp = 1;
    return null;
  }
  // Meus clubes ficam com estádio de 100 mil, sem custo; ao deixar o clube, ele volta à capacidade real (stad0).
  function syncStad(s) {
    for (const t of Object.values(s.teams)) {
      if (isMine(s, t.id)) {
        if (t.stad0 === undefined && !t.stadUp) t.stad0 = getStad(t);
        if (t.stad !== STAD_MAX) { t.stad = STAD_MAX; t.stadUp = 1; }
      } else if (t.stad0 !== undefined) { t.stad = t.stad0; t.stadUp = 0; delete t.stad0; }
    }
  }
  // Ampliação automática do clube ativo: só se a procura por ingresso passa da capacidade e a obra custa até 25% do caixa (uma por vez).
  function autoStadium(s) {
    const t = s.teams[s.user]; let n = 0;
    while (n < 1 && getStad(t) < t.fans * 1000 * 0.12 * 1.1 && stadCost(t) <= s.cash * 0.25 && !upgradeStadium(s)) n++;
    return n;
  }
  // Renda do jogo: público x preço do ingresso; mandante fica com 70% e visitante com 30%.
  // O público varia com a torcida, o porte do adversário e o acaso.
  // Preço médio do ingresso (R$) por competição. Série A: ticket médio real do Brasileirão 2026 (R$ 52,64, Trivela/Pluri);
  // demais valores são estimativas de ordem de grandeza a partir do que os campeonatos cobram na vida real.
  const TICKET = { BRA1: 52, BRA2: 28, BRA3: 20, ARG1: 60, ARG2: 25, GER1: 200, GER2: 90, ENG1: 330, ENG2: 120, ESP1: 190, ESP2: 70, POR1: 110, POR2: 40, ITA1: 190, ITA2: 70, FRA1: 160, FRA2: 55,
    UCL: 500, UEL: 300, UECL: 200, LIB: 110, SUL: 70, MUN: 350, CDB: 70, EST: 35 };
  function ticketPrice(c, t) {
    const id = c && c.id ? String(c.id).replace(/_K$/, "") : "";
    if (c && c.key && TICKET[c.key]) return TICKET[c.key];
    if (TICKET[id]) return TICKET[id];
    if (id.indexOf("EST_") === 0) return TICKET.EST;
    if (id.indexOf("ARG1") === 0) return TICKET.ARG1;
    if (id.indexOf("BRA3") === 0) return TICKET.BRA3;
    if (id.indexOf("ARG2") === 0) return TICKET.ARG2;
    const tier = t.lkey && LG[t.lkey] ? LG[t.lkey].tier : 3;
    return [50, 30, 15][tier - 1] || 15;
  }
  // fases decisivas custam mais: quanto mais importante o jogo, mais caro o ingresso
  const stageMult = (n) => (/final/i.test(n || "") && !/semi/i.test(n) ? 2 : /semi/i.test(n || "") ? 1.6 : /quartas/i.test(n || "") ? 1.35 : /oitavas/i.test(n || "") ? 1.15 : 1);
  function gateOf(s, hid, aid, c, stage) {
    const t = s.teams[hid], cap = getStad(t);
    const tier = t.lkey && LG[t.lkey] ? LG[t.lkey].tier : 3;
    const opp = aid != null && s.teams[aid] ? s.teams[aid] : null;
    const oppF = opp ? clamp(0.75 + 0.3 * Math.min(opp.fans / Math.max(t.fans, 1), 2), 0.75, 1.3) : 1;
    const att = Math.round(Math.min(cap, t.fans * 1000 * 0.12 * rnd(0.65, 1.3) * oppF));
    const price = Math.round(ticketPrice(c, t) * stageMult(stage));
    const rev = att * price;
    return { att, cap, price, rev, home: rev, away: 0 }; // toda a renda é do mandante
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
  // Livro-caixa do clube que estou comandando (histórico de dinheiro recebido e pago)
  function led(s, id, d, v) {
    if (!v) return;
    s.ledger = s.ledger || [];
    s.ledger.push({ T: s.T, id, d, v: Math.round(v) });
    if (s.ledger.length > 4000) s.ledger.splice(0, s.ledger.length - 4000);
  }
  const CUP_PRIZE_X = { UCL: 30, UEL: 30, UECL: 30, LIB: 20, SUL: 20, CDB: 15 }; // prêmio por fase vencida (valor-base × fator)
  const STAD_MAINT = 10; // R$ por lugar por mês
  const monthIdx = (T) => { const d = new Date(Date.UTC(START_YEAR, 0, 1) + Math.round(T * 7) * 864e5); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  // salários são pagos uma vez por mês (soma dos salários por rodada × 52/12)
  function paySalaries(s, T) {
    const mi = monthIdx(T);
    if (s.payM == null) s.payM = mi - 1;
    while (s.payM < mi) {
      s.payM++;
      for (const id of myClubs(s)) {
        const tm = s.teams[id], R = clubRev(tm), amt = Math.round(payroll(tm) / 12);
        const tv = Math.round((R * 0.44) / 12), com = Math.round((R * 0.32) / 12), ops = Math.round((R * 0.08) / 12), mes = `${MESES[s.payM % 12]}/${Math.floor(s.payM / 12)}`;
        const net = tv + com - ops - amt;
        if (id === s.user) s.cash += net; else { s.cashes = s.cashes || {}; s.cashes[id] = (s.cashes[id] || 0) + net; }
        s.ledger = s.ledger || [];
        s.ledger.push({ T, id, d: `Direitos de TV de ${mes}`, v: tv }, { T, id, d: `Patrocínio e comercial de ${mes}`, v: com }, { T, id, d: `Custos operacionais de ${mes}`, v: -ops }, { T, id, d: `Salários de ${mes}`, v: -amt });
      }
    }
  }
  // Fecha uma rodada: tabela/copas (processRound) + finanças dos meus clubes.
  function settleRd(s, rd, res, pre) {
    processRound(s, rd, res, false, pre);
    paySalaries(s, rd.T);
    const credit = (id, x, wage) => {
      if (id === s.user) { res.gate += x; res.wages += wage; return; }
      s.cashes = s.cashes || {};
      s.cashes[id] = (s.cashes[id] || 0) + x - wage;
    };
    rd.fx.forEach(([h, a], fi) => {
      if (!isMine(s, h) && !isMine(s, a)) return;
      const gt = (pre && pre[fi] && pre[fi].gate) || gateOf(s, h, a, s.comps[rd.c], rd.n);
      res.gates = res.gates || [];
      res.gates.push({ home: s.teams[h].name, away: s.teams[a].name, att: gt.att, cap: gt.cap, rev: gt.rev, homeShare: gt.home, awayShare: gt.away, homeMine: isMine(s, h), awayMine: isMine(s, a) });
      if (isMine(s, h)) { credit(h, gt.home, 0); s.ledger = s.ledger || []; s.ledger.push({ T: rd.T, id: h, d: `Renda: ${s.teams[h].name} x ${s.teams[a].name} (público ${gt.att.toLocaleString("pt-BR")})`, v: Math.round(gt.home) }); }
    });
  }
  function playRound(s) {
    syncStad(s);
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
    const S = simS(m.H, m.A);
    let xh = clamp(1.33 * Math.exp((rh.A * ah - ra.D * da + HOME_ADV) / S), 0.15, 5);
    let xa = clamp(1.125 * Math.exp((ra.A * aa - rh.D * dh - HOME_ADV) / S), 0.15, 5);
    xh *= Math.pow(nh / 11, 1.3) * Math.pow(11 / Math.max(na, 1), 0.5);
    xa *= Math.pow(na / 11, 1.3) * Math.pow(11 / Math.max(nh, 1), 0.5);
    m.px = { h: xh / 90, a: xa / 90 };
  }
  function createLive(s, rd) {
    const c = s.comps[rd.c];
    const live = { rd, T: rd.T, date: dateOf(rd.T), comp: c ? c.name + (rd.n ? " · " + rd.n : "") : "", rodada: rodLabel(c, rd), minute: 0, pending: [], done: false, matches: [] };
    rd.fx.forEach(([h, a, k], i) => {
      const H = s.teams[h], A = s.teams[a];
      for (const [t, id] of [[H, h], [A, a]]) { if (isMine(s, id)) fixLineup(t); else t.lineup = autoLineup(t); }
      const m = { i, hid: h, aid: a, H, A, gh: 0, ga: 0, sh: [], sa: [], evh: [], eva: [], ev: [], subs: { h: 0, a: 0 }, mine: { h: isMine(s, h), a: isMine(s, a) } };
      const tie = rd.k === "ko" && c && c.ties && c.ties[k];
      if (tie && tie.res.length) m.ida = { r: tie.res[0], home: tie.a === h ? 0 : 1 }; // jogo de volta: resultado da ida ([gols do time A, gols do time B]; home=0 se o mandante da volta era o A)
      m.on = { h: lineupPlayers(H).slice(), a: lineupPlayers(A).slice() };
      const bench = (t) => t.players.filter((p) => avail(p) && !t.lineup.includes(p.id)).sort((x, y) => y.ov - x.ov);
      m.bench = { h: bench(H), a: bench(A) };
      m.gate = gateOf(s, h, a, c, rd.n);
      live.matches.push(m);
    });
    if (!rd.dec) { // quem estava fora cumpre mais um jogo de suspensão/lesão
      for (const m of live.matches) for (const t of [m.H, m.A]) for (const p of t.players) { if (p.sus > 0) p.sus--; if (p.inj > 0) p.inj--; }
      rd.dec = 1;
    }
    live.matches.forEach(liveRates);
    // Se mais de um jogo é meu nesta rodada, eles acontecem um de cada vez (como se fossem em horários diferentes);
    // os jogos dos outros times acontecem junto do meu último jogo.
    const my = live.matches.filter((m) => m.mine.h || m.mine.a).map((m) => m.i);
    if (my.length > 1) {
      live.stages = my.slice(0, -1).map((i) => [i]);
      live.stages.push(live.matches.map((m) => m.i).filter((i) => !my.slice(0, -1).includes(i)));
      live.stage = 0;
      live.matches.forEach((m) => { if (!live.stages[0].includes(m.i)) m.hold = true; });
    }
    return live;
  }
  function startRound(s) {
    syncStad(s);
    if (s.fired) return { res: { reports: [], notes: [], wages: 0, gate: 0, skipped: 0 }, live: null, blocked: true };
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
    unrole(pout);
    m.on[side][oi] = pin; m.bench[side].splice(bi, 1); m.subs[side]++;
    m.ev.push({ min: m.min || 0, type: "sub", side, name: pin.name, out: pout.name, club: (side === "h" ? m.H : m.A).name, why });
    liveRates(m);
    return true;
  }
  // Reposicionar um jogador em campo durante a partida (clique no campo). Fora da posição natural ele rende menos até o fim do jogo.
  const SP_GROUP = { GOL: "GK", LD: "DEF", ZAG: "DEF", LE: "DEF", VOL: "MID", ME: "MID", MC: "MID", MEI: "MID", MD: "MID", PD: "ATT", PE: "ATT", SA: "ATT", CA: "ATT" };
  function liveReposition(live, mi, side, pid, newSp) {
    const m = live.matches[mi], p = m.on[side].find((q) => q.id === pid), g = SP_GROUP[newSp];
    if (!p || !g) return false;
    if (!p.rp) p.rp = { pos: p.pos, sp: p.sp, ov: p.ov };
    const nat = p.rp, natSp = nat.sp || ({ GK: "GOL", DEF: "ZAG", MID: "MC", ATT: "CA" })[nat.pos];
    const f = newSp === natSp ? 1 : (ALTS[natSp] || []).includes(newSp) ? 1 : g === nat.pos ? 0.95 : (g === "GK" || nat.pos === "GK") ? 0.6 : 0.85;
    p.pos = g; p.sp = newSp; p.ov = Math.max(1, Math.round(nat.ov * f));
    m.ev.push({ min: live.minute, type: "pos", side, name: p.name, sp: newSp, club: (side === "h" ? m.H : m.A).name });
    liveRates(m);
    return true;
  }
  function unrole(p) { if (p && p.rp) { p.pos = p.rp.pos; p.sp = p.rp.sp; p.ov = p.rp.ov; delete p.rp; } }
  function restoreRoles(live) {
    for (const m of live.matches) for (const side of ["h", "a"]) for (const p of m.on[side].concat(m.bench[side])) unrole(p);
  }
  function liveSub(live, mi, side, outId, inId) {
    const m = live.matches[mi]; m.min = live.minute;
    const ok = swapPlayers(m, side, outId, inId, "user");
    const p = live.pending[0];
    if (ok && p && p.kind === "inj" && p.outId === outId) live.pending.shift();
    return ok;
  }
  // chance de converter um pênalti: qualidade do batedor menos a do goleiro adversário
  function penProb(m, side, k) {
    const gk = m.on[side === "h" ? "a" : "h"].find((q) => q.pos === "GK");
    return clamp(0.76 + (k.ov - 70) * 0.004 - (gk ? (gk.ov - 70) * 0.002 : 0), 0.5, 0.92);
  }
  function penKick(m, side, k, mn) {
    const team = side === "h" ? m.H : m.A, ok = Math.random() < penProb(m, side, k);
    if (ok) { if (side === "h") { m.gh++; m.sh.push(k.name); } else { m.ga++; m.sa.push(k.name); } }
    m.ev.push({ min: mn, type: "pen", side, name: k.name, club: team.name, ok });
    return ok;
  }
  function liveTakePen(live, mi, side, kid) {
    const p = live.pending[0];
    if (!p || p.kind !== "pen" || p.mi !== mi || p.side !== side) return false;
    const m = live.matches[mi], k = m.on[side].find((q) => q.id === kid);
    if (!k) return false;
    live.pending.shift(); penKick(m, side, k, p.min);
    return true;
  }
  function liveMinute(s, live, m) {
    const mn = live.minute; m.min = mn;
    for (const side of ["h", "a"]) {
      const team = side === "h" ? m.H : m.A, evs = side === "h" ? m.evh : m.eva;
      // gols
      if (m.on[side].length && Math.random() < m.px[side]) {
        const p = wpickP(m.on[side], (q) => ({ ATT: 3, MID: 1.5, DEF: 0.4, GK: 0.01 }[q.pos] * q.ov));
        if (side === "h") { m.gh++; m.sh.push(p.name); } else { m.ga++; m.sa.push(p.name); }
        m.ev.push({ min: mn, type: "goal", side, name: p.name, club: team.name, how: (() => { const r = Math.random(); return r < 0.07 ? "fk" : r < 0.17 ? "corner" : undefined; })() }); // how:"fk" = gol de falta (só na animação)
      }
      // pênalti (o técnico escolhe o batedor no próprio time; os outros times usam o melhor batedor)
      if (m.on[side].length > 8 && Math.random() < 0.14 / 90) {
        m.ev.push({ min: mn, type: "penwin", side, name: "", club: team.name });
        if (isMine(s, team.id)) live.pending.push({ kind: "pen", mi: m.i, side, club: team.name, min: mn });
        else { const k = m.on[side].filter((q) => q.pos !== "GK").sort((x, y) => y.ov - x.ov)[0]; if (k) penKick(m, side, k, mn); }
      }
      // expulsão
      if (m.on[side].length > 8 && Math.random() < 0.05 / 90) {
        const p = wpickP(m.on[side], (q) => ({ GK: 0.2, DEF: 1.4, MID: 1, ATT: 0.7 }[q.pos]));
        m.on[side].splice(m.on[side].indexOf(p), 1); unrole(p);
        p.sus = pick([1, 1, 1, 1, 1, 2, 2, 3, 4]); p.yc = 0;
        evs.push({ type: "red", name: p.name, n: p.sus });
        m.ev.push({ min: mn, type: "red", side, name: p.name, n: p.sus, club: team.name });
        liveRates(m);
        if (isMine(s, team.id)) live.pending.push({ mi: m.i, side, name: p.name, club: team.name, sp: p.sp || ({ GK: "GOL", DEF: "ZAG", MID: "MC", ATT: "CA" })[p.pos], ov: p.ov });
        else autoReorg(m, side);
      }
      // lesão (substituição automática por reserva do mesmo setor)
      if (m.on[side].length > 8 && Math.random() < 0.19 / 90) {
        const p = m.on[side][ri(0, m.on[side].length - 1)];
        const r = Math.random();
        p.inj = r < 0.5 ? ri(1, 2) : r < 0.8 ? ri(3, 5) : r < 0.96 ? ri(6, 12) : ri(13, 30);
        evs.push({ type: "inj", name: p.name, n: p.inj });
        m.ev.push({ min: mn, type: "inj", side, name: p.name, n: p.inj, club: team.name });
        if (isMine(s, team.id)) { // o técnico decide a substituição (o lesionado sai de campo ao resolver)
          live.pending.push({ kind: "inj", mi: m.i, side, name: p.name, club: team.name, outId: p.id, n: p.inj });
        } else {
          const b = m.bench[side].find((q) => q.pos === p.pos);
          if (b && m.subs[side] < SUBS_MAX) swapPlayers(m, side, p.id, b.id, "lesao");
          else { m.on[side].splice(m.on[side].indexOf(p), 1); liveRates(m); autoReorg(m, side); }
        }
      }
      // cartão amarelo (3º amarelo = suspenso na próxima rodada)
      if (m.on[side].length && Math.random() < 1.5 / 90) {
        m.ycm = m.ycm || {};
        let p = wpickP(m.on[side], (q) => ({ GK: 0.1, DEF: 1.4, MID: 1.3, ATT: 0.9 }[q.pos]));
        // quem já tem amarelo na partida joga com mais cuidado: 65% das vezes o cartão vai para outro
        if (m.ycm[p.id] >= 1 && Math.random() < 0.65) p = wpickP(m.on[side], (q) => ({ GK: 0.1, DEF: 1.4, MID: 1.3, ATT: 0.9 }[q.pos]) * (m.ycm[q.id] ? 0.2 : 1));
        m.ycm[p.id] = (m.ycm[p.id] || 0) + 1;
        if (m.ycm[p.id] >= 2) { // dois amarelos na mesma partida = expulso
          m.ev.push({ min: mn, type: "yellow", side, name: p.name, club: team.name, second: true });
          m.on[side].splice(m.on[side].indexOf(p), 1); unrole(p);
          p.sus = 1; p.yc = 0;
          evs.push({ type: "red", name: p.name, n: p.sus });
          m.ev.push({ min: mn, type: "red", side, name: p.name, n: p.sus, club: team.name, second: true });
          liveRates(m);
          if (isMine(s, team.id)) live.pending.push({ mi: m.i, side, name: p.name, club: team.name, sp: p.sp || ({ GK: "GOL", DEF: "ZAG", MID: "MC", ATT: "CA" })[p.pos], ov: p.ov });
          else autoReorg(m, side);
        } else {
          p.yc = (p.yc || 0) + 1;
          const third = p.yc >= 3;
          m.ev.push({ min: mn, type: "yellow", side, name: p.name, club: team.name, third });
          if (third) { p.yc = 0; p.sus = 1; evs.push({ type: "yc3", name: p.name, n: 1 }); }
        }
      }
    }
  }
  // Pênaltis ao vivo: se a decisão do meu mata-mata empatar no agregado, a cobrança é sorteada aqui (e revelada cobrança a cobrança na tela).
  function prepShoot(s, live) {
    if (live.rd.k !== "ko") return;
    const c = s.comps[live.rd.c];
    for (const m of live.matches) {
      if (!(m.mine.h || m.mine.a)) continue;
      const t = c && c.ties && c.ties[live.rd.fx[m.i][2]];
      if (!t || t.w !== null || t.res.length !== t.legs - 1) continue;
      let ga = 0, gb = 0;
      t.res.forEach((r, i) => { if (i % 2 === 0) { ga += r[0]; gb += r[1]; } else { ga += r[1]; gb += r[0]; } });
      const li = t.res.length;
      if (li % 2 === 0) { ga += m.gh; gb += m.ga; } else { ga += m.ga; gb += m.gh; }
      if (ga !== gb) continue;
      const order = (tm) => m.on[tm === m.H ? "h" : "a"].filter((p) => p.pos !== "GK").sort((x, y) => y.ov - x.ov).concat(m.on[tm === m.H ? "h" : "a"].filter((p) => p.pos === "GK"));
      const side = { [t.a]: t.a === m.hid ? m.H : m.A, [t.b]: t.b === m.hid ? m.H : m.A };
      const ta = side[t.a], tb = side[t.b], oa = order(ta), ob = order(tb);
      const kicks = [];
      const kick = (tm, list, i) => { const p = list[i % list.length] || { name: "Jogador", ov: 60 }; return { team: tm.id, club: tm.name, name: p.name, ok: Math.random() < clamp(0.76 + ((p.ov || 60) - 70) * 0.004, 0.6, 0.9) }; };
      let fa = 0, fb = 0, ka = 0, kb = 0;
      for (;;) {
        const first = ka === kb;
        const k = first ? kick(ta, oa, ka) : kick(tb, ob, kb);
        kicks.push(k);
        if (first) { ka++; if (k.ok) fa++; } else { kb++; if (k.ok) fb++; }
        if (ka <= 5 && kb <= 5) { if (fa > fb + (5 - kb) || fb > fa + (5 - ka)) break; }
        if (ka === kb && ka >= 5 && fa !== fb) break;
        if (kicks.length > 60) { fa += 1; break; }
      }
      live.shoot = { mi: m.i, a: ta.name, b: tb.name, kicks, shown: 0, pk: [fa, fb], w: fa > fb ? t.a : t.b, tie: live.rd.fx[m.i][2], ids: [t.a, t.b] };
      return;
    }
  }
  function liveStep(s, live, n) {
    for (let k = 0; k < n && !live.done && !live.pending.length && !live.wait; k++) {
      live.minute++;
      for (const m of live.matches) if (!m.hold && !m.fin) liveMinute(s, live, m);
      if (live.minute === 90 && live.added == null) { // acréscimos: crescem com substituições, cartões, lesões e gols
        let n = 0;
        for (const m of live.matches) if (!m.hold && !m.fin) n += m.subs.h + m.subs.a + m.ev.filter((e) => ["yellow", "red", "inj", "goal", "pen"].includes(e.type)).length;
        live.added = clamp(Math.round(0.7 + n * 0.25 + Math.random() * 2), 1, 8);
      }
      if (live.minute >= 90 + (live.added || 0)) {
        if (live.stages && live.stage < live.stages.length - 1) { live.stages[live.stage].forEach((i) => { live.matches[i].fin = true; }); live.wait = true; } // fim de um dos meus jogos; o próximo começa quando o técnico mandar
        else { live.done = true; prepShoot(s, live); }
      }
    }
  }
  function liveNext(live) { // começa o próximo jogo da fila
    if (!live || !live.wait) return false;
    live.stage++; live.stages[live.stage].forEach((i) => { live.matches[i].hold = false; });
    live.wait = false; live.minute = 0; live.added = null;
    return true;
  }
  function liveResolve(live) { // fecha a tela de expulsão/lesão: o lesionado não substituído sai e o auxiliar garante um goleiro em campo
    const p = live.pending.shift();
    if (!p) return;
    const m = live.matches[p.mi];
    if (p.kind === "pen") { const k = m.on[p.side].filter((q) => q.pos !== "GK").sort((x, y) => y.ov - x.ov)[0]; if (k) penKick(m, p.side, k, p.min); return; }
    if (p.kind === "inj") {
      const i = m.on[p.side].findIndex((q) => q.id === p.outId);
      if (i >= 0) { m.on[p.side].splice(i, 1); liveRates(m); }
    }
    autoReorg(m, p.side);
  }
  function liveFinish(s, live, res) {
    restoreRoles(live);
    const pre = live.matches.map((m) => ({ gh: m.gh, ga: m.ga, sh: m.sh, sa: m.sa, evh: m.evh, eva: m.eva, gate: m.gate }));
    const ix = s.q.indexOf(live.rd);
    if (ix >= 0) s.q.splice(ix, 1);
    s.T = live.rd.T; ageCheck(s);
    if (live.shoot) { const t = s.comps[live.rd.c].ties[live.shoot.tie]; t.pre = { w: live.shoot.w, pk: live.shoot.pk }; }
    settleRd(s, live.rd, res, pre);
    s.cash += res.gate - res.wages;
    res.date = dateOf(s.T);
    return res;
  }


  // Listas reais de times por divisão (ligas.json): vale para o save em andamento no dia do primeiro jogo real do campeonato.
  // Meus times continuam na divisão em que estão; se sobrar time numa liga, o pior colocado (que não é meu) cai para a de baixo.
  function applyLeagues(s, data) {
    const report = [];
    if (!data || !data.leagues) return report;
    s.ligasAp = s.ligasAp || {};
    const byName = {}; Object.values(s.teams).forEach((t) => (byName[t.name] = t.id));
    for (const country of Object.keys(data.leagues)) {
      const dl = data.leagues[country];
      if (!dl || !dl.tiers || !COUNTRIES[country] || s.season[country] !== dl.year || s.ligasAp[country] === dl.year) continue;
      const tiers = LEAGUES.filter((l) => l.country === country).sort((a, b) => a.tier - b.tier);
      if (!tiers.every((l) => dl.tiers[l.key] && s.lg[l.key])) continue;
      const comp = {};
      for (const l of tiers) comp[l.key] = Object.values(s.comps).find((c) => c.key === l.key && !c.done && c.tab && c.ids);
      if (!tiers.every((l) => comp[l.key])) continue;
      const cur = {}, n = {}, all = new Set();
      tiers.forEach((l) => { cur[l.key] = s.lg[l.key].slice(); n[l.key] = cur[l.key].length; cur[l.key].forEach((id) => all.add(id)); });
      const curOf = {}; tiers.forEach((l) => cur[l.key].forEach((id) => (curOf[id] = l.key)));
      const D = {}, used = new Set();
      for (const l of tiers) D[l.key] = [];
      for (const l of tiers) for (const nm of dl.tiers[l.key]) { const id = byName[nm]; if (id != null && all.has(id) && !used.has(id)) { used.add(id); D[l.key].push(id); } }
      // meus times ficam onde estão
      for (const id of all) if (isMineG(s, id)) { for (const l of tiers) D[l.key] = D[l.key].filter((x) => x !== id); D[curOf[id]].push(id); used.add(id); }
      const pool = [...all].filter((id) => !used.has(id));
      const str = (id) => ratings(s.teams[id]).ovr;
      // "pior colocado" = pior posição na tabela final REAL da temporada anterior (dl.previous[key] = nomes da 1ª à última posição)
      const pidx = (key, id) => { const p = dl.previous && dl.previous[key]; return p ? p.indexOf(s.teams[id].name) : -1; };
      const worst = (key) => {
        const cand = D[key].filter((id) => !isMineG(s, id));
        const st = cand.filter((id) => pidx(key, id) >= 0);
        if (st.length) return st.sort((a, b) => pidx(key, b) - pidx(key, a))[0];
        return cand.slice().sort((a, b) => str(a) - str(b))[0];
      };
      const best = (arr, key) => {
        const cand = arr.filter((id) => !isMineG(s, id));
        const st = key ? cand.filter((id) => pidx(key, id) >= 0) : [];
        if (st.length) return st.sort((a, b) => pidx(key, a) - pidx(key, b))[0];
        return cand.sort((a, b) => str(b) - str(a))[0];
      };
      tiers.forEach((l, i) => {
        const k = l.key, last = i === tiers.length - 1;
        while (D[k].length > n[k]) { const w = worst(k); if (w == null) break; D[k] = D[k].filter((x) => x !== w); if (!last) D[tiers[i + 1].key].push(w); else pool.push(w); }
        while (D[k].length < n[k]) {
          const src = !last ? best(D[tiers[i + 1].key], tiers[i + 1].key) : null;
          if (src != null) { D[tiers[i + 1].key] = D[tiers[i + 1].key].filter((x) => x !== src); D[k].push(src); continue; }
          const p = best(pool, null); if (p == null) break; pool.splice(pool.indexOf(p), 1); D[k].push(p);
        }
      });
      const flat = tiers.flatMap((l) => D[l.key]);
      if (pool.length || flat.length !== all.size || new Set(flat).size !== flat.length || tiers.some((l) => D[l.key].length !== n[l.key])) { report.push({ country, error: "listas incompatíveis, nada foi alterado" }); continue; }
      const moves = [];
      for (const l of tiers) {
        const k = l.key, c = comp[k];
        const rem = cur[k].filter((id) => !D[k].includes(id)).sort((a, b) => str(b) - str(a));
        const add = D[k].filter((id) => !cur[k].includes(id)).sort((a, b) => str(b) - str(a));
        const map = {}; rem.forEach((r, j) => (map[r] = add[j]));
        if (!rem.length) continue;
        const rp = (id) => (map[id] != null ? map[id] : id);
        c.ids = c.ids.map(rp); if (c.order) c.order = c.order.map(rp);
        const tab = {}; Object.keys(c.tab).forEach((id) => (tab[rp(+id)] = c.tab[id])); c.tab = tab;
        if (c.groups) c.groups = c.groups.map((g) => g.map(rp));
        for (const rd of s.q) if (rd.c === c.id) rd.fx = rd.fx.map((m) => [rp(m[0]), rp(m[1])].concat(m.slice(2)));
        rem.forEach((r, j) => moves.push(`${s.teams[add[j]].name} entra na ${l.name}, ${s.teams[r].name} sai`));
      }
      for (const l of tiers) { s.lg[l.key] = D[l.key]; D[l.key].forEach((id) => (s.teams[id].lkey = l.key)); }
      s.ligasAp[country] = dl.year;
      report.push({ country, moves });
    }
    return report;
  }

  function acceptOffer(s, tid) {
    const o = s.offers.find((x) => x.tid === tid);
    if (!o) return "Convite inválido.";
    const old = o.for != null && myClubs(s).includes(o.for) ? o.for : s.user;
    s.offers = s.offers.filter((x) => x.for !== o.for && x.tid !== tid);
    if (old === s.user) {
      if (s.clubs && s.clubs.includes(old)) { s.clubs = s.clubs.map((x) => (x === old ? tid : x)); if (s.cashes) delete s.cashes[tid]; }
      s.user = tid; s.cash = o.cash; s.fired = null;
      if (!s.offers.some((x) => x.for === s.user)) { /* ofertas de outros clubes meus continuam */ }
    } else { // troca de outro clube meu (não o ativo): sai do antigo e assume o novo com o caixa dele
      s.clubs = s.clubs.map((x) => (x === old ? tid : x));
      s.cashes = s.cashes || {}; delete s.cashes[old]; s.cashes[tid] = o.cash;
      s.offers = s.offers.map((x) => (x.for === old ? { ...x, for: tid } : x));
    }
    if (s.jobModes && s.jobModes[old] != null) { s.jobModes[tid] = s.jobModes[old]; delete s.jobModes[old]; }
    s.teams[tid].lineup = autoLineup(s.teams[tid]);
    syncStad(s);
    return null;
  }

  function market(s) {
    const out = [];
    for (const t of Object.values(s.teams)) if (!isMine(s, t.id)) for (const p of t.players) out.push({ ...p, team: t.name, tid: t.id });
    for (const p of s.ext || []) out.push({ ...p, team: p.club, tid: -1 }); // jogadores de clubes fora das ligas do jogo (Messi, Cristiano...)
    return out;
  }
  // procura jogador (de outro clube) pelo nome e clube, para o clique "contratar" em qualquer tela
  function lookup(s, name, club) {
    const t = Object.values(s.teams).find((x) => x.name === club);
    if (!t) { const e = (s.ext || []).find((x) => x.name === name && x.club === club); return e ? { id: e.id, name: e.name, pos: e.pos, sp: e.sp, ov: e.ov, age: e.age, team: e.club, price: Math.round(e.value * 1.15) } : null; }
    if (isMine(s, t.id)) return null;
    const p = t.players.find((x) => x.name === name);
    return p ? { id: p.id, name: p.name, pos: p.pos, sp: p.sp, ov: p.ov, age: p.age, inj: p.inj, sus: p.sus, team: t.name, price: Math.round(p.value * 1.15) } : null;
  }
  function findPlayer(s, pid) {
    const xi = (s.ext || []).findIndex((p) => p.id === pid);
    if (xi >= 0) return { t: { id: -1, name: s.ext[xi].club, players: s.ext, ext: true }, i: xi, p: s.ext[xi] };
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
    s.cash -= price; led(s, s.user, `Compra: ${f.p.name} (${f.t.name})`, -price);
    f.t.players.splice(f.i, 1);
    if (f.t.ext) { delete f.p.club; delete f.p.ext; f.p.real = 1; }
    u.players.push(f.p);
    s.bought = s.bought || []; s.sold = s.sold || [];
    const bn = f.p.name.toLowerCase();
    if (!s.bought.includes(bn)) s.bought.push(bn);
    s.sold = s.sold.filter((x) => x.p.name.toLowerCase() !== bn);
    if (!f.t.ext) {
      f.t.players.push(mkPlayer(f.p.pos, f.p.ov - 4 + rnd(-2, 2), ri(18, 30)));
      f.t.lineup = autoLineup(f.t);
    }
    return null;
  }
  function sell(s, pid) {
    const u = s.teams[s.user];
    const i = u.players.findIndex((p) => p.id === pid);
    if (i < 0) return "Jogador não encontrado.";
    if (u.players.length <= 18) return "Elenco mínimo de 18 jogadores.";
    const p = u.players[i];
    s.cash += Math.round(p.value * 0.85); led(s, s.user, `Venda: ${p.name}`, Math.round(p.value * 0.85));
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
      const cap = clubCash(t) * 0.7;
      const bid = Math.round(Math.min(p.value * f, cap, p.value * 1.4) / 10000) * 10000;
      if (bid < p.value || bid < 10000) continue; // lance nunca abaixo do valor de mercado
      bids.push({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, bid });
    }
    if (!bids.length) { // sempre algum clube paga pelo menos o valor mínimo
      const pool = ids.map((k) => s.teams[k]);
      const rich = pool.filter((x) => clubCash(x) * 0.7 >= p.value), t = rich.length ? shuffle(rich)[0] : shuffle(pool)[0];
      if (t) bids.push({ tid: t.id, name: t.name, league: LG[t.lkey].name, country: COUNTRIES[t.country].name, bid: Math.round(p.value) });
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
    s.cash += price; led(s, s.user, `Leilão: ${p.name}`, price);
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
  function applyUpdate(s, data, opts) {
    const initial = !!(opts && opts.initial); // novo jogo: o time escolhido também recebe o elenco real
    const isMine = initial ? () => false : isMineG;
    const u = s.teams[s.user];
    const key = (x) => String(x).toLowerCase();
    const NB = (data.notas && data.notas.t) || {}; // bônus de OVR (−3..+3) pelas notas reais do Sofascore
    const nbo = (tname, pname) => (NB[tname] && NB[tname][pname]) || 0;
    // Saves antigos: sem registro de compras, ninguém sai do elenco nesta atualização
    s.sold = s.sold || [];
    const mine = initial ? new Set() : new Set((s.clubs || [s.user]).concat(s.user).flatMap((id) => s.teams[id].players.map((p) => key(p.name))));
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
      if (dt.stad) { if (t.stadUp) t.stad0 = dt.stad; else t.stad = dt.stad; }
      const cgs = {}; for (const q of dt.players || []) if (q.cg) cgs[key(q.name)] = q.cg;
      for (const p of t.players) if (cgs[key(p.name)]) p.cg = cgs[key(p.name)];
    }
    // ovr, valor, idade e salário de TODOS os meus jogadores acompanham o desempenho/valor real (Transfermarkt), mesmo sem mexer no elenco
    if (!initial) {
      const real = {}, realT = {}; // realT: por clube (nomes iguais em clubes diferentes, ex.: Paulo Henrique)
      for (const dt of data.teams || []) for (const q of dt.players || []) { real[key(q.name)] = q; realT[dt.name + "|" + key(q.name)] = q; }
      for (const q of data.outros || []) real[key(q.name)] = q;
      for (const t of Object.values(s.teams)) {
        if (!isMine(s, t.id)) continue;
        for (const p of t.players) {
          const q = realT[t.name + "|" + key(p.name)] || real[key(p.name)];
          if (!q || !(q.value || q.ov)) continue;
          const age = q.age || p.age;
          p.ov = q.ov || Math.max(1, ovFromValue(q.value, age, q.sp || p.sp, t.lkey) + nbo(t.name, q.name));
          if (q.sp) p.sp = q.sp;
          p.of = p.ov; p.age = age; p.value = q.value || valueOf(p.ov, age, q.sp || p.sp, t.lkey); p.wage = Math.round(p.value / 900);
          p.long = age > 40 ? 1 : 0; p.real = 1; // jogador com dado real: o Transfermarkt manda no OVR dele
        }
        if (isMineG(s, t.id) && t.id === s.user) fixLineup(t);
      }
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
        const ov = q.ov || (q.value ? Math.max(1, ovFromValue(q.value, age, q.sp, t.lkey) + nbo(dt.name, q.name)) : 55);
        const value = q.value || valueOf(ov, age, q.sp, t.lkey);
        ps.push({ id: PID++, name: q.name, pos: q.pos, sp: q.sp, cg: q.cg || 0, ov, age, value, wage: Math.round(value / 900), long: age > 40 ? 1 : 0 });
      }
      if (dt.stad) { if (t.stadUp) t.stad0 = dt.stad; else t.stad = dt.stad; }
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
    for (const p of initial ? [] : u.players.slice()) {
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
    // Jogadores de clubes fora das ligas do jogo: ficam num pool externo, comprados pelo valor de mercado
    if (data.outros) {
      const have = new Set();
      for (const t of Object.values(s.teams)) for (const p of t.players) have.add(key(p.name));
      s.ext = [];
      for (const q of data.outros) {
        if (have.has(key(q.name))) continue;
        const age = q.age || 27;
        const ov = q.ov || ovFromValue(q.value, age, q.sp);
        const value = q.value || valueOf(ov, age, q.sp);
        s.ext.push({ id: PID++, name: q.name, pos: q.pos, sp: q.sp, cg: q.cg || 0, ov, age, value, wage: Math.round(value / 900), long: age > 40 ? 1 : 0, club: q.club, ext: 1 });
      }
    }
    syncStad(s);
    return { teams: n, removed, kept, left };
  }


  // Vários clubes sob o meu comando: o ativo usa s.cash; os demais guardam o caixa em s.cashes.
  function myClubs(s) { if (s.free) return []; return s.clubs && s.clubs.length ? s.clubs : [s.user]; }
  function addClub(s, id) {
    id = +id;
    if (!s.teams[id]) return "Time inválido.";
    if (myClubs(s).includes(id)) return "Você já comanda este time.";
    if (s.teams[id].local) return "Time indisponível.";
    if (s.free) { // estava sem clube: assume este
      s.free = false; s.fired = null; s.offers = []; s.user = id; s.clubs = [id]; s.cashes = {};
      s.cash = clubCash(s.teams[id]); s.teams[id].lineup = autoLineup(s.teams[id]);
      syncStad(s);
      return null;
    }
    s.clubs = myClubs(s).concat(id);
    s.cashes = s.cashes || {};
    s.cashes[id] = clubCash(s.teams[id]);
    s.teams[id].lineup = autoLineup(s.teams[id]);
    dupOffers(s, { notes: [] });
    syncStad(s);
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
    if (!myClubs(s).includes(id)) return "Você não comanda este time.";
    if (id === s.user) {
      const others = myClubs(s).filter((x) => x !== id);
      if (others.length) switchClub(s, others[0]);
      else { // largou o último: fica sem clube até adicionar outro
        s.free = true; s.clubs = []; s.cashes = {}; s.offers = [];
        s.fired = { club: s.teams[id].name, why: "Você deixou o time." };
        return null;
      }
    }
    s.clubs = (s.clubs || []).filter((x) => x !== id);
    if (s.cashes) delete s.cashes[id];
    syncStad(s);
    return null;
  }
  const api = { slotMap, liveNext, prestige, syncStad, ALTS, dupOffers, jobOffers, level, liveReposition, applyLeagues, clubCash, yearOf, startRound, liveStep, liveSub, liveTakePen, penProb, liveResolve, liveFinish, autoReorg, getStad, stadCost, upgradeStadium, autoStadium, clubRev, payroll, migrateFin, migrateOvr2, topScorers, topScorersComp, lookup, yearOf, bestFormation, avail, nextRoundClubs, myClubs, addClub, switchClub, dropClub, STATES, CONT, COUNTRIES, LEAGUES, LG, FORMATIONS, TACTICS, newGame, autoLineup, ratings, playRound, acceptOffer, market, buy, sell, auction, sellTo, applyUpdate, resetPid, migrateOvr, lineupPlayers, fixLineup, nextUserRound, sortTab, dateOf, userComps, userMatches };
  if (typeof module !== "undefined") module.exports = api; else root.Game = api;
})(typeof window !== "undefined" ? window : globalThis);
