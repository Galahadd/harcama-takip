import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { isValidUsername, normalizeUsername } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { username?: string } | null;
    const username = normalizeUsername(body?.username || "");
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Kullanıcı adı 3-40 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir." },
        { status: 400 },
      );
    }
    const user = await createUser(username);
    if (!user) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
    }
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanıcı eklenemedi." },
      { status: 500 },
    );
  }
}
