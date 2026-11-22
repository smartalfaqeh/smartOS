#!/usr/bin/env python3
"""Ujian automatik servis SmartOS (mod mock, tanpa rangkaian). Jalankan: python3 tests/selftest.py"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "iso/config/includes.chroot/opt/smartos"
home = tempfile.mkdtemp()
env = {**os.environ, "SMARTOS_HOME": home, "SMARTOS_PORT": "7899", "XDG_RUNTIME_DIR": home}
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
finally:
    srv.terminate()
print(f"\n{ok} lulus, {fail} gagal"); sys.exit(1 if fail else 0)
