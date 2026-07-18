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
    version: "v2.1.21",
    date: "2026-07-18",
    title: "Editable “due today by client” strip",
    notes: [
      "The Due-today-by-client strip at the top of the Clients board is now interactive: check a task off (syncs everywhere), edit its title/date inline, or delete it — right from the strip.",
    ],
  },
  {
    version: "v2.1.20",
    date: "2026-07-18",
    title: "Recurring client tasks + cross-tab done sync",
    notes: [
      "Client board: add recurring tasks per project — weekly (pick weekdays) or monthly (a day like the 15th or 30th; 31 = last day). They auto-appear on their due dates with an optional time.",
      "Checking a task off now syncs everywhere: mark a pulled client task done in Tasks · Today and it checks off on the client board (and the Due-Today card) — and vice-versa.",
    ],
  },
  {
    version: "v2.1.19",
    date: "2026-07-16",
    title: "Client board shows what's already on today",
    notes: [
      "On the client board, a task already added to Tasks · Today shows a green ✓ today instead of ＋ today.",
      "It's a toggle — click the green ✓ to remove it from today; click ＋ to add it. State reflects Section 10 in real time.",
    ],
  },
  {
    version: "v2.1.18",
    date: "2026-07-16",
    title: "Layout fits the screen (left-aligned)",
    notes: [
      "The dashboard is now left-aligned and the right-hand column fits on normal screens — no more widening the window to see Next Up / Nutrition / Goals.",
      "Gentler desktop zoom and a wrap-safe top nav, so there's no horizontal scroll from ~1180px up.",
    ],
  },
  {
    version: "v2.1.17",
    date: "2026-07-16",
    title: "No duplicate day tasks + add-to-today from client board",
    notes: [
      "Pulling the same client/CRM task into Tasks · Today no longer creates duplicates — it's deduped by source, so repeated adds (or a refresh) are a no-op.",
      "New ＋ today button on every client-board task adds it straight to Section 10, carrying its time.",
      "Manual tasks you type yourself are unaffected — you can still add two with the same name on purpose.",
    ],
  },
  {
    version: "v2.1.16",
    date: "2026-07-16",
    title: "Hotfix: overdue-task crash",
    notes: ["Fixed a client-side crash that could blank the home page when an overdue task with no set time rolled into today."],
  },
  {
    version: "v2.1.15",
    date: "2026-07-15",
    title: "Calorie target → 1,750",
    notes: ["Daily calorie target changed from 2,000 to 1,750 kcal (Nutrition card, Health averages, and Jarvis)."],
  },
  {
    version: "v2.1.14",
    date: "2026-07-15",
    title: "Client task times + voice client-matching",
    notes: [
      "Client tasks now keep a clock time, not just a date — set it inline on the client board (tap the date chip). The time is preserved when the task is pulled into Section 10.",
      "A client reminder due today with a time auto-flows into Tasks · Today at that time (e.g. “BYTOX invoice due today at 3pm” lands on the BYTOX board and in Section 10 at 3:00 PM).",
      "Spoken client names now match even when Siri mishears them (“by tox”, “bydox”, “hydro gel” all resolve to the right client).",
    ],
  },
  {
    version: "v2.1.13",
    date: "2026-07-14",
    title: "“Work on” button on Section 10",
    notes: [
      "Each open task in Tasks · Today now has a ▶ work on button that slides it into Currently Working On so you can see what you're actively on.",
      "The task stays in Section 10 while you work; marking it Done in the strip checks it off there and stamps the start/finish times.",
    ],
  },
  {
    version: "v2.1.12",
    date: "2026-07-14",
    title: "Overdue failsafe — tasks are never lost",
    notes: [
      "Overdue tasks that roll into the next day now blink red and show the date they were originally due (“overdue · was due Jul 12”).",
      "Carry-forward is loss-proof: a task is written onto the new day before it's removed from the old one, so an interrupted sweep can never drop it (worst case is a harmless duplicate that self-heals).",
      "Look-back window extended to 14 days; tasks older than that are still never deleted — only surfaced once swept.",
      "Verified with edge-case tests: done tasks stay put, multi-day rollovers keep their original due date, repeated sweeps don't duplicate, and out-of-window tasks are preserved.",
    ],
  },
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
