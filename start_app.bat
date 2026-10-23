@echo off
REM Start de app MET consolevenster (handig voor foutzoeken).
REM Voor dagelijks gebruik: het bureaubladicoon (start_app.pyw).
setlocal
title Elio
cd /d "%~dp0"

REM Controleer of Python beschikbaar is
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo Python is niet gevonden op dit systeem.
    echo Installeer Python 3 vanaf https://www.python.org/downloads/
    echo Vink tijdens installatie "Add Python to PATH" aan.
    echo.
    pause
    exit /b 1
)

REM Start de server (open automatisch de browser via app.py)
python app.py

REM Als app.py stopt (bv. door fout), laat het venster open zodat je de melding ziet
if errorlevel 1 (
    echo.
    echo De app is gestopt met een fout. Zie de melding hierboven.
    pause
)

endlocal