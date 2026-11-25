#!/usr/bin/env python3
"""FaqehOS Service: enjin AI, Make a Software, pengurus app, peranti dan jambatan Blender.

Hanya mendengar pada 127.0.0.1. Semua panggilan /api/* memerlukan token sesi
(ditulis ke $XDG_RUNTIME_DIR/faqehos.token) dan pengepala Host yang sah.
"""
import os, re, json, time, hmac, socket, hashlib, secrets, shutil, subprocess, threading, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import fileops, extras

PORT = int(os.environ.get("FAQEHOS_PORT", 7878))
ROOT = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get("FAQEHOS_HOME", Path.home()))
DATA = HOME / ".local/share/faqehos"
APPS, DRAFTS, APPDATA = DATA / "apps", DATA / "drafts", DATA / "appdata"
CONF = HOME / ".config/faqehos"
for d in (APPS, DRAFTS, APPDATA, CONF):
    d.mkdir(parents=True, exist_ok=True)
extras.init(CONF, DATA, HOME, ROOT)

RUNTIME = Path(os.environ.get("XDG_RUNTIME_DIR", CONF))
TOKEN = secrets.token_urlsafe(24)
(RUNTIME / "faqehos.token").write_text(TOKEN)
os.chmod(RUNTIME / "faqehos.token", 0o600)
BTOKEN_FILE = CONF / "blender.token"
if not BTOKEN_FILE.exists():
    BTOKEN_FILE.write_text(secrets.token_urlsafe(24))
    os.chmod(BTOKEN_FILE, 0o600)

ALLOWED_PERMS = {"ai", "storage", "printer", "blender", "network"}
ID_RE = re.compile(r"^[a-z0-9-]{3,60}$")
MODELS = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-4.1", "deepseek": "deepseek-chat", "ollama": "llama3.2", "kimi": "kimi-k2.6", "mock": "mock"}

BROWSER = "/opt/faqehos/bin/faqehos-browser"
WINDOW = "/opt/faqehos/shell/faqehos-window.py"
# id: (nama, ikon, jenis, arahan atau nama paparan)
SYSAPPS = {
    "chrome": ("Chrome", "🌐", "cmd", [BROWSER]),
    "docs": ("Google Docs", "📝", "cmd", [BROWSER, "--app=https://docs.google.com/document/"]),
    "sheets": ("Google Sheets", "📊", "cmd", [BROWSER, "--app=https://docs.google.com/spreadsheets/"]),
    "slides": ("Google Slides", "📽️", "cmd", [BROWSER, "--app=https://docs.google.com/presentation/"]),
    "drive": ("Google Drive", "☁️", "cmd", [BROWSER, "--app=https://drive.google.com/"]),
    "gmail": ("Gmail", "✉️", "cmd", [BROWSER, "--app=https://mail.google.com/"]),
    "claude": ("Claude", "🤖", "special", "claude"),
    "claudecode": ("Claude Code", "⌨️", "special", "claudecode"),
    "files": ("Fail", "📁", "view", "files"),
    "terminal": ("Terminal", "⌨️", "cmd", ["foot"]),
    "blender": ("Blender", "🧊", "cmd", ["/opt/faqehos/bin/faqehos-blender"]),
    "media": ("Pemain Media", "🎬", "cmd", ["mpv", "--player-operation-mode=pseudo-gui"]),
    "steam": ("Steam", "🎮", "cmd", ["sh", "-c", "command -v steam >/dev/null && exec steam || exec flatpak run com.valvesoftware.Steam"]),
    "winapps": ("App Windows", "🍷", "cmd", ["wine", "winefile"]),
    "store": ("Faqeh Store", "🛍️", "view", "store"),
    "myapps": ("My Faqeh App", "🧩", "view", "myapps"),
    "settings": ("Tetapan", "⚙️", "view", "settings"),
    "taskmgr": ("Pengurus Tugas", "📈", "view", "taskmgr"),
    "hello": ("Faqeh Hello", "💬", "view", "hello"),
    "installer": ("Pasang FaqehOS", "💿", "special", "installer"),
}
VIEWS = {"files", "store", "myapps", "settings", "app", "start", "power", "taskmgr", "ctxmenu", "hello"}
ALLOWED_LIBS = {"three", "babylon", "theatre"}
DEFAULT_PINS = ["sys:chrome", "sys:files", "sys:terminal", "sys:store", "sys:myapps", "sys:claude", "sys:settings"]
POWER = {"poweroff": ["systemctl", "poweroff"], "reboot": ["systemctl", "reboot"], "logout": ["labwc", "--exit"]}


class ApiError(Exception):
    def __init__(self, code, msg, upstream=None):
        super().__init__(msg)
        self.code = code
        self.upstream = upstream  # kod HTTP daripada penyedia AI (jika ada)


# ---------------------------------------------------------------- konfigurasi
DEFAULT_CHAIN = ["anthropic", "openai", "kimi", "deepseek", "ollama"]  # tertib kualiti lalai (terbaik dahulu)


def load_conf():
    c = {}
    try:
        c = json.loads((CONF / "config.json").read_text())
    except (OSError, ValueError):
        pass
    if "chain" not in c:  # naik taraf daripada format lama
        old_keys, old_models, old_p = c.get("keys", {}), c.get("models", {}), c.get("provider")
        order = ([old_p] if old_p in MODELS else []) + [x for x in DEFAULT_CHAIN if x != old_p]
        c["chain"] = [{"provider": x, "model": old_models.get(x, ""), "key": old_keys.get(x, ""),
                       "enabled": bool(old_keys.get(x)) or x in ("ollama", "mock") and old_p == x} for x in order]
    have = {e["provider"] for e in c["chain"]}
    for x in DEFAULT_CHAIN:  # penyedia baharu ditambah (dinyahaktifkan) pada konfigurasi lama
        if x not in have:
            c["chain"].append({"provider": x, "model": "", "key": "", "enabled": False})
    c.setdefault("doctor_auto", False)
    return c


def save_conf(c):
    p = CONF / "config.json"
    p.write_text(json.dumps(c, indent=2))
    os.chmod(p, 0o600)


COOLDOWN = {}  # provider -> masa (epoch) sehingga boleh dicuba semula


# ---------------------------------------------------------------- enjin AI
def _post(url, payload, headers, timeout=180):
    req = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise ApiError(502, f"Penyedia AI membalas {e.code}: {e.read().decode(errors='replace')[:300]}", upstream=e.code)
    except OSError as e:
        raise ApiError(502, f"Tidak dapat menghubungi penyedia AI: {e}")


def _call_provider(e, messages, system, kind, max_tokens):
    prov, key = e["provider"], e.get("key", "")
    model = e.get("model") or MODELS.get(prov, "")
    if prov == "mock":
        return mock_llm(messages, kind)
    if prov == "mockfail" and os.environ.get("FAQEHOS_TEST"):
        raise ApiError(502, "Penyedia AI membalas 429: quota exceeded", upstream=429)
    if prov == "anthropic":
        r = _post("https://api.anthropic.com/v1/messages",
                  {"model": model, "max_tokens": max_tokens, "system": system, "messages": messages},
                  {"x-api-key": key, "anthropic-version": "2023-06-01"})
        return "".join(b.get("text", "") for b in r.get("content", []))
    if prov in ("openai", "deepseek", "kimi"):
        url = {"openai": "https://api.openai.com/v1/chat/completions", "deepseek": "https://api.deepseek.com/chat/completions",
               "kimi": "https://api.moonshot.ai/v1/chat/completions"}[prov]
        r = _post(url, {"model": model, "messages": [{"role": "system", "content": system}] + messages},
                  {"Authorization": "Bearer " + key})
        return r["choices"][0]["message"]["content"]
    if prov == "ollama":
        r = _post("http://127.0.0.1:11434/api/chat",
                  {"model": model, "stream": False, "messages": [{"role": "system", "content": system}] + messages}, {})
        return r["message"]["content"]
    raise ApiError(400, "Penyedia tidak dikenali: " + str(prov))


def llm(messages, system, kind="ask", max_tokens=8000):
    """Cuba penyedia mengikut keutamaan. Jika kuota habis atau ralat, tukar ke penyedia seterusnya."""
    c = load_conf()
    now, errors, tried = time.time(), [], 0
    for e in c["chain"]:
        prov = e["provider"]
        if not e.get("enabled"):
            continue
        if prov not in ("ollama", "mock", "mockfail") and not e.get("key"):
            continue
        if COOLDOWN.get(prov, 0) > now:
            errors.append(f"{prov}: rehat sehingga {time.strftime('%H:%M', time.localtime(COOLDOWN[prov]))}")
            continue
        tried += 1
        try:
            return _call_provider(e, messages, system, kind, max_tokens)
        except ApiError as x:
            msg = str(x).lower()
            quota = x.upstream in (402, 429) or any(w in msg for w in ("quota", "credit", "insufficient", "rate limit", "billing"))
            auth = x.upstream in (401, 403)
            COOLDOWN[prov] = now + (3600 if quota else 6 * 3600 if auth else 120)
            errors.append(f"{prov}: {'kuota habis' if quota else 'kunci ditolak' if auth else str(x)[:120]}")
    if not tried and not errors:
        raise ApiError(400, "Tiada penyedia AI diaktifkan. Buka Tetapan → AI dan masukkan sekurang-kurangnya satu kunci API.")
    raise ApiError(502, "Semua penyedia AI gagal: " + "; ".join(errors))


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
    if kind == "doctor":
        return "[mod mock] Ringkasan: tiada masalah kritikal dalam diagnostik demo.\nMasalah: (tiada)\nCadangan: (tiada)"
    if kind == "bpy":
        return "```python\nimport bpy\nbpy.ops.mesh.primitive_cube_add(size=2)\nprint('Kubus ditambah')\n```"
    return "[mod mock] Anda bertanya: " + last[:200]


SYSTEM_ASK = "Anda ialah pembantu AI dalam FaqehOS. Jawab ringkas dalam bahasa yang sama dengan pengguna."

SDK_DOC = """window.os (sudah tersedia, tidak perlu import):
- await os.ai.ask(teks) -> string            [kebenaran: ai]
- await os.storage.get(kunci) -> nilai|null   [kebenaran: storage]
- await os.storage.set(kunci, nilaiJSON)      [kebenaran: storage]
- await os.printers.list() -> [nama]          [kebenaran: printer]
- await os.printers.print(nama, teks)         [kebenaran: printer]
- await os.blender.run(skripPython) -> {ok, output, error}  [kebenaran: blender]
- os.notify(mesej)                            [tiada kebenaran]

Pustaka 3D tempatan (tersedia luar talian). Senaraikan dalam "libs" pada manifest, kemudian guna terus:
- "three"   -> objek global THREE (three.js r128)
- "babylon" -> objek global BABYLON (Babylon.js)
- "theatre" -> objek global Theatre (Theatre.js core, untuk animasi)
Jangan tulis <script src> sendiri; FaqehOS memuatkannya.
"""

SYSTEM_GEN = """Anda ialah enjin 'Make a Software' dalam FaqehOS. Bina satu aplikasi berdasarkan permintaan pengguna.

""" + SDK_DOC + """
Format output MESTI tepat begini, tanpa teks lain:
===MANIFEST===
{"name":"Nama pendek","icon":"satu emoji","description":"satu ayat","permissions":["storage"],"libs":[]}
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
            "description": str(m.get("description", ""))[:200], "permissions": sorted(set(perms)), "version": 1,
            "libs": sorted({l for l in m.get("libs", []) if l in ALLOWED_LIBS})}


def validate_html(html):
    if len(html) > 400_000:
        raise ApiError(413, "App terlalu besar (maks 400 KB).")
    if "<html" not in html.lower() and "<body" not in html.lower():
        raise ApiError(502, "App yang dijana bukan HTML yang sah.")


RISKY = [(r"\beval\s*\(", "guna eval()"), (r"new\s+Function\s*\(", "guna new Function()"),
         (r"document\.write\s*\(", "guna document.write()"), (r"<iframe", "membenamkan iframe"),
         (r"window\.open\s*\(", "membuka tetingkap baharu"), (r"\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon", "cuba membuat permintaan rangkaian"),
         (r"atob\s*\(", "menyahkod base64 (kadangkala menyembunyikan kod)"), (r"<script[^>]+src\s*=", "memuatkan skrip luar"),
         (r"location\s*(\.href)?\s*=", "mengubah hala halaman")]


def scan_html(html):
    found = [msg for pat, msg in RISKY if re.search(pat, html, re.I)]
    return {"level": "tinggi" if len(found) >= 3 else "sederhana" if found else "rendah", "findings": found}


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
    return {"draft_id": app_id, "manifest": m, "scan": scan_html(html)}


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


def set_perms(app_id, granted):
    d = APPS / check_id(app_id)
    a = read_app(d)
    m = a["manifest"]
    m["granted"] = sorted({g for g in granted if g in m.get("permissions", [])})
    write_app(d, m, a["html"])
    return {"ok": True, "granted": m["granted"]}


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
    pkg = {"format": "faqehapp/1", "manifest": m, "html": a["html"], "sha256": pack_digest(m, a["html"])}
    out = HOME / "Dokumen"
    out.mkdir(exist_ok=True)
    path = out / (re.sub(r"[^\w-]+", "_", m["name"]) + ".faqehapp")
    path.write_text(json.dumps(pkg, ensure_ascii=False))
    return {"path": str(path)}


def import_app(pkg):
    try:
        pkg = json.loads(pkg) if isinstance(pkg, str) else pkg
        assert pkg["format"] == "faqehapp/1"
        m, html = pkg["manifest"], pkg["html"]
    except Exception:
        raise ApiError(400, "Fail .faqehapp tidak sah")
    if not hmac.compare_digest(pack_digest(m, html), str(pkg.get("sha256", ""))):
        raise ApiError(400, "Pakej rosak atau telah diubah (sha256 tidak sepadan)")
    validate_html(html)
    app_id = slug(m.get("name", "app"))
    cm = clean_manifest(m, app_id)
    cm["imported"] = True
    write_app(DRAFTS / app_id, cm, html)
    (DRAFTS / app_id / "prompt.json").write_text(json.dumps({"prompt": "(diimport)"}))
    return {"draft_id": app_id, "manifest": cm, "scan": scan_html(html)}


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


FM = fileops.FileManager(HOME)
INSTALLS = {}  # id Flatpak -> {"state": ..., "msg": ...}
_fp_cache = {"t": 0, "v": set()}


def spawn(cmd):
    try:
        subprocess.Popen(cmd, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        raise ApiError(500, f"Tidak dapat memulakan {cmd[0]}: {e}")
    return {"ok": True}


def open_view(view, app_id=None, page=None):
    if view not in VIEWS:
        raise ApiError(400, "Paparan tidak dikenali")
    cmd = [WINDOW, "--view", view]
    if page and re.fullmatch(r"[\w./ -]{1,200}", str(page)):
        cmd += ["--page", str(page)]
    if view == "app":
        m = read_app(APPS / check_id(app_id))["manifest"]
        cmd += ["--id", app_id, "--title", m["name"], "--appid", "faqehos-app-" + app_id]
    return spawn(cmd)


def catalog():
    return json.loads((Path(__file__).parent / "store_catalog.json").read_text())["apps"]


def fp_installed():
    if time.time() - _fp_cache["t"] < 4:
        return _fp_cache["v"]
    try:
        r = subprocess.run(["flatpak", "list", "--app", "--columns=application"], capture_output=True, text=True, timeout=15)
        v = {l.strip() for l in r.stdout.splitlines() if l.strip()}
    except (OSError, subprocess.SubprocessError):
        v = set()
    _fp_cache.update(t=time.time(), v=v)
    return v


def meta(key):
    kind, _, ident = key.partition(":")
    if kind == "sys" and ident in SYSAPPS:
        n, i = SYSAPPS[ident][0], SYSAPPS[ident][1]
        return {"key": key, "name": n, "icon": i, "kind": "sys"}
    if kind == "store":
        for c in catalog():
            if c["id"] == ident:
                return {"key": key, "name": c["name"], "icon": c["icon"], "kind": "store"}
    if kind == "app":
        try:
            m = json.loads((APPS / check_id(ident) / "manifest.json").read_text())
            return {"key": key, "name": m["name"], "icon": m["icon"], "kind": "app"}
        except (OSError, ValueError, ApiError):
            return None
    return None


def launcher():
    live = Path("/run/live").exists()
    base = [meta("sys:" + k) for k in SYSAPPS if k != "installer" or live]
    inst = fp_installed()
    store = [meta("store:" + c["id"]) for c in catalog() if c["id"] in inst]
    return {"apps": base + store, "myapps": [meta("app:" + a["id"]) for a in list_apps()]}


def open_key(key, page=None):
    kind, _, ident = str(key).partition(":")
    if kind == "sys" and ident in SYSAPPS:
        _, _, k, v = SYSAPPS[ident]
        if k == "special":
            return open_special(v)
        return open_view(v, page=page) if k == "view" else spawn(v)
    if kind == "store" and any(c["id"] == ident for c in catalog()):
        if ident not in fp_installed():
            raise ApiError(404, "App belum dipasang. Pasang dari Faqeh Store.")
        return spawn(["flatpak", "run", ident])
    if kind == "app":
        return open_view("app", ident)
    raise ApiError(404, "Aplikasi tidak dikenali")


def open_special(name):
    if name == "claude":
        if shutil.which("claude-desktop"):
            return spawn(["claude-desktop"])
        extras.claude_install("desktop")  # memerlukan internet; ralat jelas jika tiada
        return {"ok": True, "installing": True, "message": "Memasang Claude Desktop… Ini memerlukan internet dan ruang cakera. Cuba buka semula selepas beberapa minit."}
    if name == "claudecode":
        extras.claude_workspace()
        cmd = ('command -v claude >/dev/null 2>&1 && exec claude || { echo "Claude Code belum dipasang."; '
               'echo "Menyemak internet dan memasang versi terbaharu…"; curl -fsSL https://claude.ai/install.sh | bash && exec "$HOME/.local/bin/claude"; exec bash; }')
        return spawn(["foot", "-D", str(HOME / "Claude"), "sh", "-c", 'export PATH="$HOME/.local/bin:$PATH"; ' + cmd])
    if name == "installer":
        if not Path("/run/live").exists():
            raise ApiError(400, "Pemasang hanya tersedia dalam sesi live")
        return spawn(["sh", "-c", "sudo -E calamares"])
    raise ApiError(404, "Aplikasi tidak dikenali")


def open_url(url):
    url = str(url or "")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(:\d+)?(/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]*)?", url) or len(url) > 500:
        raise ApiError(400, "Hanya pautan https yang sah dibenarkan")
    return spawn([BROWSER, url])


def launch(name):  # keserasian ke belakang
    return open_key("sys:" + str(name))


def pins_get():
    try:
        keys = json.loads((CONF / "desktop.json").read_text())
    except (OSError, ValueError):
        keys = DEFAULT_PINS
    return [m for m in (meta(k) for k in keys) if m]


def pins_set(keys):
    keys = [k for k in keys if isinstance(k, str) and meta(k)][:60]
    (CONF / "desktop.json").write_text(json.dumps(keys))
    return {"ok": True}


def store_catalog():
    inst = fp_installed()
    return {"flatpak": shutil.which("flatpak") is not None,
            "apps": [{**c, "installed": c["id"] in inst, "state": INSTALLS.get(c["id"], {}).get("state"),
                      "msg": INSTALLS.get(c["id"], {}).get("msg", "")} for c in catalog()]}


def _install_job(fid):
    INSTALLS[fid] = {"state": "installing", "msg": ""}
    try:
        subprocess.run(["flatpak", "remote-add", "--user", "--if-not-exists", "flathub",
                        "https://dl.flathub.org/repo/flathub.flatpakrepo"], capture_output=True, timeout=60)
        r = subprocess.run(["flatpak", "install", "--user", "-y", "--noninteractive", "flathub", fid],
                           capture_output=True, text=True, timeout=3600)
        free = shutil.disk_usage(HOME).free // 1048576
        INSTALLS[fid] = {"state": "done" if r.returncode == 0 else "error",
                         "msg": extras.friendly_flatpak_error(r.stderr or r.stdout, free) if r.returncode else ""}
    except (OSError, subprocess.SubprocessError) as e:
        INSTALLS[fid] = {"state": "error", "msg": str(e)}
    _fp_cache["t"] = 0


def store_install(fid):
    if not any(c["id"] == fid for c in catalog()):
        raise ApiError(404, "App tidak dalam katalog Faqeh Store")
    if not shutil.which("flatpak"):
        raise ApiError(503, "Flatpak tidak dipasang pada sistem ini")
    if INSTALLS.get(fid, {}).get("state") == "installing":
        return {"ok": True}
    free = shutil.disk_usage(HOME).free // 1048576
    need = 1800  # MB: Flatpak memuat turun runtime (selalunya 500 MB hingga 1 GB) dan aplikasi
    if free < need:
        live = Path("/run/live").exists()
        raise ApiError(507, f"Ruang cakera tidak mencukupi: {free} MB bebas, sekurang-kurangnya {need} MB diperlukan. "
                       + ("Anda dalam sesi live (disimpan dalam RAM). Pasang FaqehOS ke cakera atau gunakan USB dengan persistence." if live else "Kosongkan ruang dahulu."))
    threading.Thread(target=_install_job, args=(fid,), daemon=True).start()
    return {"ok": True}


def store_remove(fid):
    if not any(c["id"] == fid for c in catalog()):
        raise ApiError(404, "App tidak dalam katalog Faqeh Store")
    r = subprocess.run(["flatpak", "uninstall", "--user", "-y", "--noninteractive", fid], capture_output=True, text=True, timeout=300)
    _fp_cache["t"] = 0
    INSTALLS.pop(fid, None)
    if r.returncode:
        raise ApiError(500, (r.stderr or r.stdout)[-200:])
    return {"ok": True}


# ---------------------------------------------------------------- keselamatan & Doktor
SECRET_RE = re.compile(r"(sk-[A-Za-z0-9_-]{10,}|[Bb]earer\s+[A-Za-z0-9._~+/-]{10,}|[A-Za-z0-9_-]{32,})")


def sanitize(t):
    return SECRET_RE.sub("[DISEMBUNYI]", t)


def _sh(cmd, n=4000, timeout=15):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return (r.stdout + r.stderr)[-n:]
    except (OSError, subprocess.SubprocessError) as e:
        return f"(gagal: {e})"


def collect_diag():
    parts = {"journal (amaran ke atas)": _sh(["journalctl", "-b", "-p", "warning", "--no-pager", "-n", "120"], 6000),
             "perkhidmatan gagal": _sh(["systemctl", "--failed", "--no-pager"], 1500),
             "memori": _sh(["free", "-m"], 600), "cakera": _sh(["df", "-h", "/", str(HOME)], 800),
             "beban": _sh(["uptime"], 200)}
    for name in ("service", "labwc", "waybar", "desktop", "cage", "shell", "health", "ai-tools"):
        f = HOME / (name + ".log")
        if f.exists():
            parts["log " + name] = f.read_text(errors="replace")[-2500:]
    return sanitize("\n\n".join(f"### {k}\n{v}" for k, v in parts.items()))


SYSTEM_DOCTOR = ("Anda ialah Doktor FaqehOS, ejen yang mencari bug dan masalah prestasi pada sistem FaqehOS (Debian, labwc, waybar, "
                 "servis Python, shell WebKit). Berdasarkan diagnostik, hasilkan laporan ringkas dalam bahasa Melayu: 1) Ringkasan keadaan, "
                 "2) Masalah yang ditemui mengikut keutamaan (tinggi/sederhana/rendah) dengan bukti daripada log, 3) Cadangan pembaikan "
                 "(arahan atau perubahan fail), 4) Perkara yang tidak dapat disimpulkan. Jangan reka maklumat yang tiada dalam log. "
                 "Anda hanya mencadangkan; pengguna yang memutuskan sama ada mahu melaksanakan.")


def doctor_run():
    diag = collect_diag()
    report = llm([{"role": "user", "content": "Diagnostik sistem:\n\n" + diag}], SYSTEM_DOCTOR, kind="doctor", max_tokens=3000)
    rec = {"ts": int(time.time()), "report": report}
    (DATA / "doctor-last.json").write_text(json.dumps(rec, ensure_ascii=False))
    return rec


def doctor_last():
    try:
        return json.loads((DATA / "doctor-last.json").read_text())
    except (OSError, ValueError):
        return {"ts": None, "report": ""}


def _doctor_loop():
    while True:
        time.sleep(3600)
        try:
            if load_conf().get("doctor_auto") and time.time() - (doctor_last().get("ts") or 0) > 86400:
                doctor_run()
        except Exception:
            pass


def security_status():
    def active(u):
        return _sh(["systemctl", "is-active", u], 50, 5).strip() == "active"
    db = [f for f in Path("/var/lib/clamav").glob("*.c[vl]d")] if Path("/var/lib/clamav").is_dir() else []
    aa = Path("/sys/module/apparmor/parameters/enabled")
    upd = Path("/var/lib/faqehos/last-update")
    return {"firewall": active("nftables"), "apparmor": aa.exists() and aa.read_text().strip() == "Y",
            "clamav_installed": shutil.which("clamscan") is not None,
            "clamav_db": max((f.stat().st_mtime for f in db), default=None),
            "auto_updates": active("faqehos-update.timer"),
            "last_update": upd.read_text().strip() if upd.exists() else None}


def security_scan(path):
    if not shutil.which("clamscan"):
        raise ApiError(503, "ClamAV tidak dipasang pada sistem ini")
    if not any(Path("/var/lib/clamav").glob("*.c[vl]d")):
        raise ApiError(503, "Pangkalan data virus belum dimuat turun. Sambung ke internet dan tunggu kemas kini automatik (beberapa minit selepas boot).")
    target = FM.safe(path)
    r = subprocess.run(["clamscan", "-r", "--infected", "--no-summary", "--max-filesize=100M", "--max-scansize=300M", str(target)],
                       capture_output=True, text=True, timeout=1800)
    infected = [l for l in r.stdout.splitlines() if l.endswith("FOUND")]
    return {"clean": r.returncode == 0, "infected": infected, "error": r.stderr[-300:] if r.returncode == 2 else ""}


def blender_run(script):
    tok = BTOKEN_FILE.read_text().strip()
    try:
        s = socket.create_connection(("127.0.0.1", 7879), timeout=3)
    except OSError:
        raise ApiError(503, "Blender belum dibuka. Buka Blender daripada FaqehOS dahulu.")
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
    last = Path("/var/lib/faqehos/last-update")
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
def config_public():
    c, now = load_conf(), time.time()
    return {"chain": [{"provider": e["provider"], "model": e.get("model", ""), "default_model": MODELS.get(e["provider"], ""),
                       "enabled": bool(e.get("enabled")), "has_key": bool(e.get("key")),
                       "cooldown_until": COOLDOWN.get(e["provider"], 0) if COOLDOWN.get(e["provider"], 0) > now else None}
                      for e in c["chain"]],
            "doctor_auto": bool(c.get("doctor_auto")), "meshy_has_key": bool(c.get("meshy_key"))}


def config_set(b):
    c = load_conf()
    old = {e["provider"]: e for e in c["chain"]}
    chain = []
    for e in b.get("chain", []):
        prov = e.get("provider")
        if prov not in MODELS and not (prov == "mockfail" and os.environ.get("FAQEHOS_TEST")):
            raise ApiError(400, "Penyedia tidak sah: " + str(prov))
        key = str(e.get("key") or "").strip() or old.get(prov, {}).get("key", "")
        chain.append({"provider": prov, "model": str(e.get("model", ""))[:80], "key": key, "enabled": bool(e.get("enabled"))})
        COOLDOWN.pop(prov, None)
    if chain:
        c["chain"] = chain
    if "doctor_auto" in b:
        c["doctor_auto"] = bool(b["doctor_auto"])
    if str(b.get("meshy_key") or "").strip():
        c["meshy_key"] = str(b["meshy_key"]).strip()[:200]  # ruang simpanan: integrasi penjanaan 3D menyusul
    save_conf(c)
    return {"ok": True}


def fm_route(m, op, q, b):
    g = lambda k, d="": (q.get(k) or [d])[0]
    if op == "places": return {"places": FM.places()}
    if op == "list": return FM.list(g("path", str(HOME)), g("hidden") == "1")
    if op == "mkdir": return FM.mkdir(b.get("parent"), b.get("name"))
    if op == "newfile": return FM.newfile(b.get("parent"), b.get("name"))
    if op == "rename": return FM.rename(b.get("path"), b.get("name"))
    if op == "paste": return FM.paste(b.get("paths", []), b.get("dest"), b.get("mode"))
    if op == "delete": return FM.delete(b.get("paths", []))
    if op == "restore": return FM.restore(b.get("names", []))
    if op == "empty-trash": return FM.empty_trash()
    if op == "undo": return FM.undo()
    if op == "redo": return FM.redo()
    if op == "open": return FM.open(b.get("path"), b.get("app"))
    raise ApiError(404, "Operasi fail tidak dikenali")


def dispatch(m, path, q, b):
    seg = path.strip("/").split("/")
    r = (m, seg[0], seg[1] if len(seg) > 1 else "")
    if r == ("GET", "config", ""): return config_public()
    if r == ("POST", "config", ""): return config_set(b)
    if r == ("GET", "system", ""): return {**system_info(), "security": security_status()}
    if r == ("GET", "prefs", ""): return {"prefs": extras.prefs_get(), "accents": extras.ACCENTS, "branding": extras.branding(), "version": extras.version()}
    if r == ("POST", "prefs", ""): return {"prefs": extras.prefs_set(b)}
    if r == ("GET", "account", ""): return extras.account()
    if r == ("GET", "sysinfo", ""): return extras.sysinfo()
    if r == ("GET", "powerprofile", ""): return extras.powerprofile()
    if r == ("POST", "powerprofile", ""): return extras.powerprofile(b.get("profile"))
    if r == ("GET", "net", "status"): return extras.net_status()
    if r == ("GET", "net", "scan"): return extras.net_scan()
    if r == ("POST", "net", "connect"): return extras.net_connect(b.get("ssid"), b.get("password"))
    if r == ("POST", "net", "disconnect"): return extras.net_disconnect()
    if r == ("POST", "net", "forget"): return extras.net_forget(b.get("ssid"))
    if r == ("GET", "proc", ""): return extras.proc_list()
    if r == ("POST", "proc", "kill"): return extras.proc_kill(b.get("pid"), bool(b.get("force")))
    if r == ("GET", "pay", "config"): return extras.pay_get()
    if r == ("POST", "pay", "config"): return extras.pay_set(b)
    if r == ("POST", "pay", "test"): return extras.pay_test()
    if r == ("GET", "pay", "dashboard"): return extras.pay_dashboard((q.get("days") or ["30"])[0])
    if r == ("GET", "update", "check"): return extras.update_check()
    if r == ("POST", "update", "apply"): return extras.update_apply()
    if r == ("GET", "update", "log"): return extras.update_log()
    if r == ("GET", "claude", "status"): return extras.claude_status()
    if r == ("POST", "claude", "install"): return extras.claude_install(b.get("what"))
    if r == ("POST", "apps", "perms"): return set_perms(b.get("id"), b.get("granted", []))
    if r == ("GET", "launcher", ""): return launcher()
    if r == ("GET", "desktop", ""): return {"pins": pins_get()}
    if r == ("POST", "desktop", ""): return pins_set(b.get("keys", []))
    if r == ("POST", "open", ""): return open_key(b.get("key"), b.get("page"))
    if r == ("POST", "openurl", ""): return open_url(b.get("url"))
    if r == ("GET", "store", "catalog"): return store_catalog()
    if r == ("POST", "store", "install"): return store_install(b.get("id"))
    if r == ("POST", "store", "remove"): return store_remove(b.get("id"))
    if r == ("POST", "doctor", "run"): return doctor_run()
    if r == ("GET", "doctor", "last"): return doctor_last()
    if r == ("GET", "security", "status"): return security_status()
    if r == ("POST", "security", "scan"): return security_scan(b.get("path", str(HOME)))
    if seg[0] == "fm" and len(seg) == 2: return fm_route(m, seg[1], q, b)
    if r == ("GET", "apps", ""): return {"apps": list_apps()}
    if r == ("POST", "apps", "generate"): return gen_app(b.get("prompt"), b.get("draft_id"))
    if r == ("POST", "apps", "install"): return install(b.get("draft_id"))
    if r == ("POST", "apps", "uninstall"): return uninstall(b.get("id"))
    if r == ("POST", "apps", "import"): return import_app(b.get("package"))
    if m == "GET" and seg[0] == "apps" and len(seg) == 3 and seg[1] == "draft":
        return {**read_app(DRAFTS / check_id(seg[2])), "scan": scan_html(read_app(DRAFTS / seg[2])["html"])}
    if m == "GET" and seg[0] == "apps" and len(seg) == 2: return read_app(APPS / check_id(seg[1]))
    if m == "POST" and seg[0] == "apps" and len(seg) == 3 and seg[2] == "export": return export_app(seg[1])
    if seg[0] == "data" and len(seg) == 2:
        if m == "GET": return app_data(seg[1], (q.get("key") or [""])[0])
        return app_data(seg[1], b.get("key", ""), b.get("value"), write=True)
    if r == ("POST", "ai", "ask"):
        return {"text": llm([{"role": "user", "content": str(b.get("prompt", ""))[:8000]}], SYSTEM_ASK)}
    if r == ("GET", "printers", ""): return {"printers": printers()}
    if r == ("POST", "print", ""): return print_text(b.get("printer"), b.get("text", ""))
    if r == ("POST", "launch", ""): return launch(b.get("name"))
    if r == ("POST", "blender", ""): return blender_run(str(b.get("script", ""))[:200_000])
    if r == ("POST", "blender", "ask"): return blender_ask(b.get("prompt", ""))
    if r == ("POST", "power", ""):
        if b.get("action") not in POWER:
            raise ApiError(400, "Tindakan tidak sah")
        subprocess.Popen(POWER[b["action"]])
        return {"ok": True}
    raise ApiError(404, "Laluan tidak dijumpai")


CTYPES = {".woff2": "font/woff2", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json"}


class H(BaseHTTPRequestHandler):
    server_version = "FaqehOS"

    def log_message(self, *a):
        pass

    def _send(self, code, obj=None, ctype="application/json", raw=None, extra=None):
        data = raw if raw is not None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass  # klien menutup sambungan lebih awal

    def static(self, p):
        f = (ROOT / p.lstrip("/")).resolve()
        if not (f.is_file() and ((ROOT / "shell") in f.parents or (ROOT / "sdk") in f.parents)):
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
        if not hmac.compare_digest(self.headers.get("X-FaqehOS-Token", ""), TOKEN):
            return self._send(401, {"error": "token tidak sah"})
        try:
            body = {}
            if m == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                if n > 2_000_000:
                    return self._send(413, {"error": "terlalu besar"})
                body = json.loads(self.rfile.read(n) or b"{}")
            self._send(200, dispatch(m, p[5:], parse_qs(u.query), body))
        except (ApiError, fileops.FMError) as e:
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
    threading.Thread(target=_doctor_loop, daemon=True).start()
    extras.claude_workspace()
    extras.apply_theme(extras.prefs_get()["accent"], signal=False)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"FaqehOS Service pada 127.0.0.1:{PORT}", flush=True)
    srv.serve_forever()
