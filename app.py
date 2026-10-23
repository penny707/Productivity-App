# app.py
# Lokale productivity app server - Python standaardbibliotheek only.
# Start met: python app.py
# Open daarna http://127.0.0.1:8765 in je browser.

import json
import os
import sqlite3
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# ----------------------------------------------------------------------------
# Configuratie
# ----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")
HOST = "127.0.0.1"
PORT = 8765

TAAK_TYPES = {"opdracht", "theorie", "labo"}


# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS vakken (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            naam TEXT NOT NULL,
            kleur TEXT NOT NULL DEFAULT '#4F7CAC',
            volgorde INTEGER NOT NULL DEFAULT 0,
            aangemaakt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS onderdelen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vak_id INTEGER NOT NULL REFERENCES vakken(id) ON DELETE CASCADE,
            parent_id INTEGER REFERENCES onderdelen(id) ON DELETE CASCADE,
            titel TEXT NOT NULL,
            volgorde INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS taken (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            onderdeel_id INTEGER NOT NULL REFERENCES onderdelen(id) ON DELETE CASCADE,
            titel TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'opdracht',
            klaar INTEGER NOT NULL DEFAULT 0,
            deadline TEXT,
            streefdatum TEXT,
            volgorde INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS instellingen (
            sleutel TEXT PRIMARY KEY,
            waarde TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_onderdelen_vak ON onderdelen(vak_id);
        CREATE INDEX IF NOT EXISTS idx_onderdelen_parent ON onderdelen(parent_id);
        CREATE INDEX IF NOT EXISTS idx_taken_onderdeel ON taken(onderdeel_id);
        """
    )
    # Standaardinstellingen
    defaults = {
        "thema": "grey",
        "sidebar_ingeklapt": "0",
    }
    for k, v in defaults.items():
        cur.execute(
            "INSERT OR IGNORE INTO instellingen (sleutel, waarde) VALUES (?, ?)",
            (k, v),
        )
    conn.commit()
    conn.close()


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def lees_json(handler):
    length = int(handler.headers.get("Content-Length", 0) or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


def stuur_json(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def stuur_fout(handler, status, bericht):
    stuur_json(handler, {"fout": bericht}, status=status)


# ----------------------------------------------------------------------------
# API logica
# ----------------------------------------------------------------------------
def api_vakken(handler, methode, pad_delen, body):
    conn = get_conn()
    cur = conn.cursor()

    # /api/vakken
    if len(pad_delen) == 2:
        if methode == "GET":
            cur.execute("SELECT * FROM vakken ORDER BY volgorde, id")
            stuur_json(handler, [row_to_dict(r) for r in cur.fetchall()])
            conn.close()
            return True
        if methode == "POST":
            naam = (body.get("naam") or "").strip()
            kleur = (body.get("kleur") or "#4F7CAC").strip()
            if not naam:
                stuur_fout(handler, 400, "Naam is verplicht.")
                conn.close()
                return True
            cur.execute("SELECT COALESCE(MAX(volgorde), -1) + 1 FROM vakken")
            volgorde = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO vakken (naam, kleur, volgorde) VALUES (?, ?, ?)",
                (naam, kleur, volgorde),
            )
            nieuw_id = cur.lastrowid
            conn.commit()
            cur.execute("SELECT * FROM vakken WHERE id = ?", (nieuw_id,))
            stuur_json(handler, row_to_dict(cur.fetchone()), status=201)
            conn.close()
            return True

    # /api/vakken/<id>
    if len(pad_delen) == 3:
        try:
            vak_id = int(pad_delen[2])
        except ValueError:
            stuur_fout(handler, 400, "Ongeldig id.")
            conn.close()
            return True

        if methode == "GET":
            cur.execute("SELECT * FROM vakken WHERE id = ?", (vak_id,))
            row = cur.fetchone()
            if not row:
                stuur_fout(handler, 404, "Vak niet gevonden.")
            else:
                stuur_json(handler, row_to_dict(row))
            conn.close()
            return True

        if methode == "PUT":
            cur.execute("SELECT * FROM vakken WHERE id = ?", (vak_id,))
            if not cur.fetchone():
                stuur_fout(handler, 404, "Vak niet gevonden.")
                conn.close()
                return True
            velden, waarden = [], []
            if "naam" in body:
                naam = (body.get("naam") or "").strip()
                if not naam:
                    stuur_fout(handler, 400, "Naam mag niet leeg zijn.")
                    conn.close()
                    return True
                velden.append("naam = ?")
                waarden.append(naam)
            if "kleur" in body:
                velden.append("kleur = ?")
                waarden.append((body.get("kleur") or "#4F7CAC").strip())
            if "volgorde" in body:
                velden.append("volgorde = ?")
                waarden.append(int(body.get("volgorde") or 0))
            if velden:
                waarden.append(vak_id)
                cur.execute(f"UPDATE vakken SET {', '.join(velden)} WHERE id = ?", waarden)
                conn.commit()
            cur.execute("SELECT * FROM vakken WHERE id = ?", (vak_id,))
            stuur_json(handler, row_to_dict(cur.fetchone()))
            conn.close()
            return True

        if methode == "DELETE":
            cur.execute("DELETE FROM vakken WHERE id = ?", (vak_id,))
            conn.commit()
            stuur_json(handler, {"ok": True})
            conn.close()
            return True

    return False


def api_onderdelen(handler, methode, pad_delen, body):
    conn = get_conn()
    cur = conn.cursor()

    # /api/onderdelen?vak_id=..  (GET)  |  POST
    if len(pad_delen) == 2:
        if methode == "GET":
            qs = parse_qs(urlparse(handler.path).query)
            vak_id = qs.get("vak_id", [None])[0]
            if vak_id:
                cur.execute(
                    "SELECT * FROM onderdelen WHERE vak_id = ? ORDER BY volgorde, id",
                    (int(vak_id),),
                )
            else:
                cur.execute("SELECT * FROM onderdelen ORDER BY volgorde, id")
            stuur_json(handler, [row_to_dict(r) for r in cur.fetchall()])
            conn.close()
            return True

        if methode == "POST":
            vak_id = body.get("vak_id")
            titel = (body.get("titel") or "").strip()
            parent_id = body.get("parent_id")
            if not vak_id or not titel:
                stuur_fout(handler, 400, "vak_id en titel zijn verplicht.")
                conn.close()
                return True
            if parent_id is not None:
                # Controleer dat parent bestaat en bij hetzelfde vak hoort
                cur.execute("SELECT vak_id FROM onderdelen WHERE id = ?", (parent_id,))
                p = cur.fetchone()
                if not p or p["vak_id"] != int(vak_id):
                    stuur_fout(handler, 400, "Ongeldige parent_id.")
                    conn.close()
                    return True
            cur.execute(
                "SELECT COALESCE(MAX(volgorde), -1) + 1 FROM onderdelen WHERE vak_id = ? AND parent_id IS ?",
                (vak_id, parent_id),
            )
            volgorde = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO onderdelen (vak_id, parent_id, titel, volgorde) VALUES (?, ?, ?, ?)",
                (vak_id, parent_id, titel, volgorde),
            )
            nieuw_id = cur.lastrowid
            conn.commit()
            cur.execute("SELECT * FROM onderdelen WHERE id = ?", (nieuw_id,))
            stuur_json(handler, row_to_dict(cur.fetchone()), status=201)
            conn.close()
            return True

    # /api/onderdelen/<id>
    if len(pad_delen) == 3:
        try:
            oid = int(pad_delen[2])
        except ValueError:
            stuur_fout(handler, 400, "Ongeldig id.")
            conn.close()
            return True

        if methode == "GET":
            cur.execute("SELECT * FROM onderdelen WHERE id = ?", (oid,))
            row = cur.fetchone()
            if not row:
                stuur_fout(handler, 404, "Onderdeel niet gevonden.")
            else:
                stuur_json(handler, row_to_dict(row))
            conn.close()
            return True

        if methode == "PUT":
            cur.execute("SELECT * FROM onderdelen WHERE id = ?", (oid,))
            if not cur.fetchone():
                stuur_fout(handler, 404, "Onderdeel niet gevonden.")
                conn.close()
                return True
            velden, waarden = [], []
            if "titel" in body:
                titel = (body.get("titel") or "").strip()
                if not titel:
                    stuur_fout(handler, 400, "Titel mag niet leeg zijn.")
                    conn.close()
                    return True
                velden.append("titel = ?")
                waarden.append(titel)
            if "volgorde" in body:
                velden.append("volgorde = ?")
                waarden.append(int(body.get("volgorde") or 0))
            if velden:
                waarden.append(oid)
                cur.execute(f"UPDATE onderdelen SET {', '.join(velden)} WHERE id = ?", waarden)
                conn.commit()
            cur.execute("SELECT * FROM onderdelen WHERE id = ?", (oid,))
            stuur_json(handler, row_to_dict(cur.fetchone()))
            conn.close()
            return True

        if methode == "DELETE":
            cur.execute("DELETE FROM onderdelen WHERE id = ?", (oid,))
            conn.commit()
            stuur_json(handler, {"ok": True})
            conn.close()
            return True

    return False


def api_taken(handler, methode, pad_delen, body):
    conn = get_conn()
    cur = conn.cursor()

    # /api/taken?onderdeel_id=..  (GET) | POST
    if len(pad_delen) == 2:
        if methode == "GET":
            qs = parse_qs(urlparse(handler.path).query)
            oid = qs.get("onderdeel_id", [None])[0]
            if oid:
                cur.execute(
                    "SELECT * FROM taken WHERE onderdeel_id = ? ORDER BY volgorde, id",
                    (int(oid),),
                )
            else:
                cur.execute("SELECT * FROM taken ORDER BY volgorde, id")
            stuur_json(handler, [row_to_dict(r) for r in cur.fetchall()])
            conn.close()
            return True

        if methode == "POST":
            onderdeel_id = body.get("onderdeel_id")
            titel = (body.get("titel") or "").strip()
            ttype = (body.get("type") or "opdracht").strip()
            if not onderdeel_id or not titel:
                stuur_fout(handler, 400, "onderdeel_id en titel zijn verplicht.")
                conn.close()
                return True
            if ttype not in TAAK_TYPES:
                stuur_fout(handler, 400, "Ongeldig type.")
                conn.close()
                return True
            cur.execute("SELECT id FROM onderdelen WHERE id = ?", (onderdeel_id,))
            if not cur.fetchone():
                stuur_fout(handler, 400, "Ongeldig onderdeel_id.")
                conn.close()
                return True
            cur.execute(
                "SELECT COALESCE(MAX(volgorde), -1) + 1 FROM taken WHERE onderdeel_id = ?",
                (onderdeel_id,),
            )
            volgorde = cur.fetchone()[0]
            cur.execute(
                """INSERT INTO taken (onderdeel_id, titel, type, klaar, deadline, streefdatum, volgorde)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    onderdeel_id,
                    titel,
                    ttype,
                    1 if body.get("klaar") else 0,
                    body.get("deadline") or None,
                    body.get("streefdatum") or None,
                    volgorde,
                ),
            )
            nieuw_id = cur.lastrowid
            conn.commit()
            cur.execute("SELECT * FROM taken WHERE id = ?", (nieuw_id,))
            stuur_json(handler, row_to_dict(cur.fetchone()), status=201)
            conn.close()
            return True

    # /api/taken/<id>
    if len(pad_delen) == 3:
        try:
            tid = int(pad_delen[2])
        except ValueError:
            stuur_fout(handler, 400, "Ongeldig id.")
            conn.close()
            return True

        if methode == "GET":
            cur.execute("SELECT * FROM taken WHERE id = ?", (tid,))
            row = cur.fetchone()
            if not row:
                stuur_fout(handler, 404, "Taak niet gevonden.")
            else:
                stuur_json(handler, row_to_dict(row))
            conn.close()
            return True

        if methode == "PUT":
            cur.execute("SELECT * FROM taken WHERE id = ?", (tid,))
            if not cur.fetchone():
                stuur_fout(handler, 404, "Taak niet gevonden.")
                conn.close()
                return True
            velden, waarden = [], []
            if "titel" in body:
                titel = (body.get("titel") or "").strip()
                if not titel:
                    stuur_fout(handler, 400, "Titel mag niet leeg zijn.")
                    conn.close()
                    return True
                velden.append("titel = ?")
                waarden.append(titel)
            if "type" in body:
                if body["type"] not in TAAK_TYPES:
                    stuur_fout(handler, 400, "Ongeldig type.")
                    conn.close()
                    return True
                velden.append("type = ?")
                waarden.append(body["type"])
            if "klaar" in body:
                velden.append("klaar = ?")
                waarden.append(1 if body["klaar"] else 0)
            if "deadline" in body:
                velden.append("deadline = ?")
                waarden.append(body["deadline"] or None)
            if "streefdatum" in body:
                velden.append("streefdatum = ?")
                waarden.append(body["streefdatum"] or None)
            if "volgorde" in body:
                velden.append("volgorde = ?")
                waarden.append(int(body["volgorde"] or 0))
            if velden:
                waarden.append(tid)
                cur.execute(f"UPDATE taken SET {', '.join(velden)} WHERE id = ?", waarden)
                conn.commit()
            cur.execute("SELECT * FROM taken WHERE id = ?", (tid,))
            stuur_json(handler, row_to_dict(cur.fetchone()))
            conn.close()
            return True

        if methode == "DELETE":
            cur.execute("DELETE FROM taken WHERE id = ?", (tid,))
            conn.commit()
            stuur_json(handler, {"ok": True})
            conn.close()
            return True

    return False


def api_instellingen(handler, methode, pad_delen, body):
    conn = get_conn()
    cur = conn.cursor()

    if len(pad_delen) == 2:
        if methode == "GET":
            cur.execute("SELECT * FROM instellingen")
            data = {r["sleutel"]: r["waarde"] for r in cur.fetchall()}
            stuur_json(handler, data)
            conn.close()
            return True
        if methode == "PUT":
            for k, v in body.items():
                cur.execute(
                    "INSERT INTO instellingen (sleutel, waarde) VALUES (?, ?) "
                    "ON CONFLICT(sleutel) DO UPDATE SET waarde = excluded.waarde",
                    (str(k), str(v)),
                )
            conn.commit()
            cur.execute("SELECT * FROM instellingen")
            data = {r["sleutel"]: r["waarde"] for r in cur.fetchall()}
            stuur_json(handler, data)
            conn.close()
            return True

    return False


def api_overzicht(handler):
    """
    Eén call voor het startscherm en deadline-overzicht:
    vakken met progress, plus alle taken met een deadline/streefdatum.
    """
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM vakken ORDER BY volgorde, id")
    vakken = [row_to_dict(r) for r in cur.fetchall()]

    cur.execute(
        """SELECT t.id, t.titel, t.type, t.klaar, t.deadline, t.streefdatum,
                  t.onderdeel_id, o.vak_id, v.naam AS vak_naam, v.kleur AS vak_kleur,
                  o.titel AS onderdeel_titel
           FROM taken t
           JOIN onderdelen o ON o.id = t.onderdeel_id
           JOIN vakken v ON v.id = o.vak_id
           ORDER BY COALESCE(t.deadline, t.streefdatum, '9999-12-31'), t.id"""
    )
    alle_taken = [row_to_dict(r) for r in cur.fetchall()]

    # Progress per vak
    per_vak = {}
    for v in vakken:
        per_vak[v["id"]] = {"totaal": 0, "klaar": 0, "per_type": {"opdracht": [0, 0], "theorie": [0, 0], "labo": [0, 0]}}
    for t in alle_taken:
        vid = t["vak_id"]
        if vid not in per_vak:
            continue
        per_vak[vid]["totaal"] += 1
        if t["klaar"]:
            per_vak[vid]["klaar"] += 1
        tt = t["type"]
        if tt in per_vak[vid]["per_type"]:
            per_vak[vid]["per_type"][tt][1] += 1
            if t["klaar"]:
                per_vak[vid]["per_type"][tt][0] += 1

    for v in vakken:
        p = per_vak[v["id"]]
        v["progress"] = p

    deadlines = [t for t in alle_taken if t["deadline"]]
    streefmomenten = [t for t in alle_taken if t["streefdatum"]]

    stuur_json(handler, {
        "vakken": vakken,
        "deadlines": deadlines,
        "streefmomenten": streefmomenten,
    })
    conn.close()
    return True


# ----------------------------------------------------------------------------
# HTTP Handler
# ----------------------------------------------------------------------------
class AppHandler(BaseHTTPRequestHandler):
    server_version = "ProductivityApp/1.0"

    def log_message(self, fmt, *args):
        # Stille logging; alleen echte fouten tonen we liever niet in de console.
        pass

    def _dispatch(self, methode):
        parsed = urlparse(self.path)
        pad = parsed.path
        delen = [d for d in pad.split("/") if d != ""]

        # API routes
        if len(delen) >= 2 and delen[0] == "api":
            body = lees_json(self) if methode in ("POST", "PUT") else {}
            try:
                if delen[1] == "vakken":
                    if api_vakken(self, methode, delen, body):
                        return
                elif delen[1] == "onderdelen":
                    if api_onderdelen(self, methode, delen, body):
                        return
                elif delen[1] == "taken":
                    if api_taken(self, methode, delen, body):
                        return
                elif delen[1] == "instellingen":
                    if api_instellingen(self, methode, delen, body):
                        return
                elif delen[1] == "overzicht" and methode == "GET" and len(delen) == 2:
                    api_overzicht(self)
                    return
                stuur_fout(self, 404, "API route niet gevonden.")
            except Exception as e:
                stuur_fout(self, 500, f"Serverfout: {e}")
            return

        # Statische bestanden
        if methode != "GET":
            stuur_fout(self, 405, "Methode niet toegestaan.")
            return

        if pad == "/" or pad == "":
            bestand = os.path.join(STATIC_DIR, "index.html")
        else:
            veilig_pad = pad.lstrip("/").replace("\\", "/")
            if ".." in veilig_pad.split("/"):
                stuur_fout(self, 400, "Ongeldig pad.")
                return
            bestand = os.path.join(STATIC_DIR, veilig_pad)

        if not os.path.isfile(bestand):
            stuur_fout(self, 404, "Bestand niet gevonden.")
            return

        ext = os.path.splitext(bestand)[1].lower()
        types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
        }
        ctype = types.get(ext, "application/octet-stream")
        try:
            with open(bestand, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            stuur_fout(self, 500, f"Kon bestand niet lezen: {e}")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Allow", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()


# ----------------------------------------------------------------------------
# Start
# ----------------------------------------------------------------------------
def open_browser_later():
    webbrowser.open(f"http://{HOST}:{PORT}/")


def main():
    init_db()
    if not os.path.isdir(STATIC_DIR):
        print(f"[!] Map 'static' niet gevonden op {STATIC_DIR}")
        print("    Maak de map aan en plaats index.html, style.css en app.js erin.")
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print("=" * 60)
    print(" Productivity App draait")
    print(f" Open: http://{HOST}:{PORT}/")
    print(f" Database: {DB_PATH}")
    print(" Sluiten: Ctrl+C in dit venster")
    print("=" * 60)
    threading.Timer(1.0, open_browser_later).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gestopt.")
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()