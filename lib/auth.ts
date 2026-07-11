// Single-password auth gate with HMAC-signed cookies (guide §3.4).
// Uses Web Crypto so the same code runs in middleware (edge) and route handlers.

export const AUTH_COOKIE = "jarvis_session";

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

export function authEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD && secret());
}

async function hmac(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Buffer.from ? Buffer.from(sig).toString("base64url") : btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function makeSessionToken(): Promise<string> {
  const s = secret();
  if (!s) throw new Error("AUTH_SECRET not set");
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const payload = String(expires);
  const sig = await hmac(payload, s);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const s = secret();
  if (!s) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (Number(payload) < Date.now()) return false;
  const expected = await hmac(payload, s);
  return expected === sig;
}

// Programmatic access via x-api-secret header (for curl / cron / scripts).
export function checkApiSecret(req: Request): boolean {
  const configured = process.env.API_SECRET;
  if (!configured) return false;
  return req.headers.get("x-api-secret") === configured;
}
