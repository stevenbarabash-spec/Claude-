// Google Contacts (People API) lookup — resolves a spoken name like "Ashley"
// to an email by searching the user's actual Gmail/Google contacts, instead
// of requiring every invitee to be pre-listed in MEETING_CONTACTS.
// Needs the `contacts.readonly` + `contacts.other.readonly` scopes on the
// same refresh token used for Calendar (re-minted with
// scripts/google-refresh-token.mjs once both scopes are requested).
import { accessToken } from "./google";

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
async function searchOne(endpoint: string, query: string, readMask: string): Promise<PersonResult[]> {
  const token = await accessToken();
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

// Searches saved contacts first, then "other contacts" (people you've
// emailed but never saved) — first name match, case-insensitive, first hit
// with an email wins. Returns null if nothing matched.
export async function findContact(name: string): Promise<ContactMatch | null> {
  try {
    const [saved, other] = await Promise.all([
      searchOne("people:searchContacts", name, "names,emailAddresses"),
      searchOne("otherContacts:search", name, "names,emailAddresses"),
    ]);
    for (const r of [...saved, ...other]) {
      const email = r.person?.emailAddresses?.find((e) => e.value)?.value;
      if (email) {
        return { name: r.person?.names?.find((n) => n.displayName)?.displayName ?? name, email };
      }
    }
    return null;
  } catch {
    return null;
  }
}
