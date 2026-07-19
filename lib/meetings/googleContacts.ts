// Google Contacts (People API) lookup — resolves a spoken name like "Ashley"
// to an email by searching the user's actual Gmail/Google contacts, instead
// of requiring every invitee to be pre-listed in MEETING_CONTACTS.
// Searches the primary (booking) account plus any accounts listed in
// GOOGLE_CONTACTS_REFRESH_TOKENS — meetings still only ever get booked on the
// primary account, this only widens who can be found by name.
// Needs the `contacts.readonly` + `contacts.other.readonly` scopes on every
// account's refresh token (minted with scripts/google-refresh-token.mjs).
import { accessTokenFor, contactsOnlyRefreshTokens } from "./google";

const PEOPLE_API = "https://people.googleapis.com/v1";

interface PersonResult {
  person?: {
    names?: { displayName?: string }[];
    emailAddresses?: { value?: string }[];
  };
}

// People API requires a brief "warm up" the first time searchContacts is
// called after a token refresh — an immediate search can return zero results
// even for real matches. Doesn't need special handling here since results
// simply come back empty and the caller falls through to "unmatched."
async function searchOne(token: string, endpoint: string, query: string, readMask: string): Promise<PersonResult[]> {
  const url = `${PEOPLE_API}/${endpoint}?query=${encodeURIComponent(query)}&readMask=${readMask}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: PersonResult[] };
  return data.results ?? [];
}

export interface ContactMatch {
  name: string | null;
  email: string;
}

// Tries each account's contacts in order (primary account first, then
// GOOGLE_CONTACTS_REFRESH_TOKENS in the order listed) — saved contacts then
// "other contacts" (people emailed but never saved) — first name match with
// an email wins. A bad/expired token on one account is skipped, not fatal.
export async function findContact(name: string): Promise<ContactMatch | null> {
  const refreshTokens = [process.env.GOOGLE_OAUTH_REFRESH_TOKEN, ...contactsOnlyRefreshTokens()].filter(
    (t): t is string => Boolean(t),
  );
  for (const refreshToken of refreshTokens) {
    try {
      const token = await accessTokenFor(refreshToken);
      const [saved, other] = await Promise.all([
        searchOne(token, "people:searchContacts", name, "names,emailAddresses"),
        searchOne(token, "otherContacts:search", name, "names,emailAddresses"),
      ]);
      for (const r of [...saved, ...other]) {
        const email = r.person?.emailAddresses?.find((e) => e.value)?.value;
        if (email) {
          return { name: r.person?.names?.find((n) => n.displayName)?.displayName ?? name, email };
        }
      }
    } catch {
      // try the next account
    }
  }
  return null;
}
