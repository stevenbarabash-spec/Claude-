// Motivational quote of the day — self-contained, no network. Rotates by
// day-of-year so it's stable through the day and changes each morning.
const QUOTES: { text: string; who: string }[] = [
  { text: "The way to get started is to quit talking and begin doing.", who: "Walt Disney" },
  { text: "Discipline equals freedom.", who: "Jocko Willink" },
  { text: "It always seems impossible until it's done.", who: "Nelson Mandela" },
  { text: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", who: "Stephen King" },
  { text: "Well done is better than well said.", who: "Benjamin Franklin" },
  { text: "The man who moves a mountain begins by carrying away small stones.", who: "Confucius" },
  { text: "Action is the foundational key to all success.", who: "Pablo Picasso" },
  { text: "You don't have to be great to start, but you have to start to be great.", who: "Zig Ziglar" },
  { text: "Hard work beats talent when talent doesn't work hard.", who: "Tim Notke" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", who: "Dale Carnegie" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", who: "Winston Churchill" },
  { text: "The best way out is always through.", who: "Robert Frost" },
  { text: "What you do today can improve all your tomorrows.", who: "Ralph Marston" },
  { text: "Quality is not an act, it is a habit.", who: "Aristotle" },
  { text: "Start where you are. Use what you have. Do what you can.", who: "Arthur Ashe" },
  { text: "The secret of getting ahead is getting started.", who: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", who: "Tim Ferriss" },
  { text: "If you're going through hell, keep going.", who: "Winston Churchill" },
  { text: "Motivation gets you going, but discipline keeps you growing.", who: "John C. Maxwell" },
  { text: "Everything you've ever wanted is on the other side of fear.", who: "George Addair" },
  { text: "Don't watch the clock; do what it does. Keep going.", who: "Sam Levenson" },
  { text: "A goal without a plan is just a wish.", who: "Antoine de Saint-Exupéry" },
  { text: "Whether you think you can or you think you can't, you're right.", who: "Henry Ford" },
  { text: "Great things are done by a series of small things brought together.", who: "Vincent van Gogh" },
  { text: "The only way to do great work is to love what you do.", who: "Steve Jobs" },
  { text: "Slow is smooth, and smooth is fast.", who: "Navy SEALs" },
  { text: "Energy and persistence conquer all things.", who: "Benjamin Franklin" },
  { text: "You miss 100% of the shots you don't take.", who: "Wayne Gretzky" },
  { text: "Make each day your masterpiece.", who: "John Wooden" },
  { text: "The future depends on what you do today.", who: "Mahatma Gandhi" },
  { text: "Done is better than perfect.", who: "Sheryl Sandberg" },
];

// Day-of-year index so the quote is deterministic per calendar day.
export function quoteOfTheDay(dateKey: string): { text: string; who: string } {
  const d = new Date(dateKey + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
