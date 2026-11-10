# -*- mode: python ; coding: utf-8 -*-
# PyInstaller-recept voor Elio.
# Bouwen:  pyinstaller --noconfirm --clean packaging/elio.spec
# Resultaat: dist/Elio/ (Windows, met Elio.exe) of dist/Elio.app (macOS).

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

# Versienummer uit app.py, zodat het maar op één plek staat
with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as f:
    VERSIE = re.search(r'^APP_VERSIE = "([^"]+)"', f.read(), re.M).group(1)

a = Analysis(
    [os.path.join(ROOT, "start_app.pyw")],
    pathex=[ROOT],
    datas=[(os.path.join(ROOT, "static"), "static")],
    excludes=["tkinter"],
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Elio",
    console=False,  # geen zwart venster
    icon=os.path.join(ROOT, "static", "icon.ico") if sys.platform == "win32"
    else os.path.join(SPECPATH, "icon.icns"),
)

coll = COLLECT(exe, a.binaries, a.datas, name="Elio")

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Elio.app",
        icon=os.path.join(SPECPATH, "icon.icns"),
        bundle_identifier="io.github.penny707.elio",
        info_plist={
            "CFBundleName": "Elio",
            "CFBundleDisplayName": "Elio",
            "CFBundleShortVersionString": VERSIE,
            "CFBundleVersion": VERSIE,
            # Het startprogramma opent het venster en stopt meteen weer;
            # zonder Dock-icoon voelt dat niet als een app die "hangt".
            "LSUIElement": True,
            "NSHighResolutionCapable": True,
        },
    )
