#!/usr/bin/env python3
"""Ujian automatik servis FaqehOS (mod mock, tanpa rangkaian). Jalankan: python3 tests/selftest.py"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "iso/config/includes.chroot_after_packages/opt/faqehos"
home = tempfile.mkdtemp()
env = {**os.environ, "FAQEHOS_TEST": "1", "FAQEHOS_HOME": home, "FAQEHOS_PORT": "7899", "XDG_RUNTIME_DIR": home}
Path(home, ".config/faqehos").mkdir(parents=True)
Path(home, ".config/faqehos/config.json").write_text(json.dumps({"provider": "mock"}))
srv = subprocess.Popen([sys.executable, str(ROOT / "service/faqehos_service.py")], env=env, stdout=subprocess.DEVNULL)
time.sleep(1.2)
tok = Path(home, "faqehos.token").read_text()
B = "http://127.0.0.1:7899"
ok = fail = 0

def call(path, body=None, token=tok, host=None):
    h = {"X-FaqehOS-Token": token, "Content-Type": "application/json"}
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
    check("SDK dihidang", b"window.os" in urllib.request.urlopen(B + "/sdk/faqehos-sdk.js").read())
    try: urllib.request.urlopen(B + "/shell/../service/faqehos_service.py"); trav = False
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
    check("eksport .faqehapp", s == 200 and json.loads(pkg)["format"] == "faqehapp/1")
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
    check("token mod 600", oct(os.stat(Path(home, "faqehos.token")).st_mode & 0o777) == "0o600")
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

    # ---- desktop, launcher, My Faqeh App
    s_, r_ = call("/api/apps/generate", {"prompt": "app 3d"}); d2 = r_["draft_id"]
    check("imbasan keselamatan app disertakan", r_["scan"]["level"] in ("rendah", "sederhana", "tinggi"))
    call("/api/apps/install", {"draft_id": d2})
    l = call("/api/launcher")[1]
    check("launcher: app sistem + app pengguna berasingan", any(a["key"] == "sys:chrome" for a in l["apps"]) and l["myapps"][0]["key"] == "app:" + d2)
    check("pin lalai desktop", len(call("/api/desktop")[1]["pins"]) >= 5)
    call("/api/desktop", {"keys": ["sys:files", "app:" + d2, "sys:tidakwujud"]})
    check("pin app pengguna ke desktop (kunci tidak sah dibuang)", [p["key"] for p in call("/api/desktop")[1]["pins"]] == ["sys:files", "app:" + d2])
    check("buka app tidak dikenali ditolak", call("/api/open", {"key": "sys:rm"})[0] == 404)

    # ---- Faqeh Store
    cat_ = call("/api/store/catalog")[1]
    check("katalog Faqeh Store", len(cat_["apps"]) >= 10 and all("id" in a for a in cat_["apps"]))
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
    check("Doktor FaqehOS menjana laporan (mock)", rep[0] == 200 and "mock" in rep[1]["report"])
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
    check("skrip terminal (bash) sintaks sah", subprocess.run(["bash", "-n", str(I / "etc/faqehos/shell.sh")]).returncode == 0)
    check("tema boot: fail lengkap", all((I / "usr/share/plymouth/themes/faqehos" / f).exists() for f in ("logo.png", "glow.png", "spark.png", "faqehos.script", "faqehos.plymouth")))
    check("pustaka 3D tempatan (three, babylon, theatre)", all((ROOT / "sdk/lib" / f).stat().st_size > 50000 for f in ("three.min.js", "babylon.min.js", "theatre.min.js")))
    check("pustaka 3D dihidang oleh servis", b"THREE" in urllib.request.urlopen(B + "/sdk/lib/three.min.js").read(2_000_000))

    # ---- keutamaan, tema, akaun
    pr = call("/api/prefs")[1]
    check("keutamaan lalai (ms, turquoise, bayaran mati)", pr["prefs"]["lang"] == "ms" and pr["prefs"]["accent"] == "turquoise" and not pr["prefs"]["pay_enabled"] and len(pr["accents"]) == 6)
    check("keutamaan: nilai tidak sah ditolak", call("/api/prefs", {"lang": "fr"})[0] == 400 and call("/api/prefs", {"accent": "merah-jambu"})[0] == 400)
    check("keutamaan: tukar bahasa dan warna", call("/api/prefs", {"lang": "en", "accent": "emas"})[1]["prefs"]["lang"] == "en")
    css = (Path(home) / ".config/faqehos/waybar.css")
    check("tema: waybar.css dijana dengan warna pilihan", css.exists() and "@define-color acc #f8cd3a;" in css.read_text())
    call("/api/prefs", {"lang": "ms", "accent": "turquoise"})
    a1 = call("/api/account")[1]; a2 = call("/api/account")[1]
    import re as _re
    check("ID Faqeh: format FQ-XXXX-XXXX dan kekal", _re.fullmatch(r"FQ-[A-Z2-7]{4}-[A-Z2-7]{4}", a1["id"]) is not None and a1["id"] == a2["id"])
    # ---- sistem, kuasa, tugas
    si = call("/api/sysinfo")[1]
    check("maklumat sistem", si["version"] == "0.3.0" and si["ram_mb"] > 0 and "cpu" in si)
    check("profil kuasa tidak rosak tanpa powerprofilesctl", call("/api/powerprofile")[0] == 200)
    pl = call("/api/proc")[1]
    check("pengurus tugas: senarai proses + CPU/RAM", len(pl["procs"]) >= 1 and pl["mem_total_mb"] > 0 and 0 <= pl["cpu"] <= 100)
    check("pengurus tugas: proses bukan milik pengguna atau tidak wujud ditolak", call("/api/proc/kill", {"pid": 1})[0] == 403 and call("/api/proc/kill", {"pid": 99999999})[0] == 403)
    # ---- rangkaian (tiada nmcli dalam sandbox)
    check("rangkaian: tiada NetworkManager -> 503 jelas", call("/api/net/scan")[0] == 503 and call("/api/net/status")[0] in (200, 503))
    check("rangkaian: kata laluan Wi-Fi terlalu pendek ditolak", call("/api/net/connect", {"ssid": "x", "password": "123"})[0] in (400, 503))
    # ---- Stripe
    pg = call("/api/pay/config")[1]
    check("bayaran: dimatikan dan tiada kunci secara lalai", not pg["enabled"] and not pg["has_secret"])
    check("bayaran: format kunci salah ditolak", call("/api/pay/config", {"secret_key": "hello"})[0] == 400 and call("/api/pay/config", {"public_key": "sk_live_x"})[0] == 400)
    pg = call("/api/pay/config", {"public_key": "pk_test_abcdefghijklmnop", "secret_key": "rk_test_abcdefghijklmnopqrstuvwxyz", "webhook_secret": "whsec_abcdef123456"})[1]
    check("bayaran: kunci disimpan, rahsia disembunyikan", pg["has_secret"] and pg["has_webhook"] and "abcdefghijklmnopqrstuvwxyz" not in json.dumps(pg) and "whsec_abcdef123456" not in json.dumps(pg))
    check("bayaran: fail pay.json mod 600", oct(os.stat(Path(home) / ".config/faqehos/pay.json").st_mode & 0o777) == "0o600")
    check("bayaran: ujian sambungan tanpa internet -> ralat jelas (bukan kerosakan)", call("/api/pay/test", {})[0] == 502)
    check("bayaran: padam kunci", not call("/api/pay/config", {"clear": True})[1]["has_secret"])
    # ---- kemas kini
    uc = call("/api/update/check")[1]
    check("kemas kini: repositori belum ditetapkan -> configured=false", uc["configured"] is False and uc["current"] == "0.3.0")
    import sys as _sys; _sys.path.insert(0, str(ROOT / "service")); import extras as _ex
    check("kemas kini: perbandingan versi (v0.3.1 > 0.3.0, v0.10.0 > v0.9.9)", _ex._vt("v0.3.1") > _ex._vt("0.3.0") and _ex._vt("v0.10.0") > _ex._vt("v0.9.9") and _ex._vt("build-5") is None)
    # ---- Claude dan ruang kerja
    w = Path(home) / "Claude"
    check("ruang kerja Claude: 6 folder + CLAUDE.md", all((w / d).is_dir() for d in ("input", "arahan", "about", "md", "bahan", "output")) and (w / "CLAUDE.md").exists())
    cs = call("/api/claude/status")[1]
    check("status Claude", set(["desktop", "code", "online", "workspace"]) <= set(cs))
    check("pasang Claude tanpa internet -> 503 jelas", call("/api/claude/install", {"what": "code"})[0] == 503)
    check("buka app Claude tanpa pemasangan -> mesej jelas atau 503", call("/api/open", {"key": "sys:claude"})[0] in (200, 503))
    # ---- penolong
    check("mesej ralat Flatpak mesra (ruang tidak cukup)", "Ruang cakera tidak mencukupi" in _ex.friendly_flatpak_error("Failed to install: Not enough disk space to complete this operation", 539))
    check("buka URL: hanya https", call("/api/openurl", {"url": "http://evil.com"})[0] == 400 and call("/api/openurl", {"url": "javascript:alert(1)"})[0] == 400)
    cf = call("/api/config")[1]
    check("Kimi dalam rantaian + Meshy disimpan tanpa dipulangkan", any(e["provider"] == "kimi" for e in cf["chain"]) and call("/api/config", {"chain": [], "meshy_key": "msy_secret123"})[0] == 200 and call("/api/config")[1]["meshy_has_key"] and "msy_secret123" not in json.dumps(call("/api/config")[1]))
    check("pemasang tersembunyi dalam sesi bukan live", not any(a["key"] == "sys:installer" for a in call("/api/launcher")[1]["apps"]))
    # ---- aset
    lg = urllib.request.urlopen(B + "/shell/logo3d.html").read().decode()
    check("logo3d.html: tiada sumber luar, rujuk pustaka tempatan", "http://" not in lg and "https://" not in lg and "/sdk/lib/r147/three.min.js" in lg)
    check("pustaka r147 dan fon dihidang", all(urllib.request.urlopen(B + "/sdk/lib/r147/" + f).status == 200 for f in ("three.min.js", "UnrealBloomPass.js", "motion.js", "theatre-core-only.min.js", "fonts/orbitron-latin-900-normal.woff2")))
    left = []
    for fp in (ROOT.parent.parent.parent.parent).rglob("*"):
        if fp.is_file() and "sdk/lib" not in str(fp) and fp.suffix in (".py", ".js", ".html", ".json", ".sh", ".css", ".md", ".conf", ".yml", ".xml", ".service", ".timer", ".desc", ".script", ".ini", ".desktop", "") and "tests" not in fp.parts:
            try: txt = fp.read_text()
            except Exception: continue
            if _re.search(r"smartos|SmartOS", txt) and fp.name not in ("build.sh",):
                left.append(str(fp.name))
    check("jenama: tiada baki 'SmartOS' dalam kit (kecuali pembersihan build.sh)", not left or (print(left) or False))

finally:
    srv.terminate()
print(f"\n{ok} lulus, {fail} gagal"); sys.exit(1 if fail else 0)
