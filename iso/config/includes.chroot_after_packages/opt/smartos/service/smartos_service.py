#!/usr/bin/env python3
"""SmartOS Service: enjin AI, Make a Software, pengurus app, peranti dan jambatan Blender.

Hanya mendengar pada 127.0.0.1. Semua panggilan /api/* memerlukan token sesi
(ditulis ke $XDG_RUNTIME_DIR/smartos.token) dan pengepala Host yang sah.
"""
import os, re, json, time, hmac, socket, hashlib, secrets, shutil, subprocess, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("SMARTOS_PORT", 7878))
ROOT = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get("SMARTOS_HOME", Path.home()))
DATA = HOME / ".local/share/smartos"
APPS, DRAFTS, APPDATA = DATA / "apps", DATA / "drafts", DATA / "appdata"
CONF = HOME / ".config/smartos"
for d in (APPS, DRAFTS, APPDATA, CONF):
    d.mkdir(parents=True, exist_ok=True)

RUNTIME = Path(os.environ.get("XDG_RUNTIME_DIR", CONF))
TOKEN = secrets.token_urlsafe(24)
(RUNTIME / "smartos.token").write_text(TOKEN)
os.chmod(RUNTIME / "smartos.token", 0o600)
BTOKEN_FILE = CONF / "blender.token"
if not BTOKEN_FILE.exists():
    BTOKEN_FILE.write_text(secrets.token_urlsafe(24))
    os.chmod(BTOKEN_FILE, 0o600)

ALLOWED_PERMS = {"ai", "storage", "printer", "blender", "network"}
ID_RE = re.compile(r"^[a-z0-9-]{3,60}$")
MODELS = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-4.1", "deepseek": "deepseek-chat", "ollama": "llama3.2", "mock": "mock"}

LAUNCH = {
    "firefox": ["firefox-esr"],
    "writer": ["libreoffice", "--writer"],
    "calc": ["libreoffice", "--calc"],
    "impress": ["libreoffice", "--impress"],
    "blender": ["/opt/smartos/bin/smartos-blender"],
    "steam": ["sh", "-c", "command -v steam >/dev/null && exec steam || exec flatpak run com.valvesoftware.Steam"],
    "lutris": ["lutris"],
    "files": ["pcmanfm"],
    "terminal": ["foot"],
}
POWER = {"poweroff": ["systemctl", "poweroff"], "reboot": ["systemctl", "reboot"]}


class ApiError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


# ---------------------------------------------------------------- konfigurasi
def load_conf():
    c = {"provider": "anthropic", "models": {}, "keys": {}}
    try:
        c.update(json.loads((CONF / "config.json").read_text()))
    except (OSError, ValueError):
        pass
    return c


def save_conf(c):
    p = CONF / "config.json"
    p.write_text(json.dumps(c, indent=2))
    os.chmod(p, 0o600)


# ---------------------------------------------------------------- enjin AI
def _post(url, payload, headers, timeout=180):
    req = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise ApiError(502, f"Penyedia AI membalas {e.code}: {e.read().decode(errors='replace')[:300]}")
    except OSError as e:
        raise ApiError(502, f"Tidak dapat menghubungi penyedia AI: {e}")


def llm(messages, system, kind="ask", max_tokens=8000):
    c = load_conf()
    prov = c.get("provider", "anthropic")
    model = c.get("models", {}).get(prov) or MODELS.get(prov, "")
    key = c.get("keys", {}).get(prov, "")
    if prov == "mock":
        return mock_llm(messages, kind)
    if prov != "ollama" and not key:
        raise ApiError(400, "Kunci API belum ditetapkan. Buka Tetapan dan masukkan kunci untuk " + prov + ".")
    if prov == "anthropic":
        r = _post("https://api.anthropic.com/v1/messages",
                  {"model": model, "max_tokens": max_tokens, "system": system, "messages": messages},
                  {"x-api-key": key, "anthropic-version": "2023-06-01"})
        return "".join(b.get("text", "") for b in r.get("content", []))
    if prov in ("openai", "deepseek"):
        url = "https://api.openai.com/v1/chat/completions" if prov == "openai" else "https://api.deepseek.com/chat/completions"
        r = _post(url, {"model": model, "messages": [{"role": "system", "content": system}] + messages},
                  {"Authorization": "Bearer " + key})
        return r["choices"][0]["message"]["content"]
    if prov == "ollama":
        r = _post("http://127.0.0.1:11434/api/chat",
                  {"model": model, "stream": False, "messages": [{"role": "system", "content": system}] + messages}, {})
        return r["message"]["content"]
    raise ApiError(400, "Penyedia tidak dikenali: " + str(prov))


def mock_llm(messages, kind):
    last = messages[-1]["content"]
    if kind == "gen":
        title = re.sub(r"\s+", " ", last)[:28] or "App Demo"
        manifest = {"name": title, "icon": "🧪", "description": "App demo (mod mock)", "permissions": ["storage"]}
        html = ("<!doctype html><html><head><meta charset='utf-8'><title>Demo</title></head><body style='font-family:sans-serif;padding:24px'>"
                "<h1 id='t'>Demo</h1><button id='b'>Tambah</button><p id='n'>0</p><script>"
                "let n=0;const $=id=>document.getElementById(id);"
                "os.storage.get('n').then(v=>{n=v||0;$('n').textContent=n});"
                "$('b').onclick=()=>{n++;$('n').textContent=n;os.storage.set('n',n)};"
                "</script></body></html>")
        return "===MANIFEST===\n" + json.dumps(manifest, ensure_ascii=False) + "\n===HTML===\n" + html
    if kind == "bpy":
        return "```python\nimport bpy\nbpy.ops.mesh.primitive_cube_add(size=2)\nprint('Kubus ditambah')\n```"
    return "[mod mock] Anda bertanya: " + last[:200]


SYSTEM_ASK = "Anda ialah pembantu AI dalam SmartOS. Jawab ringkas dalam bahasa yang sama dengan pengguna."

SDK_DOC = """window.os (sudah tersedia, tidak perlu import):
- await os.ai.ask(teks) -> string            [kebenaran: ai]
- await os.storage.get(kunci) -> nilai|null   [kebenaran: storage]
- await os.storage.set(kunci, nilaiJSON)      [kebenaran: storage]
- await os.printers.list() -> [nama]          [kebenaran: printer]
- await os.printers.print(nama, teks)         [kebenaran: printer]
- await os.blender.run(skripPython) -> {ok, output, error}  [kebenaran: blender]
- os.notify(mesej)                            [tiada kebenaran]
"""

SYSTEM_GEN = """Anda ialah enjin 'Make a Software' dalam SmartOS. Bina satu aplikasi berdasarkan permintaan pengguna.

""" + SDK_DOC + """
Format output MESTI tepat begini, tanpa teks lain:
===MANIFEST===
{"name":"Nama pendek","icon":"satu emoji","description":"satu ayat","permissions":["storage"]}
===HTML===
<!doctype html>...fail HTML lengkap...

Peraturan:
- Satu fail HTML sahaja, CSS dan JS inline. Tiada CDN, tiada pustaka luar, tiada fetch/XHR ke luar.
- Guna window.os untuk ciri OS. Minta kebenaran paling minimum dalam "permissions" (hanya: ai, storage, printer, blender, network).
- Simpan data pengguna dengan os.storage, bukan localStorage.
- UI bersih, responsif, menyokong mod gelap dan terang. Guna bahasa yang sama dengan pengguna.
- Kendalikan ralat dan paparkan mesej yang jelas.
"""

SYSTEM_BPY = ("Anda menjana skrip Python untuk Blender (modul bpy). Pulangkan HANYA satu blok ```python. "
              "Skrip mesti selamat: jangan padam fail, jangan akses rangkaian, jangan guna os/subprocess. "
              "Guna print() untuk melaporkan apa yang dibuat.")


def parse_gen(text):
    m = re.search(r"===MANIFEST===\s*(\{.*?\})\s*===HTML===\s*(.*)", text, re.S)
    if not m:
        raise ApiError(502, "AI tidak memulangkan format app yang sah. Cuba lagi atau ubah prompt.")
    try:
        manifest = json.loads(m.group(1))
    except ValueError:
        raise ApiError(502, "Manifest daripada AI tidak sah.")
    html = re.sub(r"^```(?:html)?\s*|\s*```\s*$", "", m.group(2).strip())
    return manifest, html


def clean_manifest(m, app_id):
    perms = [p for p in m.get("permissions", []) if p in ALLOWED_PERMS]
    return {"id": app_id, "name": str(m.get("name", "App"))[:40] or "App", "icon": str(m.get("icon", "🧩"))[:4],
            "description": str(m.get("description", ""))[:200], "permissions": sorted(set(perms)), "version": 1}


def validate_html(html):
    if len(html) > 400_000:
        raise ApiError(413, "App terlalu besar (maks 400 KB).")
    if "<html" not in html.lower() and "<body" not in html.lower():
        raise ApiError(502, "App yang dijana bukan HTML yang sah.")


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "app"
    return f"{s}-{secrets.token_hex(2)}"


def check_id(i):
    if not isinstance(i, str) or not ID_RE.match(i):
        raise ApiError(400, "ID app tidak sah")
    return i


# ---------------------------------------------------------------- app
def read_app(d):
    return {"manifest": json.loads((d / "manifest.json").read_text()), "html": (d / "index.html").read_text()}


def write_app(d, manifest, html):
    d.mkdir(parents=True, exist_ok=True)
    (d / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    (d / "index.html").write_text(html)


def list_apps():
    out = []
    for d in sorted(APPS.iterdir()):
        try:
            out.append(json.loads((d / "manifest.json").read_text()))
        except (OSError, ValueError):
            pass
    return out


def gen_app(prompt, draft_id=None):
    prompt = str(prompt).strip()[:4000]
    if not prompt:
        raise ApiError(400, "Prompt kosong")
    if draft_id:
        old = read_app(DRAFTS / check_id(draft_id))
        orig = json.loads((DRAFTS / draft_id / "prompt.json").read_text())["prompt"]
        msgs = [{"role": "user", "content": orig},
                {"role": "assistant", "content": "===MANIFEST===\n" + json.dumps(old["manifest"], ensure_ascii=False) + "\n===HTML===\n" + old["html"]},
                {"role": "user", "content": "Ubah suai app itu: " + prompt + "\nKeluarkan semula MANIFEST dan HTML penuh dalam format yang sama."}]
        app_id = draft_id
    else:
        msgs, orig, app_id = [{"role": "user", "content": prompt}], prompt, None
    manifest, html = parse_gen(llm(msgs, SYSTEM_GEN, kind="gen"))
    validate_html(html)
    app_id = app_id or slug(manifest.get("name", "app"))
    m = clean_manifest(manifest, app_id)
    write_app(DRAFTS / app_id, m, html)
    (DRAFTS / app_id / "prompt.json").write_text(json.dumps({"prompt": orig}))
    return {"draft_id": app_id, "manifest": m}


def install(draft_id):
    src = DRAFTS / check_id(draft_id)
    if not src.exists():
        raise ApiError(404, "Draf tidak dijumpai")
    a = read_app(src)
    m = a["manifest"]
    m["granted"] = list(m["permissions"])
    m["installed"] = int(time.time())
    write_app(APPS / draft_id, m, a["html"])
    shutil.rmtree(src, ignore_errors=True)
    return {"ok": True, "manifest": m}


def uninstall(app_id):
    d = APPS / check_id(app_id)
    if not d.exists():
        raise ApiError(404, "App tidak dijumpai")
    shutil.rmtree(d)
    (APPDATA / (app_id + ".json")).unlink(missing_ok=True)
    return {"ok": True}


def pack_digest(manifest, html):
    return hashlib.sha256((json.dumps(manifest, sort_keys=True, ensure_ascii=False) + "\n" + html).encode()).hexdigest()


def export_app(app_id):
    a = read_app(APPS / check_id(app_id))
    m = {k: a["manifest"][k] for k in ("name", "icon", "description", "permissions", "version")}
    pkg = {"format": "smartapp/1", "manifest": m, "html": a["html"], "sha256": pack_digest(m, a["html"])}
    out = HOME / "Dokumen"
    out.mkdir(exist_ok=True)
    path = out / (re.sub(r"[^\w-]+", "_", m["name"]) + ".smartapp")
    path.write_text(json.dumps(pkg, ensure_ascii=False))
    return {"path": str(path)}


def import_app(pkg):
    try:
        pkg = json.loads(pkg) if isinstance(pkg, str) else pkg
        assert pkg["format"] == "smartapp/1"
        m, html = pkg["manifest"], pkg["html"]
    except Exception:
        raise ApiError(400, "Fail .smartapp tidak sah")
    if not hmac.compare_digest(pack_digest(m, html), str(pkg.get("sha256", ""))):
        raise ApiError(400, "Pakej rosak atau telah diubah (sha256 tidak sepadan)")
    validate_html(html)
    app_id = slug(m.get("name", "app"))
    cm = clean_manifest(m, app_id)
    cm["imported"] = True
    write_app(DRAFTS / app_id, cm, html)
    (DRAFTS / app_id / "prompt.json").write_text(json.dumps({"prompt": "(diimport)"}))
    return {"draft_id": app_id, "manifest": cm}


# ---------------------------------------------------------------- peranti & sistem
def printers():
    try:
        r = subprocess.run(["lpstat", "-e"], capture_output=True, text=True, timeout=5)
        return [l.strip() for l in r.stdout.splitlines() if l.strip()]
    except (OSError, subprocess.SubprocessError):
        return []


def print_text(printer, text):
    if printer not in printers():
        raise ApiError(404, "Printer tidak dijumpai")
    r = subprocess.run(["lp", "-d", printer], input=str(text)[:200_000].encode(), capture_output=True, timeout=30)
    if r.returncode:
        raise ApiError(500, r.stderr.decode(errors="replace")[:200])
    return {"ok": True}


def launch(name):
    if name not in LAUNCH:
        raise ApiError(404, "Aplikasi tidak dikenali")
    try:
        subprocess.Popen(LAUNCH[name], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        raise ApiError(500, f"Tidak dapat memulakan {name}: {e}")
    return {"ok": True}


def blender_run(script):
    tok = BTOKEN_FILE.read_text().strip()
    try:
        s = socket.create_connection(("127.0.0.1", 7879), timeout=3)
    except OSError:
        raise ApiError(503, "Blender belum dibuka. Buka Blender daripada SmartOS dahulu.")
    with s:
        s.settimeout(70)
        s.sendall((json.dumps({"token": tok, "script": script}) + "\n").encode())
        line = s.makefile("rb").readline()
    return json.loads(line or b'{"ok":false,"error":"Tiada jawapan daripada Blender"}')


def blender_ask(prompt):
    text = llm([{"role": "user", "content": str(prompt)[:4000]}], SYSTEM_BPY, kind="bpy")
    m = re.search(r"```(?:python)?\s*(.*?)```", text, re.S)
    code = (m.group(1) if m else text).strip()
    return {"script": code, "result": blender_run(code)}


def system_info():
    last = Path("/var/lib/smartos/last-update")
    ver = ""
    try:
        ver = subprocess.run(["sh", "-c", "flatpak info org.blender.Blender 2>/dev/null | grep -i '^ *Version' || blender --version 2>/dev/null | head -1"],
                             capture_output=True, text=True, timeout=8).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return {"blender": ver, "last_update": last.read_text().strip() if last.exists() else None}


def app_data(app_id, key=None, value=None, write=False):
    check_id(app_id)
    f = APPDATA / (app_id + ".json")
    try:
        d = json.loads(f.read_text())
    except (OSError, ValueError):
        d = {}
    if not write:
        return {"value": d.get(key)}
    d[str(key)[:100]] = value
    s = json.dumps(d)
    if len(s) > 1_000_000:
        raise ApiError(413, "Storan app penuh (maks 1 MB)")
    f.write_text(s)
    return {"ok": True}


# ---------------------------------------------------------------- penghala
def dispatch(m, path, q, b):
    seg = path.strip("/").split("/")
    r = (m, seg[0], seg[1] if len(seg) > 1 else "")
    if r == ("GET", "config", ""):
        c = load_conf(); p = c["provider"]
        return {"provider": p, "model": c["models"].get(p, MODELS.get(p, "")), "has_key": bool(c["keys"].get(p)), "providers": list(MODELS)}
    if r == ("POST", "config", ""):
        c = load_conf(); p = b.get("provider", c["provider"])
        if p not in MODELS:
            raise ApiError(400, "Penyedia tidak sah")
        c["provider"] = p
        if b.get("model"): c["models"][p] = str(b["model"])[:80]
        if b.get("key"): c["keys"][p] = str(b["key"]).strip()
        save_conf(c)
        return {"ok": True}
    if r == ("GET", "system", ""):
        return system_info()
    if r == ("GET", "apps", ""):
        return {"apps": list_apps()}
    if r == ("POST", "apps", "generate"):
        return gen_app(b.get("prompt"), b.get("draft_id"))
    if r == ("POST", "apps", "install"):
        return install(b.get("draft_id"))
    if r == ("POST", "apps", "uninstall"):
        return uninstall(b.get("id"))
    if r == ("POST", "apps", "import"):
        return import_app(b.get("package"))
    if m == "GET" and seg[0] == "apps" and len(seg) == 3 and seg[1] == "draft":
        return read_app(DRAFTS / check_id(seg[2]))
    if m == "GET" and seg[0] == "apps" and len(seg) == 2:
        return read_app(APPS / check_id(seg[1]))
    if m == "POST" and seg[0] == "apps" and len(seg) == 3 and seg[2] == "export":
        return export_app(seg[1])
    if seg[0] == "data" and len(seg) == 2:
        if m == "GET":
            return app_data(seg[1], (q.get("key") or [""])[0])
        return app_data(seg[1], b.get("key", ""), b.get("value"), write=True)
    if r == ("POST", "ai", "ask"):
        return {"text": llm([{"role": "user", "content": str(b.get("prompt", ""))[:8000]}], SYSTEM_ASK)}
    if r == ("GET", "printers", ""):
        return {"printers": printers()}
    if r == ("POST", "print", ""):
        return print_text(b.get("printer"), b.get("text", ""))
    if r == ("POST", "launch", ""):
        return launch(b.get("name"))
    if r == ("POST", "blender", ""):
        return blender_run(str(b.get("script", ""))[:200_000])
    if r == ("POST", "blender", "ask"):
        return blender_ask(b.get("prompt", ""))
    if r == ("POST", "power", ""):
        if b.get("action") not in POWER:
            raise ApiError(400, "Tindakan tidak sah")
        subprocess.Popen(POWER[b["action"]])
        return {"ok": True}
    raise ApiError(404, "Laluan tidak dijumpai")


CTYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".css": "text/css"}


class H(BaseHTTPRequestHandler):
    server_version = "SmartOS"

    def log_message(self, *a):
        pass

    def _send(self, code, obj=None, ctype="application/json", raw=None, extra=None):
        data = raw if raw is not None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def static(self, p):
        f = (ROOT / p.lstrip("/")).resolve()
        if not (f.is_file() and ((ROOT / "shell") in f.parents or f.parent == ROOT / "sdk")):
            return self._send(404, {"error": "tiada"})
        self._send(200, raw=f.read_bytes(), ctype=CTYPES.get(f.suffix, "application/octet-stream"))

    def route(self, m):
        if self.headers.get("Host", "").split(":")[0] not in ("127.0.0.1", "localhost"):
            return self._send(403, {"error": "host tidak dibenarkan"})
        u = urlparse(self.path)
        p = u.path
        if p == "/":
            return self._send(302, raw=b"", extra={"Location": "/shell/index.html"})
        if p.startswith(("/shell/", "/sdk/")):
            return self.static(p)
        if not p.startswith("/api/"):
            return self._send(404, {"error": "tiada"})
        if not hmac.compare_digest(self.headers.get("X-SmartOS-Token", ""), TOKEN):
            return self._send(401, {"error": "token tidak sah"})
        try:
            body = {}
            if m == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                if n > 2_000_000:
                    return self._send(413, {"error": "terlalu besar"})
                body = json.loads(self.rfile.read(n) or b"{}")
            self._send(200, dispatch(m, p[5:], parse_qs(u.query), body))
        except ApiError as e:
            self._send(e.code, {"error": str(e)})
        except (FileNotFoundError, ValueError):
            self._send(404, {"error": "tidak dijumpai atau data tidak sah"})
        except Exception as e:
            self._send(500, {"error": f"{type(e).__name__}: {e}"})

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"SmartOS Service pada 127.0.0.1:{PORT}", flush=True)
    srv.serve_forever()
