// Visão 3D real (WebGL) do campo, com Three.js e um modelo humano animado (Xbot, exemplo oficial do Three.js).
// As bibliotecas ficam em lib/ e só são carregadas quando o jogador aperta "Ver em 3D".
const Campo3D = (() => {
  const W = 105, H = 68;
  const KG = {}; let crowdT = null, crowdM = null, dirMode = "side", dirT = 0, dirNext = 14, lockT = 0, cpos = null, clook = null, clock3 = 0, st = "idle", T = null, ren = null, scene, cam, sun, ball, ballSh, ring, pl = {}, glb = null, camX = W / 2, spr = {}, cbs = [], ok = false, fail = false;
  let FL = false;
  const wx = (x) => (FL ? x - W / 2 : W / 2 - x), wz = (y) => (FL ? H / 2 - y : y - H / 2);
  const ver = () => { try { return typeof VERSAO !== "undefined" ? VERSAO : 1; } catch (e) { return 1; } };
  const loadJs = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src + "?v=" + ver(); s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });

  function load() {
    if (st !== "idle") return;
    st = "loading";
    (async () => {
      await loadJs("lib/three.min.js"); await loadJs("lib/GLTFLoader.js"); await loadJs("lib/SkeletonUtils.js");
      T = THREE;
      glb = await new Promise((res, rej) => new T.GLTFLoader().load("lib/Xbot.glb?v=" + ver(), res, undefined, rej));
      build(); st = "ready"; ok = true;
    })().catch((e) => { console.error("campo3d", e); st = "fail"; fail = true; });
  }

  function pitchTex() {
    const c = document.createElement("canvas"), k = 20; c.width = W * k; c.height = H * k; const x = c.getContext("2d");
    for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? "#2f9248" : "#27803f"; x.fillRect(i * W / 14 * k, 0, W / 14 * k + 1, c.height); }
    x.strokeStyle = "rgba(255,255,255,.92)"; x.lineWidth = 0.22 * k; x.fillStyle = "#fff";
    x.strokeRect(0.2 * k, 0.2 * k, (W - 0.4) * k, (H - 0.4) * k);
    x.beginPath(); x.moveTo(W / 2 * k, 0); x.lineTo(W / 2 * k, H * k); x.stroke();
    x.beginPath(); x.arc(W / 2 * k, H / 2 * k, 9.15 * k, 0, 7); x.stroke(); x.beginPath(); x.arc(W / 2 * k, H / 2 * k, 0.35 * k, 0, 7); x.fill();
    for (const sd of [0, 1]) {
      const g = (v) => (sd ? W - v : v) * k, rw = (a, b, w, h) => x.strokeRect(sd ? (W - a - w) * k : a * k, b * k, w * k, h * k);
      rw(0, (H - 40.32) / 2, 16.5, 40.32); rw(0, (H - 18.32) / 2, 5.5, 18.32);
      x.beginPath(); x.arc(g(11), H / 2 * k, 0.35 * k, 0, 7); x.fill();
      const a = Math.acos(5.5 / 9.15); x.beginPath(); x.arc(g(11), H / 2 * k, 9.15 * k, sd ? Math.PI - a : -a, sd ? Math.PI + a : a); x.stroke();
    }
    x.globalAlpha = 0.07; for (let i = 0; i < 5200; i++) { x.fillStyle = i % 2 ? "#0d3b1a" : "#6fd488"; x.fillRect(Math.random() * c.width, Math.random() * c.height, 3 + Math.random() * 14, 2 + Math.random() * 8); } x.globalAlpha = 1;
    const t = new T.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function adTex() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#0b1d3a"; x.fillRect(0, 0, 1024, 64);
    const tx = ["ELIFOOT", "BRASILEIRÃO", "COPA DO BRASIL", "LIBERTADORES", "FUTEBOL"], co = ["#ffd166", "#58d68d", "#5dade2", "#f1948a", "#fff"];
    x.font = "bold 38px sans-serif"; x.textBaseline = "middle"; x.textAlign = "center"; tx.forEach((t, i) => { x.fillStyle = co[i]; x.fillText(t, 102 + i * 205, 34); });
    const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; return t;
  }
  function glowTex() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(0.25, "rgba(255,240,190,.55)"); g.addColorStop(1, "rgba(255,240,190,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); }
  function crowdTex() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#26333f"; x.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 2600; i++) { x.fillStyle = ["#d9534f", "#f0ad4e", "#5bc0de", "#e8e8e8", "#7a8da0", "#3d7a4a"][i % 6]; x.globalAlpha = 0.8; x.fillRect((i * 37.31) % 1024, (i * 17.77) % 256, 4, 5); }
    const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.repeat.set(3, 1); return t;
  }
  const white0 = () => new T.MeshStandardMaterial({ color: 0xffffff });
  function build() {
    scene = new T.Scene(); scene.background = new T.Color(0x050a14); scene.fog = new T.Fog(0x050a14, 90, 230);
    cam = new T.PerspectiveCamera(36, 1.6, 0.5, 400);
    scene.add(new T.HemisphereLight(0xcfdcff, 0x24402a, 0.6));
    sun = new T.DirectionalLight(0xfff4dc, 0.95); sun.position.set(20, 40, -25); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 120;
    scene.add(sun); scene.add(sun.target);
    // gramado
    const g = new T.BufferGeometry(), P = [[0, 0], [W, 0], [W, H], [0, H]];
    g.setAttribute("position", new T.Float32BufferAttribute(P.flatMap(([x, y]) => [wx(x), 0, wz(y)]), 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(P.flatMap(([x, y]) => [x / W, 1 - y / H]), 2)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    const pm = new T.Mesh(g, new T.MeshStandardMaterial({ map: pitchTex(), roughness: 1, side: T.DoubleSide })); pm.receiveShadow = true; scene.add(pm);
    const out = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshStandardMaterial({ color: 0x1b5a30, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
    // arquibancadas
    const ct = crowdTex(), cm = new T.MeshBasicMaterial({ map: ct, color: 0xa8a8b8 }); crowdT = ct; crowdM = cm;
    const mk = (w, x, y, z, ry, rx) => { const m = new T.Mesh(new T.PlaneGeometry(w, 14), cm); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); };
    mk(W + 40, 0, 6, H / 2 + 9, Math.PI, -0.5); mk(W + 40, 0, 6, -H / 2 - 9, 0, 0.5);
    mk(H + 20, W / 2 + 10, 6, 0, -Math.PI / 2, -0.5); mk(H + 20, -W / 2 - 10, 6, 0, Math.PI / 2, -0.5);
    // refletores nos quatro cantos
    const gl = glowTex(), pole = new T.MeshStandardMaterial({ color: 0x555a63, roughness: 0.8 }), lamp = new T.MeshBasicMaterial({ color: 0xfff6d6 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tx = sx * (W / 2 + 18), tz = sz * (H / 2 + 16);
      const p = new T.Mesh(new T.CylinderGeometry(0.5, 0.8, 30, 8), pole); p.position.set(tx, 15, tz); scene.add(p);
      const pan = new T.Mesh(new T.BoxGeometry(9, 4.5, 0.5), lamp); pan.position.set(tx, 31, tz); pan.lookAt(0, 8, 0); scene.add(pan);
      const gs = new T.Sprite(new T.SpriteMaterial({ map: gl, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); gs.position.set(tx, 31, tz); gs.scale.set(34, 34, 1); scene.add(gs);
    }
    // placas de publicidade ao redor do gramado
    const at = adTex(); at.repeat.set(6, 1); const am = new T.MeshBasicMaterial({ map: at, color: 0xdddddd });
    const board = (w, x, z, ry) => { const b = new T.Mesh(new T.BoxGeometry(w, 0.95, 0.15), am); b.position.set(x, 0.48, z); b.rotation.y = ry; scene.add(b); };
    board(W + 6, 0, H / 2 + 3.2, 0); board(W + 6, 0, -H / 2 - 3.2, 0); board(H + 6, W / 2 + 3.2, 0, Math.PI / 2); board(H + 6, -W / 2 - 3.2, 0, Math.PI / 2);
    // bandeirinhas de escanteio
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const fp = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.5, 6), white0()); fp.position.set(sx * W / 2, 0.75, sz * H / 2); scene.add(fp);
      const fl = new T.Mesh(new T.PlaneGeometry(0.45, 0.32), new T.MeshBasicMaterial({ color: 0xe11d1d, side: T.DoubleSide })); fl.position.set(sx * W / 2 + 0.22, 1.35, sz * H / 2); scene.add(fl);
    }
    // gols
    const white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (const sd of [0, 1]) {
      const X = wx(sd ? W : 0), dir = sd ? -1 : 1;
      for (const z of [-3.66, 3.66]) { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.44, 8), white); p.position.set(X, 1.22, z); p.castShadow = true; scene.add(p); }
      const bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 7.32, 8), white); bar.rotation.x = Math.PI / 2; bar.position.set(X, 2.44, 0); scene.add(bar);
      const net = new T.LineSegments(new T.WireframeGeometry(new T.BoxGeometry(2.2, 2.44, 7.32, 3, 6, 18)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); net.position.set(X + dir * 1.1, 1.22, 0); scene.add(net);
    }
    // bola
    ball = new T.Mesh(new T.SphereGeometry(0.24, 20, 16), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); ball.castShadow = true; scene.add(ball);
    ballSh = new T.Mesh(new T.CircleGeometry(0.26, 16), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3 })); ballSh.rotation.x = -Math.PI / 2; scene.add(ballSh);
    ring = new T.Mesh(new T.RingGeometry(0.62, 0.76, 32), new T.MeshBasicMaterial({ color: 0xffd166, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
    ren = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }); ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap; ren.setPixelRatio(1);
  }

  let AX = null, trs = [], trUse = 0, bLx = null, bLz = null;
  function teamRing(col) { let r = trs[trUse]; if (!r) { r = new T.Mesh(new T.RingGeometry(0.5, 0.68, 24), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); r.rotation.x = -Math.PI / 2; scene.add(r); trs[trUse] = r; } trUse++; if (r._c !== col) { r._c = col; r.material.color.set(col); } return r; }
  function sprite(text, kind, id) { // número e nome em placas que olham sempre para a câmera
    const key = kind + text + (id == null ? "" : "#" + id); if (spr[key]) return spr[key];
    const c = document.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d");
    if (kind === "n") { x.font = "bold 70px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 9; x.strokeStyle = "#000"; x.strokeText(text, 128, 48); x.fillStyle = "#fff"; x.fillText(text, 128, 48); }
    else if (kind === "m") { x.fillStyle = text === "red" ? "#e11" : text === "inj" ? "#fff" : "#ffd400"; x.fillRect(80, 4, 96, 88); x.strokeStyle = "#000"; x.lineWidth = 5; x.strokeRect(80, 4, 96, 88); if (text === "inj") { x.fillStyle = "#d33"; x.fillRect(110, 30, 36, 36); } }
    else { const bc = id || "#000"; x.fillStyle = bc; x.fillRect(0, 10, 256, 70); x.strokeStyle = lum(bc) > 150 ? "#111" : "#fff"; x.lineWidth = 6; x.strokeRect(3, 13, 250, 64); x.font = "bold 58px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = lum(bc) > 150 ? "#111" : "#fff"; x.fillText(text, 128, 46, 236); }
    const m = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); m.renderOrder = 10; spr[key] = m; scene.add(m); return m;
  }

  // uniforme pintado por vértice (camisa, calção, meias, pele, cabelo) sobre o mesmo modelo
  function kitGeom(src, col, sh) {
    const key = src.uuid + col + sh; if (KG[key]) return KG[key];
    const g = src.clone(), pos = g.attributes.position, n = pos.count, arr = new Float32Array(n * 3), c1 = hex(col), c2 = hex(sh), sk = new T.Color(0xe0ac84), hr = new T.Color(0x2a1a10);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i); let c = c1;
      if (y > 1.48 && Math.abs(x) < 0.2) c = y > 1.62 ? hr : sk;
      else if (Math.abs(x) > 0.52 && y > 0.9) c = sk; // mãos
      else if (y > 1.0 && Math.abs(x) <= 0.52 && y < 1.5) c = c1; // camisa e mangas
      else if (y > 1.5) c = sk;
      else if (y > 0.82) c = c2; // calção
      else if (y > 0.38) c = sk; // coxas e canelas
      else c = c1; // meias
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new T.BufferAttribute(arr, 3)); KG[key] = g; return g;
  }
  function mkPlayer(id) {
    const m = T.SkeletonUtils.clone(glb.scene), mats = [];
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.userData.src = o.geometry; if (!/Joints/.test(o.material.name || "")) { o.material.vertexColors = true; o.material.color = new T.Color(0xffffff); o.userData.body = true; } mats.push(o); } });
    m.scale.multiplyScalar(1.02);
    const root = new T.Group(); root.add(m); scene.add(root);
    const mx = new T.AnimationMixer(m), acts = {};
    for (const n of ["idle", "walk", "run"]) { const cl = glb.animations.find((a) => a.name === n); if (cl) { acts[n] = mx.clipAction(cl); acts[n].play(); acts[n].setEffectiveWeight(n === "idle" ? 1 : 0); } }
    const bn = (n) => m.getObjectByName("mixamorig:" + n), o = { root, m, mx, acts, mats, yaw: 0, lx: null, lz: null, v: 0, sp: 0, dp: 0, dv: 0, hd: 0, dvd: 1, bones: { ru: bn("RightUpLeg"), rl: bn("RightLeg"), la: bn("LeftArm"), ra: bn("RightArm"), lf: bn("LeftForeArm"), rf: bn("RightForeArm") } }; pl[id] = o; return o;
  }
  const hex = (c) => new T.Color(c);
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16)); const lum = (c) => { const l = rgb(c); return 0.3 * l[0] + 0.59 * l[1] + 0.11 * l[2]; };

  // estado: { w, h, dt, k:{h,a,gh,ga}, players:[{id,x,y,side,gk,n,name,carrier}], ball:{x,y,z}, marks:[{x,y,k,t}], flash, goalSide }
  function render(S) {
    if (!ok) return null;
    if (FL !== !!S.flip) { FL = !!S.flip; cpos = null; }
    ren.setSize(S.w, S.h, false); cam.aspect = S.w / S.h; cam.updateProjectionMatrix();
    camX += (clamp(S.ball.x, 15, W - 15) - camX) * 0.06;
    let tp, tl;
    if (S.focus && S.focus.view === "goal") { const f = S.focus, dr = Math.sign(f.gx - f.x) || 1; tp = [wx(f.x - dr * 12), 3.4, wz(f.y + 2.5)]; tl = [wx(f.gx), 1.1, wz(f.y)]; }
    else if (S.focus && S.focus.view === "corner") { const f = S.focus, dr = Math.sign(f.gx - W / 2) || 1, up = f.cy < H / 2 ? -1 : 1; tp = [wx(f.gx - dr * 19), 7.5, wz(34 + up * 25)]; tl = [wx(f.gx - dr * 6), 1, wz(34 + up * 7)]; }
    else if (S.focus) { const fx = wx(S.focus.x), fz = wz(S.focus.y); tp = [fx, 11, clamp(fz - 20, -H / 2 - 12, H / 2 - 14)]; tl = [fx, 0.8, fz]; }
    else {
      const cX0 = wx(camX), bz = wz(S.ball.y), dtt = Math.max(0.001, S.dt);
      let mode = S.cam || "auto";
      if (mode === "auto") { // diretor de TV: lateral na maior parte, aérea de tempos em tempos, atrás do gol nos chutes
        dirT += dtt; lockT -= dtt;
        if (S.shot && lockT <= 0 && dirMode !== "end") { dirMode = "end"; lockT = 3; dirT = 0; }
        else if (dirMode === "end" && !S.shot && lockT <= 0) { dirMode = "side"; dirT = 0; dirNext = 12 + Math.random() * 10; }
        else if (dirMode === "side" && dirT > dirNext) { dirMode = "aerial"; dirT = 0; }
        else if (dirMode === "aerial" && dirT > 6) { dirMode = "side"; dirT = 0; dirNext = 12 + Math.random() * 10; }
        mode = dirMode;
      }
      if (mode === "aerial") { tp = [cX0, 23, -H / 2 - 20]; tl = [cX0, 0, clamp(bz * 0.4, -8, 8)]; }
      else if (mode === "end") { const gx = S.shot ? S.shot.gx : (S.ball.x > W / 2 ? W : 0), dr = gx > W / 2 ? 1 : -1; tp = [wx(gx + dr * 17), 6.5, wz(34)]; tl = [wx(gx - dr * 24), 1.2, wz(34)]; }
      else { tp = [cX0, 13, -H / 2 - 20]; tl = [cX0, 0, clamp(bz * 0.5, -12, 12)]; }
    }
    { const zf = S.zoom || 1; if (zf > 1) { // com zoom, a câmera segue a bola nos dois eixos
        const f = Math.min(1, (zf - 1) / 0.5), bx = wx(clamp(S.ball.x, 4, W - 4)), bzz = clamp(wz(S.ball.y), -H / 2 + 3, H / 2 - 3);
        const dx = (bx - tl[0]) * f, dz = (bzz - tl[2]) * f; tl[0] += dx; tl[2] += dz; tp[0] += dx; tp[2] += dz; } }
    { const zf = S.zoom || 1; if (zf !== 1) tp = [tl[0] + (tp[0] - tl[0]) / zf, tl[1] + (tp[1] - tl[1]) / zf, tl[2] + (tp[2] - tl[2]) / zf]; }
    if (!cpos) { cpos = tp.slice(); clook = tl.slice(); }
    const kk = Math.min(1, Math.max(0.001, S.dt) * 3.2); for (let i = 0; i < 3; i++) { cpos[i] += (tp[i] - cpos[i]) * kk; clook[i] += (tl[i] - clook[i]) * kk; }
    const cX = cpos[0]; cam.position.set(cpos[0], cpos[1], cpos[2]); cam.lookAt(clook[0], clook[1], clook[2]);
    sun.position.set(cX + 18, 40, -22); sun.target.position.set(cX, 0, 0);
    const seen = {}, dt = Math.max(0.001, S.dt); clock3 += dt;
    if (crowdT) { const fl = S.flash > 0 ? Math.min(1, S.flash) : 0; crowdT.offset.y = Math.sin(clock3 * (5 + fl * 9)) * (0.006 + fl * 0.03); crowdM.color.setScalar(0.62 + fl * 0.38); }
    trUse = 0;
    for (const p of S.players) {
      seen[p.id] = 1; const o = pl[p.id] || mkPlayer(p.id), X = wx(p.x), Z = wz(p.y);
      o.root.visible = true; o.root.position.set(X, 0, Z);
      if (o.lx != null) { const dx = X - o.lx, dz = Z - o.lz, v = Math.hypot(dx, dz) / dt; o.v += (v - o.v) * 0.15; if (v > 0.6) { let ty = Math.atan2(dx, dz), d = ty - o.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); o.yaw += d * 0.18; } }
      o.lx = X; o.lz = Z; o.root.rotation.y = o.yaw;
      const wI = o.v < 0.7 ? 1 : 0, wW = o.v >= 0.7 && o.v < 3.6 ? 1 : 0, wR = o.v >= 3.6 ? 1 : 0;
      for (const [n, w] of [["idle", wI], ["walk", wW], ["run", wR]]) if (o.acts[n]) { const c = o.acts[n].getEffectiveWeight(); o.acts[n].setEffectiveWeight(c + (w - c) * 0.2); }
      o.mx.update(dt);
      o.dp += ((p.down ? 1 : 0) - o.dp) * Math.min(1, dt * 6); o.m.rotation.x = -Math.PI / 2 * o.dp; o.root.position.y = 0.22 * o.dp;
      const B = o.bones;
      { // goleiro se joga na bola durante o chute; cabeceio quando a bola vem alta
        if (!AX) AX = new T.Vector3(1, 0, 0); const bwx = wx(S.ball.x), bwz = wz(S.ball.y), hb = 0.24 + (S.ball.z || 0) * 1.2;
        const dv = S.shot && p.gk && Math.abs(p.x - S.shot.gx) < 22 ? Math.sign(bwz - Z) || 1 : 0; o.dvd = dv || o.dvd || 1;
        o.dv += ((dv ? 1 : 0) - o.dv) * Math.min(1, dt * (dv ? 7 : 3));
        if (o.dv > 0.02) { o.root.position.y += 0.35 * o.dv; o.root.position.z += o.dvd * 0.9 * o.dv; o.root.rotateOnWorldAxis(AX, o.dvd * 1.25 * o.dv); }
        const near = Math.hypot(bwx - X, bwz - Z) < 1.6 && hb > 1.0 && !p.gk;
        o.hd += ((near ? 1 : 0) - o.hd) * Math.min(1, dt * 8);
        if (o.hd > 0.02) { o.root.position.y += 0.55 * o.hd; if (B.la) { B.la.rotateZ(1.3 * o.hd); B.ra.rotateZ(-1.3 * o.hd); } }
      }
      if (p.kick >= 0 && B.ru) { const u = Math.sin(Math.PI * clamp(p.kick, 0, 1)); B.ru.rotateX(-1.15 * u); B.rl.rotateX(1.1 * u); }
      if (p.cel && B.la) { B.la.rotateZ(1.9); B.ra.rotateZ(-1.9); B.lf.rotateY(0.3); o.root.position.y += Math.abs(Math.sin(clock3 * 9 + p.id)) * 0.28; }
      const col = p.kitCol || (p.gk ? (p.side === "h" ? S.k.gh : S.k.ga) : S.k[p.side]); if (o.col !== col) { o.col = col; const sh = lum(col) > 150 ? "#202020" : "#f4f4f4"; o.mats.forEach((m) => { if (m.userData.body) m.geometry = kitGeom(m.userData.src, col, p.gk ? "#111111" : sh); }); }
      if (p.side === "h" || p.side === "a") { const tr = teamRing(S.k[p.side]); tr.visible = true; tr.position.set(X, 0.04, Z); }
      if (p.n !== "" && !p.down) { const n = sprite(String(p.n), "n", p.id); n.visible = true; n.position.set(X, 2.35, Z); n.scale.set(1.6, 0.6, 1); p._s = n; }
      if (p.carrier) { ring.visible = true; ring.position.x = X; ring.position.z = Z; const nm = sprite(p.name, "t", S.k[p.side]); nm.visible = true; nm.position.set(X, 3.3, Z); nm.scale.set(5.4, 2.0, 1); p._t = nm; }
    }
    if (!S.players.some((p) => p.carrier)) ring.visible = false;
    for (let i = trUse; i < trs.length; i++) trs[i].visible = false;
    for (const id in pl) if (!seen[id]) pl[id].root.visible = false;
    for (const k in spr) { const sp = spr[k]; sp._keep = false; }
    S.players.forEach((p) => { if (p._s) p._s._keep = true; if (p._t) p._t._keep = true; });
    for (const m of S.marks) { const sp = sprite(m.k, "m", m.x.toFixed(0)); sp.visible = true; sp._keep = true; sp.position.set(wx(m.x), 3.2 + Math.min(m.t, 0.4), wz(m.y)); sp.scale.set(1.2, 0.45, 1); }
    for (const k in spr) if (!spr[k]._keep) spr[k].visible = false;
    const bz = 0.24 + (S.ball.z || 0) * 1.2; { const bx = wx(S.ball.x), bzz = wz(S.ball.y); if (bLx != null) { const dx = bx - bLx, dz = bzz - bLz; if (Math.hypot(dx, dz) < 8) { ball.rotateOnWorldAxis(AX || (AX = new T.Vector3(1, 0, 0)), dz / 0.24); ball.rotateOnWorldAxis(new T.Vector3(0, 0, 1), -dx / 0.24); } } bLx = bx; bLz = bzz; ballSh.scale.setScalar(Math.max(0.5, 1 - (bz - 0.24) * 0.18)); } ball.position.set(wx(S.ball.x), bz, wz(S.ball.y)); ballSh.position.set(wx(S.ball.x), 0.02, wz(S.ball.y));
    ren.render(scene, cam); return ren.domElement;
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  return { load, render, ready: () => ok, state: () => st, failed: () => fail };
})();
