<p align="center">
  <img src="static/icon.svg" alt="Elio logo" width="96" height="96">
</p>

<h1 align="center">Elio</h1>

<p align="center">
  A local-first study planner for Windows and macOS: track tasks per course, hard deadlines and personal target dates.<br>
  Python standard library + vanilla JavaScript. <strong>Zero dependencies.</strong>
</p>

<p align="center">
  <a href="https://github.com/penny707/Productivity-App/actions/workflows/tests.yml"><img src="https://github.com/penny707/Productivity-App/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://github.com/penny707/Productivity-App/releases/latest"><img src="https://img.shields.io/github/v/release/penny707/Productivity-App?label=download" alt="Latest release"></a>
</p>

---

Elio runs entirely on your own computer. Your data lives in a single SQLite file in
your user profile, and nothing is sent to the internet. It opens in its own window like a
native app, with a Start menu entry and no console window.

## Download

Get the latest version from the **[Releases page](https://github.com/penny707/Productivity-App/releases/latest)**.
You don't need Python or anything else.

### Windows 10 / 11

1. Download **`Elio-Setup-<version>.exe`** and run it. No administrator rights are
   needed; Elio is installed for your user only.
2. Windows may show *"Windows protected your PC"*, because Elio isn't signed with a
   paid certificate. Click **More info → Run anyway**.
3. Start Elio from the Start menu. To pin it to the taskbar: right-click **Elio** in
   Start and choose *Pin to taskbar*.

Prefer not to install anything? Download the **portable zip**, extract it anywhere and
run `Elio.exe`.

To uninstall, use *Settings → Apps → Installed apps → Elio*. Your data stays in
`%APPDATA%\Elio`.

### macOS (Apple Silicon: M1 or newer)

1. Download **`Elio-<version>-macos.dmg`**, open it and drag **Elio** into
   **Applications**.
2. The first time, macOS may say it can't verify Elio, because it isn't notarised by
   Apple. Open *System Settings → Privacy & Security*, scroll down and click
   **Open Anyway**.
3. Elio opens in Google Chrome, Microsoft Edge or Brave as an app window if one of them
   is installed, otherwise in your default browser.

## Features

- **Dashboard.** A greeting with today's date, four key figures (open tasks, overdue,
  deadlines this week, % done) and a card per course with progress and its next
  deadline.
- **Courses, sections and tasks.** Courses contain collapsible sections, which can be
  nested as deep as you like. Each task has a type (assignment, theory, lab).
- **Two kinds of dates.** A *hard deadline* (must be done) and a *personal target date*
  (when you want it done), kept deliberately separate.
- **Deadlines view.** Grouped into Overdue, Today, Next 7 days and Later, for deadlines
  and target dates alike.
- **Drag and drop.** Reorder courses in the sidebar, tasks within a section, and colours in Settings, by mouse or
  by keyboard (Alt + arrow keys).
- **Customisable colour palette.** Add colours with a colour picker or a HEX code,
  remove or reorder them. Text on a light course colour automatically switches to dark
  for readability.
- **Three themes.** Light, Grey and Dark.
- **English and Dutch.** English by default; switch in Settings. Dates and the
  server's messages follow the chosen language.
- **Automatic daily backups.** Kept in `backups/` (the last 14 are retained).
- **Feels like a real app.**
  - It opens in its own window (browser app mode: Edge or Chrome).
  - On Windows, launching it again brings the existing window to the front instead
    of opening a second one.
  - After an update, the background server replaces itself automatically.

## Run from source

For development, or if you prefer running the code yourself:

1. Install **Python 3.11+** from [python.org](https://www.python.org/downloads/)
   (on Windows, tick **"Add Python to PATH"**).
2. Clone or download this repository.
3. Run `python app.py`. On Windows you can also double-click
   **`snelkoppeling_maken.bat`** (Dutch for "create shortcut") to add an **Elio**
   shortcut to your Start menu and desktop.

For troubleshooting on Windows, run `start_app.bat`. It starts Elio with a console
window that shows any error messages. Errors from the silent launcher are written to
`fout.log` in the data folder.

## Building the apps

GitHub Actions builds both apps on every push to `main`
([workflow](.github/workflows/release.yml)) and tests the built app before keeping it.
Pushing a version tag publishes a release:

1. Set `APP_VERSIE` in `app.py` (e.g. `0.2.0`).
2. Commit, then `git tag v0.2.0` and `git push origin v0.2.0`.

To build locally: `pip install pyinstaller==6.11.1`, then
`pyinstaller --noconfirm --clean packaging/elio.spec`. The Windows installer is made
with [Inno Setup](https://jrsoftware.org/isinfo.php): `iscc /DAppVersie=0.2.0 packaging\elio.iss`.

## How it works

```
 Elio.lnk ──► pythonw start_app.pyw ──► app.py (HTTP server on 127.0.0.1:8765)
                                          │   ├─ REST API (/api/...)  ──► SQLite (data.db)
                                          │   └─ static files (static/)
                                          └─► Edge --app window  ◄── HTML/CSS/JS frontend
```

- **Backend (`app.py`):** built on `http.server` and `sqlite3` from the standard
  library.
  - It exposes a small JSON API for courses, sections, tasks and settings.
  - It only listens on `127.0.0.1`.
  - It rejects requests with a foreign `Host` header (DNS rebinding) and non-JSON
    write requests, so other websites cannot change your data.
- **Single instance:** a second launch detects the running server through
  `/api/status`.
  - If the server's code version (a hash of `app.py`) is older, it is replaced.
  - Otherwise the existing window is brought to the front through the Win32 API
    (`ctypes`).
- **Frontend (`static/`):** plain HTML, CSS and JavaScript with no framework and no
  build step. The design uses CSS custom properties for the three themes and the Windows
  11 *Segoe UI Variable* typeface.

### Why no frameworks?

Elio is meant to be something you can download and run in seconds, and something you
can read from top to bottom. Without dependencies:

- there is no `npm install` or `pip install`;
- nothing goes stale;
- every line in the repository is part of the app.

## Your data

Elio keeps your data in your user profile, separate from the program, so updating
or reinstalling Elio never touches it:

| System | Folder |
|---|---|
| Windows | `%APPDATA%\Elio` |
| macOS | `~/Library/Application Support/Elio` |
| Linux | `~/.local/share/elio` |

| What | File in that folder |
|---|---|
| All courses, tasks and settings | `data.db` (SQLite) |
| Daily backups (last 14) | `backups/data-YYYY-MM-DD.db` |

To restore a backup:

1. Stop Elio with the power button in the sidebar.
2. Copy the backup into the data folder.
3. Rename it to `data.db`.

**Upgrading from an older version?** Earlier versions stored `data.db` next to
`app.py`. On first start, Elio copies it (and the backups) to the data folder
automatically. The original file is left untouched; you can delete it once you're
happy everything moved.

**Database versions.** The database records its schema version. When a new version
of Elio needs an extra column or table, it upgrades the database step by step and
makes a safety copy first (`backups/voor-vN-….db`).

## Project structure

```
app.py                   HTTP server, REST API, SQLite, backups, single-instance launcher
start_app.pyw            silent launcher (used by the shortcut)
start_app.bat            launcher with console window (for troubleshooting)
maak_snelkoppeling.py    creates the Start menu / desktop shortcut
snelkoppeling_maken.bat  double-click wrapper for the script above
static/
  index.html             app shell
  style.css              design system and themes
  app.js                 views, state and API calls
  i18n.js                all interface text in English and Dutch
  icon.svg/.png/.ico     app icon
tests/
  test_elio.py           server tests (API, database versions, backups, data migration)
  check_i18n.js          checks that every text exists in both languages
.github/workflows/
  tests.yml              runs all tests on Windows, macOS and Linux on every push
  release.yml            builds and tests the Windows and macOS apps; publishes releases
packaging/
  elio.spec              PyInstaller recipe (Windows folder / macOS .app)
  elio.iss               Inno Setup script for the Windows installer
  icon.icns              macOS app icon
```

## Tests

```
python -m unittest discover -s tests -v
node tests/check_i18n.js
```

The tests only use the standard library and always work in temporary folders, so
they never touch your own data. GitHub Actions runs them on every push.

## Roadmap

- [x] English / Dutch language switch (English as default)
- [x] Automated tests with GitHub Actions
- [x] Data stored in the user profile, with database versions
- [x] Standalone app for Windows and macOS (PyInstaller) and downloadable releases
- [ ] "Today" view: overdue, due today and tasks pinned for today
- [ ] Task notes
- [ ] Backups from Settings: create one now, see the history, restore
- [ ] Semesters and an archive for finished courses
- [ ] Windows notifications for upcoming deadlines
- [ ] Statistics
- [ ] Calendar view

## License

[MIT](LICENSE)
