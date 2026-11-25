"use strict";
/* FaqehOS shell: satu halaman, banyak paparan (?view=desktop|start|power|ctxmenu|store|myapps|settings|files|taskmgr|hello|app). */
const Q = new URLSearchParams(location.search);
const TOKEN = Q.get("t") || "", VIEW = Q.get("view") || "desktop", APPID = Q.get("id") || "", PAGE = Q.get("page") || "";
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
  headers: {"X-FaqehOS-Token": TOKEN, "Content-Type": "application/json"},
  body: body !== undefined ? JSON.stringify(body) : undefined
}).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; });
let toastT;
const toast = (m, ms = 3200) => { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = "none", ms); };
const fail = e => toast(e.message || String(e), 6500);
const closeWin = () => { document.title = "faqehos:close"; };
const PERM = {ai: "AI", storage: "Simpan data", printer: "Printer", blender: "Blender (boleh jalankan skrip)", network: "Internet"};

/* ---------- keutamaan (bahasa, warna, animasi) ---------- */
const PREFS = {lang: "ms", accent: "turquoise", anim: "full", icon_size: "medium", wallpaper: "aurora", intro: true, clock24: true, pay_enabled: false, display_name: ""};
let ACCENTS = {}, BRAND = {}, VERSION = "";
const LOCALE = () => PREFS.lang === "en" ? "en-GB" : "ms-MY";
function applyPrefs() {
  const a = ACCENTS[PREFS.accent] || ["#2de2d6", "#0aa7c4", "#0b3a45"], st = document.documentElement.style;
  st.setProperty("--acc", a[0]); st.setProperty("--acc2", a[1]); st.setProperty("--bg1", a[2]);
  Object.assign(document.body.dataset, {anim: PREFS.anim, icon: PREFS.icon_size, wall: PREFS.wallpaper});
  document.documentElement.lang = PREFS.lang;
  if (window.I18N) I18N.set(PREFS.lang);
  dispatchEvent(new Event("faqeh-prefs"));
}
async function loadPrefs() {
  try { const r = await api("/prefs"); Object.assign(PREFS, r.prefs); ACCENTS = r.accents; BRAND = r.branding; VERSION = r.version; } catch (e) {}
  applyPrefs();
}
async function setPref(patch) { const r = await api("/prefs", patch); Object.assign(PREFS, r.prefs); applyPrefs(); return r.prefs; }

/* ---------- dialog tersuai (boleh diseret pada tajuk) ---------- */
function dragify(d) {
  const bar = $("h3", d); if (!bar) return;
  bar.style.cursor = "move"; bar.style.touchAction = "none";
  let sx, sy, ox = 0, oy = 0, on = false;
  bar.addEventListener("pointerdown", e => { on = true; sx = e.clientX - ox; sy = e.clientY - oy; bar.setPointerCapture && bar.setPointerCapture(e.pointerId); });
  bar.addEventListener("pointermove", e => { if (!on) return; ox = e.clientX - sx; oy = e.clientY - sy; d.style.transform = `translate(${ox}px,${oy}px)`; });
  const up = () => { on = false; }; bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
}
function openDialog(d) { document.body.append(d); dragify(d); d.showModal(); return d; }
function modal(title, body, buttons) {
  return new Promise(res => {
    const done = v => { d.close(); d.remove(); res(v); };
    const d = h("dialog", null, h("h3", null, title), body, h("div", {class: "row", style: "margin-top:14px;justify-content:flex-end"},
      buttons.map(([label, val, cls]) => h("button", {class: cls || "", onclick: () => done(val)}, label))));
    d.addEventListener("cancel", () => { d.remove(); res(null); });
    openDialog(d);
  });
}
const uiConfirm = (msg, ok = "Teruskan") => modal("Sahkan", h("p", null, msg), [["Batal", false], [ok, true, "pri"]]).then(v => v === true);
async function uiPrompt(title, def = "", type = "text") {
  const inp = h("input", {value: def, type});
  const v = await new Promise(res => {
    const done = x => { d.close(); d.remove(); res(x); };
    const d = h("dialog", null, h("h3", null, title), inp, h("div", {class: "row", style: "margin-top:14px;justify-content:flex-end"},
      h("button", {onclick: () => done(null)}, "Batal"), h("button", {class: "pri", onclick: () => done(inp.value)}, "OK")));
    d.addEventListener("cancel", () => { d.remove(); res(null); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); done(inp.value); } });
    openDialog(d); inp.focus(); inp.select();
  });
  return v === null ? null : (type === "password" ? v : v.trim()) || null;
}
function ctxMenu(x, y, items) {
  $(".menu")?.remove();
  const m = h("div", {class: "menu"}, items.map(it => it === "-" ? h("hr") : h("button", {disabled: it.off, onclick: () => { m.remove(); it.fn(); }}, it.check ? "✓ " : "", it.label)));
  document.body.append(m);
  m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 6)) + "px"; m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 6)) + "px";
  setTimeout(() => addEventListener("pointerdown", e => { if (!m.contains(e.target)) m.remove(); }, {once: true, capture: true}), 0);
}
/* tekan lama pada skrin sentuh = menu klik kanan */
function longPress(el, fn) {
  let t, sx, sy;
  el.addEventListener("pointerdown", e => { if (!e.pointerType || e.pointerType === "mouse") return; sx = e.clientX; sy = e.clientY; t = setTimeout(() => fn(sx, sy), 550); });
  const c = () => clearTimeout(t); el.addEventListener("pointerup", c); el.addEventListener("pointercancel", c);
  el.addEventListener("pointermove", e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) c(); });
}

/* ---------- sandbox app + jambatan SDK ---------- */
let SDK = "";
const sdkReady = fetch("/sdk/faqehos-sdk.js").then(r => r.text()).then(t => { SDK = t; });
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
const openKey = key => api("/open", {key}).then(r => { if (r && r.message) toast(r.message, 7000); }).catch(fail);
const openSettings = page => api("/open", {key: "sys:settings", page}).catch(fail);
const scanChip = sc => !sc ? null : h("span", {class: "chip " + (sc.level === "tinggi" ? "bad" : sc.level === "sederhana" ? "warn" : "ok"), title: sc.findings.join(", ")}, "Imbasan kod: risiko " + sc.level);

/* ---------- susun semula dengan seret-lepas (tetikus dan sentuh, animasi FLIP) ---------- */
function sortable(grid, onDone) {
  let st = null, justDragged = false;
  const flip = fn => {
    const kids = [...grid.children], before = new Map(kids.map(k => [k, k.getBoundingClientRect()]));
    fn();
    if (document.body.dataset.anim === "off") return;
    for (const k of kids) {
      const a = before.get(k), b = k.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) { k.style.transition = "none"; k.style.transform = `translate(${dx}px,${dy}px)`; requestAnimationFrame(() => { k.style.transition = "transform .18s ease"; k.style.transform = ""; }); }
    }
  };
  function begin() {
    const r = st.it.getBoundingClientRect(); st.on = true;
    st.ghost = st.it.cloneNode(true); st.ghost.classList.add("ghost");
    st.ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:70;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.5);background:var(--card2)`;
    document.body.append(st.ghost); st.it.classList.add("ph");
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
  }
  grid.addEventListener("pointerdown", e => {
    const it = e.target.closest(".sc"); if (!it || (e.pointerType === "mouse" && e.button !== 0)) return;
    const touch = !!e.pointerType && e.pointerType !== "mouse";
    st = {it, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, touch};
    if (touch) st.timer = setTimeout(() => { if (st && !st.on) begin(); }, 380);   // sentuh: tekan lama untuk seret
  });
  addEventListener("pointermove", e => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.on) {
      if (Math.hypot(dx, dy) < (st.touch ? 12 : 6)) return;
      if (st.touch) { clearTimeout(st.timer); st = null; return; }            // gerak jari sebelum tekan lama = skrol
      begin();
    }
    e.preventDefault();
    st.ghost.style.transform = `translate(${dx}px,${dy}px) scale(1.1)`;
    const over = document.elementFromPoint && document.elementFromPoint(e.clientX, e.clientY);
    const tgt = over && over.closest && over.closest(".sc");
    if (tgt && tgt !== st.it && grid.contains(tgt) && !tgt.classList.contains("ghost")) {
      const kids = [...grid.children], from = kids.indexOf(st.it), to = kids.indexOf(tgt);
      flip(() => grid.insertBefore(st.it, to > from ? tgt.nextSibling : tgt));
    }
  }, {passive: false});
  addEventListener("touchmove", e => { if (st && st.on) e.preventDefault(); }, {passive: false});
  const end = () => {
    if (!st) return; clearTimeout(st.timer);
    if (st.on) {
      const s = st, r = s.it.getBoundingClientRect(), g = s.ghost;
      g.style.transition = "transform .16s ease"; g.style.transform = `translate(${r.left - parseFloat(g.style.left)}px,${r.top - parseFloat(g.style.top)}px) scale(1)`;
      setTimeout(() => { g.remove(); s.it.classList.remove("ph"); }, 170);
      justDragged = true; setTimeout(() => justDragged = false, 80);
      onDone([...grid.children].filter(c => c.dataset.key).map(c => c.dataset.key));
    }
    st = null;
  };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
  grid.addEventListener("click", e => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ======================= DESKTOP ======================= */
VIEWS.desktop = async function () {
  document.body.classList.add("isdesk");
  const root = $("#root"); root.className = "desk";
  const clock = h("div", {class: "clock"}), date = h("div", {class: "date"});
  const ans = h("div", {class: "answer hidden"});
  let blender = false;
  const ask = h("input", {placeholder: "Tanya FaqehOS…", "aria-label": "Tanya FaqehOS"});
  const mode = h("button", {title: "Tukar antara tanya AI dan arahkan Blender", onclick: () => {
    blender = !blender; mode.classList.toggle("on", blender); mode.textContent = blender ? "Blender" : "AI";
    ask.placeholder = blender ? "Arahkan Blender: contoh, buat 5 kubus bersusun" : "Tanya FaqehOS…";
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
  const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString(LOCALE(), {hour: "2-digit", minute: "2-digit", hour12: !PREFS.clock24}); date.textContent = d.toLocaleDateString(LOCALE(), {weekday: "long", day: "numeric", month: "long"}); };
  tick(); setInterval(tick, 15000); addEventListener("faqeh-prefs", tick);
  let last = "";
  const itemMenu = (x, y, p) => ctxMenu(x, y, [{label: "Buka", fn: () => openKey(p.key)}, "-", {label: "Nyahpin daripada desktop", fn: async () => { await togglePin(p.key); load(true); }}]);
  async function load(force) {
    let pins; try { pins = (await api("/desktop")).pins; } catch (e) { return; }
    const sig = JSON.stringify(pins.map(p => p.key)); if (sig === last && !force) return; last = sig;
    grid.replaceChildren(...pins.map(p => {
      const b = h("button", {class: "sc", "data-key": p.key, title: p.name, onclick: () => openKey(p.key),
        oncontextmenu: e => { e.preventDefault(); e.stopPropagation(); itemMenu(e.clientX, e.clientY, p); }}, h("i", null, p.icon), h("span", null, p.name));
      longPress(b, (x, y) => { if (!document.querySelector(".ghost")) itemMenu(x, y, p); });
      return b;
    }));
  }
  sortable(grid, async keys => { last = JSON.stringify(keys); try { await api("/desktop", {keys}); } catch (e) { fail(e); } });
  const size = s => ({label: {small: "Ikon kecil", medium: "Ikon sederhana", large: "Ikon besar"}[s], check: PREFS.icon_size === s, fn: () => setPref({icon_size: s})});
  const deskMenu = (x, y) => ctxMenu(x, y, [size("small"), size("medium"), size("large"), "-",
    {label: "Susun ikut nama", fn: async () => { const keys = [...grid.children].map(c => [c.title, c.dataset.key]).sort((a, b) => a[0].localeCompare(b[0], LOCALE())).map(a => a[1]); await api("/desktop", {keys}); load(true); }},
    {label: "Segar semula", fn: () => load(true)}, "-",
    {label: "🛍️ Faqeh Store", fn: () => openKey("sys:store")}, {label: "📁 Fail", fn: () => openKey("sys:files")}, {label: "⌨️ Terminal", fn: () => openKey("sys:terminal")}, "-",
    {label: "🖥️ Tetapan paparan", fn: () => openSettings("system")}, {label: "🎨 Peribadikan", fn: () => openSettings("personal")}]);
  root.addEventListener("contextmenu", e => { if (!e.target.closest(".sc,.ask,.answer")) { e.preventDefault(); deskMenu(e.clientX, e.clientY); } });
  longPress(root, (x, y) => { if (!document.querySelector(".ghost")) deskMenu(x, y); });
  await load(); setInterval(load, 3000); addEventListener("focus", () => load());
  addEventListener("click", e => { if (!ans.contains(e.target) && !form.contains(e.target)) ans.classList.add("hidden"); });
  if (Q.get("intro") === "1") runIntro();
};

/* intro: animasi 3D logo FaqehOS (logo3d.html) dalam iframe. Dilangkau jika WebGL tiada atau peranti perlahan. */
function runIntro() {
  if (!PREFS.intro || PREFS.anim === "off" || (matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const fr = h("iframe", {id: "intro", src: "/shell/logo3d.html?embed=1", title: "FaqehOS"});
  document.body.append(fr);
  const end = () => { removeEventListener("message", on); fr.style.opacity = 0; setTimeout(() => fr.remove(), 800); };
  const on = e => { if (e.source === fr.contentWindow && (e.data === "faqeh-intro-done" || e.data === "faqeh-intro-slow")) end(); };
  addEventListener("message", on); setTimeout(end, 9000);
}

/* ======================= MENU MULA ======================= */
const PINNED = ["sys:chrome", "sys:files", "sys:store", "sys:myapps", "sys:claude", "sys:claudecode", "sys:terminal", "sys:settings"];
VIEWS.start = async function () {
  const root = $("#root"); root.className = "startwin";
  const search = h("input", {placeholder: "Cari aplikasi…", "aria-label": "Cari aplikasi"});
  const list = h("div", {class: "list"});
  let apps = [], acct = {};
  const act = a => { openKey(a.key); closeWin(); };
  const menu = a => e => { e.preventDefault(); ctxMenu(e.clientX, e.clientY, [{label: "Buka", fn: () => act(a)}, {label: "Pin ke desktop", fn: () => togglePin(a.key)}]); };
  const tile = a => h("button", {class: "sc", title: a.name, onclick: () => act(a), oncontextmenu: menu(a)}, h("i", null, a.icon), h("span", null, a.name));
  const row = a => h("button", {class: "arow", onclick: () => act(a), oncontextmenu: menu(a)}, h("i", null, a.icon), h("span", null, a.name));
  function render() {
    const q = search.value.trim().toLowerCase();
    const f = apps.filter(a => !q || a.name.toLowerCase().includes(q));
    const pinned = q ? [] : PINNED.map(k => apps.find(a => a.key === k)).filter(Boolean);
    const rest = f.slice().sort((a, b) => a.name.localeCompare(b.name, LOCALE()));
    list.replaceChildren(...[
      pinned.length ? [h("h5", null, "Disematkan"), h("div", {class: "grid"}, pinned.map(tile))] : null,
      h("h5", null, q ? "Hasil carian" : "Semua aplikasi"), h("div", {class: "alist"}, rest.map(row)),
      !f.length ? h("p", {class: "dim"}, "Tiada aplikasi sepadan.") : null].flat().filter(Boolean));
  }
  search.addEventListener("input", render);
  const wname = h("b", null, "…"), wid = h("small", {class: "dim"});
  const panel = h("div", {class: "start"}, h("div", {class: "hdr"}, search), list,
    h("div", {class: "foot"}, h("button", {class: "who", onclick: () => { openSettings("account"); closeWin(); }},
      h("span", {class: "avatar"}, "F"), h("span", {class: "wtxt"}, wname, wid)),
      h("div", {class: "row"}, h("button", {title: "Tetapan", onclick: () => { openSettings(); closeWin(); }}, "⚙️"),
        h("button", {title: "Kuasa", onclick: () => { location.search = "?view=power&t=" + TOKEN; }}, "⏻"))));
  root.append(panel);
  let leave, idle = setTimeout(closeWin, 60000);
  panel.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") leave = setTimeout(closeWin, 2200); });
  panel.addEventListener("pointerenter", () => clearTimeout(leave));
  panel.addEventListener("pointermove", () => { clearTimeout(idle); idle = setTimeout(closeWin, 60000); });
  addEventListener("keydown", e => { if (e.key === "Escape") closeWin(); });
  try { apps = (await api("/launcher")).apps; acct = await api("/account"); } catch (e) { fail(e); }
  wname.textContent = acct.name || "faqeh"; wid.textContent = acct.id || "";
  render(); search.focus();
};

VIEWS.power = function () {
  const root = $("#root"); root.className = "powerwin";
  const act = a => () => { api("/power", {action: a}).catch(fail); closeWin(); };
  root.append(h("div", {class: "card pcard"}, h("h3", {style: "margin:0 0 6px"}, "Kuasa"),
    h("button", {onclick: act("logout")}, "Log keluar"), h("button", {onclick: act("reboot")}, "Mulakan semula"),
    h("button", {class: "pri", onclick: act("poweroff")}, "Matikan"), h("button", {class: "ghost", onclick: closeWin}, "Batal")));
  addEventListener("keydown", e => { if (e.key === "Escape") closeWin(); });
};

/* menu klik kanan bar tugas (muncul di atas bar) */
VIEWS.ctxmenu = function () {
  const root = $("#root"); root.className = "ctxwin";
  const go = (key, page) => () => { api("/open", {key, page}).catch(fail); closeWin(); };
  const items = [["📈", "Pengurus Tugas", go("sys:taskmgr")], ["🎨", "Tetapan bar tugas", go("sys:settings", "personal")], ["⚙️", "Tetapan", go("sys:settings")],
    ["📁", "Fail", go("sys:files")], ["⌨️", "Terminal", go("sys:terminal")], ["⏻", "Kuasa", () => { location.search = "?view=power&t=" + TOKEN; }]];
  const m = h("div", {class: "menu fixed"}, items.map(([i, l, fn]) => h("button", {onclick: fn}, h("span", {class: "mi"}, i), l)));
  root.append(m);
  let t; m.addEventListener("pointerleave", () => { t = setTimeout(closeWin, 1500); }); m.addEventListener("pointerenter", () => clearTimeout(t));
  setTimeout(closeWin, 20000);
  addEventListener("keydown", e => { if (e.key === "Escape") closeWin(); });
};

/* ======================= PENGURUS TUGAS ======================= */
VIEWS.taskmgr = async function () {
  const root = $("#root"); root.className = "win";
  const cpu = h("div", {class: "meter"}, h("i")), ram = h("div", {class: "meter"}, h("i")), sumc = h("span"), sumr = h("span");
  const tbody = h("tbody");
  root.append(h("header", null, h("h2", null, "📈 Pengurus Tugas")),
    h("main", null, h("div", {class: "row", style: "gap:24px;margin-bottom:14px"},
      h("div", {style: "flex:1;min-width:200px"}, h("div", {class: "dim"}, "CPU ", sumc), cpu), h("div", {style: "flex:1;min-width:200px"}, h("div", {class: "dim"}, "Memori ", sumr), ram)),
      h("table", {class: "tbl"}, h("thead", null, h("tr", null, h("th", null, "Nama"), h("th", null, "CPU %"), h("th", null, "Memori"), h("th"))), tbody)));
  async function load() {
    let d; try { d = await api("/proc"); } catch (e) { return; }
    cpu.firstChild.style.width = Math.min(100, d.cpu) + "%"; sumc.textContent = d.cpu + "%";
    const pct = Math.round(100 * d.mem_used_mb / d.mem_total_mb); ram.firstChild.style.width = pct + "%"; sumr.textContent = `${d.mem_used_mb} / ${d.mem_total_mb} MB (${pct}%)`;
    tbody.replaceChildren(...d.procs.map(p => h("tr", null, h("td", null, p.name), h("td", null, p.cpu.toFixed(1)), h("td", null, p.mem_mb + " MB"),
      h("td", null, p.protected ? h("span", {class: "chip"}, "sistem") : h("button", {onclick: async () => { try { await api("/proc/kill", {pid: p.pid}); toast("Ditamatkan"); } catch (e) { fail(e); } load(); }}, "Tamatkan")))));
  }
  load(); setInterval(load, 2000);
};

/* ======================= FAQEH HELLO (ruang simpanan) ======================= */
VIEWS.hello = async function () {
  const root = $("#root"); root.className = "win";
  const a = await api("/account").catch(() => ({}));
  root.append(h("header", null, h("h2", null, "💬 Faqeh Hello")), h("main", null,
    h("div", {class: "card", style: "max-width:560px"}, h("h3", {style: "margin-top:0"}, "ID Faqeh anda"),
      h("div", {class: "idbox"}, a.id || "…"), h("button", {onclick: () => { navigator.clipboard && navigator.clipboard.writeText(a.id); toast("ID disalin"); }}, "Salin ID"),
      h("p", {class: "dim"}, "Faqeh Hello (sembang antara rakan, panggilan suara, kongsi skrin dan fail, permainan bersama) belum aktif. Ia memerlukan pelayan pusat Faqeh untuk mendaftar ID yang unik dan menghubungkan peranti. ID di atas dijana pada peranti ini dan akan didaftarkan apabila pelayan tersedia."))));
};

/* ======================= FAQEH STORE ======================= */
VIEWS.store = async function () {
  const root = $("#root"); root.className = "win";
  const q = h("input", {placeholder: "Cari dalam Faqeh Store…", style: "max-width:320px"});
  const cats = h("div", {class: "row", style: "margin-bottom:14px"}), grid = h("div", {class: "store-grid"}), note = h("p", {class: "dim"});
  let data = {apps: [], flatpak: true}, cat = "Semua", timer = null;
  function render() {
    const f = data.apps.filter(a => (cat === "Semua" || a.cat === cat) && (!q.value || (a.name + a.desc).toLowerCase().includes(q.value.toLowerCase())));
    cats.replaceChildren(...["Semua", ...new Set(data.apps.map(a => a.cat))].map(c => h("button", {class: c === cat ? "pri" : "", onclick: () => { cat = c; render(); }}, c)));
    note.textContent = data.flatpak ? "Aplikasi dipasang daripada Flathub dan berjalan dalam sandbox. Pemasangan memerlukan internet dan ruang cakera (sekurang-kurangnya 1.8 GB). Dalam sesi live tanpa persistence, aplikasi disimpan dalam RAM." : "Flatpak tidak dipasang pada sistem ini, jadi pemasangan tidak tersedia.";
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
  root.append(h("header", null, h("h2", null, "🛍️ Faqeh Store"), q), h("main", null, cats, note, grid));
  refresh();
};

/* ======================= MY FAQEH APP (+ Make a Software) ======================= */
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
      hint.textContent = on.length ? "Enjin AI aktif: " + on.map(e => e.provider).join(" → ") + " (bertukar automatik jika kuota habis)." : "Tiada penyedia AI aktif. Buka Tetapan → AI & API dan masukkan kunci API (atau aktifkan “mock” untuk demo)."; } catch (e) {}
  }
  const dm = makeDialog(refresh);
  root.append(h("header", null, h("h2", null, "🧩 My Faqeh App")),
    h("main", null, h("div", {class: "make"}, h("div", null, h("h3", null, "Make a Software"), h("p", null, "Terangkan app yang anda mahu. FaqehOS akan membinanya dan memasangnya ke sini.")),
      h("button", {class: "gold", onclick: dm.open}, "Cipta app"), h("button", {onclick: dm.importFile}, "Import .faqehapp")), hint, tiles));
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
    h("div", {class: "row", style: "margin-top:12px"}, goB, h("button", {onclick: () => dlg.close()}, "Tutup"), status), res);
  res.append(prev, h("div", {class: "row", style: "margin-top:10px"}, nm, chips), h("div", {class: "row", style: "margin-top:10px"}, rev, revB),
    h("div", {class: "row", style: "margin-top:10px"},
      h("button", {class: "gold", onclick: async () => {
        if (scan && scan.level === "tinggi" && !(await uiConfirm("Imbasan kod menunjukkan risiko TINGGI (" + scan.findings.join(", ") + "). Pasang juga?", "Pasang juga"))) return;
        try { await api("/apps/install", {draft_id: draft}); dlg.close(); toast("App dipasang ke My Faqeh App"); onInstalled(); } catch (e) { fail(e); } }}, "Pasang app"),
      h("button", {onclick: () => { draft = null; res.classList.add("hidden"); prev.srcdoc = ""; }}, "Buang draf")));
  document.body.append(dlg); dragify(dlg);
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
      const f = h("input", {type: "file", accept: ".faqehapp,application/json", onchange: async () => {
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

addEventListener("DOMContentLoaded", async () => {
  addEventListener("contextmenu", e => { if (!e.target.closest(".sc,.fm,.arow,input,textarea,#root.desk")) e.preventDefault(); });
  await loadPrefs(); setInterval(loadPrefs, 6000);
  Promise.resolve((VIEWS[VIEW] || VIEWS.desktop)()).catch(fail);
});
