@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python is niet gevonden. Installeer Python 3 en vink "Add Python to PATH" aan.
    pause
    exit /b 1
)

python maak_snelkoppeling.py
pause
endlocal
