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
  // Six daily habits (guide §5.3). Keys are stable ids stored in daily_logs.
  habits: [
    { id: "train", label: "Train", category: "Body" },
    { id: "deep-work", label: "Deep work block", category: "Output" },
    { id: "read", label: "Read 30 min", category: "Mind" },
    { id: "sunlight", label: "Morning sunlight", category: "Body" },
    { id: "no-junk", label: "No junk food", category: "Fuel" },
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
