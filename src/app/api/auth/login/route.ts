import { NextResponse } from "next/server";
import { authCookieName, isValidUsername, normalizeUsername, signSession } from "@/lib/auth";
import { userExists } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string } | null;
  const username = normalizeUsername(body?.username || "");

  if (!isValidUsername(username) || !(await userExists(username))) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, await signSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
