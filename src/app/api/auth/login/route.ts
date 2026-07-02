import { NextResponse } from "next/server";
import { authCookieName, isValidPassword, signSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password || !isValidPassword(body.password)) {
    return NextResponse.json({ error: "Gecersiz sifre." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, await signSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
