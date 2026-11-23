"""SmartOS Bridge: jambatan antara SmartOS dan Blender.

Dijalankan oleh pembungkus smartos-blender (blender --python ...).
Mendengar pada 127.0.0.1:7879, menerima {"token","script"} dan menjalankan
skrip pada thread utama Blender. Token dikongsi melalui ~/.config/smartos/blender.token.
"""
import bpy, socket, threading, json, io, os, queue, traceback, contextlib, hmac

HOST, PORT = "127.0.0.1", 7879
_q = queue.Queue()
_started = False


def _token():
    with open(os.path.expanduser("~/.config/smartos/blender.token")) as f:
        return f.read().strip()


def _run(code):
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            exec(compile(code, "<smartos>", "exec"), {"bpy": bpy, "__name__": "__smartos__"})
        return {"ok": True, "output": out.getvalue()}
    except Exception:
        return {"ok": False, "output": out.getvalue(), "error": traceback.format_exc()}


def _pump():
    try:
        while True:
            code, box = _q.get_nowait()
            box["r"] = _run(code)
            box["ev"].set()
    except queue.Empty:
        pass
    return 0.1


def _handle(conn):
    with conn:
        try:
            req = json.loads(conn.makefile("rb").readline(4_000_000))
            if not hmac.compare_digest(str(req.get("token", "")), _token()):
                reply = {"ok": False, "error": "token tidak sah"}
            else:
                box = {"ev": threading.Event()}
                _q.put((str(req.get("script", "")), box))
                reply = box.get("r") if box["ev"].wait(60) else {"ok": False, "error": "tamat masa"}
                reply = reply or {"ok": False, "error": "tamat masa"}
        except Exception as e:
            reply = {"ok": False, "error": str(e)}
        conn.sendall((json.dumps(reply) + "\n").encode())


def _serve():
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((HOST, PORT))
    except OSError:
        return  # port sudah digunakan oleh Blender lain
    s.listen(4)
    while True:
        conn, _ = s.accept()
        threading.Thread(target=_handle, args=(conn,), daemon=True).start()


def register():
    global _started
    if _started:
        return
    _started = True
    threading.Thread(target=_serve, daemon=True).start()
    bpy.app.timers.register(_pump, persistent=True)


def unregister():
    pass


register()
