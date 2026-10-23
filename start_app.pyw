# start_app.pyw
# Start de app zonder zwart consolevenster (wordt gestart met pythonw.exe).
# Dit is het bestand waar de bureaubladsnelkoppeling naar verwijst.

import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app

try:
    app.main()
except SystemExit:
    pass
except Exception:
    log = os.path.join(app.BASE_DIR, "fout.log")
    with open(log, "a", encoding="utf-8") as f:
        traceback.print_exc(file=f)
    app.meld_fout(f"De app is gestopt met een fout.\nDetails staan in:\n{log}")
