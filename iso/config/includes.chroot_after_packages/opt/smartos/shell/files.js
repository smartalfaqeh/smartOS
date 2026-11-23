"use strict";
/* Pengurus fail SmartOS. Bergantung pada penolong dalam app.js (h, api, toast, fail, uiPrompt, uiConfirm, ctxMenu, VIEWS). */
VIEWS.files = async function () {
  const root = $("#root"); root.className = "";
  const S = {cwd: "", items: [], sel: new Set(), anchor: -1, clip: null, hidden: false, mode: "list", filter: "", hist: [], hi: -1,
             canUndo: false, canRedo: false, trash: "", places: []};
  const join = (d, n) => (d.endsWith("/") ? d : d + "/") + n;
  const fmtSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB";
  const icon = it => it.dir ? "📁" : /^image\//.test(it.mime) ? "🖼️" : /^video\//.test(it.mime) ? "🎞️" : /^audio\//.test(it.mime) ? "🎵" : /pdf/.test(it.mime) ? "📕" : /\.(blend|glb|gltf|obj|fbx|stl)$/i.test(it.name) ? "🧊" : /zip|tar|gz|7z|rar/.test(it.mime + it.name) ? "🗜️" : "📄";
  const inTrash = () => S.cwd === S.trash;
  const visible = () => S.items.filter(i => !S.filter || i.name.toLowerCase().includes(S.filter.toLowerCase()));
  const selPaths = () => [...S.sel].map(n => join(S.cwd, n));

  const path = h("input", {class: "path", "aria-label": "Laluan", onkeydown: e => { if (e.key === "Enter") go(path.value); }});
  const filter = h("input", {placeholder: "Tapis…", style: "width:130px", oninput: e => { S.filter = e.target.value; render(); }});
  const side = h("div", {class: "side"}), files = h("div", {class: "files", tabindex: "0"}), stat = h("div", {class: "status"});
  const B = (label, fn, title) => h("button", {title, onclick: fn}, label);
  const bUndo = B("↶ Undo", () => act("/fm/undo"), "Ctrl+Z"), bRedo = B("↷ Redo", () => act("/fm/redo"), "Ctrl+Y");
  const bBack = B("←", () => nav(-1), "Kembali"), bFwd = B("→", () => nav(1), "Ke hadapan"), bUp = B("↑", () => S.parent && go(S.parent), "Folder atas");
  const bCut = B("✂ Potong", cut, "Ctrl+X"), bCopy = B("⧉ Salin", copy, "Ctrl+C"), bPaste = B("📋 Tampal", paste, "Ctrl+V"), bRen = B("✎ Namakan", rename, "F2"), bDel = B("🗑 Padam", del, "Delete");
  const bNew = B("＋ Baharu ▾", e => { const r = e.target.getBoundingClientRect(); ctxMenu(r.left, r.bottom + 4, [{label: "📁 Folder baharu", fn: newFolder}, {label: "📄 Fail baharu", fn: newFile}]); });
  const bRestore = B("↩ Pulihkan", restore), bEmpty = B("Kosongkan tong sampah", emptyTrash);
  const bView = B("☷ Paparan", () => { S.mode = S.mode === "list" ? "icons" : "list"; render(); });
  const bHid = B("👁 Fail tersembunyi", () => { S.hidden = !S.hidden; go(S.cwd, true); });
  root.append(h("div", {class: "fm"},
    h("div", {class: "tb"}, bBack, bFwd, bUp, path, filter, h("span", {class: "sep"}), bNew, bCut, bCopy, bPaste, bRen, bDel, h("span", {class: "sep"}), bUndo, bRedo, h("span", {class: "sep"}), bRestore, bEmpty, bView, bHid),
    h("div", {class: "body"}, side, files), stat));

  async function act(url, body = {}) {
    try { await api(url, body); } catch (e) { fail(e); }
    await go(S.cwd, true);
  }
  async function go(p, keep = false, noHist = false) {
    try {
      const r = await api("/fm/list?path=" + encodeURIComponent(p) + "&hidden=" + (S.hidden ? 1 : 0));
      if (!keep) S.sel.clear();
      else { const names = new Set(r.items.map(i => i.name)); S.sel = new Set([...S.sel].filter(n => names.has(n))); }
      Object.assign(S, {cwd: r.path, parent: r.parent, items: r.items, canUndo: r.can_undo, canRedo: r.can_redo});
      if (!noHist && !keep) { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(r.path); S.hi = S.hist.length - 1; }
      document.title = "Fail: " + r.path.split("/").pop();
      render();
    } catch (e) { fail(e); path.value = S.cwd; }
  }
  function nav(d) { const i = S.hi + d; if (i >= 0 && i < S.hist.length) { S.hi = i; go(S.hist[i], false, true); } }

  function render() {
    path.value = S.cwd;
    const items = visible(), t = inTrash();
    bUndo.disabled = !S.canUndo; bRedo.disabled = !S.canRedo; bBack.disabled = S.hi <= 0; bFwd.disabled = S.hi >= S.hist.length - 1; bUp.disabled = !S.parent;
    const n = S.sel.size;
    bCut.disabled = bCopy.disabled = bDel.disabled = n === 0 || t; bRen.disabled = n !== 1 || t;
    bPaste.disabled = !S.clip || t; bNew.disabled = t; bRestore.classList.toggle("hidden", !t); bEmpty.classList.toggle("hidden", !t);
    bRestore.disabled = n === 0;
    side.replaceChildren(...S.places.map(p => h("button", {class: S.cwd === p.path ? "cur" : "", onclick: () => go(p.path)}, (p.trash ? "" : "📁 ") + p.name)));
    const row = (it, idx) => ({it, idx});
    if (S.mode === "list") {
      files.replaceChildren(h("table", null, h("thead", null, h("tr", null, h("th", null, "Nama"), h("th", {style: "width:100px"}, "Saiz"), h("th", {style: "width:150px"}, "Diubah suai"))),
        h("tbody", null, items.map((it, idx) => h("tr", {class: (S.sel.has(it.name) ? "sel " : "") + (S.clip && S.clip.mode === "cut" && S.clip.paths.includes(join(S.cwd, it.name)) ? "cut" : ""), "data-n": it.name,
          onclick: e => pick(e, it, idx), ondblclick: () => openItem(it), oncontextmenu: e => ctx(e, it)},
          h("td", null, icon(it) + " " + it.name), h("td", null, it.dir ? "" : fmtSize(it.size)), h("td", null, new Date(it.mtime * 1000).toLocaleString("ms-MY", {dateStyle: "short", timeStyle: "short"})))))));
    } else {
      files.replaceChildren(h("div", {class: "icons"}, items.map((it, idx) => h("div", {class: "it" + (S.sel.has(it.name) ? " sel" : ""), title: it.name,
        onclick: e => pick(e, it, idx), ondblclick: () => openItem(it), oncontextmenu: e => ctx(e, it)}, h("i", null, icon(it)), it.name))));
    }
    files.oncontextmenu = e => { if (e.target === files || e.target.closest(".icons") === e.target) { e.preventDefault(); S.sel.clear(); render(); bgMenu(e); } };
    stat.replaceChildren(h("span", null, items.length + " item"), n ? h("span", null, n + " dipilih" + (n === 1 ? "" : " (" + fmtSize(S.items.filter(i => S.sel.has(i.name)).reduce((a, i) => a + i.size, 0)) + ")")) : null,
      S.clip ? h("span", null, (S.clip.mode === "cut" ? "Dipotong: " : "Disalin: ") + S.clip.paths.length) : null);
  }
  function pick(e, it, idx) {
    const items = visible();
    if (e.shiftKey && S.anchor >= 0) { const [a, b] = [Math.min(S.anchor, idx), Math.max(S.anchor, idx)]; if (!e.ctrlKey) S.sel.clear(); items.slice(a, b + 1).forEach(i => S.sel.add(i.name)); }
    else if (e.ctrlKey || e.metaKey) { S.sel.has(it.name) ? S.sel.delete(it.name) : S.sel.add(it.name); S.anchor = idx; }
    else { S.sel = new Set([it.name]); S.anchor = idx; }
    render();
  }
  function ctx(e, it) {
    e.preventDefault(); if (!S.sel.has(it.name)) { S.sel = new Set([it.name]); render(); }
    if (inTrash()) return ctxMenu(e.clientX, e.clientY, [{label: "↩ Pulihkan", fn: restore}]);
    const single = S.sel.size === 1;
    ctxMenu(e.clientX, e.clientY, [
      {label: "Buka", off: !single, fn: () => openItem(it)}, {label: "Buka dengan Chrome", off: !single || it.dir, fn: () => openWith(it, "chrome")},
      {label: "Buka dengan Blender", off: !single || it.dir, fn: () => openWith(it, "blender")}, {label: "Buka dengan Pemain Media", off: !single || it.dir, fn: () => openWith(it, "media")},
      {label: "Buka Terminal di sini", fn: () => openWith(it.dir ? it : {name: ""}, "terminal")}, "-",
      {label: "Potong", fn: cut}, {label: "Salin", fn: copy}, {label: "Tampal", off: !S.clip, fn: paste}, "-",
      {label: "Namakan semula", off: !single, fn: rename}, {label: "Padam", fn: del}]);
  }
  function bgMenu(e) { ctxMenu(e.clientX, e.clientY, [{label: "Tampal", off: !S.clip || inTrash(), fn: paste}, {label: "📁 Folder baharu", off: inTrash(), fn: newFolder}, {label: "📄 Fail baharu", off: inTrash(), fn: newFile}, "-", {label: "Segar semula", fn: () => go(S.cwd, true)}]); }
  async function openItem(it) { if (it.dir) return go(join(S.cwd, it.name)); try { await api("/fm/open", {path: join(S.cwd, it.name)}); } catch (e) { fail(e); } }
  async function openWith(it, app) { try { await api("/fm/open", {path: it.name ? join(S.cwd, it.name) : S.cwd, app}); } catch (e) { fail(e); } }
  function copy() { if (S.sel.size) { S.clip = {paths: selPaths(), mode: "copy"}; toast(S.sel.size + " item disalin"); render(); } }
  function cut() { if (S.sel.size) { S.clip = {paths: selPaths(), mode: "cut"}; toast(S.sel.size + " item dipotong"); render(); } }
  async function paste() {
    if (!S.clip || inTrash()) return;
    try { await api("/fm/paste", {paths: S.clip.paths, dest: S.cwd, mode: S.clip.mode}); if (S.clip.mode === "cut") S.clip = null; } catch (e) { fail(e); }
    await go(S.cwd, true);
  }
  async function del() {
    if (!S.sel.size || inTrash()) return;
    const n = S.sel.size; if (n > 5 && !(await uiConfirm("Alihkan " + n + " item ke tong sampah?", "Padam"))) return;
    await act("/fm/delete", {paths: selPaths()}); toast(n + " item dialihkan ke tong sampah (Ctrl+Z untuk batal)");
  }
  async function rename() { if (S.sel.size !== 1) return; const old = [...S.sel][0], nn = await uiPrompt("Nama baharu", old); if (nn && nn !== old) { await act("/fm/rename", {path: join(S.cwd, old), name: nn}); S.sel = new Set([nn]); render(); } }
  async function newFolder() { const n = await uiPrompt("Nama folder baharu", "Folder baharu"); if (n) await act("/fm/mkdir", {parent: S.cwd, name: n}); }
  async function newFile() { const n = await uiPrompt("Nama fail baharu", "Fail baharu.txt"); if (n) await act("/fm/newfile", {parent: S.cwd, name: n}); }
  async function restore() { if (S.sel.size) await act("/fm/restore", {names: [...S.sel]}); }
  async function emptyTrash() { if (await uiConfirm("Kosongkan tong sampah secara kekal? Ini tidak boleh dibatalkan.", "Kosongkan")) await act("/fm/empty-trash"); }

  addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input,textarea,dialog")) return;
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (c && k === "a") { e.preventDefault(); visible().forEach(i => S.sel.add(i.name)); render(); }
    else if (c && k === "c") { e.preventDefault(); copy(); } else if (c && k === "x") { e.preventDefault(); cut(); } else if (c && k === "v") { e.preventDefault(); paste(); }
    else if (c && k === "z") { e.preventDefault(); act("/fm/undo"); } else if (c && k === "y") { e.preventDefault(); act("/fm/redo"); }
    else if (c && e.shiftKey && k === "n") { e.preventDefault(); newFolder(); }
    else if (e.key === "Delete") del(); else if (e.key === "F2") rename(); else if (e.key === "F5") go(S.cwd, true);
    else if (e.key === "Enter" && S.sel.size === 1) openItem(S.items.find(i => S.sel.has(i.name)));
    else if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) S.parent && go(S.parent);
    else if (e.altKey && e.key === "ArrowLeft") nav(-1); else if (e.altKey && e.key === "ArrowRight") nav(1);
    else if (e.key === "Escape") { S.sel.clear(); render(); }
  });
  try { S.places = (await api("/fm/places")).places; S.trash = (S.places.find(p => p.trash) || {}).path || ""; } catch (e) { fail(e); }
  await go(Q.get("path") || (S.places[0] && S.places[0].path) || "/");
  files.focus();
};
