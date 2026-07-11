import { NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, makeSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, note: "auth disabled" });
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const token = await makeSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
