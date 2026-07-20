// Personal configuration — edit these to make the OS yours.
export const config = {
  brand: "WARROOM",
  version: "v2.1.23",
  owner: {
    name: "Steven",
    fullName: "Steven Barabash",
    role: "Operator",
    location: "Boca Raton, FL",
    avatar: "/avatar.jpg", // set to "" to fall back to initials
  },
  timezone: process.env.USER_TIMEZONE || "America/New_York",
  // Default daily habits — used until the list is customized on the dashboard
  // (the live list is stored in the DB and editable on the Habits card).
  habits: [
    { id: "coffee-reading", label: "Coffee + free reading (30 min)", category: "Morning" },
    { id: "news", label: "Catch up on news", category: "Morning" },
    { id: "yoga", label: "Yoga", category: "Body" },
    { id: "skate-eva", label: "Skateboard + scooter with Eva", category: "Play" },
    { id: "pickleball-am", label: "Morning pickleball", category: "Body" },
    { id: "pickleball-pm", label: "Evening pickleball", category: "Body" },
    { id: "show-night", label: "Watch shows with wife at night (11 pm+)", category: "Evening" },
    { id: "unwind", label: "Unwind (10–11 pm)", category: "Evening" },
    { id: "plan-tomorrow", label: "Plan tomorrow", category: "System" },
  ],
  nutrition: {
    kcalTarget: 1750,
    proteinTarget: 150, // 600 kcal
    carbsTarget: 200, // 800 kcal
    fatTarget: 65, // ~585 kcal
    cutoff: "17:00", // eating cutoff shown as a countdown on the card
  },
};

export type HabitDef = (typeof config.habits)[number];
