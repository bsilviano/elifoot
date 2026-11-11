// Visão 3D real (WebGL) do campo, com Three.js e um modelo humano animado (Xbot, exemplo oficial do Three.js).
// As bibliotecas ficam em lib/ e só são carregadas quando o jogador aperta "Ver em 3D".
const Campo3D = (() => {
  const W = 105, H = 68;
  let st = "idle", T = null, ren = null, scene, cam, sun, ball, ballSh, ring, pl = {}, glb = null, camX = W / 2, spr = {}, cbs = [], ok = false, fail = false;
  const wx = (x) => W / 2 - x, wz = (y) => y - H / 2;
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
    const t = new T.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function crowdTex() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#26333f"; x.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 2600; i++) { x.fillStyle = ["#d9534f", "#f0ad4e", "#5bc0de", "#e8e8e8", "#7a8da0", "#3d7a4a"][i % 6]; x.globalAlpha = 0.8; x.fillRect((i * 37.31) % 1024, (i * 17.77) % 256, 4, 5); }
    const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.repeat.set(3, 1); return t;
  }
  function build() {
    scene = new T.Scene(); scene.background = new T.Color(0x0e1b27); scene.fog = new T.Fog(0x0e1b27, 70, 150);
    cam = new T.PerspectiveCamera(30, 1.6, 0.5, 400);
    scene.add(new T.HemisphereLight(0xffffff, 0x3a5a3a, 0.55));
    sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(20, 40, -25); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 120;
    scene.add(sun); scene.add(sun.target);
    // gramado
    const g = new T.BufferGeometry(), P = [[0, 0], [W, 0], [W, H], [0, H]];
    g.setAttribute("position", new T.Float32BufferAttribute(P.flatMap(([x, y]) => [wx(x), 0, wz(y)]), 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(P.flatMap(([x, y]) => [x / W, 1 - y / H]), 2)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    const pm = new T.Mesh(g, new T.MeshStandardMaterial({ map: pitchTex(), roughness: 1, side: T.DoubleSide })); pm.receiveShadow = true; scene.add(pm);
    const out = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshStandardMaterial({ color: 0x1b5a30, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
    // arquibancadas
    const ct = crowdTex(), cm = new T.MeshBasicMaterial({ map: ct });
    const mk = (w, x, y, z, ry, rx) => { const m = new T.Mesh(new T.PlaneGeometry(w, 14), cm); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); };
    mk(W + 40, 0, 6, H / 2 + 9, Math.PI, -0.5); mk(W + 40, 0, 6, -H / 2 - 9, 0, 0.5);
    mk(H + 20, W / 2 + 10, 6, 0, -Math.PI / 2, -0.5); mk(H + 20, -W / 2 - 10, 6, 0, Math.PI / 2, -0.5);
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

  function sprite(text, kind, id) { // número e nome em placas que olham sempre para a câmera
    const key = kind + text + (id == null ? "" : "#" + id); if (spr[key]) return spr[key];
    const c = document.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d");
    if (kind === "n") { x.font = "bold 70px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 9; x.strokeStyle = "#000"; x.strokeText(text, 128, 48); x.fillStyle = "#fff"; x.fillText(text, 128, 48); }
    else if (kind === "m") { x.fillStyle = text === "red" ? "#e11" : text === "inj" ? "#fff" : "#ffd400"; x.fillRect(80, 4, 96, 88); x.strokeStyle = "#000"; x.lineWidth = 5; x.strokeRect(80, 4, 96, 88); if (text === "inj") { x.fillStyle = "#d33"; x.fillRect(110, 30, 36, 36); } }
    else { x.fillStyle = "rgba(0,0,0,.7)"; x.fillRect(0, 10, 256, 70); x.font = "bold 44px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff"; x.fillText(text, 128, 46, 240); }
    const m = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); m.renderOrder = 10; spr[key] = m; scene.add(m); return m;
  }

  function mkPlayer(id) {
    const m = T.SkeletonUtils.clone(glb.scene), mats = [];
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); mats.push(o.material); } });
    m.scale.multiplyScalar(1.02);
    const root = new T.Group(); root.add(m); scene.add(root);
    const mx = new T.AnimationMixer(m), acts = {};
    for (const n of ["idle", "walk", "run"]) { const cl = glb.animations.find((a) => a.name === n); if (cl) { acts[n] = mx.clipAction(cl); acts[n].play(); acts[n].setEffectiveWeight(n === "idle" ? 1 : 0); } }
    const o = { root, mx, acts, mats, yaw: 0, lx: null, lz: null, v: 0, sp: 0 }; pl[id] = o; return o;
  }
  const hex = (c) => new T.Color(c);

  // estado: { w, h, dt, k:{h,a,gh,ga}, players:[{id,x,y,side,gk,n,name,carrier}], ball:{x,y,z}, marks:[{x,y,k,t}], flash, goalSide }
  function render(S) {
    if (!ok) return null;
    ren.setSize(S.w, S.h, false); cam.aspect = S.w / S.h; cam.updateProjectionMatrix();
    camX += (clamp(S.ball.x, 15, W - 15) - camX) * 0.06;
    const cX = wx(camX); cam.position.set(cX, 10, -H / 2 - 9); cam.lookAt(cX, 0, 5);
    sun.position.set(cX + 18, 40, -22); sun.target.position.set(cX, 0, 0);
    const seen = {}, dt = Math.max(0.001, S.dt);
    for (const p of S.players) {
      seen[p.id] = 1; const o = pl[p.id] || mkPlayer(p.id), X = wx(p.x), Z = wz(p.y);
      o.root.visible = true; o.root.position.set(X, 0, Z);
      if (o.lx != null) { const dx = X - o.lx, dz = Z - o.lz, v = Math.hypot(dx, dz) / dt; o.v += (v - o.v) * 0.15; if (v > 0.6) { let ty = Math.atan2(dx, dz), d = ty - o.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); o.yaw += d * 0.18; } }
      o.lx = X; o.lz = Z; o.root.rotation.y = o.yaw;
      const wI = o.v < 0.7 ? 1 : 0, wW = o.v >= 0.7 && o.v < 3.6 ? 1 : 0, wR = o.v >= 3.6 ? 1 : 0;
      for (const [n, w] of [["idle", wI], ["walk", wW], ["run", wR]]) if (o.acts[n]) { const c = o.acts[n].getEffectiveWeight(); o.acts[n].setEffectiveWeight(c + (w - c) * 0.2); }
      o.mx.update(dt);
      const col = p.gk ? (p.side === "h" ? S.k.gh : S.k.ga) : S.k[p.side]; if (o.col !== col) { o.col = col; o.mats.forEach((m) => { if (!/Joints/.test(m.name || "")) m.color = hex(col); }); }
      const n = sprite(String(p.n), "n", p.id); n.visible = true; n.position.set(X, 2.35, Z); n.scale.set(1.6, 0.6, 1);
      p._s = n;
      if (p.carrier) { ring.visible = true; ring.position.x = X; ring.position.z = Z; const nm = sprite(p.name, "t"); nm.visible = true; nm.position.set(X, 3.1, Z); nm.scale.set(3.4, 1.28, 1); p._t = nm; }
    }
    if (!S.players.some((p) => p.carrier)) ring.visible = false;
    for (const id in pl) if (!seen[id]) pl[id].root.visible = false;
    for (const k in spr) { const sp = spr[k]; sp._keep = false; }
    S.players.forEach((p) => { if (p._s) p._s._keep = true; if (p._t) p._t._keep = true; });
    for (const m of S.marks) { const sp = sprite(m.k, "m", m.x.toFixed(0)); sp.visible = true; sp._keep = true; sp.position.set(wx(m.x), 3.2 + Math.min(m.t, 0.4), wz(m.y)); sp.scale.set(1.2, 0.45, 1); }
    for (const k in spr) if (!spr[k]._keep) spr[k].visible = false;
    const bz = 0.24 + (S.ball.z || 0) * 1.2; ball.position.set(wx(S.ball.x), bz, wz(S.ball.y)); ballSh.position.set(wx(S.ball.x), 0.02, wz(S.ball.y));
    ren.render(scene, cam); return ren.domElement;
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  return { load, render, ready: () => ok, state: () => st, failed: () => fail };
})();
