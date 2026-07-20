import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, verifySessionToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  // Auth is opt-in: with no DASHBOARD_PASSWORD set, the dashboard is open (local dev).
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  // The brief feed does its own auth (BRIEF_API_KEY); let it reach its handler.
  if (pathname.startsWith("/api/brief")) {
    return NextResponse.next();
  }

  // Programmatic access via x-api-secret for API routes (scripts, shortcuts).
  if (pathname.startsWith("/api/") && process.env.API_SECRET) {
    if (req.headers.get("x-api-secret") === process.env.API_SECRET) return NextResponse.next();
  }

  const ok = await verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
