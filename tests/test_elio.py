"""Tests voor de Elio-server (alleen de Python-standaardbibliotheek).

Start met:  python -m unittest discover -s tests -v

Alle tests werken in tijdelijke mappen: je echte gegevens worden nooit
aangeraakt (ELIO_DATA wordt gezet vóór app.py geladen wordt).
"""

import datetime
import http.client
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import unittest

# Vóór het importeren van app: gegevens in een tijdelijke map
_TEST_DATA = tempfile.mkdtemp(prefix="elio-test-")
os.environ["ELIO_DATA"] = _TEST_DATA
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app  # noqa: E402


def gebruik_map(map_pad, oude_map=None):
    """Laat app.py een andere gegevensmap (en eventueel oude locatie) gebruiken."""
    app.DATA_DIR = map_pad
    app.DB_PATH = os.path.join(map_pad, "data.db")
    app.BACKUP_DIR = os.path.join(map_pad, "backups")
    if oude_map is not None:
        app.OUDE_DB_PATH = os.path.join(oude_map, "data.db")
        app.OUDE_BACKUP_DIR = os.path.join(oude_map, "backups")


def tijdelijke_map(test, prefix="elio-"):
    pad = tempfile.mkdtemp(prefix=prefix)
    test.addCleanup(shutil.rmtree, pad, True)
    return pad


# ----------------------------------------------------------------------------
# API
# ----------------------------------------------------------------------------
class ApiTest(unittest.TestCase):
    """Start één echte server op een vrije poort en praat er via HTTP mee."""

    @classmethod
    def setUpClass(cls):
        cls.map = tempfile.mkdtemp(prefix="elio-api-")
        gebruik_map(cls.map)
        app.init_db()
        cls.server = app.AppServer(("127.0.0.1", 0), app.AppHandler)
        cls.poort = cls.server.server_address[1]
        app.TOEGESTANE_HOSTS = {f"127.0.0.1:{cls.poort}", f"localhost:{cls.poort}"}
        cls.draad = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.draad.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        shutil.rmtree(cls.map, ignore_errors=True)

    def setUp(self):
        # Elke test begint met de standaardtaal
        self.api("PUT", "/api/instellingen", {"taal": "en"})

    def api(self, methode, pad, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.poort, timeout=5)
        h = {"Content-Type": "application/json"} if body is not None else {}
        h.update(headers or {})
        conn.request(methode, pad, body=json.dumps(body) if body is not None else None, headers=h)
        res = conn.getresponse()
        data = res.read()
        conn.close()
        ctype = res.getheader("Content-Type", "")
        return res.status, (json.loads(data) if "json" in ctype else data)

    # Hulpjes om snel gegevens aan te maken
    def maak_vak(self, naam="Wiskunde"):
        status, vak = self.api("POST", "/api/vakken", {"naam": naam})
        self.assertEqual(status, 201)
        return vak

    def maak_onderdeel(self, vak_id, titel="Hoofdstuk 1", parent_id=None):
        status, o = self.api("POST", "/api/onderdelen", {"vak_id": vak_id, "titel": titel, "parent_id": parent_id})
        self.assertEqual(status, 201)
        return o

    def maak_taak(self, onderdeel_id, titel="Taak", **extra):
        status, t = self.api("POST", "/api/taken", {"onderdeel_id": onderdeel_id, "titel": titel, **extra})
        self.assertEqual(status, 201)
        return t

    def test_status(self):
        status, data = self.api("GET", "/api/status")
        self.assertEqual(status, 200)
        self.assertEqual(data["app"], "elio")
        self.assertEqual(data["versie"], app.CODE_VERSIE)

    def test_vak_aanmaken_wijzigen_en_naam_verplicht(self):
        vak = self.maak_vak("Fysica")
        status, gewijzigd = self.api("PUT", f"/api/vakken/{vak['id']}", {"naam": "Fysica 2", "kleur": "#123456"})
        self.assertEqual((status, gewijzigd["naam"], gewijzigd["kleur"]), (200, "Fysica 2", "#123456"))
        status, fout = self.api("POST", "/api/vakken", {"naam": "   "})
        self.assertEqual((status, fout["code"]), (400, "naam_verplicht"))

    def test_vakken_herordenen(self):
        a, b, c = self.maak_vak("A"), self.maak_vak("B"), self.maak_vak("C")
        status, lijst = self.api("PUT", "/api/vakken/volgorde", {"ids": [c["id"], a["id"], b["id"]]})
        self.assertEqual(status, 200)
        ids = [v["id"] for v in lijst if v["id"] in (a["id"], b["id"], c["id"])]
        self.assertEqual(ids, [c["id"], a["id"], b["id"]])

    def test_sub_onderdeel_moet_bij_hetzelfde_vak_horen(self):
        vak1, vak2 = self.maak_vak("Een"), self.maak_vak("Twee")
        ouder = self.maak_onderdeel(vak1["id"])
        self.maak_onderdeel(vak1["id"], "Sub", parent_id=ouder["id"])
        status, fout = self.api("POST", "/api/onderdelen",
                                {"vak_id": vak2["id"], "titel": "Fout", "parent_id": ouder["id"]})
        self.assertEqual((status, fout["code"]), (400, "ongeldige_parent"))

    def test_taak_aanmaken_wijzigen_en_type_controle(self):
        o = self.maak_onderdeel(self.maak_vak()["id"])
        taak = self.maak_taak(o["id"], "Labo 1", type="labo", deadline="2026-12-01")
        self.assertEqual((taak["type"], taak["deadline"], taak["klaar"]), ("labo", "2026-12-01", 0))
        status, t = self.api("PUT", f"/api/taken/{taak['id']}", {"klaar": True, "deadline": None})
        self.assertEqual((status, t["klaar"], t["deadline"]), (200, 1, None))
        status, fout = self.api("POST", "/api/taken", {"onderdeel_id": o["id"], "titel": "X", "type": "examen"})
        self.assertEqual((status, fout["code"]), (400, "ongeldig_type"))

    def test_taken_herordenen_raakt_alleen_eigen_onderdeel(self):
        vak = self.maak_vak()
        o1, o2 = self.maak_onderdeel(vak["id"], "Een"), self.maak_onderdeel(vak["id"], "Twee")
        t = [self.maak_taak(o1["id"], f"T{i}") for i in range(3)]
        ander = [self.maak_taak(o2["id"], f"A{i}") for i in range(2)]
        nieuw = [t[2]["id"], t[0]["id"], t[1]["id"]]
        status, lijst = self.api("PUT", "/api/taken/volgorde", {"onderdeel_id": o1["id"], "ids": nieuw})
        self.assertEqual((status, [x["id"] for x in lijst]), (200, nieuw))
        # Ids van een ander onderdeel meesturen verandert daar niets
        self.api("PUT", "/api/taken/volgorde",
                 {"onderdeel_id": o1["id"], "ids": [ander[1]["id"], ander[0]["id"]]})
        _, lijst2 = self.api("GET", f"/api/taken?onderdeel_id={o2['id']}")
        self.assertEqual([x["id"] for x in lijst2], [ander[0]["id"], ander[1]["id"]])

    def test_vak_verwijderen_verwijdert_alles_eronder(self):
        vak = self.maak_vak()
        o = self.maak_onderdeel(vak["id"])
        sub = self.maak_onderdeel(vak["id"], "Sub", parent_id=o["id"])
        taak = self.maak_taak(sub["id"])
        self.assertEqual(self.api("DELETE", f"/api/vakken/{vak['id']}")[0], 200)
        self.assertEqual(self.api("GET", f"/api/onderdelen/{o['id']}")[0], 404)
        self.assertEqual(self.api("GET", f"/api/taken/{taak['id']}")[0], 404)

    def test_overzicht_telt_voortgang_per_type(self):
        vak = self.maak_vak("Telvak")
        o = self.maak_onderdeel(vak["id"])
        self.maak_taak(o["id"], "a", type="labo", klaar=True)
        self.maak_taak(o["id"], "b", type="labo")
        self.maak_taak(o["id"], "c", type="theorie", deadline="2030-01-01")
        _, data = self.api("GET", "/api/overzicht")
        v = next(x for x in data["vakken"] if x["id"] == vak["id"])
        self.assertEqual((v["progress"]["klaar"], v["progress"]["totaal"]), (1, 3))
        self.assertEqual(v["progress"]["per_type"]["labo"], [1, 2])
        self.assertIn("c", [t["titel"] for t in data["deadlines"]])

    def test_foutmeldingen_volgen_de_gekozen_taal(self):
        _, fout = self.api("POST", "/api/vakken", {"naam": ""})
        self.assertEqual(fout["fout"], "Name is required.")
        self.api("PUT", "/api/instellingen", {"taal": "nl"})
        _, fout = self.api("POST", "/api/vakken", {"naam": ""})
        self.assertEqual(fout["fout"], "Naam is verplicht.")

    def test_vreemde_host_wordt_geweigerd(self):
        status, _ = self.api("GET", "/api/vakken", headers={"Host": "evil.example"})
        self.assertEqual(status, 403)

    def test_schrijven_zonder_json_wordt_geweigerd(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.poort, timeout=5)
        conn.request("POST", "/api/vakken", body='{"naam": "x"}', headers={"Content-Type": "text/plain"})
        self.assertEqual(conn.getresponse().status, 415)
        conn.close()

    def test_ongeldige_invoer_geeft_400(self):
        status, fout = self.api("GET", "/api/taken?vak_id=abc")
        self.assertEqual((status, fout["code"]), (400, "ongeldige_invoer"))

    def test_statische_bestanden_en_geen_pad_buiten_static(self):
        status, html = self.api("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"<title>Elio</title>", html)
        self.assertEqual(self.api("GET", "/../app.py")[0], 400)


# ----------------------------------------------------------------------------
# Database-versies
# ----------------------------------------------------------------------------
class DatabaseVersieTest(unittest.TestCase):
    def setUp(self):
        gebruik_map(tijdelijke_map(self))

    def versie(self):
        conn = sqlite3.connect(app.DB_PATH)
        try:
            return conn.execute("PRAGMA user_version").fetchone()[0]
        finally:
            conn.close()

    def test_nieuwe_database_krijgt_de_laatste_versie(self):
        app.init_db()
        self.assertEqual(self.versie(), app.SCHEMA_VERSIE)

    def test_oude_database_zonder_versie_behoudt_haar_gegevens(self):
        # Zoals een database van vóór de versienummering: tabellen, maar versie 0
        conn = sqlite3.connect(app.DB_PATH)
        app._schema_v1(conn)
        conn.execute("INSERT INTO vakken (naam) VALUES ('Bestaand vak')")
        conn.commit()
        conn.close()
        app.init_db()
        self.assertEqual(self.versie(), app.SCHEMA_VERSIE)
        conn = sqlite3.connect(app.DB_PATH)
        self.assertEqual(conn.execute("SELECT naam FROM vakken").fetchall(), [("Bestaand vak",)])
        conn.close()

    def test_database_van_nieuwere_versie_wordt_geweigerd(self):
        conn = sqlite3.connect(app.DB_PATH)
        conn.execute(f"PRAGMA user_version = {app.SCHEMA_VERSIE + 1}")
        conn.close()
        with self.assertRaises(app.DatabaseTeNieuw):
            app.init_db()

    def test_migratie_maakt_eerst_een_veiligheidskopie(self):
        # Simuleer een extra migratie bovenop de huidige versie
        app.init_db()
        oud = app.MIGRATIES

        def _test_v2(conn):
            conn.execute("ALTER TABLE taken ADD COLUMN test_kolom TEXT")

        app.MIGRATIES = oud + [_test_v2]
        app.SCHEMA_VERSIE = len(app.MIGRATIES)
        try:
            app.init_db()
            self.assertEqual(self.versie(), len(oud) + 1)
            kopieen = [n for n in os.listdir(app.BACKUP_DIR) if n.startswith(f"voor-v{len(oud) + 1}-")]
            self.assertEqual(len(kopieen), 1)
        finally:
            app.MIGRATIES = oud
            app.SCHEMA_VERSIE = len(oud)


# ----------------------------------------------------------------------------
# Back-ups
# ----------------------------------------------------------------------------
class BackupTest(unittest.TestCase):
    def setUp(self):
        gebruik_map(tijdelijke_map(self))
        app.init_db()

    def test_een_backup_per_dag_en_hoogstens_14(self):
        os.makedirs(app.BACKUP_DIR)
        vandaag = datetime.date.today()
        for i in range(1, 21):  # 20 oudere back-ups
            dag = vandaag - datetime.timedelta(days=i)
            open(os.path.join(app.BACKUP_DIR, f"data-{dag.isoformat()}.db"), "wb").close()
        app.maak_backup()
        app.maak_backup()  # tweede keer dezelfde dag: geen extra kopie
        namen = sorted(n for n in os.listdir(app.BACKUP_DIR) if n.startswith("data-"))
        self.assertEqual(len(namen), app.BACKUPS_BEWAREN)
        self.assertEqual(namen[-1], f"data-{vandaag.isoformat()}.db")
        conn = sqlite3.connect(os.path.join(app.BACKUP_DIR, namen[-1]))
        self.assertIn(("vakken",), conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())
        conn.close()


# ----------------------------------------------------------------------------
# Verhuizen van de oude locatie (naast app.py) naar de gegevensmap
# ----------------------------------------------------------------------------
class VerhuisTest(unittest.TestCase):
    def setUp(self):
        # Een oude map met een spatie in de naam, zoals "Productivity App"
        self.oud = os.path.join(tijdelijke_map(self), "Productivity App")
        os.makedirs(os.path.join(self.oud, "backups"))
        gebruik_map(tijdelijke_map(self), oude_map=self.oud)
        conn = sqlite3.connect(os.path.join(self.oud, "data.db"))
        app._schema_v1(conn)
        conn.execute("INSERT INTO vakken (naam) VALUES ('Mijn vak')")
        conn.commit()
        conn.close()
        open(os.path.join(self.oud, "backups", "data-2026-01-01.db"), "wb").close()

    def tearDown(self):
        gebruik_map(app.DATA_DIR, oude_map=app.BASE_DIR)

    def test_oude_gegevens_worden_gekopieerd_en_het_origineel_blijft(self):
        self.assertTrue(app.verhuis_oude_gegevens())
        conn = sqlite3.connect(app.DB_PATH)
        self.assertEqual(conn.execute("SELECT naam FROM vakken").fetchall(), [("Mijn vak",)])
        conn.close()
        self.assertTrue(os.path.isfile(os.path.join(app.BACKUP_DIR, "data-2026-01-01.db")))
        self.assertTrue(os.path.isfile(os.path.join(self.oud, "data.db")))
        self.assertFalse(os.path.exists(app.DB_PATH + ".tmp"))

    def test_bestaande_gegevens_worden_nooit_overschreven(self):
        os.makedirs(app.DATA_DIR, exist_ok=True)
        conn = sqlite3.connect(app.DB_PATH)
        app._schema_v1(conn)
        conn.execute("INSERT INTO vakken (naam) VALUES ('Nieuwer')")
        conn.commit()
        conn.close()
        self.assertFalse(app.verhuis_oude_gegevens())
        conn = sqlite3.connect(app.DB_PATH)
        self.assertEqual(conn.execute("SELECT naam FROM vakken").fetchall(), [("Nieuwer",)])
        conn.close()


# ----------------------------------------------------------------------------
# Starter (zoals op macOS): server apart op de achtergrond, korte startprocessen
# ----------------------------------------------------------------------------
class StarterTest(unittest.TestCase):
    def setUp(self):
        import socket
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            self.poort = s.getsockname()[1]
        # Het achtergrondproces erft deze omgeving: eigen poort en tijdelijke gegevens
        self.oud = {k: os.environ.get(k) for k in ("ELIO_PORT", "ELIO_DATA")}
        os.environ["ELIO_PORT"] = str(self.poort)
        os.environ["ELIO_DATA"] = tijdelijke_map(self)
        self.oude_waarden = (app.PORT, app.URL, app.open_app_venster)
        app.PORT = self.poort
        app.URL = f"http://127.0.0.1:{self.poort}/"
        self.vensters = []
        app.open_app_venster = lambda: self.vensters.append(1)

    def tearDown(self):
        app.stop_draaiende_server()
        app.PORT, app.URL, app.open_app_venster = self.oude_waarden
        for k, v in self.oud.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_starter_start_een_server_en_hergebruikt_ze(self):
        app.start_als_starter()
        status = app.status_draaiende_server()
        self.assertIsNotNone(status)
        self.assertEqual(status["versie"], app.CODE_VERSIE)
        app.start_als_starter()  # tweede klik: dezelfde server, enkel een venster
        self.assertEqual(self.vensters, [1, 1])
        # --stop stopt de achtergrondserver
        oud_argv = sys.argv
        sys.argv = ["app.py", "--stop"]
        try:
            app.main()
        finally:
            sys.argv = oud_argv
        for _ in range(40):
            if app.status_draaiende_server() is None:
                break
            import time
            time.sleep(0.25)
        self.assertIsNone(app.status_draaiende_server())


# ----------------------------------------------------------------------------
# Teksten van de server
# ----------------------------------------------------------------------------
class TekstTest(unittest.TestCase):
    def test_elke_tekst_bestaat_in_beide_talen(self):
        for code, vertalingen in app.TEKSTEN.items():
            self.assertEqual(set(vertalingen), {"en", "nl"}, code)

    def test_onbekende_taal_valt_terug_op_engels(self):
        gebruik_map(tijdelijke_map(self))
        self.assertEqual(app.taal(), "en")  # nog geen database: standaardtaal


def tearDownModule():
    shutil.rmtree(_TEST_DATA, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
