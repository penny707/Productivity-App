# maak_snelkoppeling.py
# Zet een snelkoppeling "Elio" (met icoon) op je bureaublad.
# Start met: python maak_snelkoppeling.py  (of dubbelklik snelkoppeling_maken.bat)

import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STARTER = os.path.join(BASE_DIR, "start_app.pyw")
ICOON = os.path.join(BASE_DIR, "static", "icon.ico")


def ps_tekst(s):
    # Tekst veilig tussen enkele aanhalingstekens zetten in PowerShell
    return "'" + s.replace("'", "''") + "'"


def main():
    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.isfile(pythonw):
        print(f"pythonw.exe niet gevonden naast {sys.executable}")
        return 1

    script = f"""
$bureaublad = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
# Snelkoppeling van vóór de naamswijziging opruimen (enkel als die naar deze app wijst)
$oud = Join-Path $bureaublad 'Productivity App.lnk'
if ((Test-Path $oud) -and ($shell.CreateShortcut($oud).Arguments -like '*start_app.pyw*')) {{
    Remove-Item $oud
}}
$pad = Join-Path $bureaublad 'Elio.lnk'
$s = $shell.CreateShortcut($pad)
$s.TargetPath = {ps_tekst(pythonw)}
$s.Arguments = {ps_tekst('"' + STARTER + '"')}
$s.WorkingDirectory = {ps_tekst(BASE_DIR)}
$s.IconLocation = {ps_tekst(ICOON + ",0")}
$s.Description = 'Elio'
$s.Save()
Write-Output $pad
"""
    res = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        print("Snelkoppeling maken mislukt:")
        print(res.stderr)
        return 1
    print(f"Snelkoppeling gemaakt: {res.stdout.strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
