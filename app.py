# app.py
# Elio - lokale productiviteitsapp. Server met alleen de Python-standaardbibliotheek.
# Start met: python app.py  (of dubbelklik op het bureaubladicoon)
# De app opent in een eigen venster op http://127.0.0.1:8765

import datetime
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# ----------------------------------------------------------------------------
# Configuratie
# ----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
BACKUPS_BEWAREN = 14
HOST = "127.0.0.1"
PORT = 8765
URL = f"http://{HOST}:{PORT}/"
APP_ID = "elio"
VENSTER_TITEL = "Elio"  # moet gelijk zijn aan <title> in static/index.html
OUDE_APP_IDS = {"productivity-app"}  # vorige naam, om een oude server te herkennen

# Vingerafdruk van deze code. Draait er nog een server met andere (oudere)
# code, dan wordt die bij het starten automatisch vervangen.
with open(os.path.abspath(__file__), "rb") as _f:
    CODE_VERSIE = hashlib.sha1(_f.read()).hexdigest()[:12]

# Alleen verzoeken met deze Host-header worden aanvaard (bescherming tegen
# DNS-rebinding: andere websites kunnen zo niet bij je gegevens).
TOEGESTANE_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}

TAAK_TYPES = {"opdracht", "theorie", "labo"}

SERVER = None


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


def maak_backup():
    """
    Maakt één backup per dag in backups/data-JJJJ-MM-DD.db (via de
    SQLite backup-API, dus veilig terwijl de app draait).
    Alleen de laatste BACKUPS_BEWAREN backups worden bewaard.
    """
    if not os.path.isfile(DB_PATH):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    doel = os.path.join(BACKUP_DIR, f"data-{datetime.date.today().isoformat()}.db")
    if not os.path.exists(doel):
        bron = sqlite3.connect(DB_PATH)
        kopie = sqlite3.connect(doel)
        try:
            bron.backup(kopie)
        finally:
            kopie.close()
            bron.close()
    backups = sorted(
        f for f in os.listdir(BACKUP_DIR) if f.startswith("data-") and f.endswith(".db")
    )
    for oud in backups[:-BACKUPS_BEWAREN]:
        os.remove(os.path.join(BACKUP_DIR, oud))


def backup_lus():
    # De server kan dagen blijven draaien: controleer elk uur of de backup
    # van vandaag al bestaat.
    while True:
        time.sleep(3600)
        try:
            maak_backup()
        except Exception:
            pass


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

    # /api/vakken/volgorde  (PUT {"ids": [3, 1, 2]})  - nieuwe volgorde in één keer
    if len(pad_delen) == 3 and pad_delen[2] == "volgorde" and methode == "PUT":
        ids = body.get("ids")
        if not isinstance(ids, list):
            stuur_fout(handler, 400, "ids moet een lijst zijn.")
            conn.close()
            return True
        for volgorde, vak_id in enumerate(ids):
            cur.execute("UPDATE vakken SET volgorde = ? WHERE id = ?", (volgorde, int(vak_id)))
        conn.commit()
        cur.execute("SELECT * FROM vakken ORDER BY volgorde, id")
        stuur_json(handler, [row_to_dict(r) for r in cur.fetchall()])
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

    # /api/taken?onderdeel_id=..|?vak_id=..  (GET) | POST
    if len(pad_delen) == 2:
        if methode == "GET":
            qs = parse_qs(urlparse(handler.path).query)
            oid = qs.get("onderdeel_id", [None])[0]
            vak_id = qs.get("vak_id", [None])[0]
            if vak_id:
                cur.execute(
                    """SELECT t.* FROM taken t
                       JOIN onderdelen o ON o.id = t.onderdeel_id
                       WHERE o.vak_id = ? ORDER BY t.volgorde, t.id""",
                    (int(vak_id),),
                )
            elif oid:
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
    server_version = "Elio/1.0"

    def log_message(self, fmt, *args):
        # Stille logging; alleen echte fouten tonen we liever niet in de console.
        pass

    def _dispatch(self, methode):
        parsed = urlparse(self.path)
        pad = parsed.path
        delen = [d for d in pad.split("/") if d != ""]

        if self.headers.get("Host", "") not in TOEGESTANE_HOSTS:
            stuur_fout(self, 403, "Ongeldige host.")
            return

        # API routes
        if len(delen) >= 2 and delen[0] == "api":
            if methode in ("POST", "PUT"):
                # Vereist JSON: zo kan een andere website via een gewoon
                # formulier of 'simple request' niets aanmaken of wijzigen.
                ctype = self.headers.get("Content-Type", "")
                if not ctype.startswith("application/json"):
                    stuur_fout(self, 415, "Content-Type moet application/json zijn.")
                    return
                body = lees_json(self)
            else:
                body = {}
            try:
                if delen[1] == "status" and methode == "GET":
                    stuur_json(self, {"app": APP_ID, "versie": CODE_VERSIE})
                    return
                elif delen[1] == "afsluiten" and methode == "POST":
                    stuur_json(self, {"ok": True})
                    threading.Thread(target=SERVER.shutdown, daemon=True).start()
                    return
                elif delen[1] == "vakken":
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
            except (ValueError, TypeError):
                stuur_fout(self, 400, "Ongeldige invoer.")
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


class AppServer(ThreadingHTTPServer):
    # Op Windows laat SO_REUSEADDR een tweede server op dezelfde poort toe.
    # Uitzetten, zodat een tweede start netjes merkt dat de poort bezet is.
    allow_reuse_address = False


# ----------------------------------------------------------------------------
# Start
# ----------------------------------------------------------------------------
def meld_fout(bericht):
    """Toont een foutmelding: in de console, of als pop-up wanneer de app
    zonder console draait (pythonw via het bureaubladicoon)."""
    if sys.stdout is not None:
        print(f"[!] {bericht}")
    else:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, bericht, "Elio", 0x10)


def _opener():
    # Geen proxy gebruiken voor verzoeken naar onze eigen pc
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def status_draaiende_server():
    """Geeft de status van de server op de poort terug, of None als het niet
    onze app is (of er niets luistert)."""
    try:
        with _opener().open(f"{URL}api/status", timeout=1.5) as res:
            status = json.loads(res.read().decode("utf-8"))
    except Exception:
        return None
    if status.get("app") in {APP_ID} | OUDE_APP_IDS:
        return status
    return None


def stop_draaiende_server():
    req = urllib.request.Request(
        f"{URL}api/afsluiten", data=b"{}", method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        _opener().open(req, timeout=3).read()
    except Exception:
        pass


def bind_server(pogingen=1):
    for i in range(pogingen):
        try:
            return AppServer((HOST, PORT), AppHandler)
        except OSError:
            if i == pogingen - 1:
                raise
            time.sleep(0.25)


def zoek_edge():
    for basis in ("ProgramFiles(x86)", "ProgramFiles", "LocalAppData"):
        map_ = os.environ.get(basis)
        if map_:
            pad = os.path.join(map_, "Microsoft", "Edge", "Application", "msedge.exe")
            if os.path.isfile(pad):
                return pad
    return None


def open_app_venster():
    # Edge in app-modus: eigen venster zonder adresbalk of tabbladen.
    # Geen Edge gevonden? Dan gewoon de standaardbrowser.
    edge = zoek_edge()
    if edge:
        try:
            subprocess.Popen([edge, f"--app={URL}"])
            return
        except OSError:
            pass
    webbrowser.open(URL)


def focus_bestaand_venster():
    """Haalt een al geopend Elio-venster naar voren. Een Edge-app-venster
    heeft exact de paginatitel als venstertitel ("Elio"); gewone
    browservensters eindigen op "- Microsoft Edge" en tellen dus niet mee.
    Geeft True terug als er een venster gevonden is."""
    if sys.platform != "win32":
        return False
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    gevonden = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def bekijk(hwnd, _):
        lengte = user32.GetWindowTextLengthW(hwnd)
        if lengte != len(VENSTER_TITEL) or not user32.IsWindowVisible(hwnd):
            return True
        titel = ctypes.create_unicode_buffer(lengte + 1)
        user32.GetWindowTextW(hwnd, titel, lengte + 1)
        klasse = ctypes.create_unicode_buffer(64)
        user32.GetClassNameW(hwnd, klasse, 64)
        if titel.value == VENSTER_TITEL and klasse.value.startswith("Chrome_WidgetWin"):
            gevonden.append(hwnd)
            return False  # stoppen met zoeken
        return True

    user32.EnumWindows(bekijk, 0)
    if not gevonden:
        return False
    hwnd = gevonden[0]
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE: uit de taakbalk halen
    user32.SetForegroundWindow(hwnd)
    return True


def toon_app():
    # Eén Elio-venster: bestaat het al, dan dat tonen; anders een nieuw openen.
    if not focus_bestaand_venster():
        open_app_venster()


def main():
    global SERVER
    if not os.path.isdir(STATIC_DIR):
        meld_fout(f"Map 'static' niet gevonden op {STATIC_DIR}")
        return
    try:
        SERVER = bind_server()
    except OSError:
        status = status_draaiende_server()
        if status is None:
            meld_fout(f"Poort {PORT} is al in gebruik door een ander programma.\n"
                      "Herstart je pc of sluit dat programma.")
            sys.exit(1)
        if status.get("versie") == CODE_VERSIE:
            # Draait al met dezelfde code (bv. tweede dubbelklik): bestaand
            # venster tonen, of een nieuw openen als er geen meer open is.
            toon_app()
            return
        # Er draait een oudere versie (bv. na een update): vervangen.
        stop_draaiende_server()
        try:
            SERVER = bind_server(pogingen=20)
        except OSError:
            meld_fout("De vorige versie van Elio kon niet gestopt worden.\n"
                      "Herstart je pc en probeer opnieuw.")
            sys.exit(1)

    init_db()
    try:
        maak_backup()
    except Exception as e:
        meld_fout(f"Backup maken mislukt: {e}")

    threading.Thread(target=backup_lus, daemon=True).start()
    print("=" * 60)
    print(" Elio draait")
    print(f" Open: {URL}")
    print(f" Database: {DB_PATH}")
    print(" Sluiten: Ctrl+C in dit venster, of 'Afsluiten' in de app")
    print("=" * 60)
    toon_app()
    try:
        SERVER.serve_forever()
    except KeyboardInterrupt:
        pass
    SERVER.server_close()
    print("\nServer gestopt.")


if __name__ == "__main__":
    main()