"use strict";
/* SmartOS shell: satu halaman, banyak paparan (?view=desktop|start|power|store|myapps|settings|files|app). */
const Q = new URLSearchParams(location.search);
const TOKEN = Q.get("t") || "", VIEW = Q.get("view") || "desktop", APPID = Q.get("id") || "";
const VIEWS = {};
const $ = (s, r = document) => r.querySelector(s);

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const api = (path, body) => fetch("/api" + path, {
  method: body !== undefined ? "POST" : "GET",
  headers: {"X-SmartOS-Token": TOKEN, "Content-Type": "application/json"},
  body: body !== undefined ? JSON.stringify(body) : undefined
}).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; });
let toastT;
const toast = (m, ms = 3200) => { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = "none", ms); };
const fail = e => toast(e.message || String(e), 6000);
const closeWin = () => { document.title = "smartos:close"; };
const PERM = {ai: "AI", storage: "Simpan data", printer: "Printer", blender: "Blender (boleh jalankan skrip)", network: "Internet"};

/* ---------- dialog tersuai (prompt/confirm bawaan tidak boleh diharap dalam WebKitGTK) ---------- */
function modal(title, body, buttons) {
  return new Promise(res => {
    const d = h("dialog", null, h("h3", null, title), body, h("div", {class: "row", style: "margin-top:14px;justify-content:flex-end"},
      buttons.map(([label, val, cls]) => h("button", {class: cls || "", onclick: () => { d.close(); d.remove(); res(val); }}, label))));
    d.addEventListener("cancel", () => { d.remove(); res(null); });
    document.body.append(d); d.showModal();
    const i = $("input", d); if (i) { i.focus(); i.select(); }
    d.addEventListener("keydown", e => { if (e.key === "Enter" && i) { e.preventDefault(); d.close(); d.remove(); res(i.value); } });
  });
}
const uiConfirm = (msg, ok = "Teruskan") => modal("Sahkan", h("p", null, msg), [["Batal", false], [ok, true, "pri"]]).then(v => v === true);
async function uiPrompt(title, def = "") {
  const inp = h("input", {value: def});
  const v = await new Promise(res => {
    const d = h("dialog", null, h("h3", null, title), inp, h("div", {class: "row", style: "margin-top:14px;justify-content:flex-end"},
      h("button", {onclick: () => { d.close(); d.remove(); res(null); }}, "Batal"),
      h("button", {class: "pri", onclick: () => { d.close(); d.remove(); res(inp.value); }}, "OK")));
    d.addEventListener("cancel", () => { d.remove(); res(null); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); d.close(); d.remove(); res(inp.value); } });
    document.body.append(d); d.showModal(); inp.focus(); inp.select();
  });
  return v === null ? null : v.trim() || null;
}
function ctxMenu(x, y, items) {
  $(".menu")?.remove();
  const m = h("div", {class: "menu"}, items.map(it => it === "-" ? h("hr") : h("button", {disabled: it.off, onclick: () => { m.remove(); it.fn(); }}, it.label)));
  document.body.append(m);
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 6) + "px"; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 6) + "px";
  setTimeout(() => addEventListener("pointerdown", e => { if (!m.contains(e.target)) m.remove(); }, {once: true, capture: true}), 0);
}

/* ---------- sandbox app + jambatan SDK ---------- */
let SDK = "";
const sdkReady = fetch("/sdk/smartos-sdk.js").then(r => r.text()).then(t => { SDK = t; });
const LIBFILE = {three: "three.min.js", babylon: "babylon.min.js", theatre: "theatre.min.js"};
const LIBBASE = location.origin + "/sdk/lib/";
const esc = s => JSON.stringify(s).replace(/</g, "\\u003c");
async function mount(frame, ctx, html) {
  await sdkReady;
  frame._ctx = ctx;
  const net = ctx.granted.includes("network"), libs = (ctx.libs || []).filter(l => LIBFILE[l]);
  const csp = ["default-src 'none'", "script-src 'unsafe-inline'" + (libs.length ? " " + LIBBASE : ""), "style-src 'unsafe-inline'",
    "img-src data: blob:" + (net ? " https:" : ""), "font-src data:", "media-src data: blob:", "worker-src blob:",
    "connect-src " + (net ? "https:" : "'none'")].join("; ");
  const inj = `<meta http-equiv="Content-Security-Policy" content="${csp}"><script>window.__APP=${esc({id: ctx.id})}<\/script><script>${SDK}<\/script>` +
    libs.map(l => `<script src="${LIBBASE + LIBFILE[l]}"><\/script>`).join("");
  frame.srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + inj) : "<!doctype html><head>" + inj + "</head>" + html;
}
const NEED = {"ai.ask": "ai", "storage.get": "storage", "storage.set": "storage", "printers.list": "printer", "printers.print": "printer", "blender.run": "blender", "notify": null};
const HANDLE = {
  "ai.ask": (c, p) => api("/ai/ask", {prompt: String(p)}).then(r => r.text),
  "storage.get": (c, k) => api("/data/" + c.id + "?key=" + encodeURIComponent(k)).then(r => r.value),
  "storage.set": (c, k, v) => api("/data/" + c.id, {key: k, value: v}),
  "printers.list": () => api("/printers").then(r => r.printers),
  "printers.print": (c, p, t) => api("/print", {printer: p, text: String(t)}),
  "blender.run": (c, s) => api("/blender", {script: String(s)}),
  "notify": (c, m) => toast(String(m).slice(0, 200))
};
addEventListener("message", async e => {
  const f = [...document.querySelectorAll("iframe")].find(x => x.contentWindow === e.source);
  if (!f || !f._ctx) return;
  const {id, method, args} = e.data || {};
  let res, err;
  try {
    if (!Object.prototype.hasOwnProperty.call(HANDLE, method)) throw new Error("Kaedah tidak dikenali");
    const need = NEED[method];
    if (need && !f._ctx.granted.includes(need)) throw new Error('Kebenaran "' + PERM[need] + '" tidak diberi kepada app ini');
    res = await HANDLE[method](f._ctx, ...(Array.isArray(args) ? args : []));
  } catch (x) { err = x.message; }
  e.source.postMessage({id, res, err}, "*");
});

/* ---------- penolong ---------- */
async function togglePin(key) {
  const cur = (await api("/desktop")).pins.map(p => p.key);
  const on = cur.includes(key);
  await api("/desktop", {keys: on ? cur.filter(k => k !== key) : [...cur, key]});
  toast(on ? "Dinyahpin daripada desktop" : "Dipin ke desktop");
}
const openKey = key => api("/open", {key}).catch(fail);
const scanChip = sc => !sc ? null : h("span", {class: "chip " + (sc.level === "tinggi" ? "bad" : sc.level === "sederhana" ? "warn" : "ok"), title: sc.findings.join(", ")}, "Imbasan kod: risiko " + sc.level);

/* ======================= DESKTOP ======================= */
VIEWS.desktop = async function () {
  const root = $("#root"); root.className = "desk";
  const clock = h("div", {class: "clock"}), date = h("div", {class: "date"});
  const ans = h("div", {class: "answer hidden"});
  let blender = false;
  const ask = h("input", {placeholder: "Tanya SmartOS…", "aria-label": "Tanya SmartOS"});
  const mode = h("button", {title: "Tukar antara tanya AI dan arahkan Blender", onclick: () => {
    blender = !blender; mode.classList.toggle("on", blender); mode.textContent = blender ? "Blender" : "AI";
    ask.placeholder = blender ? "Arahkan Blender: contoh, buat 5 kubus bersusun" : "Tanya SmartOS…";
  }}, "AI");
  const form = h("form", {class: "ask", autocomplete: "off", onsubmit: async e => {
    e.preventDefault(); const p = ask.value.trim(); if (!p) return;
    ans.classList.remove("hidden"); ans.textContent = "Berfikir…";
    try {
      if (blender) { const r = await api("/blender/ask", {prompt: p}); ans.textContent = (r.result.ok ? "Selesai.\n" : "Ralat dalam Blender:\n") + (r.result.output || "") + (r.result.error || "") + "\n\nSkrip:\n" + r.script; }
      else ans.textContent = (await api("/ai/ask", {prompt: p})).text;
    } catch (x) { ans.textContent = x.message; }
  }}, mode, ask);
  const grid = h("div", {class: "shortcuts"});
  root.append(h("div", {class: "top"}, h("div", null, clock, date), form), grid, ans);
  const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString("ms-MY", {hour: "2-digit", minute: "2-digit"}); date.textContent = d.toLocaleDateString("ms-MY", {weekday: "long", day: "numeric", month: "long"}); };
  tick(); setInterval(tick, 20000);
  let last = "";
  async function load() {
    let pins; try { pins = (await api("/desktop")).pins; } catch (e) { return; }
    const sig = JSON.stringify(pins.map(p => p.key)); if (sig === last) return; last = sig;
    grid.replaceChildren(...pins.map(p => h("button", {class: "sc", title: p.name, onclick: () => openKey(p.key),
      oncontextmenu: e => { e.preventDefault(); ctxMenu(e.clientX, e.clientY, [{label: "Buka", fn: () => openKey(p.key)}, {label: "Nyahpin daripada desktop", fn: async () => { await togglePin(p.key); load(); }}]); }},
      h("i", null, p.icon), h("span", null, p.name))));
  }
  await load(); setInterval(load, 3000); addEventListener("focus", load);
  addEventListener("click", e => { if (!ans.contains(e.target) && !form.contains(e.target)) ans.classList.add("hidden"); });
  if (Q.get("intro") === "1") runIntro();
};

/* ---------- intro 3D (logo + api turquoise). Dilangkau jika WebGL tidak tersedia. ---------- */
function loadScript(src) { return new Promise((ok, no) => { const s = h("script", {src}); s.onload = ok; s.onerror = no; document.head.append(s); }); }
async function runIntro() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = h("canvas"), el = h("div", {id: "intro"}, cv, h("div", {class: "nm"}, "Smart", h("b", null, "OS")));
  document.body.append(el);
  const end = () => { el.style.opacity = 0; setTimeout(() => el.remove(), 800); };
  try {
    if (!(cv.getContext("webgl") || cv.getContext("experimental-webgl"))) return el.remove();
    await loadScript("/sdk/lib/three.min.js");
    const r = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
    r.setPixelRatio(1); r.setSize(innerWidth, innerHeight, false);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 100);
    cam.position.set(0, .3, Math.max(16, 14 / cam.aspect));
    scene.add(new THREE.HemisphereLight(0xdffcff, 0x0a4a55, .95));
    const key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(-6, 8, 10); scene.add(key);
    const P = (x, y) => new THREE.Vector2((x - 552) / 100, -(y - 480) / 100);
    const poly = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => { const v = P(p[0], p[1]); i ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y); }); return s; };
    const teal = new THREE.MeshPhysicalMaterial({color: 0x52b8c4, roughness: .35, clearcoat: .7, emissive: 0x0b5a63, emissiveIntensity: .4});
    const gold = new THREE.MeshPhysicalMaterial({color: 0xf8cd3a, roughness: .28, metalness: .25, clearcoat: .6, emissive: 0x6b4e00, emissiveIntensity: .25});
    const logo = new THREE.Group();
    const add = (sh, m, d, z = 0) => { const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: d, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 24}), m); mesh.position.z = z; logo.add(mesh); };
    const cap = poly([[88, 400], [552, 209], [672, 257], [682, 330], [672, 410], [640, 470], [560, 520], [505, 562], [120, 412]]);
    const hole = new THREE.Path(); const hc = P(548, 375); hole.absarc(hc.x, hc.y, .8, 0, Math.PI * 2, true); cap.holes.push(hole);
    add(cap, teal, .4);
    add(poly([[815, 312], [1020, 397], [790, 494], [806, 430], [820, 370]]), teal, .4);
    add(poly([[265, 498], [483, 582], [445, 625], [412, 715], [404, 803], [265, 746]]), teal, .4);
    add(poly([[833, 505], [833, 743], [551, 853], [562, 770], [600, 680], [680, 600], [755, 536]]), teal, .4);
    const R = [[632, 125], [720, 190], [790, 330], [765, 460], [690, 550], [580, 630], [530, 720], [522, 830], [548, 957]].map(p => P(...p));
    const L = [[548, 957], [470, 900], [430, 775], [455, 670], [530, 585], [630, 510], [695, 430], [712, 330], [690, 225], [632, 125]].map(p => P(...p));
    const rs = new THREE.Shape(); new THREE.SplineCurve(R).getPoints(50).forEach((v, i) => i ? rs.lineTo(v.x, v.y) : rs.moveTo(v.x, v.y));
    new THREE.SplineCurve(L).getPoints(50).forEach(v => rs.lineTo(v.x, v.y)); add(rs, gold, .7, -.15);
    const st = new THREE.Shape(), sc = P(552, 80);
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .38 : .85; const x = sc.x + Math.cos(a) * rr, y = sc.y + Math.sin(a) * rr; i ? st.lineTo(x, y) : st.moveTo(x, y); }
    add(st, gold, .4, .1);
    logo.scale.setScalar(.001); logo.position.y = .9; scene.add(logo);
    const N = 450, pos = new Float32Array(N * 3), vel = new Float32Array(N), life = new Float32Array(N), size = new Float32Array(N), ttl = new Float32Array(N);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const emit = (i, warm) => { const th = rnd(Math.PI, 2 * Math.PI), rr = rnd(.6, 1.02); pos[i * 3] = Math.cos(th) * 3 * rr; pos[i * 3 + 1] = .9 + Math.sin(th) * 3 * rr; pos[i * 3 + 2] = rnd(-1.4, .6); vel[i] = rnd(1.3, 2.6); ttl[i] = rnd(1.1, 2.1); size[i] = rnd(.5, 1.4); life[i] = warm ? Math.random() : 0; if (warm) pos[i * 3 + 1] += vel[i] * life[i] * ttl[i]; };
    for (let i = 0; i < N; i++) emit(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("life", new THREE.BufferAttribute(life, 1)); geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const fm = new THREE.ShaderMaterial({uniforms: {uK: {value: innerHeight / (2 * Math.tan(22.5 * Math.PI / 180))}, uA: {value: 0}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: "attribute float life;attribute float size;varying float vL;uniform float uK;void main(){vL=life;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*(1.-life*.55)*uK/-mv.z;gl_Position=projectionMatrix*mv;}",
      fragmentShader: "varying float vL;uniform float uA;void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.)discard;float a=pow(1.-r,1.6)*pow(1.-vL,1.4)*uA;vec3 c=mix(vec3(.85,1.,1.),vec3(.1,.95,.88),smoothstep(0.,.3,vL));c=mix(c,vec3(0.,.4,.6),smoothstep(.3,1.,vL));gl_FragColor=vec4(c,a);}"});
    const fire = new THREE.Points(geo, fm); fire.frustumCulled = false; scene.add(fire);
    const t0 = performance.now(); let prev = t0, frames = 0, slow = 0;
    await new Promise(resolve => {
      const tick = now => {
        const dt = Math.min((now - prev) / 1000, .05), t = (now - t0) / 1000; prev = now; frames++;
        if (frames > 5 && dt >= .05) slow++;
        if (t > 3.2 || slow > 8) return resolve();           // tamat, atau terlalu perlahan: berhenti awal
        const ease = Math.min(1, t / 1.0); logo.scale.setScalar(Math.max(.001, (1 - Math.pow(1 - ease, 3)) * .72));
        logo.rotation.y = Math.sin(t * 1.1) * .4; fm.uniforms.uA.value = Math.min(1, t / 1.0) * .95;
        for (let i = 0; i < N; i++) { life[i] += dt / ttl[i]; if (life[i] >= 1) { emit(i, false); continue; } pos[i * 3] += Math.sin(t * 2 + i) * .5 * dt; pos[i * 3 + 1] += vel[i] * dt; }
        geo.attributes.position.needsUpdate = geo.attributes.life.needsUpdate = geo.attributes.size.needsUpdate = true;
        r.render(scene, cam); requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    r.dispose(); geo.dispose();
  } catch (e) { /* WebGL gagal: langkau terus ke desktop */ }
  end();
}

/* ======================= MENU MULA ======================= */
VIEWS.start = async function () {
  document.body.classList.add("transparent");
  const root = $("#root");
  const search = h("input", {placeholder: "Cari aplikasi…", "aria-label": "Cari aplikasi"});
  const list = h("div", {class: "list"});
  let apps = [];
  const tile = a => h("button", {class: "sc", style: "grid-row:auto", title: a.name, onclick: () => { openKey(a.key); closeWin(); },
    oncontextmenu: e => { e.preventDefault(); ctxMenu(e.clientX, e.clientY, [{label: "Buka", fn: () => { openKey(a.key); closeWin(); }}, {label: "Pin ke desktop", fn: () => togglePin(a.key)}]); }},
    h("i", null, a.icon), h("span", null, a.name));
  function render() {
    const q = search.value.trim().toLowerCase();
    const f = apps.filter(a => !q || a.name.toLowerCase().includes(q));
    const sys = f.filter(a => a.kind === "sys"), st = f.filter(a => a.kind === "store");
    list.replaceChildren(
      h("h5", null, "Smart Store (dipasang)"), h("div", {class: "grid"}, sys.map(tile)),
      st.length ? [h("h5", null, "Dipasang daripada Smart Store"), h("div", {class: "grid"}, st.map(tile))] : null,
      !f.length ? h("p", {class: "dim"}, "Tiada aplikasi sepadan.") : null);
  }
  search.addEventListener("input", render);
  root.append(h("div", {class: "backdrop", onclick: closeWin}), h("div", {class: "start"},
    h("div", {class: "hdr"}, search), list,
    h("div", {class: "foot"}, h("span", {class: "dim"}, "👤 smart"), h("div", {class: "row"},
      h("button", {onclick: () => { openKey("sys:store"); closeWin(); }}, "🛍️ Store"),
      h("button", {onclick: () => { openKey("sys:settings"); closeWin(); }}, "⚙️"),
      h("button", {onclick: () => { api("/open", {key: "sys:myapps"}); closeWin(); }}, "🧩 My Smart App"),
      h("button", {onclick: () => { location.search = "?view=power&t=" + TOKEN; }}, "⏻")))));
  addEventListener("keydown", e => { if (e.key === "Escape") closeWin(); });
  try { const l = await api("/launcher"); apps = l.apps; } catch (e) { fail(e); }
  render(); search.focus();
};

VIEWS.power = function () {
  document.body.classList.add("transparent");
  const act = a => () => { api("/power", {action: a}).catch(fail); closeWin(); };
  $("#root").append(h("div", {class: "power", onclick: e => { if (e.target.classList.contains("power")) closeWin(); }},
    h("div", {class: "card"}, h("h3", {style: "margin:0"}, "Kuasa"),
      h("button", {onclick: act("logout")}, "Log keluar"), h("button", {onclick: act("reboot")}, "Mulakan semula"),
      h("button", {class: "pri", onclick: act("poweroff")}, "Matikan"), h("button", {class: "ghost", onclick: closeWin}, "Batal"))));
  addEventListener("keydown", e => { if (e.key === "Escape") closeWin(); });
};

/* ======================= SMART STORE ======================= */
VIEWS.store = async function () {
  const root = $("#root"); root.className = "win";
  const q = h("input", {placeholder: "Cari dalam Smart Store…", style: "max-width:320px"});
  const cats = h("div", {class: "row", style: "margin-bottom:14px"}), grid = h("div", {class: "store-grid"}), note = h("p", {class: "dim"});
  let data = {apps: [], flatpak: true}, cat = "Semua", timer = null;
  const unlock = d => (d.apps || []);
  function render() {
    const f = data.apps.filter(a => (cat === "Semua" || a.cat === cat) && (!q.value || (a.name + a.desc).toLowerCase().includes(q.value.toLowerCase())));
    cats.replaceChildren(...["Semua", ...new Set(data.apps.map(a => a.cat))].map(c => h("button", {class: c === cat ? "pri" : "", onclick: () => { cat = c; render(); }}, c)));
    note.textContent = data.flatpak ? "Aplikasi dipasang daripada Flathub dan berjalan dalam sandbox Flatpak. Dalam mod live, aplikasi hilang selepas reboot melainkan USB mempunyai persistence." : "Flatpak tidak dipasang pada sistem ini, jadi pemasangan tidak tersedia.";
    grid.replaceChildren(...f.map(a => {
      const busy = a.state === "installing";
      return h("div", {class: "card"}, h("i", null, a.icon), h("div", null, h("h4", null, a.name), h("p", null, a.desc),
        h("div", {class: "row"}, h("span", {class: "chip"}, a.cat),
          busy ? h("span", {class: "chip warn"}, "Memasang…") :
          a.installed ? [h("button", {class: "pri", onclick: () => openKey("store:" + a.id)}, "Buka"), h("button", {onclick: async () => { if (await uiConfirm("Buang " + a.name + "?", "Buang")) { try { await api("/store/remove", {id: a.id}); toast("Dibuang"); } catch (e) { fail(e); } refresh(); } }}, "Buang")] :
          h("button", {class: "gold", disabled: !data.flatpak, onclick: async () => { try { await api("/store/install", {id: a.id}); toast("Pemasangan dimulakan"); } catch (e) { fail(e); } refresh(); }}, "Pasang")),
        a.state === "error" ? h("p", {class: "err"}, "Gagal: " + a.msg) : null));
    }));
    clearTimeout(timer); if (data.apps.some(a => a.state === "installing")) timer = setTimeout(refresh, 3000);
  }
  async function refresh() { try { data = await api("/store/catalog"); } catch (e) { fail(e); } render(); }
  q.addEventListener("input", render);
  root.append(h("header", null, h("h2", null, "🛍️ Smart Store"), q), h("main", null, cats, note, grid));
  refresh();
};

/* ======================= MY SMART APP (+ Make a Software) ======================= */
VIEWS.myapps = async function () {
  const root = $("#root"); root.className = "win";
  const tiles = h("div", {class: "tiles"}), hint = h("p", {class: "dim"});
  async function refresh() {
    let apps = []; try { apps = (await api("/apps")).apps; } catch (e) { fail(e); }
    const pinned = (await api("/desktop").catch(() => ({pins: []}))).pins.map(p => p.key);
    tiles.replaceChildren(...(apps.length ? apps.map(a => h("div", {class: "card app"}, h("i", null, a.icon), h("strong", null, a.name), h("span", {class: "dim", style: "font-size:13px"}, a.description || ""),
      h("div", {class: "chips row"}, (a.permissions || []).map(p => h("span", {class: "chip" + (p === "blender" || p === "network" ? " warn" : "")}, PERM[p])), (a.libs || []).map(l => h("span", {class: "chip"}, l))),
      h("div", {class: "acts"},
        h("button", {class: "pri", onclick: () => api("/open", {key: "app:" + a.id}).catch(fail)}, "Buka"),
        h("button", {onclick: async () => { await togglePin("app:" + a.id); refresh(); }}, pinned.includes("app:" + a.id) ? "Nyahpin" : "Pin ke desktop"),
        h("button", {onclick: async () => { try { const r = await api("/apps/" + a.id + "/export", {}); toast("Disimpan di " + r.path, 6000); } catch (e) { fail(e); } }}, "Eksport"),
        h("button", {onclick: async () => { if (await uiConfirm("Nyahpasang “" + a.name + "” dan padam datanya?", "Nyahpasang")) { await api("/apps/uninstall", {id: a.id}).catch(fail); refresh(); } }}, "Nyahpasang")))) :
      [h("p", {class: "dim"}, "Belum ada app. Tekan “Cipta app” untuk mula.")]));
    try { const c = await api("/config"); const on = c.chain.filter(e => e.enabled && (e.has_key || ["ollama", "mock"].includes(e.provider)));
      hint.textContent = on.length ? "Enjin AI aktif: " + on.map(e => e.provider).join(" → ") + " (bertukar automatik jika kuota habis)." : "Tiada penyedia AI aktif. Buka Tetapan → AI dan masukkan kunci API (atau aktifkan “mock” untuk demo)."; } catch (e) {}
  }
  const dm = makeDialog(refresh);
  root.append(h("header", null, h("h2", null, "🧩 My Smart App")),
    h("main", null, h("div", {class: "make"}, h("div", null, h("h3", null, "Make a Software"), h("p", null, "Terangkan app yang anda mahu. SmartOS akan membinanya dan memasangnya ke sini.")),
      h("button", {class: "gold", onclick: dm.open}, "Cipta app"), h("button", {onclick: dm.importFile}, "Import .smartapp")), hint, tiles));
  refresh();
};
function makeDialog(onInstalled) {
  let draft = null, imported = false, scan = null;
  const prompt = h("textarea", {rows: 3, placeholder: "Contoh: app belanjawan bulanan dengan graf, atau pemandang 3D dengan three.js"});
  const status = h("span", {class: "chip"}), prev = h("iframe", {id: "prev", class: "sandbox", sandbox: "allow-scripts", title: "Pratonton"});
  const res = h("div", {class: "hidden"}), nm = h("strong"), chips = h("div", {class: "row"}), rev = h("input", {placeholder: "Mahu ubah sesuatu? Contoh: tambah mod gelap"});
  const goB = h("button", {class: "pri", onclick: () => prompt.value.trim() && build(prompt.value.trim(), null)}, "Bina");
  const revB = h("button", {onclick: () => rev.value.trim() && draft && build(rev.value.trim(), draft).then(() => rev.value = "")}, "Ubah");
  const dlg = h("dialog", null, h("h3", null, "Make a Software"), prompt,
    h("div", {class: "row", style: "margin-top:12px"}, goB, h("button", {onclick: () => dlg.close()}, "Tutup"), status),
    h("div", {class: "hidden"}, ""), res);
  res.append(prev, h("div", {class: "row", style: "margin-top:10px"}, nm, chips), h("div", {class: "row", style: "margin-top:10px"}, rev, revB),
    h("div", {class: "row", style: "margin-top:10px"},
      h("button", {class: "gold", onclick: async () => {
        if (scan && scan.level === "tinggi" && !(await uiConfirm("Imbasan kod menunjukkan risiko TINGGI (" + scan.findings.join(", ") + "). Pasang juga?", "Pasang juga"))) return;
        try { await api("/apps/install", {draft_id: draft}); dlg.close(); toast("App dipasang ke My Smart App"); onInstalled(); } catch (e) { fail(e); } }}, "Pasang app"),
      h("button", {onclick: () => { draft = null; res.classList.add("hidden"); prev.srcdoc = ""; }}, "Buang draf")));
  document.body.append(dlg);
  async function show(r) {
    draft = r.draft_id; const a = await api("/apps/draft/" + draft); scan = a.scan; imported = !!a.manifest.imported;
    res.classList.remove("hidden"); nm.textContent = a.manifest.icon + " " + a.manifest.name;
    chips.replaceChildren(...(a.manifest.permissions.length ? a.manifest.permissions.map(p => h("span", {class: "chip" + (p === "blender" || p === "network" ? " warn" : "")}, PERM[p])) : [h("span", {class: "chip"}, "Tiada kebenaran diminta")]),
      ...(a.manifest.libs || []).map(l => h("span", {class: "chip"}, l)), scanChip(scan));
    if (imported) status.textContent = "App import: semak kebenaran dengan teliti";
    await mount(prev, {id: "draft-" + draft, granted: a.manifest.permissions.filter(p => p === "storage"), libs: a.manifest.libs}, a.html);
  }
  async function build(p, d) {
    status.textContent = "Membina…"; goB.disabled = revB.disabled = true;
    try { await show(await api("/apps/generate", {prompt: p, draft_id: d})); status.textContent = "Pratonton (hanya storan aktif)"; }
    catch (e) { status.textContent = ""; fail(e); }
    goB.disabled = revB.disabled = false;
  }
  return {
    open() { draft = null; res.classList.add("hidden"); prompt.value = ""; status.textContent = ""; dlg.showModal(); },
    importFile() {
      const f = h("input", {type: "file", accept: ".smartapp,application/json", onchange: async () => {
        const file = f.files[0]; if (!file) return;
        try { const r = await api("/apps/import", {package: await file.text()}); dlg.showModal(); await show(r); } catch (e) { fail(e); } }});
      f.click();
    }
  };
}

/* ======================= APP PENGGUNA (tetingkap sendiri) ======================= */
VIEWS.app = async function () {
  const root = $("#root"); root.className = "win appwin";
  try {
    const a = await api("/apps/" + APPID);
    const fr = h("iframe", {class: "sandbox", sandbox: "allow-scripts", title: a.manifest.name});
    root.append(fr); document.title = a.manifest.name;
    await mount(fr, {id: APPID, granted: a.manifest.granted || [], libs: a.manifest.libs}, a.html);
  } catch (e) { root.append(h("p", {class: "err", style: "padding:20px"}, e.message)); }
};

/* ======================= TETAPAN ======================= */
VIEWS.settings = async function () {
  const root = $("#root"); root.className = "win";
  const main = h("main");
  root.append(h("header", null, h("h2", null, "⚙️ Tetapan")), main);
  /* --- AI: rantaian penyedia dengan keutamaan --- */
  const cfg = await api("/config").catch(e => { fail(e); return {chain: [], doctor_auto: false}; });
  const rows = cfg.chain.map(e => ({...e, key: ""}));
  const provBox = h("div");
  const NAMES = {anthropic: "Anthropic (Claude)", openai: "OpenAI", deepseek: "DeepSeek", ollama: "Ollama (tempatan)", mock: "Mock (demo)"};
  function drawProv() {
    provBox.replaceChildren(...rows.map((r, i) => h("div", {class: "prov"},
      h("div", {class: "row"}, h("button", {class: "ghost", disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; drawProv(); }}, "▲"),
        h("button", {class: "ghost", disabled: i === rows.length - 1, onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; drawProv(); }}, "▼")),
      h("label", {class: "row"}, h("input", {type: "checkbox", style: "width:auto", checked: r.enabled, onchange: ev => r.enabled = ev.target.checked}), h("span", {class: "n"}, (i + 1) + ". " + (NAMES[r.provider] || r.provider))),
      h("input", {placeholder: "Model (lalai: " + r.default_model + ")", value: r.model, oninput: ev => r.model = ev.target.value}),
      h("input", {type: "password", placeholder: r.has_key ? "Kunci tersimpan (taip untuk ganti)" : r.provider === "ollama" || r.provider === "mock" ? "Tidak perlu kunci" : "Tampal kunci API", oninput: ev => r.key = ev.target.value}),
      r.cooldown_until ? h("span", {class: "chip warn", title: "Kuota habis atau ralat; dicuba semula kemudian"}, "rehat → " + new Date(r.cooldown_until * 1000).toLocaleTimeString("ms-MY", {hour: "2-digit", minute: "2-digit"})) : (r.has_key ? h("span", {class: "chip ok"}, "kunci ada") : h("span"))
    )));
  }
  drawProv();
  const saveMsg = h("span", {class: "dim"});
  main.append(h("div", {class: "sec"}, h("h3", null, "Enjin AI"),
    h("p", {class: "dim"}, "Letakkan penyedia mengikut keutamaan (atas = dicuba dahulu, letakkan model terbaik di atas). Jika kuota habis atau ralat, SmartOS bertukar automatik ke penyedia seterusnya. Kunci disimpan pada peranti ini sahaja dan tidak dipaparkan semula."),
    provBox, h("div", {class: "row", style: "margin-top:12px"},
      h("button", {class: "pri", onclick: async () => { try { await api("/config", {chain: rows.map(r => ({provider: r.provider, model: r.model, key: r.key, enabled: r.enabled}))}); saveMsg.textContent = "Disimpan."; setTimeout(() => location.reload(), 600); } catch (e) { fail(e); } }}, "Simpan"),
      h("button", {onclick: async () => { saveMsg.textContent = "Menguji…"; try { const r = await api("/ai/ask", {prompt: "Balas dengan satu perkataan: OK"}); saveMsg.textContent = "Jawapan: " + r.text.slice(0, 80); } catch (e) { saveMsg.textContent = ""; fail(e); } }}, "Uji sambungan"), saveMsg)));
  /* --- Keselamatan --- */
  const sec = await api("/security/status").catch(() => ({}));
  const yn = (v, t) => h("span", {class: "chip " + (v ? "ok" : "warn")}, t + (v ? ": aktif" : ": tidak aktif"));
  const scanOut = h("pre", {class: "rep hidden"});
  const scan = async (path, label) => { scanOut.classList.remove("hidden"); scanOut.textContent = "Mengimbas " + label + "… (boleh mengambil masa beberapa minit)"; try { const r = await api("/security/scan", {path}); scanOut.textContent = r.infected.length ? "DIJUMPAI:\n" + r.infected.join("\n") : "Tiada ancaman dijumpai."; } catch (e) { scanOut.textContent = e.message; } };
  const home = (await api("/fm/places").catch(() => ({places: []}))).places;
  const dl = home.find(p => p.name === "Muat turun"), hm = home.find(p => p.name === "Rumah");
  main.append(h("div", {class: "sec"}, h("h3", null, "Keselamatan"),
    h("div", {class: "row"}, yn(sec.firewall, "Tembok api"), yn(sec.apparmor, "AppArmor"), yn(sec.clamav_installed, "ClamAV"), yn(sec.auto_updates, "Kemas kini automatik"),
      h("span", {class: "chip"}, sec.last_update ? "Kemas kini terakhir: " + sec.last_update : "Belum dikemas kini"),
      h("span", {class: "chip"}, sec.clamav_db ? "DB virus: " + new Date(sec.clamav_db * 1000).toLocaleDateString("ms-MY") : "DB virus: belum dimuat turun")),
    h("p", {class: "dim"}, "Lapisan: tembok api (tiada port masuk), AppArmor, app dijana AI dalam sandbox tanpa rangkaian, kebenaran per-app, Flatpak sandbox untuk Store, imbasan kod app, dan imbasan virus atas permintaan. Tiada sistem boleh dijamin 100% kebal."),
    h("div", {class: "row"}, dl ? h("button", {onclick: () => scan(dl.path, "Muat turun")}, "Imbas folder Muat turun") : null, hm ? h("button", {onclick: () => scan(hm.path, "Rumah")}, "Imbas folder Rumah") : null), scanOut));
  /* --- Doktor SmartOS --- */
  const rep = h("pre", {class: "rep hidden"}), last = await api("/doctor/last").catch(() => ({}));
  if (last.report) { rep.classList.remove("hidden"); rep.textContent = "(" + new Date(last.ts * 1000).toLocaleString("ms-MY") + ")\n" + last.report; }
  main.append(h("div", {class: "sec"}, h("h3", null, "Doktor SmartOS (ejen pencari bug)"),
    h("p", {class: "dim"}, "Mengumpul log sistem (kunci dan token disembunyikan), menghantarnya kepada enjin AI anda dan menghasilkan laporan masalah serta cadangan pembaikan. Ia hanya mencadangkan; tiada apa diubah tanpa anda."),
    h("div", {class: "row"}, h("button", {class: "pri", onclick: async e => { e.target.disabled = true; rep.classList.remove("hidden"); rep.textContent = "Menganalisis…"; try { const r = await api("/doctor/run", {}); rep.textContent = r.report; } catch (x) { rep.textContent = x.message; } e.target.disabled = false; }}, "Jalankan sekarang"),
      h("label", {class: "row"}, h("input", {type: "checkbox", style: "width:auto", checked: cfg.doctor_auto, onchange: ev => api("/config", {chain: [], doctor_auto: ev.target.checked}).then(() => toast("Disimpan")).catch(fail)}), "Jalankan sekali sehari (menggunakan kuota AI)")), rep));
  /* --- Sistem --- */
  const sys = await api("/system").catch(() => ({}));
  main.append(h("div", {class: "sec"}, h("h3", null, "Sistem"),
    h("p", {class: "dim"}, "Blender: " + (sys.blender || "tidak dikesan") + ". Buka Terminal dan taip install-claude-code atau install-codex untuk memasang alat AI baris arahan. Pintasan papan kekunci: Super+Ruang (menu mula), Super+E (Fail), Alt+Tab (tukar tetingkap), Ctrl+Alt+T (Terminal)."),
    h("button", {onclick: () => openKey("sys:terminal")}, "Buka Terminal")));
};

addEventListener("DOMContentLoaded", () => {
  addEventListener("contextmenu", e => { if (!e.target.closest(".sc,.fm,input,textarea")) e.preventDefault(); });
  (VIEWS[VIEW] || VIEWS.desktop)().catch(fail);
});
