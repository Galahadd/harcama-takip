import { NextResponse } from "next/server";
import { getRequestUsername } from "@/lib/auth";

export async function GET(request: Request) {
  const username = await getRequestUsername(request);
  return username
    ? NextResponse.json({ username })
    : NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
}
