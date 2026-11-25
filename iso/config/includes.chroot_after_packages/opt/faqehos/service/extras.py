"""FaqehOS: fungsi tambahan servis (tema/keutamaan, akaun, rangkaian, pengurus tugas, Stripe, kemas kini, ruang kerja Claude)."""
import os, re, json, time, shutil, socket, signal, subprocess, secrets, base64, threading
import urllib.request, urllib.error, urllib.parse
from pathlib import Path
from fileops import FMError

CONF = DATA = HOME = ROOT = None
UNITS = {"update": "faqehos-update.service", "aitools": "faqehos-ai-tools.service"}


def init(conf, data, home, root):
    global CONF, DATA, HOME, ROOT
    CONF, DATA, HOME, ROOT = Path(conf), Path(data), Path(home), Path(root)


def _write_private(p, obj):
    p = Path(p)
    p.write_text(json.dumps(obj, indent=2, ensure_ascii=False))
    os.chmod(p, 0o600)


def _read(p, default):
    try:
        return json.loads(Path(p).read_text())
    except (OSError, ValueError):
        return default


# ------------------------------------------------------------ jenama dan versi
def branding():
    b = {"owner": "Smart al-Faqeh Empire", "donate_url": "", "update_repo": "", "support_email": "", "homepage": ""}
    b.update(_read(Path(__file__).parent / "branding.json", {}))
    return b


def version():
    try:
        return (ROOT / "VERSION").read_text().strip()
    except OSError:
        return "0.0.0"


# ------------------------------------------------------------ keutamaan dan tema
ACCENTS = {  # nama: (utama, kedua, latar tajuk)
    "turquoise": ("#2de2d6", "#0aa7c4", "#0b3a45"), "emas": ("#f8cd3a", "#d99a00", "#3a3008"),
    "ungu": ("#b794ff", "#7c4dff", "#2a1b52"), "ros": ("#ff7ea8", "#e0457b", "#4a1730"),
    "zamrud": ("#5ef0a4", "#14b86a", "#0b3a26"), "samudera": ("#6ab7ff", "#2f7de1", "#0c2b52"),
}
PREF_DEFAULTS = {"lang": "ms", "accent": "turquoise", "anim": "full", "icon_size": "medium", "wallpaper": "aurora",
                 "intro": True, "clock24": True, "pay_enabled": False, "display_name": ""}
PREF_CHOICES = {"lang": ("ms", "en"), "accent": tuple(ACCENTS), "anim": ("full", "low", "off"),
                "icon_size": ("small", "medium", "large"), "wallpaper": ("aurora", "midnight", "forest", "dusk")}


def prefs_get():
    p = dict(PREF_DEFAULTS)
    p.update({k: v for k, v in _read(CONF / "prefs.json", {}).items() if k in PREF_DEFAULTS})
    return p


def prefs_set(patch):
    p = prefs_get()
    for k, v in (patch or {}).items():
        if k not in PREF_DEFAULTS:
            continue
        if k in PREF_CHOICES and v not in PREF_CHOICES[k]:
            raise FMError(400, f"Nilai tidak sah untuk {k}")
        if isinstance(PREF_DEFAULTS[k], bool):
            v = bool(v)
        if k == "display_name":
            v = str(v).strip()[:40]
        p[k] = v
    old = _read(CONF / "prefs.json", {}).get("accent")
    _write_private(CONF / "prefs.json", p)
    if p["accent"] != old:
        apply_theme(p["accent"])
    return p


def apply_theme(accent, signal=True):
    """Jana CSS waybar dan tema labwc mengikut warna pilihan, kemudian muat semula tanpa mengganggu prestasi."""
    a, b, title = ACCENTS.get(accent, ACCENTS["turquoise"])
    try:
        css = (ROOT / "desktop/waybar.css").read_text()
        css = re.sub(r"@define-color acc [^;]+;", f"@define-color acc {a};", css, count=1)
        (CONF / "waybar.css").write_text(css)
        tdir = HOME / ".local/share/themes/FaqehOS/labwc"
        tdir.mkdir(parents=True, exist_ok=True)
        base = Path("/usr/share/themes/FaqehOS/labwc/themerc")
        if base.exists():
            t = base.read_text().replace("#2de2d6", a).replace("#0aa7c4", b).replace("#0b3a45", title)
            (tdir / "themerc").write_text(t)
        if signal:
            subprocess.run(["pkill", "-USR2", "waybar"], timeout=3, capture_output=True)
            subprocess.run(["labwc", "--reconfigure"], timeout=3, capture_output=True)
    except (OSError, subprocess.SubprocessError):
        pass


# ------------------------------------------------------------ akaun dan ID Faqeh
def account():
    a = _read(CONF / "account.json", {})
    if not a.get("id"):
        raw = base64.b32encode(secrets.token_bytes(5)).decode().rstrip("=")  # 8 aksara, tiada 0/1/8/9
        a = {"id": f"FQ-{raw[:4]}-{raw[4:8]}", "created": int(time.time())}
        _write_private(CONF / "account.json", a)
    return {**a, "name": prefs_get()["display_name"] or os.environ.get("USER", "faqeh"), "username": os.environ.get("USER", "faqeh")}


# ------------------------------------------------------------ rangkaian (nmcli)
def _nm(args, inp=None, timeout=30):
    try:
        r = subprocess.run(["nmcli"] + args, input=inp, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise FMError(503, "NetworkManager tidak dipasang")
    except subprocess.TimeoutExpired:
        raise FMError(504, "Operasi rangkaian tamat masa")
    return r


def _split(line):
    return [x.replace("\\:", ":") for x in re.split(r"(?<!\\):", line)]


def net_status():
    r = _nm(["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "dev"], timeout=8)
    devs = []
    for line in r.stdout.splitlines():
        d, t, s, c = (_split(line) + ["", "", "", ""])[:4]
        if t in ("wifi", "ethernet"):
            devs.append({"device": d, "type": t, "state": s, "connection": c})
    ip = ""
    try:
        ip = subprocess.run(["sh", "-c", "hostname -I"], capture_output=True, text=True, timeout=3).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    online = False
    try:
        socket.create_connection(("1.1.1.1", 443), timeout=2).close(); online = True
    except OSError:
        pass
    return {"devices": devs, "ip": ip, "online": online}


def net_scan():
    r = _nm(["-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "yes"], timeout=25)
    seen = {}
    for line in r.stdout.splitlines():
        use, ssid, sig, sec = (_split(line) + ["", "", "", ""])[:4]
        if not ssid:
            continue
        item = {"ssid": ssid, "signal": int(sig or 0), "secure": bool(sec and sec != "--"), "active": use == "*"}
        if ssid not in seen or item["signal"] > seen[ssid]["signal"] or item["active"]:
            seen[ssid] = item
    return {"networks": sorted(seen.values(), key=lambda x: (not x["active"], -x["signal"]))}


def net_connect(ssid, password):
    ssid, password = str(ssid or ""), str(password or "")
    if not ssid or len(ssid) > 32 or "\n" in ssid:
        raise FMError(400, "SSID tidak sah")
    if password and not (8 <= len(password) <= 63) or "\n" in password:
        raise FMError(400, "Kata laluan Wi-Fi mestilah 8 hingga 63 aksara")
    args = ["--ask", "dev", "wifi", "connect", ssid] if password else ["dev", "wifi", "connect", ssid]
    r = _nm(args, inp=(password + "\n") if password else None, timeout=45)
    if r.returncode:
        msg = (r.stderr or r.stdout).strip().splitlines()[-1:] or ["Gagal bersambung"]
        raise FMError(400, "Gagal bersambung: " + msg[0][:160])
    return {"ok": True}


def net_disconnect():
    for d in net_status()["devices"]:
        if d["type"] == "wifi" and d["state"] == "connected":
            _nm(["dev", "disconnect", d["device"]], timeout=15)
    return {"ok": True}


def net_forget(ssid):
    r = _nm(["connection", "delete", "id", str(ssid)[:64]], timeout=15)
    return {"ok": r.returncode == 0}


# ------------------------------------------------------------ pengurus tugas
PROTECTED = {"labwc", "waybar", "Xwayland", "dbus-daemon", "systemd", "pipewire", "wireplumber"}


def _cpu_times():
    f = open("/proc/stat").readline().split()[1:]
    v = list(map(int, f)); return sum(v), v[3] + (v[4] if len(v) > 4 else 0)


def proc_list():
    t1, i1 = _cpu_times(); time.sleep(0.25); t2, i2 = _cpu_times()
    cpu = round(100 * (1 - (i2 - i1) / max(1, t2 - t1)), 1)
    mem = {}
    for line in open("/proc/meminfo"):
        k, v = line.split(":"); mem[k] = int(v.split()[0])
    total, avail = mem.get("MemTotal", 1), mem.get("MemAvailable", 0)
    uid = os.getuid()
    r = subprocess.run(["ps", "-u", str(uid), "-o", "pid=,pcpu=,rss=,comm=,args=", "--sort=-rss"], capture_output=True, text=True, timeout=5)
    procs = []
    for line in r.stdout.splitlines()[:200]:
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        pid, pcpu, rss, comm = parts[:4]
        args = parts[4] if len(parts) > 4 else comm
        name = comm
        m = re.search(r"faqehos-window\.py --view (\w+)", args)
        if m: name = {"files": "Fail", "store": "Faqeh Store", "myapps": "My Faqeh App", "settings": "Tetapan", "desktop": "Desktop", "app": "App pengguna", "taskmgr": "Pengurus Tugas"}.get(m.group(1), "Tetingkap FaqehOS")
        elif "faqehos_service.py" in args: name = "Servis FaqehOS"
        procs.append({"pid": int(pid), "name": name, "cpu": float(pcpu), "mem_mb": round(int(rss) / 1024, 1), "protected": comm in PROTECTED or "faqehos_service" in args})
    return {"cpu": cpu, "mem_total_mb": total // 1024, "mem_used_mb": (total - avail) // 1024, "load": os.getloadavg()[0], "procs": procs[:60]}


def proc_kill(pid, force=False):
    pid = int(pid)
    if pid <= 1:
        raise FMError(403, "Proses tidak boleh ditamatkan")
    p = Path(f"/proc/{pid}")
    if not p.exists() or p.stat().st_uid != os.getuid() or pid == os.getpid():
        raise FMError(403, "Proses tidak boleh ditamatkan")
    comm = (p / "comm").read_text().strip()
    if comm in PROTECTED:
        raise FMError(403, "Proses sistem ini dilindungi")
    os.kill(pid, signal.SIGKILL if force else signal.SIGTERM)
    return {"ok": True}


# ------------------------------------------------------------ maklumat sistem dan profil kuasa
def sysinfo():
    cpu = ""
    for line in open("/proc/cpuinfo"):
        if line.startswith("model name"):
            cpu = line.split(":", 1)[1].strip(); break
    mem = {k: int(v.split()[0]) for k, v in (l.split(":") for l in open("/proc/meminfo"))}
    du = shutil.disk_usage(HOME)
    gpu = ""
    try:
        gpu = subprocess.run(["sh", "-c", "cat /sys/class/drm/card*/device/uevent 2>/dev/null | grep -m1 DRIVER | cut -d= -f2"], capture_output=True, text=True, timeout=3).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    live = Path("/run/live").exists()
    return {"version": version(), "cpu": cpu, "cores": os.cpu_count(), "ram_mb": mem.get("MemTotal", 0) // 1024,
            "disk_total_gb": round(du.total / 1e9, 1), "disk_free_gb": round(du.free / 1e9, 1), "gpu_driver": gpu,
            "arch": os.uname().machine, "live": live, "hostname": os.uname().nodename}


def powerprofile(set_to=None):
    if set_to:
        if set_to not in ("power-saver", "balanced", "performance"):
            raise FMError(400, "Profil tidak sah")
        subprocess.run(["powerprofilesctl", "set", set_to], capture_output=True, timeout=5)
    try:
        cur = subprocess.run(["powerprofilesctl", "get"], capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        cur = ""
    return {"profile": cur, "available": bool(cur)}


# ------------------------------------------------------------ Stripe (Bayaran)
def _pay_file():
    return CONF / "pay.json"


def _mask(k):
    return (k[:7] + "…" + k[-4:]) if k and len(k) > 12 else ("•" * len(k))


def pay_get():
    p = _read(_pay_file(), {})
    return {"enabled": prefs_get()["pay_enabled"], "public_key": p.get("public_key", ""), "has_secret": bool(p.get("secret_key")),
            "secret_masked": _mask(p.get("secret_key", "")), "has_webhook": bool(p.get("webhook_secret")),
            "livemode": p.get("secret_key", "").startswith(("sk_live", "rk_live")), "donate_url": branding()["donate_url"]}


def pay_set(b):
    p = _read(_pay_file(), {})
    rules = {"public_key": ("pk_",), "secret_key": ("sk_", "rk_"), "webhook_secret": ("whsec_",)}
    for k, prefixes in rules.items():
        v = str(b.get(k) or "").strip()
        if not v:
            continue
        if not v.startswith(prefixes) or len(v) > 300 or re.search(r"\s", v):
            raise FMError(400, f"Format {k} tidak sah (mesti bermula dengan {' atau '.join(prefixes)})")
        p[k] = v
    if b.get("clear"):
        p = {}
    _write_private(_pay_file(), p)
    return pay_get()


def _stripe(path, params=None):
    key = _read(_pay_file(), {}).get("secret_key")
    if not key:
        raise FMError(400, "Kunci rahsia Stripe belum ditetapkan")
    url = "https://api.stripe.com/v1" + path + ("?" + urllib.parse.urlencode(params, doseq=True) if params else "")
    req = urllib.request.Request(url, headers={"Authorization": "Basic " + base64.b64encode((key + ":").encode()).decode(), "Stripe-Version": "2024-06-20"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: msg = json.loads(e.read())["error"]["message"]
        except Exception: msg = str(e.code)
        raise FMError(502, "Stripe: " + msg[:200])
    except OSError as e:
        raise FMError(502, f"Tidak dapat menghubungi Stripe: {e}")


def pay_test():
    b = _stripe("/balance")
    return {"ok": True, "livemode": b.get("livemode"), "available": b.get("available", []), "pending": b.get("pending", [])}


def pay_dashboard(days=30):
    days = max(1, min(int(days), 90))
    since = int(time.time()) - days * 86400
    bal = _stripe("/balance")
    charges, after = [], None
    for _ in range(3):
        params = {"limit": 100, "created[gte]": since}
        if after: params["starting_after"] = after
        page = _stripe("/charges", params)
        charges += page.get("data", [])
        if not page.get("has_more") or not page.get("data"):
            break
        after = page["data"][-1]["id"]
    out = {}
    for c in charges:
        if not c.get("paid") or c.get("status") != "succeeded":
            continue
        cur = c["currency"].upper()
        net = c["amount"] - c.get("amount_refunded", 0)
        o = out.setdefault(cur, {"gross": 0, "refunded": 0, "count": 0, "daily": {}})
        o["gross"] += c["amount"]; o["refunded"] += c.get("amount_refunded", 0); o["count"] += 1
        day = time.strftime("%Y-%m-%d", time.gmtime(c["created"]))
        o["daily"][day] = o["daily"].get(day, 0) + net
    recent = [{"id": c["id"], "amount": c["amount"], "currency": c["currency"].upper(), "created": c["created"], "status": c["status"],
               "desc": (c.get("description") or c.get("billing_details", {}).get("name") or "")[:60]} for c in charges[:10]]
    return {"days": days, "balance": {"available": bal.get("available", []), "pending": bal.get("pending", [])}, "summary": out, "recent": recent,
            "livemode": bal.get("livemode")}


# ------------------------------------------------------------ kemas kini FaqehOS
def _vt(s):
    m = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", str(s))
    return tuple(int(x or 0) for x in m.groups()) if m else None


def update_check():
    repo = branding()["update_repo"].strip()
    cur = version()
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repo):
        return {"current": cur, "configured": False, "message": "Repositori kemas kini belum ditetapkan oleh pembangun (branding.json → update_repo)."}
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/latest", headers={"User-Agent": "FaqehOS-updater", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise FMError(502, "GitHub membalas " + str(e.code) + (" (tiada keluaran awam lagi?)" if e.code == 404 else ""))
    except OSError as e:
        raise FMError(502, f"Tiada sambungan internet: {e}")
    tag = d.get("tag_name", "")
    lt, ct = _vt(tag), _vt(cur)
    return {"current": cur, "configured": True, "latest": tag, "newer": bool(lt and ct and lt > ct), "notes": (d.get("body") or "")[:1500],
            "url": d.get("html_url", ""), "published": d.get("published_at", "")}


def _systemctl_start(unit):
    r = subprocess.run(["systemctl", "start", "--no-block", unit], capture_output=True, text=True, timeout=10)
    if r.returncode:
        raise FMError(500, "Tidak dapat memulakan " + unit + ": " + (r.stderr or "").strip()[:160])


def update_apply():
    _systemctl_start(UNITS["update"])
    return {"ok": True}


def update_log():
    p = Path("/var/lib/faqehos/update.log")
    return {"log": p.read_text(errors="replace")[-2500:] if p.exists() else ""}


# ------------------------------------------------------------ ruang kerja dan alat Claude
WORKDIRS = {
    "input": "Fail yang mahu Claude baca atau analisis (dokumen, data, gambar). Jangan ubah fail asal di sini.",
    "arahan": "Arahan dan tugasan berstruktur untuk Claude (satu fail .md setiap tugasan).",
    "about": "Konteks tentang anda dan projek: siapa anda, matlamat, gaya penulisan, peraturan.",
    "md": "Nota Markdown, ringkasan dan draf kerja.",
    "bahan": "Bahan rujukan dan aset (templat, logo, contoh). Hanya dibaca.",
    "output": "Semua hasil kerja Claude. Claude menulis keputusan di sini sahaja.",
}
CLAUDE_MD = """# Ruang kerja Claude (FaqehOS)

Folder ini disediakan oleh FaqehOS supaya Claude bekerja dengan teratur.

| Folder | Peranan |
|---|---|
| `input/` | Fail yang perlu dibaca atau dianalisis. Jangan ubah. |
| `arahan/` | Arahan dan tugasan. Baca fail di sini dahulu. |
| `about/` | Konteks pengguna dan projek. Rujuk sebelum menulis. |
| `md/` | Nota dan draf Markdown. |
| `bahan/` | Bahan rujukan dan aset. Hanya baca. |
| `output/` | Letakkan SEMUA hasil di sini. |

## Peraturan
1. Baca `about/` dan `arahan/` sebelum memulakan tugas.
2. Jangan mengubah atau memadam apa-apa dalam `input/` dan `bahan/`.
3. Tulis semua hasil ke `output/` dengan nama fail yang jelas.
4. Jika arahan tidak jelas, tanya sebelum meneruskan.
"""


def claude_workspace():
    base = HOME / "Claude"
    base.mkdir(exist_ok=True)
    for d, desc in WORKDIRS.items():
        p = base / d
        p.mkdir(exist_ok=True)
        r = p / "README.md"
        if not r.exists():
            r.write_text(f"# {d}\n\n{desc}\n")
    c = base / "CLAUDE.md"
    if not c.exists():
        c.write_text(CLAUDE_MD)
    return str(base)


def _online(host="downloads.claude.ai"):
    try:
        socket.create_connection((host, 443), timeout=2.5).close(); return True
    except OSError:
        return False


def claude_status():
    code = HOME / ".local/bin/claude"
    ver = ""
    if code.exists():
        try: ver = subprocess.run([str(code), "--version"], capture_output=True, text=True, timeout=6).stdout.strip()
        except (OSError, subprocess.SubprocessError): ver = "?"
    st = _read(Path("/var/lib/faqehos/ai-tools.status"), {})
    log = HOME / "ai-tools.log"
    return {"workspace": str(HOME / "Claude"), "desktop": shutil.which("claude-desktop") is not None, "desktop_status": st.get("desktop", ""),
            "code": code.exists(), "code_version": ver, "online": _online(), "log": log.read_text(errors="replace")[-1500:] if log.exists() else ""}


_code_lock = threading.Lock()


def _code_job():
    with _code_lock, open(HOME / "ai-tools.log", "a") as lg:
        lg.write(f"== {time.strftime('%F %T')} Claude Code ==\n"); lg.flush()
        try:
            subprocess.run(["bash", "-c", "curl -fsSL https://claude.ai/install.sh | bash"], stdout=lg, stderr=lg, timeout=900)
        except (OSError, subprocess.SubprocessError) as e:
            lg.write(f"gagal: {e}\n")


def claude_install(what):
    if not _online():
        raise FMError(503, "Tiada akses internet ke Anthropic. Sambung ke internet dan cuba lagi.")
    if what == "code":
        if _code_lock.locked(): return {"ok": True, "running": True}
        threading.Thread(target=_code_job, daemon=True).start()
    elif what == "desktop":
        _systemctl_start(UNITS["aitools"])
    else:
        raise FMError(400, "Pilihan tidak sah")
    return {"ok": True}


# ------------------------------------------------------------ mesej ralat Flatpak yang mesra
def friendly_flatpak_error(msg, free_mb=None):
    m = msg.lower()
    if "not enough disk space" in m or "no space left" in m:
        return "Ruang cakera tidak mencukupi." + (f" Ruang bebas: {free_mb} MB." if free_mb is not None else "") + " Pasang FaqehOS ke cakera atau gunakan USB dengan persistence untuk memasang aplikasi."
    if "network" in m or "could not resolve" in m or "connection" in m or "timed out" in m:
        return "Tiada sambungan internet atau pelayan Flathub tidak dapat dicapai."
    lines = [l.strip() for l in msg.strip().splitlines() if l.strip()]
    return (lines[-1] if lines else "Ralat tidak diketahui")[:220]
