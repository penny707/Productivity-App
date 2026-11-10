# Elio – for developers

How Elio is built, how to run it from source, how the tests work and how the apps are
packaged. For downloading and using Elio, see the [README](../README.md).

[![Tests](https://github.com/penny707/Productivity-App/actions/workflows/tests.yml/badge.svg)](https://github.com/penny707/Productivity-App/actions/workflows/tests.yml)
[![Build](https://github.com/penny707/Productivity-App/actions/workflows/release.yml/badge.svg)](https://github.com/penny707/Productivity-App/actions/workflows/release.yml)

## Contents

- [How it works](#how-it-works)
- [Run from source](#run-from-source)
- [Tests](#tests)
- [Building the apps and releasing](#building-the-apps-and-releasing)
- [Data and database versions](#data-and-database-versions)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)

## How it works

```
 Shortcut ──► Elio.exe / start_app.pyw ──► app.py (HTTP server on 127.0.0.1:8765)
                                             │   ├─ REST API (/api/...)  ──► SQLite (data.db)
                                             │   └─ static files (static/)
                                             └─► browser --app window  ◄── HTML/CSS/JS frontend
```

Elio uses only the **Python standard library** and **vanilla JavaScript**. There are
no dependencies and no build step for the app itself.

- **Backend (`app.py`):** built on `http.server` and `sqlite3`.
  - It exposes a small JSON API for courses, sections, tasks and settings.
  - It only listens on `127.0.0.1`.
  - It rejects requests with a foreign `Host` header (DNS rebinding) and non-JSON
    write requests, so other websites cannot change your data.
  - Error messages are returned in the chosen language (`TEKSTEN` in `app.py`).
- **Single instance:** a second launch detects the running server through
  `/api/status`.
  - If the running server is an older version (a hash of `app.py`, or the version
    number in the packaged app), it is replaced.
  - Otherwise, on Windows, the existing window is brought to the front through the
    Win32 API (`ctypes`).
- **macOS:** an app that is already running can't be launched again. So the server
  runs as a separate background process (`--server`), and every click on Elio is a
  short launcher process that starts the server if needed and opens the window.
- **Frontend (`static/`):** plain HTML, CSS and JavaScript.
  - CSS custom properties hold the three themes, with the Windows 11 *Segoe UI Variable*
    typeface.
  - All interface text lives in `static/i18n.js` (English and Dutch), used through
    `data-i18n` attributes in the HTML and `vertaal()` in `app.js`.

### Why no frameworks?

Elio is meant to be something you can download and run in seconds, and something you
can read from top to bottom. Without dependencies:

- there is no `npm install` or `pip install`;
- nothing goes stale;
- every line in the repository is part of the app.

> The code (function and variable names) is written in Dutch; the interface is in
> English and Dutch.

## Run from source

1. Install **Python 3.11+** from [python.org](https://www.python.org/downloads/)
   (on Windows, tick **"Add Python to PATH"**).
2. Clone this repository.
3. Run `python app.py`.

On Windows you can also double-click **`snelkoppeling_maken.bat`** ("create shortcut")
to add an **Elio** shortcut to your Start menu and desktop. For troubleshooting, run
`start_app.bat`: it starts Elio with a console window that shows any error messages.
Errors from the silent launcher are written to `fout.log` in the data folder.

### Try it with demo data

The screenshots in the README use English demo data. It goes in its own folder and runs
on its own port, so it never touches your own data:

```
python tools/demo_data.py demo-data
ELIO_DATA=demo-data ELIO_PORT=8766 python app.py
```

On Windows (Command Prompt), run `set ELIO_DATA=demo-data` and `set ELIO_PORT=8766`
before `python app.py`.

### Command-line options and environment variables

| | |
|---|---|
| `--server` | Run only the server, without opening a window |
| `--stop` | Stop a running Elio (used by the installer) |
| `ELIO_DATA` | Use another data folder |
| `ELIO_PORT` | Use another port (default 8765) |

## Tests

```
python -m unittest discover -s tests -v
node tests/check_i18n.js
```

- **`tests/test_elio.py`** covers:
  - the API;
  - security checks;
  - the language of error messages;
  - database versions and backups;
  - the one-time data migration;
  - the macOS launcher model.
- **`tests/check_i18n.js`** checks that every interface text exists in both languages
  and is actually used.

The tests only use the standard library and always work in temporary folders, so they
never touch your own data. [GitHub Actions](../.github/workflows/tests.yml) runs them on
Windows, macOS and Linux, with Python 3.11 and the latest Python, on every push.

## Building the apps and releasing

[GitHub Actions](../.github/workflows/release.yml) builds both apps with PyInstaller on
every push to `main`, and tests the built app before keeping it:

- **Windows:** `Elio-Setup.exe`, made with [Inno Setup](https://jrsoftware.org/isinfo.php).
  It installs per user, so no administrator rights are needed. A
  `Elio-Windows-portable.zip` is built as well.
- **macOS:** `Elio-macOS.dmg`, for Apple Silicon.

The files can be downloaded from the run's *Artifacts*.

**To publish a release:**

1. Set `APP_VERSIE` in `app.py` (e.g. `0.2.0`).
2. Commit, then `git tag v0.2.0` and `git push origin v0.2.0`.
3. The workflow attaches the files to a new GitHub Release. A tag that doesn't match
   `APP_VERSIE` is refused.

The download files have fixed names (no version number). That way the README links
`releases/latest/download/Elio-Setup.exe` and `…/Elio-macOS.dmg` always point to the
newest version.

**To build locally:**

```
pip install pyinstaller==6.11.1
pyinstaller --noconfirm --clean packaging/elio.spec
iscc /DAppVersie=0.2.0 packaging\elio.iss      # Windows installer
```

The apps aren't code-signed. Windows SmartScreen and macOS Gatekeeper therefore warn on
first launch. The README explains how to get past that.

## Data and database versions

Elio keeps your data in your user profile, separate from the program, so updating or
reinstalling Elio never touches it:

| System | Folder |
|---|---|
| Windows | `%APPDATA%\Elio` |
| macOS | `~/Library/Application Support/Elio` |
| Linux | `~/.local/share/elio` |

The folder contains:

- **`data.db`:** everything (SQLite).
- **`backups/data-YYYY-MM-DD.db`:** one backup per day; the last 14 are kept.

**Database versions.** The database records its schema version (`PRAGMA user_version`).
A new column or table means a new function at the end of the `MIGRATIES` list in
`app.py`. Elio upgrades the database step by step and makes a safety copy first
(`backups/voor-vN-….db`). A database from a newer version of Elio is refused, not
damaged.

**Upgrading from an older version.** Before 0.1.0, Elio stored `data.db` next to
`app.py`. On first start it copies the file (and the backups) to the data folder
automatically. The original file is left untouched.

## Project structure

```
app.py                   HTTP server, REST API, SQLite, backups, launcher
start_app.pyw            silent launcher (entry point of the packaged app)
start_app.bat            launcher with console window (for troubleshooting)
maak_snelkoppeling.py    creates the Start menu / desktop shortcut (source install)
snelkoppeling_maken.bat  double-click wrapper for the script above
static/
  index.html             app shell
  style.css              design system and themes
  app.js                 views, state and API calls
  i18n.js                all interface text in English and Dutch
  icon.svg/.png/.ico     app icon
tests/
  test_elio.py           server tests
  check_i18n.js          translation check
tools/
  demo_data.py           fills a separate data folder with English demo data
packaging/
  elio.spec              PyInstaller recipe (Windows folder / macOS .app)
  elio.iss               Inno Setup script for the Windows installer
  icon.icns              macOS app icon
docs/
  DEVELOPMENT.md         this file
  screenshots/, buttons/ images used in the README
.github/workflows/
  tests.yml              runs all tests on every push
  release.yml            builds and tests the apps; publishes releases
```

## Roadmap

- [x] English / Dutch language switch (English as default)
- [x] Automated tests with GitHub Actions
- [x] Data stored in the user profile, with database versions
- [x] Standalone app for Windows and macOS, with downloadable releases
- [ ] "Today" view: overdue, due today and tasks pinned for today
- [ ] Task notes
- [ ] Backups from Settings: create one now, see the history, restore
- [ ] Semesters and an archive for finished courses
- [ ] Notifications for upcoming deadlines
- [ ] Statistics
- [ ] Calendar view
