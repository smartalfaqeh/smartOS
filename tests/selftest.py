#!/usr/bin/env python3
"""Ujian automatik servis SmartOS (mod mock, tanpa rangkaian). Jalankan: python3 tests/selftest.py"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "iso/config/includes.chroot_after_packages/opt/smartos"
home = tempfile.mkdtemp()
env = {**os.environ, "SMARTOS_TEST": "1", "SMARTOS_HOME": home, "SMARTOS_PORT": "7899", "XDG_RUNTIME_DIR": home}
Path(home, ".config/smartos").mkdir(parents=True)
Path(home, ".config/smartos/config.json").write_text(json.dumps({"provider": "mock"}))
srv = subprocess.Popen([sys.executable, str(ROOT / "service/smartos_service.py")], env=env, stdout=subprocess.DEVNULL)
time.sleep(1.2)
tok = Path(home, "smartos.token").read_text()
B = "http://127.0.0.1:7899"
ok = fail = 0

def call(path, body=None, token=tok, host=None):
    h = {"X-SmartOS-Token": token, "Content-Type": "application/json"}
    if host: h["Host"] = host
    r = urllib.request.Request(B + path, json.dumps(body).encode() if body is not None else None, h)
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

def check(name, cond):
    global ok, fail
    ok += cond; fail += (not cond); print(("PASS " if cond else "FAIL ") + name)

try:
    check("tanpa token ditolak (401)", call("/api/apps", token="salah")[0] == 401)
    check("Host asing ditolak (403)", call("/api/apps", host="evil.com")[0] == 403)
    check("shell dihidang", urllib.request.urlopen(B + "/shell/index.html").status == 200)
    check("SDK dihidang", b"window.os" in urllib.request.urlopen(B + "/sdk/smartos-sdk.js").read())
    try: urllib.request.urlopen(B + "/shell/../service/smartos_service.py"); trav = False
    except urllib.error.HTTPError: trav = True
    check("path traversal ditolak", trav)
    s, r = call("/api/apps/generate", {"prompt": "app kaunter ringkas"})
    check("jana app (mock)", s == 200 and r["manifest"]["permissions"] == ["storage"]); d = r["draft_id"]
    s, r = call("/api/apps/generate", {"prompt": "tambah butang tolak", "draft_id": d})
    check("ubah suai draf", s == 200 and r["draft_id"] == d)
    check("app belum dipasang", call("/api/apps")[1]["apps"] == [])
    check("pasang app", call("/api/apps/install", {"draft_id": d})[0] == 200)
    apps = call("/api/apps")[1]["apps"]
    check("app muncul dalam senarai dengan kebenaran", len(apps) == 1 and apps[0]["granted"] == ["storage"])
    check("storan app tulis", call("/api/data/" + d, {"key": "n", "value": 5})[0] == 200)
    check("storan app baca", call("/api/data/" + d + "?key=n")[1]["value"] == 5)
    s, r = call("/api/apps/" + d + "/export", {}); pkg = Path(r["path"]).read_text()
    check("eksport .smartapp", s == 200 and json.loads(pkg)["format"] == "smartapp/1")
    s, r = call("/api/apps/import", {"package": pkg})
    check("import app (jadi draf, bukan terus dipasang)", s == 200 and r["manifest"]["imported"] and len(call("/api/apps")[1]["apps"]) == 1)
    bad = json.loads(pkg); bad["html"] += "<script>evil()</script>"
    check("pakej diubah ditolak", call("/api/apps/import", {"package": bad})[0] == 400)
    check("nyahpasang", call("/api/apps/uninstall", {"id": d})[0] == 200 and call("/api/apps")[1]["apps"] == [])
    check("data app dipadam", call("/api/data/" + d + "?key=n")[1]["value"] is None)
    check("AI ask (mock)", "mock" in call("/api/ai/ask", {"prompt": "hai"})[1]["text"])
    check("id app tidak sah ditolak", call("/api/apps/..%2Fx")[0] in (400, 404))
    check("blender tanpa Blender dibuka -> 503", call("/api/blender", {"script": "print(1)"})[0] == 503)
    check("launch tidak dikenali ditolak", call("/api/launch", {"name": "rm"})[0] == 404)
    check("power tidak sah ditolak", call("/api/power", {"action": "x"})[0] == 400)
    check("printers", call("/api/printers")[0] == 200)
    # fail token tidak boleh dibaca orang lain
    check("token mod 600", oct(os.stat(Path(home, "smartos.token")).st_mode & 0o777) == "0o600")
    # ---- rantaian penyedia AI: tukar bila kuota habis
    cfg = call("/api/config")[1]
    check("config senaraikan rantaian penyedia", [e["provider"] for e in cfg["chain"]][:1] == ["mock"])
    call("/api/config", {"chain": [{"provider": "mockfail", "enabled": True}, {"provider": "mock", "enabled": True}]})
    s_, r_ = call("/api/ai/ask", {"prompt": "uji"})
    check("penyedia pertama kuota habis -> tukar ke penyedia kedua", s_ == 200 and "mock" in r_["text"])
    cd = [e for e in call("/api/config")[1]["chain"] if e["provider"] == "mockfail"][0]
    check("penyedia yang habis kuota direhatkan", cd["cooldown_until"] is not None)
    call("/api/config", {"chain": [{"provider": "mockfail", "enabled": True}]})
    s_, r_ = call("/api/ai/ask", {"prompt": "uji"})
    check("semua penyedia gagal -> mesej ralat jelas", s_ == 502 and "kuota habis" in r_["error"])
    call("/api/config", {"chain": [{"provider": "mock", "enabled": True}, {"provider": "mockfail", "enabled": True}]})
    check("kunci API tidak pernah dipulangkan", "key" not in json.dumps(call("/api/config")[1]).replace("has_key", ""))

    # ---- desktop, launcher, My Smart App
    s_, r_ = call("/api/apps/generate", {"prompt": "app 3d"}); d2 = r_["draft_id"]
    check("imbasan keselamatan app disertakan", r_["scan"]["level"] in ("rendah", "sederhana", "tinggi"))
    call("/api/apps/install", {"draft_id": d2})
    l = call("/api/launcher")[1]
    check("launcher: app sistem + app pengguna berasingan", any(a["key"] == "sys:chrome" for a in l["apps"]) and l["myapps"][0]["key"] == "app:" + d2)
    check("pin lalai desktop", len(call("/api/desktop")[1]["pins"]) >= 5)
    call("/api/desktop", {"keys": ["sys:files", "app:" + d2, "sys:tidakwujud"]})
    check("pin app pengguna ke desktop (kunci tidak sah dibuang)", [p["key"] for p in call("/api/desktop")[1]["pins"]] == ["sys:files", "app:" + d2])
    check("buka app tidak dikenali ditolak", call("/api/open", {"key": "sys:rm"})[0] == 404)

    # ---- Smart Store
    cat_ = call("/api/store/catalog")[1]
    check("katalog Smart Store", len(cat_["apps"]) >= 10 and all("id" in a for a in cat_["apps"]))
    check("pasang ID di luar katalog ditolak", call("/api/store/install", {"id": "evil.App"})[0] == 404)

    # ---- pengurus fail
    H = Path(home).resolve(); (H / "uji").mkdir(); (H / "uji/a.txt").write_text("A"); (H / "uji/b.txt").write_text("B"); (H / "dest").mkdir()
    ls = call("/api/fm/list?path=" + str(H / "uji"))[1]
    check("fm: senarai folder", [i["name"] for i in ls["items"]] == ["a.txt", "b.txt"])
    check("fm: salin berbilang", call("/api/fm/paste", {"paths": [str(H/"uji/a.txt"), str(H/"uji/b.txt")], "dest": str(H/"dest"), "mode": "copy"})[0] == 200 and len(list((H/"dest").iterdir())) == 2)
    check("fm: salin ke tempat sama -> nama unik", call("/api/fm/paste", {"paths": [str(H/"uji/a.txt")], "dest": str(H/"uji"), "mode": "copy"})[0] == 200 and (H/"uji/a (salinan).txt").exists())
    check("fm: potong & tampal", call("/api/fm/paste", {"paths": [str(H/"uji/b.txt")], "dest": str(H/"dest"), "mode": "cut"})[0] in (200,) and (H/"dest/b (salinan).txt").exists() and not (H/"uji/b.txt").exists())
    check("fm: undo potong", call("/api/fm/undo", {})[0] == 200 and (H/"uji/b.txt").exists())
    check("fm: redo potong", call("/api/fm/redo", {})[0] == 200 and not (H/"uji/b.txt").exists())
    call("/api/fm/undo", {})
    check("fm: padam -> tong sampah", call("/api/fm/delete", {"paths": [str(H/"uji/a.txt")]})[0] == 200 and not (H/"uji/a.txt").exists() and (H/".local/share/Trash/files/a.txt").exists())
    check("fm: undo padam memulihkan", call("/api/fm/undo", {})[0] == 200 and (H/"uji/a.txt").read_text() == "A")
    check("fm: folder baharu", call("/api/fm/mkdir", {"parent": str(H/"uji"), "name": "Baru"})[0] == 200 and (H/"uji/Baru").is_dir())
    check("fm: namakan semula", call("/api/fm/rename", {"path": str(H/"uji/Baru"), "name": "Lama"})[0] == 200 and (H/"uji/Lama").is_dir())
    check("fm: fail baharu", call("/api/fm/newfile", {"parent": str(H/"uji"), "name": "n.txt"})[0] == 200)
    check("fm: konflik nama ditolak (409)", call("/api/fm/newfile", {"parent": str(H/"uji"), "name": "n.txt"})[0] == 409)
    check("fm: tidak boleh keluar kawasan (/etc)", call("/api/fm/list?path=/etc")[0] == 403)
    check("fm: traversal ../ ditolak", call("/api/fm/list?path=" + str(H) + "/../../etc")[0] == 403)
    os.symlink("/etc", H / "pautan")
    check("fm: pautan simbolik ke luar ditolak", call("/api/fm/list?path=" + str(H/"pautan"))[0] == 403)
    check("fm: padam di luar kawasan ditolak", call("/api/fm/delete", {"paths": ["/etc/hostname"]})[0] == 403)
    check("fm: nama dengan / ditolak", call("/api/fm/mkdir", {"parent": str(H), "name": "../x"})[0] == 400)
    check("fm: buka dengan app tak dibenarkan ditolak", call("/api/fm/open", {"path": str(H/"uji/a.txt"), "app": "rm -rf"})[0] == 400)
    check("fm: places", any(x["name"] == "Dokumen" for x in call("/api/fm/places")[1]["places"]))

    # ---- Doktor & keselamatan
    sec = call("/api/security/status")[1]
    check("status keselamatan", set(["firewall", "apparmor", "clamav_installed"]) <= set(sec))
    rep = call("/api/doctor/run", {})
    check("Doktor SmartOS menjana laporan (mock)", rep[0] == 200 and "mock" in rep[1]["report"])
    check("laporan Doktor disimpan", call("/api/doctor/last")[1]["ts"] is not None)
    check("imbas virus tanpa ClamAV -> 503 jelas", call("/api/security/scan", {"path": str(H)})[0] == 503)

    # ---- semakan fail konfigurasi desktop
    import xml.dom.minidom as X
    I = ROOT.parent.parent  # includes.chroot_after_packages
    json.load(open(ROOT / "desktop/waybar.json")); check("waybar.json sah", True)
    for f in ("rc.xml", "menu.xml"): X.parse(str(I / "etc/xdg/labwc" / f))
    check("labwc rc.xml dan menu.xml sah", True)
    sc = [str(x) for x in list((ROOT / "bin").glob("*")) + [I / "etc/xdg/labwc/autostart"]]
    check("skrip sh/bin sintaks sah", all(subprocess.run(["sh", "-n", f]).returncode == 0 for f in sc))
    check("skrip terminal (bash) sintaks sah", subprocess.run(["bash", "-n", str(I / "etc/smartos/shell.sh")]).returncode == 0)
    check("tema boot: fail lengkap", all((I / "usr/share/plymouth/themes/smartos" / f).exists() for f in ("logo.png", "name.png", "glow.png", "smartos.script", "smartos.plymouth")))
    check("pustaka 3D tempatan (three, babylon, theatre)", all((ROOT / "sdk/lib" / f).stat().st_size > 50000 for f in ("three.min.js", "babylon.min.js", "theatre.min.js")))
    check("pustaka 3D dihidang oleh servis", b"THREE" in urllib.request.urlopen(B + "/sdk/lib/three.min.js").read(2_000_000))

finally:
    srv.terminate()
print(f"\n{ok} lulus, {fail} gagal"); sys.exit(1 if fail else 0)
