// Personal configuration — edit these to make the OS yours.
export const config = {
  brand: "JARVIS",
  version: "v1.0",
  owner: {
    name: "Steven",
    fullName: "Steven Barabash",
    role: "Operator",
    location: "Toronto",
  },
  timezone: process.env.USER_TIMEZONE || "America/Toronto",
  // Daily habits. Keys are stable ids stored in daily_logs — renaming a label
  // is safe; changing an id orphans its history.
  habits: [
    { id: "coffee-reading", label: "Coffee + free reading (30 min)", category: "Morning" },
    { id: "news", label: "Catch up on news", category: "Morning" },
    { id: "yoga", label: "Yoga", category: "Body" },
    { id: "skate-evo", label: "Skate / scoot with Evo", category: "Play" },
    { id: "pickleball-am", label: "Morning pickleball", category: "Body" },
    { id: "pickleball-pm", label: "Evening pickleball", category: "Body" },
    { id: "show-night", label: "Show night with wife", category: "Evening" },
    { id: "unwind", label: "Unwind (10–11 pm)", category: "Evening" },
    { id: "plan-tomorrow", label: "Plan tomorrow", category: "System" },
  ],
  nutrition: {
    kcalTarget: 2800,
    proteinTarget: 180,
    carbsTarget: 300,
    fatTarget: 80,
    cutoff: "17:00", // eating cutoff shown as a countdown on the card
  },
};

export type HabitDef = (typeof config.habits)[number];
