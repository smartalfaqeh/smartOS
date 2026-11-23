#!/usr/bin/env python3
"""Tetingkap SmartOS: memaparkan satu paparan shell (WebKitGTK). Setiap app = satu tetingkap (muncul pada taskbar).

--layer background   desktop (di belakang semua tetingkap, melalui gtk-layer-shell)
--layer overlay      menu mula / kuasa (lapisan atas skrin penuh, lutsinar)
--layer normal       tetingkap biasa
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

DEFAULTS = {  # paparan: (tajuk, lebar, tinggi, lapisan)
    "desktop": ("SmartOS Desktop", 1280, 800, "background"), "start": ("Menu Mula", 1280, 800, "overlay"),
    "power": ("Kuasa", 1280, 800, "overlay"), "files": ("Fail", 980, 640, "normal"),
    "store": ("Smart Store", 1000, 680, "normal"), "myapps": ("My Smart App", 980, 680, "normal"),
    "settings": ("Tetapan", 860, 700, "normal"), "app": ("App", 900, 640, "normal"),
}
ap = argparse.ArgumentParser()
ap.add_argument("--view", default="desktop"); ap.add_argument("--id", default="")
ap.add_argument("--title"); ap.add_argument("--appid"); ap.add_argument("--layer")
ap.add_argument("--intro", action="store_true"); ap.add_argument("--fullscreen", action="store_true")
a = ap.parse_args()
title, w, h, layer = DEFAULTS.get(a.view, DEFAULTS["files"])
title, layer = a.title or title, a.layer or layer
GLib.set_prgname(a.appid or "smartos-" + a.view)
GLib.set_application_name("SmartOS")

tok = os.path.join(os.environ.get("XDG_RUNTIME_DIR", os.path.expanduser("~/.config/smartos")), "smartos.token")
for _ in range(150):  # tunggu servis (maks ~15 saat)
    try:
        if os.path.exists(tok) and time.time() - os.path.getmtime(tok) < 3600:
            socket.create_connection(("127.0.0.1", 7878), timeout=0.3).close()
            break
    except OSError:
        pass
    time.sleep(0.1)
token = open(tok).read().strip()

win = Gtk.Window(title=title)
win.set_default_size(w, h)
transparent = layer == "overlay"
if transparent:
    vis = win.get_screen().get_rgba_visual()
    if vis:
        win.set_visual(vis)
    win.set_app_paintable(True)
use_ls = GtkLayerShell is not None and layer in ("background", "overlay") and GtkLayerShell.is_supported()
if use_ls:
    GtkLayerShell.init_for_window(win)
    GtkLayerShell.set_layer(win, GtkLayerShell.Layer.BACKGROUND if layer == "background" else GtkLayerShell.Layer.OVERLAY)
    for edge in (GtkLayerShell.Edge.TOP, GtkLayerShell.Edge.BOTTOM, GtkLayerShell.Edge.LEFT, GtkLayerShell.Edge.RIGHT):
        GtkLayerShell.set_anchor(win, edge, True)
    if layer == "background":
        GtkLayerShell.set_exclusive_zone(win, -1)
        GtkLayerShell.set_keyboard_mode(win, GtkLayerShell.KeyboardMode.ON_DEMAND)
    else:
        GtkLayerShell.set_keyboard_mode(win, GtkLayerShell.KeyboardMode.EXCLUSIVE)
elif a.fullscreen or layer == "background":
    win.set_decorated(False); win.maximize()
elif layer == "overlay":
    win.set_decorated(False); win.set_default_size(560, 640)

view = WebKit2.WebView()
view.set_background_color(Gdk.RGBA(0, 0, 0, 0) if transparent else Gdk.RGBA(0.02, 0.09, 0.11, 1))
view.get_settings().set_property("enable-developer-extras", False)
q = f"view={a.view}&t={token}" + (f"&id={a.id}" if a.id else "") + ("&intro=1" if a.intro else "")
view.load_uri("http://127.0.0.1:7878/shell/index.html?" + q)
view.connect("notify::title", lambda v, _p: Gtk.main_quit() if v.get_title() == "smartos:close" else None)
win.add(view)
win.connect("destroy", Gtk.main_quit)
win.show_all()
Gtk.main()
