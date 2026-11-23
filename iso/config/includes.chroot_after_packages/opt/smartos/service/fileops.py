"""Pengurus fail SmartOS: senarai, salin, potong/tampal, padam (tong sampah), undo/redo.

Semua laluan disahkan supaya kekal dalam akar yang dibenarkan (rumah, /media, /run/media, /mnt).
Setiap tindakan dipecahkan kepada langkah asas (mv/cp/mkdir/touch/trash); setiap langkah
memulangkan langkah songsangnya, jadi undo dan redo berfungsi untuk semua tindakan.
"""
import os, shutil, subprocess, time, mimetypes, threading
from pathlib import Path


class FMError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


class FileManager:
    def __init__(self, home):
        self.home = Path(home).resolve()
        self.roots = [self.home, Path("/media"), Path("/run/media"), Path("/mnt")]
        self.trash = self.home / ".local/share/Trash"
        self.undo_stack, self.redo_stack = [], []
        self.lock = threading.Lock()
        for d in ("files", "info"):
            (self.trash / d).mkdir(parents=True, exist_ok=True)

    # ---- keselamatan laluan
    def safe(self, p):
        if not isinstance(p, str) or "\x00" in p or not p:
            raise FMError(400, "Laluan tidak sah")
        rp = Path(os.path.realpath(p))
        if not any(rp == r or r in rp.parents for r in self.roots):
            raise FMError(403, "Laluan di luar kawasan yang dibenarkan")
        return rp

    def safe_leaf(self, p):
        """Untuk sasaran yang dipulihkan: pautan simbolik pada folder induk tidak boleh keluar akar."""
        p = Path(p)
        self.safe(str(p.parent))
        return p

    # ---- langkah asas
    def _unique(self, dest):
        dest = Path(dest)
        if not dest.exists() and not dest.is_symlink():
            return dest
        stem, suf, i = dest.stem, dest.suffix, 1
        while True:
            c = dest.with_name(f"{stem} (salinan{'' if i == 1 else ' ' + str(i)}){suf}")
            if not c.exists():
                return c
            i += 1

    def prim(self, p):
        k = p[0]
        if k == "mv":
            s, d = self.safe_leaf(p[1]), self.safe_leaf(p[2])
            if d.exists() or d.is_symlink():
                raise FMError(409, f"“{d.name}” sudah wujud")
            shutil.move(str(s), str(d))
            if self.trash / "files" in s.parents:
                (self.trash / "info" / (s.name + ".trashinfo")).unlink(missing_ok=True)
            return ("mv", str(d), str(s))
        if k == "cp":
            s, d = self.safe(p[1]), self.safe_leaf(p[2])
            if d.exists():
                raise FMError(409, f"“{d.name}” sudah wujud")
            if s.is_dir():
                shutil.copytree(s, d, symlinks=True)
            else:
                shutil.copy2(s, d)
            return ("trash", str(d))
        if k == "mkdir":
            d = self.safe_leaf(p[1])
            if d.exists() or d.is_symlink(): raise FMError(409, f"“{d.name}” sudah wujud")
            d.mkdir()
            return ("trash", str(d))
        if k == "touch":
            d = self.safe_leaf(p[1])
            if d.exists() or d.is_symlink(): raise FMError(409, f"“{d.name}” sudah wujud")
            with open(d, "x"):
                pass
            return ("trash", str(d))
        if k == "trash":
            s = self.safe_leaf(p[1])
            if not (s.exists() or s.is_symlink()):
                raise FMError(404, "Fail tiada")
            t = self._unique(self.trash / "files" / s.name)
            shutil.move(str(s), str(t))
            (self.trash / "info" / (t.name + ".trashinfo")).write_text(
                f"[Trash Info]\nPath={s}\nDeletionDate={time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
            return ("mv", str(t), str(s))
        raise FMError(400, "Langkah tidak dikenali")

    def _run(self, prims, into_undo=True):
        done = []
        try:
            for p in prims:
                done.append(self.prim(p))
        except Exception:
            for inv in reversed(done):  # batalkan separuh jalan
                try: self.prim(inv)
                except Exception: pass
            raise
        return done[::-1]

    def act(self, prims):
        with self.lock:
            inv = self._run(prims)
            if inv:
                self.undo_stack.append(inv); self.redo_stack.clear()
            return {"ok": True, "can_undo": True}

    def undo(self):
        with self.lock:
            if not self.undo_stack: raise FMError(400, "Tiada yang boleh dibatalkan")
            inv = self.undo_stack.pop()
            try: redo = self._run(inv)
            except Exception: self.undo_stack.append(inv); raise
            self.redo_stack.append(redo)
            return {"ok": True}

    def redo(self):
        with self.lock:
            if not self.redo_stack: raise FMError(400, "Tiada yang boleh diulang")
            fw = self.redo_stack.pop()
            try: inv = self._run(fw)
            except Exception: self.redo_stack.append(fw); raise
            self.undo_stack.append(inv)
            return {"ok": True}

    # ---- operasi peringkat tinggi
    def list(self, path, hidden=False):
        d = self.safe(path)
        if not d.is_dir(): raise FMError(400, "Bukan folder")
        out = []
        try:
            entries = list(os.scandir(d))
        except PermissionError:
            raise FMError(403, "Tiada kebenaran membaca folder ini")
        for e in entries:
            if e.name.startswith(".") and not hidden: continue
            try:
                st = e.stat(follow_symlinks=False); isdir = e.is_dir()
            except OSError:
                continue
            out.append({"name": e.name, "dir": isdir, "size": 0 if isdir else st.st_size, "mtime": int(st.st_mtime),
                        "mime": "" if isdir else (mimetypes.guess_type(e.name)[0] or ""), "link": e.is_symlink()})
        out.sort(key=lambda x: (not x["dir"], x["name"].lower()))
        return {"path": str(d), "parent": str(d.parent) if d != self.home and d.parent != d else None, "items": out,
                "can_undo": bool(self.undo_stack), "can_redo": bool(self.redo_stack)}

    def places(self):
        h = self.home
        names = [("Rumah", h), ("Dokumen", h / "Dokumen"), ("Muat turun", h / "Muat turun"), ("Gambar", h / "Gambar"),
                 ("Video", h / "Video"), ("Muzik", h / "Muzik")]
        out = []
        for n, p in names:
            p.mkdir(exist_ok=True) if p != h else None
            out.append({"name": n, "path": str(p)})
        for base in ("/media", "/run/media"):
            b = Path(base)
            if b.is_dir():
                for sub in b.iterdir():
                    if sub.is_dir() and sub.name == os.environ.get("USER", ""):
                        out += [{"name": "💾 " + x.name, "path": str(x)} for x in sub.iterdir() if x.is_dir()]
                    elif sub.is_dir():
                        out.append({"name": "💾 " + sub.name, "path": str(sub)})
        out.append({"name": "🗑 Tong sampah", "path": str(self.trash / "files"), "trash": True})
        return out

    def mkdir(self, parent, name):
        self._name(name); return self.act([("mkdir", str(self.safe(parent) / name))])

    def newfile(self, parent, name):
        self._name(name); return self.act([("touch", str(self.safe(parent) / name))])

    def rename(self, path, name):
        self._name(name); s = self.safe_leaf(path)
        return self.act([("mv", str(s), str(s.parent / name))])

    def paste(self, paths, dest, mode):
        d = self.safe(dest)
        if not d.is_dir(): raise FMError(400, "Destinasi bukan folder")
        prims = []
        for p in paths:
            s = self.safe_leaf(p)
            if mode == "cut":
                t = d / s.name
                if t == s: continue
                if s.is_dir() and (t == s or s in t.parents): raise FMError(400, "Tidak boleh pindah folder ke dalam dirinya")
                prims.append(("mv", str(s), str(self._unique(t))))
            else:
                if s.is_dir() and s in d.parents: raise FMError(400, "Tidak boleh salin folder ke dalam dirinya")
                prims.append(("cp", str(s), str(self._unique(d / s.name))))
        return self.act(prims) if prims else {"ok": True}

    def delete(self, paths):
        return self.act([("trash", str(self.safe_leaf(p))) for p in paths])

    def restore(self, names):
        prims = []
        for n in names:
            tp = self.safe_leaf(self.trash / "files" / n)
            info = self.trash / "info" / (n + ".trashinfo")
            orig = None
            if info.exists():
                for line in info.read_text().splitlines():
                    if line.startswith("Path="): orig = line[5:]
            if not orig: raise FMError(404, "Lokasi asal tidak diketahui")
            prims.append(("mv", str(tp), str(self._unique(Path(orig)))))
        return self.act(prims)

    def empty_trash(self):
        with self.lock:
            for sub in ("files", "info"):
                for x in (self.trash / sub).iterdir():
                    shutil.rmtree(x) if x.is_dir() and not x.is_symlink() else x.unlink()
            self.undo_stack.clear(); self.redo_stack.clear()
        return {"ok": True}

    def _name(self, name):
        if not name or "/" in name or name in (".", "..") or "\x00" in name or len(name) > 200:
            raise FMError(400, "Nama tidak sah")

    # ---- buka
    OPENWITH = {
        "chrome": ["/opt/smartos/bin/smartos-browser"],
        "blender": ["/opt/smartos/bin/smartos-blender"],
        "media": ["mpv", "--player-operation-mode=pseudo-gui", "--"],
    }

    def open(self, path, app=None):
        p = self.safe(path)
        if app == "terminal":
            cmd = ["foot", "-D", str(p if p.is_dir() else p.parent)]
        elif app in self.OPENWITH:
            cmd = self.OPENWITH[app] + [str(p)]
        elif app is None:
            cmd = ["xdg-open", str(p)]
        else:
            raise FMError(400, "Aplikasi tidak dibenarkan")
        try:
            subprocess.Popen(cmd, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError as e:
            raise FMError(500, f"Tidak dapat membuka: {e}")
        return {"ok": True}
