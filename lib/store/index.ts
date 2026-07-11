import type { Store } from "./types";

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { SupabaseStore } = require("./supabase") as typeof import("./supabase");
    store = new SupabaseStore();
  } else {
    const { LocalStore } = require("./local") as typeof import("./local");
    store = new LocalStore();
  }
  return store!;
}

export type { Store };
