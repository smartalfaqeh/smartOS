"use strict";
/* Tetapan FaqehOS (susun atur seperti Tetapan Windows). Bergantung pada penolong dalam app.js. */
const card = (title, ...kids) => h("section", {class: "scard"}, title ? h("h3", null, title) : null, ...kids);
const line = (label, ctl, sub) => h("div", {class: "sline"}, h("div", {class: "slabel"}, h("div", null, label), sub ? h("small", {class: "dim"}, sub) : null), h("div", {class: "sctl"}, ctl));
const toggle = (on, fn) => { const t = h("button", {class: "tgl" + (on ? " on" : ""), role: "switch", "aria-checked": String(!!on), onclick: () => { on = !on; t.classList.toggle("on", on); t.setAttribute("aria-checked", String(on)); fn(on); }}, h("i")); return t; };
const seg = (opts, cur, fn) => { const box = h("div", {class: "seg"}); const draw = c => box.replaceChildren(...opts.map(([v, l]) => h("button", {class: v === c ? "on" : "", onclick: () => { draw(v); fn(v); }}, l))); draw(cur); return box; };
const openUrl = url => api("/openurl", {url}).catch(fail);
const fmtMoney = (amt, cur) => { try { return new Intl.NumberFormat(LOCALE(), {style: "currency", currency: cur}).format(amt / 100); } catch (e) { return (amt / 100).toFixed(2) + " " + cur; } };

const SPAGES = [["system", "🖥️", "Sistem"], ["personal", "🎨", "Personalisasi"], ["network", "📶", "Rangkaian"], ["account", "👤", "Akaun"], ["time", "🌐", "Masa & Bahasa"],
  ["privacy", "🔒", "Privasi & Keselamatan"], ["ai", "🤖", "AI & API"], ["pay", "💳", "Bayaran"], ["server", "🖧", "Pelayan"], ["update", "⬆️", "Kemas kini"], ["about", "ℹ️", "Tentang"]];

VIEWS.settings = async function () {
  const root = $("#root"); root.className = "settingswin";
  const nav = h("nav", {class: "snav"}), content = h("div", {class: "scontent"});
  const title = h("h2");
  let cur = "";
  const go = id => {
    cur = id; title.textContent = (SPAGES.find(p => p[0] === id) || [])[2] || "";
    nav.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
    content.replaceChildren(h("p", {class: "dim"}, "Memuatkan…"));
    (PAGEFN[id] || PAGEFN.system)(content).catch(e => content.replaceChildren(card("Ralat", h("p", {class: "err"}, e.message))));
    content.scrollTop = 0; nav.classList.remove("open");
  };
  nav.append(...SPAGES.map(([id, ic, nm]) => h("button", {"data-id": id, onclick: () => go(id)}, h("i", null, ic), h("span", null, nm))));
  root.append(h("div", {class: "sshell"}, h("button", {class: "burger ghost", onclick: () => nav.classList.toggle("open")}, "☰"), nav, h("div", {class: "smain"}, title, content)));
  go(SPAGES.some(p => p[0] === PAGE) ? PAGE : "system");
};

const PAGEFN = {};

PAGEFN.system = async root => {
  const s = await api("/sysinfo"), pp = await api("/powerprofile").catch(() => ({available: false}));
  root.replaceChildren(
    card("Peranti", line("Nama peranti", s.hostname), line("Pemproses", s.cpu || "—", s.cores + " teras"), line("Memori (RAM)", (s.ram_mb / 1024).toFixed(1) + " GB"),
      line("Storan", s.disk_free_gb + " GB bebas daripada " + s.disk_total_gb + " GB"), line("Pemacu grafik", s.gpu_driver || "—"), line("Seni bina", s.arch), line("Versi FaqehOS", s.version),
      s.live ? h("p", {class: "note warn"}, "Anda dalam sesi live: perubahan disimpan dalam RAM dan hilang selepas mulakan semula (melainkan USB mempunyai persistence). Pasang FaqehOS ke cakera untuk kegunaan tetap.") : null),
    card("Paparan", line("Resolusi", `${screen.width} × ${screen.height}`, "Skala " + (window.devicePixelRatio || 1) + "×"), line("Peranti input", matchMedia && matchMedia("(pointer: coarse)").matches ? "Skrin sentuh dikesan" : "Tetikus / pad sentuh")),
    card("Kuasa dan prestasi", pp.available ? line("Mod prestasi", seg([["power-saver", "Jimat bateri"], ["balanced", "Seimbang"], ["performance", "Prestasi"]], pp.profile, v => api("/powerprofile", {profile: v}).then(() => toast("Mod dikemas kini")).catch(fail)),
      "Jimat bateri mengurangkan haba dan penggunaan kuasa.") : h("p", {class: "dim"}, "Pengurusan profil kuasa tidak tersedia pada peranti ini."),
      line("Pengurus Tugas", h("button", {onclick: () => openKey("sys:taskmgr")}, "Buka"))));
};

PAGEFN.personal = async root => {
  const accents = Object.entries(ACCENTS);
  const swatches = h("div", {class: "swatches"});
  const draw = () => swatches.replaceChildren(...accents.map(([k, v]) => h("button", {class: "sw" + (PREFS.accent === k ? " on" : ""), title: k, style: `--c:${v[0]};--c2:${v[1]}`, onclick: async () => { await setPref({accent: k}); draw(); toast("Warna dikemas kini"); }})));
  draw();
  root.replaceChildren(
    card("Warna tema", h("p", {class: "dim"}, "Warna ini digunakan pada semua tetingkap, bar tugas dan sempadan tetingkap."), swatches),
    card("Latar desktop", seg([["aurora", "Aurora"], ["midnight", "Tengah malam"], ["forest", "Hutan"], ["dusk", "Senja"]], PREFS.wallpaper, v => setPref({wallpaper: v}))),
    card("Ikon desktop", seg([["small", "Kecil"], ["medium", "Sederhana"], ["large", "Besar"]], PREFS.icon_size, v => setPref({icon_size: v}))),
    card("Animasi dan prestasi", line("Tahap animasi", seg([["full", "Penuh"], ["low", "Rendah"], ["off", "Mati"]], PREFS.anim, v => setPref({anim: v})), "Rendah atau mati menjimatkan CPU/GPU dan bateri."),
      line("Animasi 3D semasa mula", toggle(PREFS.intro, v => setPref({intro: v})), "Dilangkau secara automatik jika peranti tidak menyokong WebGL atau perlahan.")),
    card("Bar tugas", h("p", {class: "dim"}, "Klik kanan butang logo atau jam pada bar tugas untuk Pengurus Tugas dan pintasan. Klik tengah pada butang tetingkap untuk menutupnya.")));
};

const bars = s => s > 75 ? "▂▄▆█" : s > 50 ? "▂▄▆" : s > 25 ? "▂▄" : "▂";
PAGEFN.network = async root => {
  const st = h("div"), list = h("div", {class: "wifi"});
  const refreshBtn = h("button", {onclick: () => load(true)}, "Cari rangkaian");
  root.replaceChildren(card("Status", st), card("Wi-Fi", h("div", {class: "row"}, refreshBtn), list));
  async function status() {
    const s = await api("/net/status");
    st.replaceChildren(line("Internet", h("span", {class: "chip " + (s.online ? "ok" : "bad")}, s.online ? "Bersambung" : "Tiada akses")), line("Alamat IP", s.ip || "—"),
      ...s.devices.map(d => line(d.type === "wifi" ? "Wi-Fi" : "Ethernet", d.state + (d.connection ? ": " + d.connection : ""))));
  }
  async function load(scan) {
    refreshBtn.disabled = true; list.replaceChildren(h("p", {class: "dim"}, "Mencari…"));
    try { await status(); const r = await api("/net/scan"); list.replaceChildren(...(r.networks.length ? r.networks.map(n => h("div", {class: "wrow"},
      h("span", {class: "sig"}, bars(n.signal)), h("span", {class: "ssid"}, n.ssid, n.secure ? " 🔒" : ""), n.active ? h("span", {class: "chip ok"}, "bersambung") : null,
      h("span", {class: "grow"}), n.active ? [h("button", {onclick: async () => { await api("/net/disconnect", {}).catch(fail); load(); }}, "Putuskan"), h("button", {onclick: async () => { await api("/net/forget", {ssid: n.ssid}).catch(fail); load(); }}, "Lupakan")] :
      h("button", {class: "pri", onclick: async () => {
        let pw = ""; if (n.secure) { pw = await uiPrompt("Kata laluan untuk " + n.ssid, "", "password"); if (pw === null) return; }
        toast("Menyambung…", 20000);
        try { await api("/net/connect", {ssid: n.ssid, password: pw}); toast("Bersambung ke " + n.ssid); } catch (e) { fail(e); }
        load(); }}, "Sambung"))) : [h("p", {class: "dim"}, "Tiada rangkaian Wi-Fi dijumpai (atau tiada adaptor Wi-Fi).")]));
    } catch (e) { list.replaceChildren(h("p", {class: "err"}, e.message)); }
    refreshBtn.disabled = false;
  }
  load();
};

PAGEFN.account = async root => {
  const a = await api("/account");
  const name = h("input", {value: a.name, maxlength: 40});
  root.replaceChildren(
    card("Profil", line("Nama paparan", h("div", {class: "row"}, name, h("button", {class: "pri", onclick: async () => { await setPref({display_name: name.value}); toast("Disimpan"); }}, "Simpan"))), line("Nama pengguna", a.username),
      line("ID Faqeh", h("div", {class: "row"}, h("span", {class: "idbox"}, a.id), h("button", {onclick: () => { navigator.clipboard && navigator.clipboard.writeText(a.id); toast("ID disalin"); }}, "Salin")),
        "ID unik anda untuk Faqeh Hello. Dijana pada peranti ini dan akan didaftarkan di pelayan Faqeh apabila perkhidmatan tersedia."),
      line("Dicipta", new Date(a.created * 1000).toLocaleDateString(LOCALE()))),
    card("Faqeh Hello", h("p", {class: "dim"}, "Sembang, panggilan suara, kongsi skrin/fail dan permainan bersama rakan (tambah rakan dengan ID Faqeh). Belum aktif: memerlukan pelayan pusat."), h("button", {onclick: () => openKey("sys:hello")}, "Buka Faqeh Hello")));
};

PAGEFN.time = async root => {
  root.replaceChildren(
    card("Bahasa", line("Bahasa paparan", seg([["ms", "Bahasa Melayu"], ["en", "English"]], PREFS.lang, async v => { await setPref({lang: v}); toast(v === "en" ? "Language changed" : "Bahasa ditukar"); }),
      "Bahasa dikemas kini serta-merta pada semua tetingkap. Pemasang FaqehOS juga menawarkan pilihan bahasa semasa pemasangan.")),
    card("Masa", line("Format 24 jam", toggle(PREFS.clock24, v => setPref({clock24: v}))), line("Zon waktu", Intl.DateTimeFormat().resolvedOptions().timeZone, "Zon waktu ditetapkan semasa pemasangan."),
      line("Masa semasa", new Date().toLocaleString(LOCALE()))));
};

PAGEFN.privacy = async root => {
  const sec = await api("/security/status"), apps = (await api("/apps")).apps;
  const yn = (v, t) => h("span", {class: "chip " + (v ? "ok" : "warn")}, t + (v ? ": aktif" : ": tidak aktif"));
  const out = h("pre", {class: "rep hidden"});
  const places = (await api("/fm/places").catch(() => ({places: []}))).places;
  const scan = async (path, label) => { out.classList.remove("hidden"); out.textContent = "Mengimbas " + label + "… (boleh mengambil masa beberapa minit)"; try { const r = await api("/security/scan", {path}); out.textContent = r.infected.length ? "DIJUMPAI:\n" + r.infected.join("\n") : "Tiada ancaman dijumpai."; } catch (e) { out.textContent = e.message; } };
  const dl = places.find(p => p.name === "Muat turun"), hm = places.find(p => p.name === "Rumah");
  const permRows = apps.length ? apps.map(a => h("div", {class: "sline"}, h("div", {class: "slabel"}, a.icon + " " + a.name), h("div", {class: "sctl row"},
    (a.permissions || []).length ? a.permissions.map(p => { const on = (a.granted || []).includes(p); const b = h("button", {class: "chip " + (on ? "ok" : "bad"), title: "Klik untuk tukar", onclick: async () => {
      const g = new Set(a.granted || []); on ? g.delete(p) : g.add(p); const r = await api("/apps/perms", {id: a.id, granted: [...g]}).catch(fail); if (r) { a.granted = r.granted; PAGEFN.privacy(root); } }}, PERM[p] + (on ? ": dibenarkan" : ": disekat")); return b; }) : h("span", {class: "dim"}, "Tiada kebenaran diminta")))) : [h("p", {class: "dim"}, "Belum ada app yang dicipta.")];
  root.replaceChildren(
    card("Status keselamatan", h("div", {class: "row"}, yn(sec.firewall, "Tembok api"), yn(sec.apparmor, "AppArmor"), yn(sec.clamav_installed, "ClamAV"), yn(sec.auto_updates, "Kemas kini automatik")),
      h("p", {class: "dim"}, "Lapisan: tembok api (tiada sambungan masuk), AppArmor, sandbox + CSP untuk app buatan AI, kebenaran per-app, imbasan kod, dan sandbox Flatpak untuk Faqeh Store. Tiada sistem boleh dijamin kebal sepenuhnya.")),
    card("Imbasan virus", h("div", {class: "row"}, dl ? h("button", {onclick: () => scan(dl.path, "Muat turun")}, "Imbas folder Muat turun") : null, hm ? h("button", {onclick: () => scan(hm.path, "Rumah")}, "Imbas folder Rumah") : null),
      h("p", {class: "dim"}, sec.clamav_db ? "Pangkalan data virus: " + new Date(sec.clamav_db * 1000).toLocaleDateString(LOCALE()) : "Pangkalan data virus belum dimuat turun (dikemas kini automatik apabila ada internet dan ruang)."), out),
    card("Kebenaran app (My Faqeh App)", ...permRows));
};

PAGEFN.ai = async root => {
  const cfg = await api("/config"), cl = await api("/claude/status").catch(() => ({}));
  const rows = cfg.chain.map(e => ({...e, key: ""}));
  const NAMES = {anthropic: "Anthropic (Claude)", openai: "OpenAI", kimi: "Kimi (Moonshot)", deepseek: "DeepSeek", ollama: "Ollama (tempatan)", mock: "Mock (demo)"};
  const provBox = h("div");
  function drawProv() {
    provBox.replaceChildren(...rows.map((r, i) => h("div", {class: "prov"},
      h("div", {class: "row"}, h("button", {class: "ghost", disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; drawProv(); }}, "▲"),
        h("button", {class: "ghost", disabled: i === rows.length - 1, onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; drawProv(); }}, "▼")),
      h("label", {class: "row"}, h("input", {type: "checkbox", style: "width:auto", checked: r.enabled, onchange: ev => r.enabled = ev.target.checked}), h("span", {class: "n"}, (i + 1) + ". " + (NAMES[r.provider] || r.provider))),
      h("input", {placeholder: "Model (lalai: " + r.default_model + ")", value: r.model, oninput: ev => r.model = ev.target.value}),
      h("input", {type: "password", placeholder: r.has_key ? "Kunci tersimpan (taip untuk ganti)" : ["ollama", "mock"].includes(r.provider) ? "Tidak perlu kunci" : "Tampal kunci API", oninput: ev => r.key = ev.target.value}),
      r.cooldown_until ? h("span", {class: "chip warn"}, "rehat → " + new Date(r.cooldown_until * 1000).toLocaleTimeString(LOCALE(), {hour: "2-digit", minute: "2-digit"})) : (r.has_key ? h("span", {class: "chip ok"}, "kunci ada") : h("span")))));
  }
  drawProv();
  const msg = h("span", {class: "dim"}), meshy = h("input", {type: "password", placeholder: cfg.meshy_has_key ? "Kunci tersimpan (taip untuk ganti)" : "Tampal kunci API Meshy"});
  const rep = h("pre", {class: "rep hidden"}), last = await api("/doctor/last").catch(() => ({}));
  if (last.report) { rep.classList.remove("hidden"); rep.textContent = "(" + new Date(last.ts * 1000).toLocaleString(LOCALE()) + ")\n" + last.report; }
  const clBadge = (ok, t) => h("span", {class: "chip " + (ok ? "ok" : "warn")}, t + (ok ? ": dipasang" : ": belum dipasang"));
  root.replaceChildren(
    card("Enjin AI (rantaian penyedia)", h("p", {class: "dim"}, "Susun mengikut keutamaan (atas = dicuba dahulu; letakkan model terbaik di atas). Jika kuota habis atau ralat, FaqehOS bertukar automatik ke penyedia seterusnya. Kunci disimpan pada peranti ini sahaja dan tidak dipaparkan semula."), provBox,
      h("div", {class: "row", style: "margin-top:12px"}, h("button", {class: "pri", onclick: async () => { try { await api("/config", {chain: rows.map(r => ({provider: r.provider, model: r.model, key: r.key, enabled: r.enabled}))}); msg.textContent = "Disimpan."; setTimeout(() => PAGEFN.ai(root), 500); } catch (e) { fail(e); } }}, "Simpan"),
        h("button", {onclick: async () => { msg.textContent = "Menguji…"; try { const r = await api("/ai/ask", {prompt: "Balas dengan satu perkataan: OK"}); msg.textContent = "Jawapan: " + r.text.slice(0, 80); } catch (e) { msg.textContent = ""; fail(e); } }}, "Uji sambungan"), msg)),
    card("Penjanaan 3D: Meshy", h("p", {class: "dim"}, "Ruang simpanan untuk kunci API Meshy (penjanaan model 3D daripada teks/imej). Sambungan ke Meshy akan ditambah kemudian; kunci disimpan dengan selamat sekarang."),
      h("div", {class: "row"}, meshy, h("button", {class: "pri", onclick: async () => { if (!meshy.value.trim()) return; await api("/config", {chain: [], meshy_key: meshy.value}).catch(fail); toast("Kunci Meshy disimpan"); meshy.value = ""; }}, "Simpan"))),
    card("Claude", h("div", {class: "row"}, clBadge(cl.desktop, "Claude Desktop"), clBadge(cl.code, "Claude Code" + (cl.code_version ? " " + cl.code_version : "")), h("span", {class: "chip " + (cl.online ? "ok" : "warn")}, cl.online ? "internet ada" : "tiada internet")),
      h("p", {class: "dim"}, "Claude Desktop rasmi (beta) dipasang daripada repositori apt Anthropic dan Claude Code daripada pemasang rasmi Claude. Pemasangan dan kemas kini automatik berjalan apabila ada internet dan ruang cakera. Folder kerja Claude: " + (cl.workspace || "~/Claude") + " (input, arahan, about, md, bahan, output)."),
      h("div", {class: "row"}, h("button", {onclick: () => api("/claude/install", {what: "desktop"}).then(() => toast("Memasang Claude Desktop…", 6000)).catch(fail)}, cl.desktop ? "Kemas kini Claude Desktop" : "Pasang Claude Desktop"),
        h("button", {onclick: () => api("/claude/install", {what: "code"}).then(() => toast("Memasang/mengemas kini Claude Code…", 6000)).catch(fail)}, cl.code ? "Kemas kini Claude Code" : "Pasang Claude Code"),
        h("button", {onclick: () => openKey("sys:claudecode")}, "Buka Claude Code"), h("button", {onclick: () => api("/open", {key: "sys:files", page: cl.workspace}).catch(fail)}, "Buka folder kerja"))),
    card("Doktor FaqehOS (ejen pencari bug)", h("p", {class: "dim"}, "Mengumpul log sistem (kunci dan token disembunyikan), meminta AI menganalisis dan menghasilkan laporan serta cadangan pembaikan. Ia hanya mencadangkan; tiada apa diubah tanpa anda."),
      h("div", {class: "row"}, h("button", {class: "pri", onclick: async e => { e.target.disabled = true; rep.classList.remove("hidden"); rep.textContent = "Menganalisis…"; try { rep.textContent = (await api("/doctor/run", {})).report; } catch (x) { rep.textContent = x.message; } e.target.disabled = false; }}, "Jalankan sekarang"),
        h("label", {class: "row"}, toggle(cfg.doctor_auto, v => api("/config", {chain: [], doctor_auto: v}).then(() => toast("Disimpan")).catch(fail)), "Jalankan sekali sehari (menggunakan kuota AI)")), rep));
};

PAGEFN.pay = async root => {
  const draw = async () => {
    const p = await api("/pay/config");
    const pk = h("input", {placeholder: "pk_live_… atau pk_test_…", value: p.public_key}), sk = h("input", {type: "password", placeholder: p.has_secret ? "Tersimpan: " + p.secret_masked + " (taip untuk ganti)" : "sk_live_… / rk_live_… (disyorkan kunci terhad)"}),
      wh = h("input", {type: "password", placeholder: p.has_webhook ? "Tersimpan (taip untuk ganti)" : "whsec_…"});
    const dash = h("div", {class: "hidden"});
    const kids = [card("Bayaran (Stripe)", line("Aktifkan Bayaran", toggle(p.enabled, async v => { await setPref({pay_enabled: v}); draw(); }), "Fungsi ini dimatikan sehingga anda mengaktifkannya."),
      h("p", {class: "dim"}, "Dengan Stripe anda boleh menerima bayaran, contohnya apabila menjual app atau model 3D ciptaan anda. Pengguna memerlukan akaun Stripe sendiri."))];
    if (p.enabled) {
      kids.push(card("Panduan: dapatkan akaun Stripe", h("ol", {class: "guide"}, h("li", null, "Daftar akaun di Stripe dan lengkapkan pengesahan perniagaan/individu."), h("li", null, "Buka Developers → API keys. Salin Publishable key (pk_) dan cipta Restricted key (rk_) dengan kebenaran baca untuk Charges dan Balance (lebih selamat daripada kunci rahsia penuh)."),
        h("li", null, "Untuk webhook: Developers → Webhooks, salin Signing secret (whsec_). Penerimaan webhook memerlukan pelayan awam (Mod Pelayan, akan datang)."), h("li", null, "Tampal kunci di bawah, tekan Simpan, kemudian Uji sambungan.")),
        h("button", {onclick: () => openUrl("https://dashboard.stripe.com/register")}, "Buka pendaftaran Stripe"), " ", h("button", {onclick: () => openUrl("https://dashboard.stripe.com/apikeys")}, "Buka halaman API keys")),
        card("Kunci Stripe", line("Publishable key", pk), line("Secret / Restricted key", sk, "Disimpan pada peranti ini (kebenaran fail 600) dan tidak dipaparkan semula."), line("Webhook signing secret", wh),
          h("div", {class: "row", style: "margin-top:10px"}, h("button", {class: "pri", onclick: async () => { try { await api("/pay/config", {public_key: pk.value, secret_key: sk.value, webhook_secret: wh.value}); toast("Disimpan"); draw(); } catch (e) { fail(e); } }}, "Simpan"),
            h("button", {onclick: async () => { try { const r = await api("/pay/test", {}); toast("Sambungan berjaya (" + (r.livemode ? "mod sebenar" : "mod ujian") + ")"); } catch (e) { fail(e); } }}, "Uji sambungan"),
            h("button", {onclick: async () => { if (await uiConfirm("Padam semua kunci Stripe daripada peranti ini?", "Padam")) { await api("/pay/config", {clear: true}); draw(); } }}, "Padam kunci"))),
        card("Dashboard kewangan", h("div", {class: "row"}, seg([["7", "7 hari"], ["30", "30 hari"], ["90", "90 hari"]], "30", v => load(v)), h("button", {onclick: () => load("30")}, "Muat")), dash));
    }
    root.replaceChildren(...kids);
    async function load(days) {
      dash.classList.remove("hidden"); dash.replaceChildren(h("p", {class: "dim"}, "Memuatkan…"));
      try {
        const d = await api("/pay/dashboard?days=" + days), out = [];
        d.balance.available.forEach(b => out.push(h("div", {class: "stat"}, h("small", null, "Baki tersedia"), h("b", null, fmtMoney(b.amount, b.currency.toUpperCase())))));
        d.balance.pending.forEach(b => out.push(h("div", {class: "stat"}, h("small", null, "Baki tertangguh"), h("b", null, fmtMoney(b.amount, b.currency.toUpperCase())))));
        for (const [cur, o] of Object.entries(d.summary)) {
          out.push(h("div", {class: "stat"}, h("small", null, "Hasil kasar " + cur + " (" + d.days + " hari)"), h("b", null, fmtMoney(o.gross, cur)), h("small", null, o.count + " transaksi, bayaran balik " + fmtMoney(o.refunded, cur))));
          const days = Object.keys(o.daily).sort(), max = Math.max(1, ...Object.values(o.daily));
          out.push(h("div", {class: "chart"}, days.map(k => h("div", {class: "bar", title: k + ": " + fmtMoney(o.daily[k], cur), style: `height:${Math.max(4, Math.round(100 * o.daily[k] / max))}%`}))));
        }
        if (!Object.keys(d.summary).length) out.push(h("p", {class: "dim"}, "Tiada transaksi dalam tempoh ini."));
        out.push(h("h4", null, "Transaksi terkini"), h("table", {class: "tbl"}, h("tbody", null, d.recent.map(r => h("tr", null, h("td", null, new Date(r.created * 1000).toLocaleDateString(LOCALE())), h("td", null, r.desc || r.id), h("td", null, fmtMoney(r.amount, r.currency)), h("td", null, r.status))))));
        dash.replaceChildren(...out);
      } catch (e) { dash.replaceChildren(h("p", {class: "err"}, e.message)); }
    }
  };
  await draw();
};

PAGEFN.server = async root => {
  root.replaceChildren(card("Mod Pelayan (akan datang)", line("Aktifkan Mod Pelayan", toggle(false, () => toast("Mod Pelayan belum tersedia")), "Dimatikan: ciri ini belum dibina."),
    h("p", {class: "dim"}, "Matlamat: menjadikan peranti anda pelayan web (Apache/Nginx, Node.js, PHP, MySQL/PostgreSQL, tugas cron, WebSocket) dengan perlindungan seperti Cloudflare dan tembok api yang ketat. Peranti perlu dihidupkan 24/7."),
    h("p", {class: "note warn"}, "Nota lesen: cPanel/WHM ialah produk berlesen komersial dan tidak boleh disertakan percuma. FaqehOS akan menyediakan alternatif sumber terbuka (contohnya panel kawalan lain) dan memaklumkan jika lesen perlu dibeli oleh pengguna. Mendedahkan peranti rumah ke internet membawa risiko keselamatan; ciri ini akan dibina dengan teliti dan diuji sebelum dibuka.")));
};

PAGEFN.update = async root => {
  const res = h("div"), logBox = h("pre", {class: "rep hidden"});
  const check = async () => {
    res.replaceChildren(h("p", {class: "dim"}, "Menyemak…"));
    try {
      const r = await api("/update/check");
      if (!r.configured) return res.replaceChildren(h("p", {class: "note warn"}, r.message));
      res.replaceChildren(line("Versi terkini", r.latest || "—"), r.newer ? h("div", null, h("p", {class: "chip ok"}, "Versi baharu tersedia"), h("p", {class: "dim", style: "white-space:pre-wrap"}, r.notes),
        h("button", {class: "pri", onclick: async () => { if (!(await uiConfirm("Mulakan kemas kini FaqehOS sekarang? Pastikan komputer dipasang kuasa dan jangan matikan.", "Kemas kini"))) return;
          try { await api("/update/apply", {}); toast("Kemas kini dimulakan"); poll(); } catch (e) { fail(e); } }}, "Kemas kini sekarang")) : h("p", {class: "chip ok"}, "FaqehOS anda sudah terkini"));
    } catch (e) { res.replaceChildren(h("p", {class: "err"}, e.message)); }
  };
  const poll = async () => { logBox.classList.remove("hidden"); try { logBox.textContent = (await api("/update/log")).log || "(belum ada log)"; } catch (e) {} };
  root.replaceChildren(card("Kemas kini FaqehOS", line("Versi semasa", VERSION || "—"), h("div", {class: "row", style: "margin:10px 0"}, h("button", {class: "pri", onclick: check}, "Semak kemas kini"), h("button", {onclick: poll}, "Lihat log kemas kini")), res, logBox),
    card("Kemas kini automatik", h("p", {class: "dim"}, "Kemas kini keselamatan sistem, Blender, Flatpak dan Claude dijalankan secara automatik apabila ada internet dan ruang cakera. Kemas kini versi FaqehOS (shell dan servis) dimuat turun daripada keluaran rasmi pembangun.")));
};

PAGEFN.about = async root => {
  const donate = () => BRAND.donate_url ? openUrl(BRAND.donate_url) : modal("Sokong pembangun", h("p", null, "Pautan derma belum ditetapkan oleh pembangun. (Pembangun: tetapkan donate_url dalam branding.json dengan Stripe Payment Link; aktifkan FPX dan kad dalam Stripe untuk MYR.)"), [["Tutup", true, "pri"]]);
  const lic = [["Linux kernel", "GPL-2.0"], ["Debian GNU/Linux (pakej pelbagai)", "pelbagai lesen"], ["labwc, waybar", "GPL/MIT"], ["Chromium", "BSD-3-Clause"], ["Blender", "GPL-3.0+"], ["three.js", "MIT"], ["Babylon.js, Theatre.js", "Apache-2.0"], ["mpv", "GPL-2.0+"], ["Wine, Flatpak", "LGPL-2.1+"], ["ClamAV", "GPL-2.0"], ["CUPS", "Apache-2.0"]];
  root.replaceChildren(
    card("", h("div", {class: "aboutbox"}, h("img", {src: "logo_full.png", alt: "FaqehOS", class: "aboutlogo"}), h("div", null, h("h3", {style: "margin:0"}, "FaqehOS " + (VERSION || "")), h("p", {class: "dim"}, "Sistem pengendalian dengan AI di terasnya."),
      h("p", null, "© 2026 " + (BRAND.owner || "Smart al-Faqeh Empire") + ". Semua hak terpelihara.")))),
    card("Lesen", h("p", null, "FaqehOS percuma digunakan untuk kegunaan peribadi. Teks lesen penuh akan dikemas kini oleh pemilik (ruang simpanan: sila semak dengan penasihat undang-undang sebelum diedarkan)."),
      h("p", {class: "dim"}, "FaqehOS dibina di atas komponen sumber terbuka. Lesen asal setiap komponen kekal terpakai; kod sumber komponen berlesen GPL boleh diperoleh daripada repositori Debian atau projek masing-masing."),
      h("table", {class: "tbl"}, h("tbody", null, lic.map(([a, b]) => h("tr", null, h("td", null, a), h("td", null, b)))))),
    card("Sokong pembangun", h("p", {class: "dim"}, "Derma menyokong pembangunan FaqehOS. Pembayaran dibuat melalui Stripe (kad, FPX atau kaedah lain yang diaktifkan pembangun)."), h("button", {class: "gold", onclick: donate}, "💛 Derma / Sokong")));
};
