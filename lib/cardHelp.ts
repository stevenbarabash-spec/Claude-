// Per-card "How do I use this?" copy, keyed by the Panel title. The eye in each
// card header opens a widget with three sections — what it does, how to use it,
// and what it interacts with — and can read them aloud.
// This is a central registry on purpose: it's the reusable how-to layer for
// handing this dashboard to other people later.
export interface CardHelp {
  what: string;
  how: string[];
  interacts: string[];
}

export const CARD_HELP: Record<string, CardHelp> = {
  Operator: {
    what: "Your at-a-glance identity strip — who's at the wheel, today's focus, and your habit streak.",
    how: [
      "Focus mirrors what you set in Session's “Today I will”.",
      "Streak counts consecutive days you've checked off habits.",
    ],
    interacts: [
      "Session — shows the focus you set there.",
      "Habits — the streak reflects your habit check-offs.",
    ],
  },
  Session: {
    what: "Your daily launchpad: greeting, live clock, your one focus for the day, and a quick capture inbox.",
    how: [
      "“Today I will” — set your single intention; it auto-saves.",
      "Capture — type anything (task, meal, money, idea) and Jarvis files it in the right place, then tells you where.",
      "The Jarvis briefing appears here when generated.",
    ],
    interacts: [
      "Operator — displays your “Today I will” focus.",
      "Capture routes into CRM, Nutrition, Finance, or Brain automatically.",
      "History — anything Capture files can be reverted there.",
    ],
  },
  Cashflow: {
    what: "This month's money pulse — what's come in and what's owed to you.",
    how: [
      "Blurred until you enter your PIN; re-hides itself after 30 seconds.",
      "Tap “this month →” for the full Finance page with every line item.",
    ],
    interacts: [
      "Finance tab — the full breakdown and editing live there.",
      "Capture & Jarvis — money you mention gets booked here.",
    ],
  },
  Calendar: {
    what: "A 7-day strip of your merged calendars — tap a day to see its events.",
    how: [
      "Events come from all your connected calendar feeds.",
      "A dot under a day means something's scheduled.",
    ],
    interacts: [
      "Schedule tab — day / week / month views of the same events.",
      "Today · Timeline — timed events appear as blue notches.",
    ],
  },
  Goals: {
    what: "Your week and month goals — the bigger targets behind the daily grind.",
    how: [
      "Type in “Add a goal…” and press Enter to add one.",
      "Check the box when done; the × removes it.",
    ],
    interacts: [
      "Review tab — your weekly review reflects on these goals.",
    ],
  },
  "Key Blockers": {
    what: "The handful of things truly stuck or blocking progress — your must-clear list.",
    how: [
      "Pulls your starred / key tasks from the CRM.",
      "Star a task in the CRM to make it show here.",
    ],
    interacts: [
      "CRM — star a task there and it surfaces here.",
    ],
  },
  Nutrition: {
    what: "Today's fuel — calories and macros against your targets, with an eating cutoff timer.",
    how: [
      "Log a meal in plain words (“chicken bowl”) and Jarvis estimates the macros.",
      "Edit any macro directly; the others rebalance.",
      "Cutoff counts down to your last-meal time.",
    ],
    interacts: [
      "Health tab — the fuller nutrition history.",
      "Capture & Jarvis — “had a burrito” logs a meal here.",
    ],
  },
  "Client Work · Due Today": {
    what: "Everything due today across your client projects, grouped by client.",
    how: [
      "Overdue items flag red; today's are amber.",
      "Tap “view all →” for the full Command board on the Clients tab.",
    ],
    interacts: [
      "Clients tab — the source board you manage projects on.",
      "CRM — client tasks also flow into your task tiers.",
      "Next Up & Schedule — these dues feed both.",
    ],
  },
  "Tasks · Today": {
    what: "Quick daily to-dos with optional times — the day's must-dos that reset each morning.",
    how: [
      "Type a task, optionally pick a time, then Add.",
      "Give it a time and it also shows on the timeline above.",
      "Check it off, or × to delete.",
    ],
    interacts: [
      "Today · Timeline — timed tasks appear as red notches.",
      "Next Up — these count toward what you should do next.",
      "History — check-offs are logged and reversible.",
    ],
  },
  "Next Up": {
    what: "One button that ranks everything you owe and tells you what to work on next.",
    how: [
      "Tap “what's next?” — it scores client work, CRM, and today's tasks by due date and priority, then Jarvis sequences them.",
      "Red = overdue / due today / tomorrow. Yellow = this week.",
      "Tap “work on” to pull one into Currently Working On.",
    ],
    interacts: [
      "Pulls from Client Work, CRM, and Tasks · Today.",
      "Currently Working On — “work on” sends a task there.",
    ],
  },
  Timers: {
    what: "One-tap countdown timers that ring like an alarm when they hit zero.",
    how: [
      "Tap 1m–1h to start; run several at once.",
      "The alarm rings 20s steady, 10s faster, then stops itself if you've walked away.",
      "Hit dismiss / cancel to clear one.",
    ],
    interacts: [
      "Stands alone — a focus / reminder tool, no data links.",
    ],
  },
  "Currently Working On": {
    what: "What you're actively doing right now, with a live clock and a blinking status light.",
    how: [
      "Pull tasks in from Next Up with “work on”.",
      "Hit “✓ done” and it checks off at its real source everywhere at once.",
      "“Stop” removes it without completing.",
    ],
    interacts: [
      "Next Up — feeds tasks into this strip.",
      "Client board / CRM / Tasks — “done” writes back to the real record.",
      "History — completions are logged there.",
    ],
  },
  "Today · Timeline": {
    what: "A visual ruler of your day with a notch for every timed thing, and a glowing “now” line.",
    how: [
      "Notches: red = timed tasks, blue = calendar events. Hover one for details.",
      "Date-only items (client work, all-day events) sit in the Anytime lane.",
    ],
    interacts: [
      "Tasks · Today — timed tasks become notches.",
      "Calendar — events become notches.",
      "Client Work — today's dues fill the Anytime lane.",
    ],
  },
  Habits: {
    what: "Your daily habit checklist and score — the routines that compound.",
    how: [
      "Tap a habit to check it off for today; it resets at midnight.",
      "Hit “edit” to rename, add, or remove habits.",
    ],
    interacts: [
      "Operator — your streak and daily score come from here.",
    ],
  },
};
