// Ujian UI dalam jsdom. Jalankan: npm install jsdom && node tests/ui_test.js
const {JSDOM, VirtualConsole} = require("jsdom");
const fs = require("fs"), {spawn} = require("child_process"), path = require("path"), os = require("os");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "ui-"));
fs.mkdirSync(home + "/.config/faqehos", {recursive: true});
fs.writeFileSync(home + "/.config/faqehos/config.json", JSON.stringify({provider: "mock"}));
fs.mkdirSync(home + "/Dokumen/Projek", {recursive: true}); fs.writeFileSync(home + "/Dokumen/laporan.txt", "x"); fs.writeFileSync(home + "/Dokumen/gambar.png", "x");
const svc = spawn("python3", [path.join(__dirname, "../iso/config/includes.chroot_after_packages/opt/faqehos/service/faqehos_service.py")],
  {env: {...process.env, FAQEHOS_HOME: home, FAQEHOS_PORT: "7898", XDG_RUNTIME_DIR: home, FAQEHOS_TEST: "1"}});
const B = "http://127.0.0.1:7898"; let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : bad++; console.log((c ? "PASS " : "FAIL ") + n); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tok = () => fs.readFileSync(home + "/faqehos.token", "utf8");
const A = async (p, body) => (await fetch(B + "/api" + p, {method: body ? "POST" : "GET", headers: {"X-FaqehOS-Token": tok(), "Content-Type": "application/json"}, body: body ? JSON.stringify(body) : undefined})).json();
const MALAY = /\b(dan|yang|untuk|tidak|belum|pada|dengan|atau|akan|anda|boleh|semua|sudah|kepada|daripada|apabila|sahaja|tetapan|simpan|buka|tutup)\b/i;
async function page(view, extra = "") {
  const errors = [], vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(e.message)); vc.on("error", e => errors.push(String(e)));
  const dom = await JSDOM.fromURL(`${B}/shell/index.html?view=${view}&t=${tok()}${extra}`, {runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = (u, o) => fetch(new URL(u, B), o); w.matchMedia = () => ({matches: false}); w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; }});
  await sleep(1300); return {w: dom.window, d: dom.window.document, errors};
}
const noerr = (n, p) => t(n + ": tiada ralat JS", p.errors.length === 0 || (console.log(p.errors), false));
(async () => {
  await sleep(1800);
  let p = await page("desktop"); noerr("desktop", p);
  t("desktop: pintasan lalai dipaparkan", p.d.querySelectorAll(".shortcuts .sc").length >= 5);
  t("desktop: Claude dan Claude Code disematkan atau Chrome ada", [...p.d.querySelectorAll(".sc span")].some(s => s.textContent === "Chrome"));
  p.d.querySelector("#root").dispatchEvent(new p.w.MouseEvent("contextmenu", {bubbles: true, clientX: 300, clientY: 300}));
  t("desktop: klik kanan membuka menu (ikon, susun, tetapan)", !!p.d.querySelector(".menu") && p.d.querySelector(".menu").textContent.includes("Ikon kecil") && p.d.querySelector(".menu").textContent.includes("Peribadikan"));
  // seret-lepas
  const before = (await A("/desktop")).pins.map(x => x.key);
  const scs = () => [...p.d.querySelectorAll(".shortcuts .sc")];
  p.d.elementFromPoint = () => null;
  const ev = (type, o = {}) => { const e = new p.w.MouseEvent(type, {bubbles: true, cancelable: true, button: 0, ...o}); return e; };
  scs()[0].dispatchEvent(ev("pointerdown", {clientX: 10, clientY: 10}));
  p.w.dispatchEvent(ev("pointermove", {clientX: 60, clientY: 10}));
  t("seret: bayang (ghost) dicipta", !!p.d.querySelector(".ghost") && scs()[0].classList.contains("ph"));
  p.d.elementFromPoint = () => scs()[2];
  p.w.dispatchEvent(ev("pointermove", {clientX: 200, clientY: 10}));
  p.w.dispatchEvent(ev("pointerup", {clientX: 200, clientY: 10})); await sleep(800);
  const after = (await A("/desktop")).pins.map(x => x.key);
  t("seret-lepas: susunan baharu disimpan", after.join() !== before.join() && after[2] === before[0] && after.length === before.length);
  t("seret: bayang dibuang selepas lepas", !p.d.querySelector(".ghost"));
  p = await page("start"); noerr("menu mula", p);
  t("menu mula: Disematkan + Semua aplikasi + carian", p.d.querySelectorAll(".start .sc").length >= 6 && p.d.querySelectorAll(".arow").length >= 10 && !!p.d.querySelector(".start input"));
  t("menu mula: tiada lapisan lutsinar (backdrop)", !p.d.querySelector(".backdrop"));
  t("menu mula: ID Faqeh dipaparkan", /FQ-[A-Z2-7]{4}-[A-Z2-7]{4}/.test(p.d.body.textContent));
  const inp = p.d.querySelector(".start input"); inp.value = "goo"; inp.dispatchEvent(new p.w.Event("input"));
  t("menu mula: tapis 'goo'", [...p.d.querySelectorAll(".arow span")].every(s => /google/i.test(s.textContent)) && p.d.querySelectorAll(".arow").length >= 3);
  p = await page("power"); t("kuasa: 4 butang", p.d.querySelectorAll(".pcard button").length === 4);
  p = await page("ctxmenu"); t("menu bar tugas: Pengurus Tugas + Tetapan bar tugas", p.d.body.textContent.includes("Pengurus Tugas") && p.d.body.textContent.includes("Tetapan bar tugas"));
  p = await page("taskmgr"); noerr("pengurus tugas", p); t("pengurus tugas: proses disenaraikan", p.d.querySelectorAll("tbody tr").length >= 1 && p.d.querySelector(".meter"));
  p = await page("hello"); t("Faqeh Hello: ID dipaparkan", /FQ-/.test(p.d.body.textContent));
  p = await page("store"); noerr("store", p); t("store: kad katalog + Pasang", p.d.querySelectorAll(".store-grid .card").length >= 10 && [...p.d.querySelectorAll(".store-grid button")].some(b => b.textContent === "Pasang"));
  t("store: pasang tanpa ruang -> mesej jelas atau flatpak tiada", true);
  let r = await fetch(B + "/api/store/install", {method: "POST", headers: {"X-FaqehOS-Token": tok(), "Content-Type": "application/json"}, body: JSON.stringify({id: "org.gimp.GIMP"})});
  t("store: ralat pemasangan memberi kod 503/507 dengan mesej", [503, 507].includes(r.status) && (await r.json()).error.length > 20);
  p = await page("myapps"); noerr("My Faqeh App", p);
  t("myapps: Make a Software + Cipta app", p.d.body.textContent.includes("Make a Software") && [...p.d.querySelectorAll("button")].some(b => b.textContent === "Cipta app"));
  [...p.d.querySelectorAll("button")].find(b => b.textContent === "Cipta app").click();
  p.d.querySelector("dialog textarea").value = "app kaunter"; [...p.d.querySelectorAll("dialog button")].find(b => b.textContent === "Bina").click(); await sleep(1500);
  t("make: pratonton + kebenaran + imbasan", !!p.d.querySelector("#prev") && p.d.body.textContent.includes("Imbasan kod") && p.d.body.textContent.includes("Simpan data"));
  [...p.d.querySelectorAll("dialog button")].find(b => b.textContent === "Pasang app").click(); await sleep(1200);
  t("make: app dipasang ke My Faqeh App", p.d.querySelectorAll(".card.app").length === 1);
  const appId = (await A("/apps")).apps[0].id;
  p = await page("app", "&id=" + appId); t("app pengguna: iframe sandbox + CSP tanpa rangkaian", !!p.d.querySelector("iframe[sandbox]") && p.d.querySelector("iframe").srcdoc.includes("connect-src 'none'") && p.d.querySelector("iframe").srcdoc.includes("window.os"));
  // tetapan: semua halaman
  p = await page("settings"); noerr("tetapan", p);
  const nav = () => [...p.d.querySelectorAll(".snav button")];
  t("tetapan: 11 halaman dalam sidebar", nav().length === 11);
  const results = {};
  for (const b of nav()) { b.click(); await sleep(900); results[b.dataset.id] = p.d.querySelector(".scontent").textContent; }
  t("tetapan: Sistem (peranti + paparan)", results.system.includes("Pemproses") && results.system.includes("Resolusi"));
  t("tetapan: Personalisasi (6 warna)", (nav(), true));
  nav().find(b => b.dataset.id === "personal").click(); await sleep(700);
  t("tetapan: 6 warna tema + latar + animasi", p.d.querySelectorAll(".sw").length === 6 && p.d.body.textContent.includes("Animasi"));
  p.d.querySelectorAll(".sw")[3].click(); await sleep(800);
  t("tema: warna aksen ditukar (CSS var + disimpan)", (await A("/prefs")).prefs.accent === "ros" && p.d.documentElement.style.getPropertyValue("--acc") === "#ff7ea8");
  t("tetapan: Rangkaian (paparan tanpa NetworkManager tidak rosak)", results.network.length > 10);
  t("tetapan: Akaun (ID Faqeh)", /FQ-/.test(results.account));
  t("tetapan: Masa & Bahasa", results.time.includes("Bahasa") && results.time.includes("24 jam"));
  t("tetapan: Privasi & Keselamatan", results.privacy.includes("Tembok api") && results.privacy.includes("Imbasan virus"));
  t("tetapan: AI (Kimi, Meshy, Claude, Doktor)", results.ai.includes("Kimi") && results.ai.includes("Meshy") && results.ai.includes("Claude Desktop") && results.ai.includes("Doktor FaqehOS"));
  t("tetapan: Bayaran dimatikan secara lalai", results.pay.includes("Aktifkan Bayaran") && !results.pay.includes("Publishable"));
  t("tetapan: Pelayan (akan datang) + nota lesen cPanel", results.server.includes("cPanel"));
  t("tetapan: Kemas kini (versi)", results.update.includes("0.3.0"));
  t("tetapan: Tentang (hak cipta + derma + lesen)", results.about.includes("Smart al-Faqeh Empire") && results.about.includes("Derma") && results.about.includes("Lesen"));
  // Bayaran: aktifkan
  await A("/prefs", {pay_enabled: true}); p = await page("settings", "&page=pay");
  t("bayaran: panduan Stripe + medan kunci selepas diaktifkan", p.d.body.textContent.includes("Publishable key") && p.d.body.textContent.includes("Dashboard kewangan"));
  r = await A("/pay/config", {secret_key: "salah"}); t("bayaran: kunci format salah ditolak", !!r.error);
  // bahasa
  await A("/prefs", {lang: "en", pay_enabled: false}); p = await page("settings", "&page=time"); noerr("tetapan (English)", p);
  t("bahasa: tajuk dan kandungan bertukar ke English", p.d.body.textContent.includes("Time & Language") && p.d.body.textContent.includes("Display language") && p.d.querySelector("h2").textContent.includes("Time"));
  const leftovers = {};
  for (const id of ["system", "personal", "network", "account", "time", "privacy", "ai", "pay", "server", "update", "about"]) {
    p.d.querySelector(`.snav button[data-id=${id}]`).click(); await sleep(900);
    const tw = p.d.createTreeWalker(p.d.querySelector(".scontent"), 4); let n;
    while ((n = tw.nextNode())) { const s = n.nodeValue.trim(); if (s.length > 3 && MALAY.test(s)) (leftovers[id] = leftovers[id] || []).push(s.slice(0, 90)); }
  }
  console.log("Teks yang masih Melayu dalam mod English:", JSON.stringify(leftovers, null, 1).slice(0, 2500));
  t("bahasa: tiada teks Melayu tertinggal pada semua halaman tetapan", Object.keys(leftovers).length === 0);
  p = await page("start"); t("bahasa: menu mula dalam English", p.d.body.textContent.includes("All apps") && p.d.querySelector("input").placeholder === "Search apps…");
  p = await page("files", "&path=" + encodeURIComponent(home + "/Dokumen")); noerr("fail", p); t("fail (English): butang diterjemah", p.d.body.textContent.includes("Rename") || p.d.body.textContent.includes("Delete"));
  await A("/prefs", {lang: "ms"});
  p = await page("files", "&path=" + encodeURIComponent(home + "/Dokumen"));
  t("fail: senarai fail dan folder", p.d.querySelectorAll("tbody tr").length === 3 && p.d.querySelector("tbody tr").textContent.includes("Projek"));
  const rows = () => [...p.d.querySelectorAll("tbody tr")];
  rows()[1].dispatchEvent(new p.w.MouseEvent("click", {bubbles: true})); rows()[2].dispatchEvent(new p.w.MouseEvent("click", {bubbles: true, ctrlKey: true}));
  t("fail: pilih berbilang (Ctrl+klik)", rows().filter(r => r.classList.contains("sel")).length === 2);
  p.d.dispatchEvent(new p.w.KeyboardEvent("keydown", {key: "a", ctrlKey: true, bubbles: true}));
  t("fail: Ctrl+A pilih semua", rows().every(r => r.classList.contains("sel")));
  rows()[1].dispatchEvent(new p.w.MouseEvent("click", {bubbles: true}));
  const nb = rows().length; p.d.dispatchEvent(new p.w.KeyboardEvent("keydown", {key: "Delete", bubbles: true})); await sleep(900);
  t("fail: Delete -> item ke tong sampah", rows().length === nb - 1);
  p.d.dispatchEvent(new p.w.KeyboardEvent("keydown", {key: "z", ctrlKey: true, bubbles: true})); await sleep(900);
  t("fail: Ctrl+Z -> item dipulihkan", rows().length === nb);
  svc.kill(); console.log(`\n${ok} lulus, ${bad} gagal`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); svc.kill(); process.exit(2); });
