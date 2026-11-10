/* =========================================================
   Elio — i18n.js
   Alle teksten van de interface, in het Engels (standaard) en Nederlands.
   - In de HTML: data-i18n="sleutel" (tekst), data-i18n-title,
     data-i18n-placeholder en data-i18n-aria-label (attributen).
   - In app.js: vertaal("sleutel", { variabelen }).
   Een waarde is een tekst met {plaatshouders}, of een functie
   (handig voor meervouden).
   ========================================================= */

const VERTALINGEN = {
  en: {
    // Algemeen
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.close": "Close",
    "error.noConnection": "Can't reach Elio. Start it again from its shortcut.",
    "error.generic": "Something went wrong",

    // Zijbalk
    "sidebar.toggle": "Collapse or expand sidebar",
    "nav.overview": "Overview",
    "nav.deadlines": "Deadlines",
    "sidebar.courses": "Courses",
    "course.new": "New course",
    "theme.group": "Theme",
    "theme.light": "Light",
    "theme.grey": "Grey",
    "theme.dark": "Dark",
    "settings.title": "Settings",
    "app.quit": "Quit Elio",

    // Overzicht
    "greeting.morning": "Good morning",
    "greeting.afternoon": "Good afternoon",
    "greeting.evening": "Good evening",
    "overview.courses": "Courses",
    "overview.empty.title": "You don't have any courses yet",
    "overview.empty.text": "Create your first course to get started.",
    "overview.sub.noTasks": "Add tasks to your courses to track your progress.",
    "overview.sub.allDone": "All tasks are done. Nice work!",
    "overview.sub.open": ({ open, week }) =>
      `You have ${open} open ${open === 1 ? "task" : "tasks"}` +
      (week ? `, ${week} with a deadline this week.` : "."),
    "kpi.open": "Open tasks",
    "kpi.open.meta": "of {total} in total",
    "kpi.overdue": "Overdue",
    "kpi.overdue.some": "hard deadlines passed",
    "kpi.overdue.none": "nothing overdue",
    "kpi.week": "Deadlines this week",
    "kpi.week.today": "{n} of them today",
    "kpi.week.next": "next 7 days",
    "kpi.done": "Completed",
    "tasks.xOfY": "{done} of {total} tasks",
    "card.next": "Next deadline: {date}",
    "card.noDeadlines": "No open deadlines",
    "card.noTasks": "No tasks yet",
    "card.aria": "{name}, {pct}% complete",

    // Taaktypes
    "type.opdracht": "Assignment",
    "type.theorie": "Theory",
    "type.labo": "Lab",
    "types.opdracht": "Assignments",
    "types.theorie": "Theory",
    "types.labo": "Labs",
    "type.option.opdracht": "Assignment (upload)",
    "type.option.theorie": "Theory (slides read)",
    "type.option.labo": "Lab (completed)",

    // Relatieve datums
    "rel.late": "{n}d late",
    "rel.today": "today",
    "rel.tomorrow": "tomorrow",
    "rel.in": "in {n}d",

    // Vakpagina
    "course.back": "Back to overview",
    "course.backShort": "Back",
    "course.editTitle": "Edit course",
    "course.deleteTitle": "Delete course",
    "course.sub.none": "No tasks in this course yet.",
    "course.sub": "{done} of {total} tasks completed",
    "course.progress": "Progress",
    "sections.title": "Sections",
    "section.new": "New section",
    "sections.empty.title": "No sections yet",
    "sections.empty.text": "Add a chapter, topic or series of labs.",
    "section.addSub": "Add subsection",
    "section.rename": "Rename",
    "task.add": "Add task",
    "task.grip": "Drag to reorder (or Alt + ↑/↓)",
    "task.deadlineTitle": "Hard deadline ({rel})",
    "task.targetTitle": "Personal target date ({rel})",

    // Deadlines
    "deadlines.title": "Deadlines",
    "deadlines.sub": "Hard deadlines and personal target dates, kept apart.",
    "deadlines.tab.hard": "Hard deadlines",
    "deadlines.tab.target": "My target dates",
    "deadlines.empty.title": "No open deadlines",
    "deadlines.empty.text": "You can add a hard deadline to any task.",
    "target.empty.title": "No open target dates",
    "target.empty.text": "Target dates are personal goals, separate from hard deadlines.",
    "group.overdue": "Overdue",
    "group.today": "Today",
    "group.week": "Next 7 days",
    "group.later": "Later",

    // Instellingen
    "settings.sub": "Make Elio your own.",
    "settings.language": "Language",
    "settings.language.text": "The language of the interface.",
    "settings.colors": "Course colours",
    "settings.colors.text": "You choose from these colours when you create or edit a course. " +
      "Drag to change the order; a new course gets the first colour. " +
      "Courses keep their colour, even if you remove it here.",
    "settings.colors.reset": "Restore defaults",
    "settings.theme": "Theme",
    "settings.theme.text": "You can also switch at the bottom of the sidebar.",
    "color.pick": "Pick a colour",
    "color.picker": "Colour picker",
    "color.hex": "HEX code",
    "color.add": "Add colour",
    "color.drag": "Drag to change the order",
    "color.aria": "{hex}. Alt + left or right arrow to move.",
    "color.used": ({ n }) => (n === 1 ? "1 course" : `${n} courses`),
    "color.remove": "Remove {hex}",
    "color.removeAria": "Remove colour {hex}",
    "color.option": "Colour {hex}",
    "color.minOne": "You need at least one colour.",
    "color.removed": "{hex} removed",
    "color.added": "{hex} added",
    "color.invalid": "Not a valid HEX code. Use e.g. #4F7CAC or 4F7CAC.",
    "color.duplicate": "{hex} is already in your colours.",
    "color.max": "You can save up to {max} colours.",
    "color.reset.title": "Restore default colours?",
    "color.reset.text": "Your colour list will be replaced by the 10 default colours. " +
      "Existing courses keep their colour.",
    "color.reset.button": "Restore",
    "color.reset.done": "Default colours restored",

    // Vensters
    "course.modal.new": "New course",
    "course.modal.edit": "Edit course",
    "field.name": "Name",
    "course.name.placeholder": "e.g. Mathematics",
    "field.color": "Colour",
    "color.manage": "Manage colours",
    "section.modal.new": "New section",
    "section.modal.newSub": "New subsection",
    "section.modal.edit": "Edit section",
    "field.title": "Title",
    "section.placeholder": "e.g. Chapter 1",
    "section.under": "Under: {title}",
    "task.modal.new": "New task",
    "task.modal.edit": "Edit task",
    "task.placeholder": "e.g. Upload exercise 3.2",
    "field.type": "Type",
    "field.deadline": "Hard deadline",
    "field.target": "Personal target date",
    "task.help": "Both are optional. Deadline = must really be done. Target date = when you want it done.",

    // Meldingen (toasts)
    "toast.courseUpdated": "Course updated",
    "toast.courseCreated": "Course created",
    "toast.courseDeleted": "Course deleted",
    "toast.sectionUpdated": "Section updated",
    "toast.sectionCreated": "Section created",
    "toast.sectionDeleted": "Section deleted",
    "toast.taskUpdated": "Task updated",
    "toast.taskCreated": "Task created",
    "toast.taskDeleted": "Task deleted",

    // Bevestigen
    "confirm.deleteCourse.title": "Delete course?",
    "confirm.deleteCourse.text": "\"{name}\" and all its sections and tasks will be permanently deleted.",
    "confirm.deleteSection.title": "Delete section?",
    "confirm.deleteSection.text": "\"{title}\" and all its tasks and subsections will be permanently deleted.",
    "confirm.deleteTask.title": "Delete task?",
    "confirm.deleteTask.text": "\"{title}\" will be permanently deleted.",
    "confirm.quit.title": "Quit Elio?",
    "confirm.quit.text": "Elio stops running in the background. Your data is already saved. " +
      "Open Elio from its shortcut to start it again.",
    "confirm.quit.button": "Quit",

    // Afgesloten
    "closed.title": "Elio has been closed",
    "closed.text": "You can close this window. Open Elio from its shortcut to start it again."
  },

  nl: {
    "common.cancel": "Annuleren",
    "common.save": "Opslaan",
    "common.edit": "Bewerken",
    "common.delete": "Verwijderen",
    "common.close": "Sluiten",
    "error.noConnection": "Geen verbinding met Elio. Start het opnieuw via de snelkoppeling.",
    "error.generic": "Er ging iets mis",

    "sidebar.toggle": "Zijbalk in-/uitklappen",
    "nav.overview": "Overzicht",
    "nav.deadlines": "Deadlines",
    "sidebar.courses": "Vakken",
    "course.new": "Nieuw vak",
    "theme.group": "Thema",
    "theme.light": "Licht",
    "theme.grey": "Grijs",
    "theme.dark": "Donker",
    "settings.title": "Instellingen",
    "app.quit": "Elio afsluiten",

    "greeting.morning": "Goedemorgen",
    "greeting.afternoon": "Goedemiddag",
    "greeting.evening": "Goedenavond",
    "overview.courses": "Vakken",
    "overview.empty.title": "Je hebt nog geen vakken",
    "overview.empty.text": "Maak je eerste vak aan om te beginnen.",
    "overview.sub.noTasks": "Voeg taken toe aan je vakken om je voortgang te volgen.",
    "overview.sub.allDone": "Alle taken zijn afgerond. Goed bezig!",
    "overview.sub.open": ({ open, week }) =>
      `Je hebt ${open} open ${open === 1 ? "taak" : "taken"}` +
      (week ? `, ${week} met een deadline deze week.` : "."),
    "kpi.open": "Open taken",
    "kpi.open.meta": "van {total} in totaal",
    "kpi.overdue": "Te laat",
    "kpi.overdue.some": "harde deadlines verstreken",
    "kpi.overdue.none": "niets te laat",
    "kpi.week": "Deadlines deze week",
    "kpi.week.today": "waarvan {n} vandaag",
    "kpi.week.next": "komende 7 dagen",
    "kpi.done": "Afgerond",
    "tasks.xOfY": "{done} van {total} taken",
    "card.next": "Eerstvolgende deadline: {date}",
    "card.noDeadlines": "Geen open deadlines",
    "card.noTasks": "Nog geen taken",
    "card.aria": "{name}, {pct}% afgerond",

    "type.opdracht": "Opdracht",
    "type.theorie": "Theorie",
    "type.labo": "Labo",
    "types.opdracht": "Opdrachten",
    "types.theorie": "Theorie",
    "types.labo": "Labo",
    "type.option.opdracht": "Opdracht (uploaden)",
    "type.option.theorie": "Theorie (slides gelezen)",
    "type.option.labo": "Labo (gemaakt)",

    "rel.late": "{n}d te laat",
    "rel.today": "vandaag",
    "rel.tomorrow": "morgen",
    "rel.in": "over {n}d",

    "course.back": "Terug naar overzicht",
    "course.backShort": "Terug",
    "course.editTitle": "Vak bewerken",
    "course.deleteTitle": "Vak verwijderen",
    "course.sub.none": "Nog geen taken in dit vak.",
    "course.sub": "{done} van {total} taken afgerond",
    "course.progress": "Voortgang",
    "sections.title": "Onderdelen",
    "section.new": "Nieuw onderdeel",
    "sections.empty.title": "Nog geen onderdelen",
    "sections.empty.text": "Voeg een hoofdstuk, thema of labo-reeks toe.",
    "section.addSub": "Sub-onderdeel toevoegen",
    "section.rename": "Naam wijzigen",
    "task.add": "Taak toevoegen",
    "task.grip": "Sleep om de volgorde te wijzigen (of Alt + ↑/↓)",
    "task.deadlineTitle": "Harde deadline ({rel})",
    "task.targetTitle": "Persoonlijk streefmoment ({rel})",

    "deadlines.title": "Deadlines",
    "deadlines.sub": "Harde deadlines en persoonlijke streefmomenten, apart van elkaar.",
    "deadlines.tab.hard": "Harde deadlines",
    "deadlines.tab.target": "Mijn streefmomenten",
    "deadlines.empty.title": "Geen openstaande deadlines",
    "deadlines.empty.text": "Je kan per taak een harde deadline toevoegen.",
    "target.empty.title": "Geen openstaande streefmomenten",
    "target.empty.text": "Streefmomenten zijn persoonlijke doelen, los van harde deadlines.",
    "group.overdue": "Te laat",
    "group.today": "Vandaag",
    "group.week": "Komende 7 dagen",
    "group.later": "Later",

    "settings.sub": "Pas Elio aan naar jouw smaak.",
    "settings.language": "Taal",
    "settings.language.text": "De taal van de app.",
    "settings.colors": "Kleuren voor vakken",
    "settings.colors.text": "Uit deze kleuren kies je bij het aanmaken of bewerken van een vak. " +
      "Sleep om de volgorde te wijzigen; de eerste kleur krijgt een nieuw vak standaard. " +
      "Vakken behouden hun kleur, ook als je die hier verwijdert.",
    "settings.colors.reset": "Standaard herstellen",
    "settings.theme": "Thema",
    "settings.theme.text": "Kan je ook onderaan in de zijbalk wisselen.",
    "color.pick": "Kies een kleur",
    "color.picker": "Kleurkiezer",
    "color.hex": "HEX-code",
    "color.add": "Kleur toevoegen",
    "color.drag": "Sleep om de volgorde te wijzigen",
    "color.aria": "{hex}. Alt + pijltje links of rechts om te verplaatsen.",
    "color.used": ({ n }) => (n === 1 ? "1 vak" : `${n} vakken`),
    "color.remove": "{hex} verwijderen",
    "color.removeAria": "Kleur {hex} verwijderen",
    "color.option": "Kleur {hex}",
    "color.minOne": "Je hebt minstens één kleur nodig.",
    "color.removed": "{hex} verwijderd",
    "color.added": "{hex} toegevoegd",
    "color.invalid": "Geen geldige HEX-code. Gebruik bv. #4F7CAC of 4F7CAC.",
    "color.duplicate": "{hex} staat al in je kleuren.",
    "color.max": "Je kan maximaal {max} kleuren bewaren.",
    "color.reset.title": "Standaardkleuren herstellen?",
    "color.reset.text": "Je eigen kleurenlijst wordt vervangen door de 10 standaardkleuren. " +
      "Bestaande vakken behouden hun kleur.",
    "color.reset.button": "Herstellen",
    "color.reset.done": "Standaardkleuren hersteld",

    "course.modal.new": "Nieuw vak",
    "course.modal.edit": "Vak bewerken",
    "field.name": "Naam",
    "course.name.placeholder": "bv. Wiskunde",
    "field.color": "Kleur",
    "color.manage": "Kleuren beheren",
    "section.modal.new": "Nieuw onderdeel",
    "section.modal.newSub": "Nieuw sub-onderdeel",
    "section.modal.edit": "Onderdeel bewerken",
    "field.title": "Titel",
    "section.placeholder": "bv. Hoofdstuk 1",
    "section.under": "Onder: {title}",
    "task.modal.new": "Nieuwe taak",
    "task.modal.edit": "Taak bewerken",
    "task.placeholder": "bv. Oefening 3.2 uploaden",
    "field.type": "Type",
    "field.deadline": "Harde deadline",
    "field.target": "Persoonlijk streefmoment",
    "task.help": "Beide zijn optioneel. Deadline = moet echt af zijn. Streefmoment = ik wil het tegen dan af hebben.",

    "toast.courseUpdated": "Vak bijgewerkt",
    "toast.courseCreated": "Vak aangemaakt",
    "toast.courseDeleted": "Vak verwijderd",
    "toast.sectionUpdated": "Onderdeel bijgewerkt",
    "toast.sectionCreated": "Onderdeel aangemaakt",
    "toast.sectionDeleted": "Onderdeel verwijderd",
    "toast.taskUpdated": "Taak bijgewerkt",
    "toast.taskCreated": "Taak aangemaakt",
    "toast.taskDeleted": "Taak verwijderd",

    "confirm.deleteCourse.title": "Vak verwijderen?",
    "confirm.deleteCourse.text": "\"{name}\" en alle onderdelen en taken erin worden permanent verwijderd.",
    "confirm.deleteSection.title": "Onderdeel verwijderen?",
    "confirm.deleteSection.text": "\"{title}\" en alle taken en sub-onderdelen erin worden permanent verwijderd.",
    "confirm.deleteTask.title": "Taak verwijderen?",
    "confirm.deleteTask.text": "\"{title}\" wordt permanent verwijderd.",
    "confirm.quit.title": "Elio afsluiten?",
    "confirm.quit.text": "Elio stopt op de achtergrond. Je gegevens zijn al opgeslagen. " +
      "Open Elio via de snelkoppeling om het opnieuw te starten.",
    "confirm.quit.button": "Afsluiten",

    "closed.title": "Elio is afgesloten",
    "closed.text": "Je kan dit venster sluiten. Open Elio via de snelkoppeling om het opnieuw te starten."
  }
};

const TALEN = ["en", "nl"];
let huidigeTaal = "en";

function zetTaal(taal) {
  huidigeTaal = TALEN.includes(taal) ? taal : "en";
  document.documentElement.lang = huidigeTaal;
}

// Tekst in de huidige taal; valt terug op Engels, en anders op de sleutel zelf
function vertaal(sleutel, vars = {}) {
  const waarde = VERTALINGEN[huidigeTaal][sleutel] ?? VERTALINGEN.en[sleutel];
  if (waarde === undefined) return sleutel;
  if (typeof waarde === "function") return waarde(vars);
  return waarde.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

// Taalcode voor datums (toLocaleDateString)
function taalLocale() {
  return huidigeTaal === "nl" ? "nl-BE" : "en-GB";
}

// Alle vaste teksten in de HTML vertalen
function vertaalPagina() {
  $$("[data-i18n]").forEach(e => { e.textContent = vertaal(e.dataset.i18n); });
  for (const attr of ["title", "placeholder", "aria-label"]) {
    $$(`[data-i18n-${attr}]`).forEach(e => {
      e.setAttribute(attr, vertaal(e.getAttribute(`data-i18n-${attr}`)));
    });
  }
}
