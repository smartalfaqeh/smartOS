#!/usr/bin/env python3
"""Tetingkap SmartOS: memaparkan shell web (WebKitGTK) skrin penuh."""
import os, sys, time
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, Gdk, WebKit2

tok = os.path.join(os.environ.get("XDG_RUNTIME_DIR", os.path.expanduser("~/.config/smartos")), "smartos.token")
for _ in range(100):
    if os.path.exists(tok) and time.time() - os.path.getmtime(tok) < 60:
        break
    time.sleep(0.1)
token = open(tok).read().strip()

win = Gtk.Window(title="SmartOS")
win.fullscreen()
view = WebKit2.WebView()
view.set_background_color(Gdk.RGBA(0.02, 0.09, 0.11, 1))
view.get_settings().set_property("enable-developer-extras", False)
view.load_uri("http://127.0.0.1:7878/shell/index.html#" + token)
win.add(view)
win.connect("destroy", Gtk.main_quit)
win.show_all()
Gtk.main()
