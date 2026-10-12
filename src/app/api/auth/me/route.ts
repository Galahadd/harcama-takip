import { NextResponse } from "next/server";
import { authCookieName, getRequestUsername, isValidUsername, normalizeUsername, signSession } from "@/lib/auth";
import { renameUser } from "@/lib/db";

export async function GET(request: Request) {
  const username = await getRequestUsername(request);
  return username
    ? NextResponse.json({ username })
    : NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
}

export async function PATCH(request: Request) {
  try {
    const currentUsername = await getRequestUsername(request);
    if (!currentUsername) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { username?: string } | null;
    const username = normalizeUsername(body?.username || "");
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Kullanıcı adı 3-40 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir." },
        { status: 400 },
      );
    }
    if (username === currentUsername) {
      return NextResponse.json({ error: "Yeni kullanıcı adı mevcut kullanıcı adıyla aynı." }, { status: 400 });
    }

    if (!(await renameUser(currentUsername, username))) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    }

    const response = NextResponse.json({ username });
    response.cookies.set(authCookieName, await signSession(username), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanıcı adı güncellenemedi." },
      { status: 500 },
    );
  }
}
