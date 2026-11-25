#!/usr/bin/env python3
"""Tetingkap FaqehOS: memaparkan satu paparan shell (WebKitGTK). Setiap app = satu tetingkap (muncul pada taskbar).

Semua tetingkap OPAK (tiada tetingkap lutsinar skrin penuh, kerana ia menyebabkan serpihan dan skrin gelap dalam VM).
  background : desktop di belakang semua tetingkap (gtk-layer-shell)
  popup      : menu mula / kuasa / menu klik kanan (lapisan atas, saiz tetap)
  normal     : tetingkap biasa
"""
import argparse, os, socket, sys, time
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, Gdk, WebKit2, GLib
try:
    gi.require_version("GtkLayerShell", "0.1")
    from gi.repository import GtkLayerShell
except (ValueError, ImportError):
    GtkLayerShell = None

DEFAULTS = {  # paparan: (tajuk, lebar, tinggi, mod)
    "desktop": ("FaqehOS Desktop", 1280, 800, "background"), "start": ("Menu Mula", 620, 720, "popup-left"),
    "power": ("Kuasa", 340, 330, "popup-center"), "ctxmenu": ("Menu", 280, 350, "popup-left"),
    "files": ("Fail", 980, 640, "normal"), "store": ("Faqeh Store", 1000, 680, "normal"), "myapps": ("My Faqeh App", 980, 680, "normal"),
    "settings": ("Tetapan", 1000, 700, "normal"), "taskmgr": ("Pengurus Tugas", 760, 600, "normal"), "hello": ("Faqeh Hello", 720, 520, "normal"),
    "app": ("App", 900, 640, "normal"),
}
ap = argparse.ArgumentParser()
ap.add_argument("--view", default="desktop"); ap.add_argument("--id", default=""); ap.add_argument("--page", default="")
ap.add_argument("--title"); ap.add_argument("--appid"); ap.add_argument("--anchor", default="left")
ap.add_argument("--intro", action="store_true"); ap.add_argument("--fullscreen", action="store_true")
a = ap.parse_args()
title, w, h, mode = DEFAULTS.get(a.view, DEFAULTS["files"])
title = a.title or title
if mode == "popup-left" and a.anchor == "right":
    mode = "popup-right"
GLib.set_prgname(a.appid or "faqehos-" + a.view)
GLib.set_application_name("FaqehOS")

tok = os.path.join(os.environ.get("XDG_RUNTIME_DIR", os.path.expanduser("~/.config/faqehos")), "faqehos.token")
for _ in range(150):  # tunggu servis (maks ~15 saat)
    try:
        if os.path.exists(tok) and time.time() - os.path.getmtime(tok) < 86400:
            socket.create_connection(("127.0.0.1", 7878), timeout=0.3).close()
            break
    except OSError:
        pass
    time.sleep(0.1)
token = open(tok).read().strip()

win = Gtk.Window(title=title)
win.set_default_size(w, h)
ls = GtkLayerShell is not None and GtkLayerShell.is_supported() and mode != "normal"
if ls:
    L = GtkLayerShell
    L.init_for_window(win)
    if mode == "background":
        L.set_layer(win, L.Layer.BACKGROUND)
        for edge in (L.Edge.TOP, L.Edge.BOTTOM, L.Edge.LEFT, L.Edge.RIGHT):
            L.set_anchor(win, edge, True)
        L.set_exclusive_zone(win, -1)
        L.set_keyboard_mode(win, L.KeyboardMode.ON_DEMAND)
    else:
        L.set_layer(win, L.Layer.OVERLAY)
        L.set_keyboard_mode(win, L.KeyboardMode.EXCLUSIVE)
        if mode in ("popup-left", "popup-right"):
            side = L.Edge.LEFT if mode == "popup-left" else L.Edge.RIGHT
            L.set_anchor(win, L.Edge.BOTTOM, True); L.set_anchor(win, side, True)
            L.set_margin(win, L.Edge.BOTTOM, 54); L.set_margin(win, side, 8)
elif a.fullscreen or mode == "background":
    win.set_decorated(False); win.maximize()
elif mode.startswith("popup"):
    win.set_decorated(False); win.set_position(Gtk.WindowPosition.CENTER)

view = WebKit2.WebView()
view.set_background_color(Gdk.RGBA(0.02, 0.09, 0.11, 1))
view.get_settings().set_property("enable-developer-extras", False)
q = f"view={a.view}&t={token}" + (f"&id={a.id}" if a.id else "") + (f"&page={a.page}" if a.page else "") + ("&intro=1" if a.intro else "")
view.load_uri("http://127.0.0.1:7878/shell/index.html?" + q)
view.connect("notify::title", lambda v, _p: Gtk.main_quit() if v.get_title() == "faqehos:close" else None)
win.add(view)
win.connect("destroy", Gtk.main_quit)
win.show_all()
Gtk.main()
