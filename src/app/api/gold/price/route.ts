import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookieName, isValidSession } from "@/lib/auth";
import { parseGoldPrices } from "@/lib/gold-prices";

export async function GET() {
  const session = (await cookies()).get(authCookieName)?.value;
  if (!(await isValidSession(session))) {
    return NextResponse.json({ error: "Fiyatları görmek için giriş yapın." }, { status: 401 });
  }

  const apiKey = process.env.ALTINAPI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Altın fiyat servisi yapılandırılmamış. ALTINAPI_API_KEY tanımlanmalı." },
      { status: 503 },
    );
  }
  try {
    const response = await fetch("https://altinapi.com/api/v1/prices", {
      headers: { "X-API-Key": apiKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const error = response.status === 429
        ? "Altın fiyat servisi istek limitine ulaştı. Biraz sonra tekrar deneyin."
        : "Altın fiyat servisine ulaşılamadı. Biraz sonra tekrar deneyin.";
      return NextResponse.json({ error }, { status: 503 });
    }

    const prices = parseGoldPrices(await response.json());
    return NextResponse.json(prices, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never forward provider errors or request headers to the browser.
    return NextResponse.json(
      { error: "Geçerli altın alış fiyatları alınamadı. Lütfen tekrar deneyin." },
      { status: 503 },
    );
  }
}
