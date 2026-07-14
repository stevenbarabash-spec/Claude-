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
