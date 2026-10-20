import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, getSessionUsername } from "./src/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get(authCookieName)?.value;
  if (!(await getSessionUsername(session))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
