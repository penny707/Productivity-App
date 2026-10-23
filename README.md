<p align="center">
  <img src="static/icon.svg" alt="Elio logo" width="96" height="96">
</p>

<h1 align="center">Elio</h1>

<p align="center">
  A local-first study planner for Windows: track tasks per course, hard deadlines and personal target dates.<br>
  Python standard library + vanilla JavaScript. <strong>Zero dependencies.</strong>
</p>

---

Elio runs entirely on your own PC. Your data lives in a single SQLite file next to
the app, and nothing is sent to the internet. It opens in its own window like a
native app, with a desktop/Start menu shortcut and no console window.

> The interface is currently in Dutch. An English/Dutch language switch is planned.

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
- **Drag and drop.** Reorder courses in the sidebar and colours in Settings, by mouse or
  by keyboard (Alt + arrow keys).
- **Customisable colour palette.** Add colours with a colour picker or a HEX code,
  remove or reorder them. Text on a light course colour automatically switches to dark
  for readability.
- **Three themes.** Light, Grey and Dark.
- **Automatic daily backups.** Kept in `backups/` (the last 14 are retained).
- **Feels like a real app.**
  - It opens in its own window (Microsoft Edge app mode).
  - Launching it again brings the existing window to the front instead of opening a second one.
  - After an update, the background server replaces itself automatically.

## Getting started (Windows)

1. Install **Python 3.8+** from [python.org](https://www.python.org/downloads/)
   and tick **"Add Python to PATH"** during installation.
2. Clone or download this repository.
3. Double-click **`snelkoppeling_maken.bat`** (Dutch for "create shortcut").
   An **Elio** shortcut is added to your Start menu and desktop.
4. Start Elio from the shortcut. To pin it to the taskbar: open Start, right-click
   **Elio** and choose *Pin to taskbar*.

For troubleshooting, run `start_app.bat` instead. It starts Elio with a console
window that shows any error messages. Errors from the silent launcher are written to
`fout.log`.

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

| What | Where |
|---|---|
| All courses, tasks and settings | `data.db` (SQLite) |
| Daily backups (last 14) | `backups/data-YYYY-MM-DD.db` |

To restore a backup:

1. Stop Elio with the power button in the sidebar.
2. Copy the backup next to `app.py`.
3. Rename it to `data.db`.

`data.db` and `backups/` are listed in `.gitignore`, so personal data never ends up
in git.

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
  icon.svg/.png/.ico     app icon
```

## Roadmap

- [ ] English / Dutch language switch (English as default)
- [ ] "Today" view: overdue, due today and tasks pinned for today
- [ ] Semesters and an archive for finished courses
- [ ] Task notes
- [ ] Backups from Settings: create one now, see the history, restore
- [ ] Windows notifications for upcoming deadlines
- [ ] Automated tests with GitHub Actions
- [ ] Standalone `Elio.exe` (PyInstaller) and downloadable releases
- [ ] Statistics
- [ ] Calendar view

## License

[MIT](LICENSE)
