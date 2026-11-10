"""Maakt een demo-database met Engelse voorbeeldgegevens (voor screenshots
of om Elio uit te proberen), in een eigen map: je echte gegevens worden
nooit aangeraakt.

Gebruik:
    python tools/demo_data.py demo-data
    ELIO_DATA=demo-data python app.py         (Windows: set ELIO_DATA=demo-data)

Deadlines worden berekend vanaf vandaag, zodat de demo altijd "actueel" oogt.
"""

import datetime
import os
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)

DOEL = os.path.abspath(sys.argv[1])
os.environ["ELIO_DATA"] = DOEL  # vóór het importeren van app: nooit de echte map
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app  # noqa: E402

if os.path.exists(app.DB_PATH):
    sys.exit(f"{app.DB_PATH} bestaat al; kies een lege map.")

app.init_db()
conn = app.get_conn()
vandaag = datetime.date.today()


def dag(n):
    return (vandaag + datetime.timedelta(days=n)).isoformat() if n is not None else None


# (vak, kleur, [(onderdeel, [(taak, type, klaar, deadline_over_n_dagen, streef_over_n_dagen)],
#                [sub-onderdelen...])])
VAKKEN = [
    ("Web Development", "#4F7CAC", [
        ("Lectures", [
            ("Read slides: HTML & CSS", "theorie", True, None, -12),
            ("Read slides: JavaScript basics", "theorie", True, None, -6),
            ("Read slides: Fetch & REST APIs", "theorie", False, None, 1),
            ("Read slides: Accessibility", "theorie", False, None, 6),
        ], []),
        ("Labs", [], [
            ("Lab 1 – Portfolio page", [
                ("Build the layout", "labo", True, None, None),
                ("Upload to the learning platform", "opdracht", True, -9, None),
            ]),
            ("Lab 2 – Weather app", [
                ("Call the weather API", "labo", True, None, -1),
                ("Show a 5-day forecast", "labo", False, None, 2),
                ("Upload the project", "opdracht", False, 4, 3),
            ]),
        ]),
        ("Project", [
            ("Write the project proposal", "opdracht", True, -5, None),
            ("Mid-term demo", "opdracht", False, 11, 9),
            ("Final project", "opdracht", False, 38, 30),
        ], []),
    ]),
    ("Databases", "#4A8F5C", [
        ("Theory", [
            ("Chapter 1 – Relational model", "theorie", True, None, None),
            ("Chapter 2 – SQL queries", "theorie", True, None, None),
            ("Chapter 3 – Normalisation", "theorie", False, None, 0),
            ("Chapter 4 – Indexes & performance", "theorie", False, None, 8),
        ], []),
        ("Exercises", [
            ("SQL exercise set 1", "opdracht", True, -15, None),
            ("SQL exercise set 2", "opdracht", False, -1, -3),
            ("ER diagram for a library", "opdracht", False, 6, None),
        ], []),
    ]),
    ("Networking", "#C2713A", [
        ("Packet Tracer labs", [
            ("Lab 1 – Basic switching", "labo", True, None, None),
            ("Lab 2 – VLANs", "labo", True, None, None),
            ("Lab 3 – Static routing", "labo", False, 0, None),
            ("Lab 4 – OSPF", "labo", False, 13, 10),
        ], []),
        ("Theory", [
            ("OSI model recap", "theorie", True, None, None),
            ("Subnetting practice", "theorie", False, None, 2),
        ], []),
    ]),
    ("Mathematics", "#7A5C9E", [
        ("Weekly assignments", [
            ("Assignment 1 – Logic", "opdracht", True, -20, None),
            ("Assignment 2 – Sets", "opdracht", True, -13, None),
            ("Assignment 3 – Graphs", "opdracht", False, 5, 3),
        ], []),
        ("Exam preparation", [
            ("Summary chapters 1–4", "theorie", False, None, 14),
            ("Practice exam", "opdracht", False, None, 20),
        ], []),
    ]),
    ("Python Programming", "#3A8C8C", [
        ("Labs", [
            ("Lab 1 – Variables & input", "labo", True, None, None),
            ("Lab 2 – Lists & loops", "labo", True, None, None),
            ("Lab 3 – Functions", "labo", True, None, None),
            ("Lab 4 – Files", "labo", False, None, 4),
        ], []),
    ]),
    ("Cyber Security", "#C0504D", [
        ("Lectures", [
            ("Threat modelling", "theorie", False, None, 5),
            ("Web vulnerabilities (OWASP Top 10)", "theorie", False, None, 9),
        ], []),
        ("Capture the flag", [
            ("Team registration", "opdracht", False, 16, None),
        ], []),
    ]),
]


def taken_toevoegen(onderdeel_id, taken):
    for volgorde, (titel, type_, klaar, deadline, streef) in enumerate(taken):
        conn.execute(
            "INSERT INTO taken (onderdeel_id, titel, type, klaar, deadline, streefdatum, volgorde)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (onderdeel_id, titel, type_, int(klaar), dag(deadline), dag(streef), volgorde),
        )


for v_volgorde, (naam, kleur, onderdelen) in enumerate(VAKKEN):
    vak_id = conn.execute("INSERT INTO vakken (naam, kleur, volgorde) VALUES (?, ?, ?)",
                          (naam, kleur, v_volgorde)).lastrowid
    for o_volgorde, (titel, taken, subs) in enumerate(onderdelen):
        o_id = conn.execute("INSERT INTO onderdelen (vak_id, titel, volgorde) VALUES (?, ?, ?)",
                            (vak_id, titel, o_volgorde)).lastrowid
        taken_toevoegen(o_id, taken)
        for s_volgorde, (sub_titel, sub_taken) in enumerate(subs):
            s_id = conn.execute(
                "INSERT INTO onderdelen (vak_id, parent_id, titel, volgorde) VALUES (?, ?, ?, ?)",
                (vak_id, o_id, sub_titel, s_volgorde)).lastrowid
            taken_toevoegen(s_id, sub_taken)

conn.execute("UPDATE instellingen SET waarde = 'light' WHERE sleutel = 'thema'")
conn.commit()
aantallen = [conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("vakken", "onderdelen", "taken")]
conn.close()
print(f"Demo-database gemaakt in {DOEL}: {aantallen[0]} courses, {aantallen[1]} sections, {aantallen[2]} tasks.")
