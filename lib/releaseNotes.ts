// Release notes — one entry per shipped WARROOM version, newest first.
// Every release adds an entry here so the Build tab can show exactly what
// changed. Keep bullets short and user-facing (what you can now do), not
// implementation detail.
export interface Release {
  version: string; // matches lib/config.ts version at ship time (e.g. "v2.1.3")
  date: string; // YYYY-MM-DD shipped
  title?: string; // optional one-line headline
  notes: string[]; // bullet list of what changed
}

export const RELEASE_NOTES: Release[] = [
  {
    version: "v2.1.11",
    date: "2026-07-14",
    title: "Guided capture + reschedule fix",
    notes: [
      "Reminders import accepts task, client, and day/time as separate fields — for a guided Siri capture that asks one thing at a time.",
      "Returns a spoken confirmation line (e.g. “Added Test my website to Get Hydrogel”).",
      "Fixed: rescheduling a Section 10 task to another day no longer risks losing it — the task is only removed from today after the new day's copy is confirmed created, with an on-screen “Moved to …” confirmation.",
    ],
  },
  {
    version: "v2.1.10",
    date: "2026-07-14",
    title: "Reminders import — clock times",
    notes: [
      "Spoken clock times now set the task's time in Section 10 (e.g. “…at 11 pm” → the task is timed 11:00 PM), instead of ending up in the title.",
      "Handles 11pm / 9am / 3:30 p.m. / 23:00, and a bare time with no date is treated as today.",
      "The time and date words are cleaned out of the task title.",
    ],
  },
  {
    version: "v2.1.9",
    date: "2026-07-14",
    title: "Reminders import — smarter client matching",
    notes: [
      "A reminder now matches a client by a distinctive brand word (e.g. “Hydrogel” finds “Get Hydrogel — Funnel”, “BYTOX”, “Greenwich”), not just the exact full project name.",
      "Generic words (website, group, support…) no longer trigger a false client match.",
    ],
  },
  {
    version: "v2.1.8",
    date: "2026-07-14",
    title: "Reminders import — handles stringified lists",
    notes: [
      "If the iPhone Shortcut serializes the reminders list into a text field, the endpoint now parses it back into JSON automatically.",
    ],
  },
  {
    version: "v2.1.7",
    date: "2026-07-14",
    title: "Reminders import — accepts any payload shape",
    notes: [
      "The import endpoint now accepts whatever an iPhone Shortcut sends — a batch, a bare array, or a single reminder — so setup can't fail on a formatting technicality.",
    ],
  },
  {
    version: "v2.1.6",
    date: "2026-07-14",
    title: "Reminders import — simpler & date-safe",
    notes: [
      "The iPhone Shortcut now only needs to send each reminder's text and due date — WARROOM generates the dedup id itself.",
      "Accepts any due-date format Apple sends and pins it to the correct calendar day (no more off-by-one).",
    ],
  },
  {
    version: "v2.1.5",
    date: "2026-07-14",
    title: "Siri / Apple Reminders import",
    notes: [
      "New import endpoint: an iPhone Shortcut sends your reminders straight into WARROOM.",
      "Smart routing — names a client → that client's board; chores/kids/doctor → Home Chores; “due today” → Tasks · Today; anything unsure → Project Miscellaneous.",
      "Spoken due dates (“Friday”, “tomorrow”, “today”) are parsed onto the task automatically.",
      "Won't double-file: each reminder is deduped by its Apple id, and every import is logged in History (revertable).",
    ],
  },
  {
    version: "v2.1.4",
    date: "2026-07-14",
    title: "Quote of the day + live ticker",
    notes: [
      "Jarvis Brief now shows a motivational quote of the day (changes each morning).",
      "New live ticker under the date: S&P 500, Dow, and XRP with real-time price and % change.",
      "Rotating top-news headlines run in the ticker — tap one to open the story.",
      "Add your own tickers (any stock/crypto symbol) and remove ones you don't want via the ✎ edit control.",
    ],
  },
  {
    version: "v2.1.3",
    date: "2026-07-14",
    title: "Client due dates + release notes",
    notes: [
      "Client board: change a task's due date any time — tap the date chip (or “＋ due date”) to pick a new one or clear it.",
      "That due date is what drives the task once it moves to the home page, where you add the time you plan to work on it.",
      "Build tab: this Release Notes panel — every version is listed and expands to show exactly what shipped.",
    ],
  },
  {
    version: "v2.1.2",
    date: "2026-07-14",
    title: "Move client tasks between projects",
    notes: [
      "Client board: every task has a ⇄ button — move it to any other project in two taps if it landed in the wrong spot.",
      "Moves are logged in History and fully revertable.",
      "Gives the upcoming Siri/Reminders import a clean way to reslot anything that files under the wrong project.",
    ],
  },
  {
    version: "v2.1.1",
    date: "2026-07-13",
    title: "Overdue roll-forward",
    notes: [
      "Tasks left unchecked at day's end roll forward to the next day tagged “overdue.”",
      "Timed tasks that pass their hour flash red with a ⟳ reschedule button.",
      "Section 10 tasks can be rescheduled to a different day, not just a different time.",
    ],
  },
  {
    version: "v2.1",
    date: "2026-07-13",
    title: "Build Console",
    notes: [
      "New Build tab: request features in plain words, PIN-gated, that ship automatically.",
      "Revert button rolls the live site back one deploy if something goes wrong.",
      "Every build auto-increments the version number (2.<minor>.<build>).",
    ],
  },
  {
    version: "v2.0",
    date: "2026-07-13",
    title: "WARROOM",
    notes: ["Renamed the dashboard to WARROOM and started versioned releases."],
  },
];
