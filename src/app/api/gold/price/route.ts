import { NextResponse } from "next/server";

const TROY_OZ_TO_GRAM = 31.1035;

export async function GET() {
  try {
    const [metalRes, fxRes] = await Promise.all([
      fetch("https://api.metals.live/v1/spot/gold", { next: { revalidate: 3600 } }),
      fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } }),
    ]);

    if (!metalRes.ok || !fxRes.ok) {
      throw new Error("Fiyat verisi alinamadi.");
    }

    const metalData = (await metalRes.json()) as Array<{ gold: number }>;
    const fxData = (await fxRes.json()) as { rates: Record<string, number> };

    const pricePerOzUsd: number = metalData[0]?.gold;
    const usdToTry: number = fxData.rates?.TRY;

    if (!pricePerOzUsd || !usdToTry) {
      throw new Error("Fiyat verisi eksik.");
    }

    const pricePerGramTry = (pricePerOzUsd / TROY_OZ_TO_GRAM) * usdToTry;

    return NextResponse.json({
      pricePerGram: Math.round(pricePerGramTry * 100) / 100,
      currency: "TRY",
      source: "metals.live + open.er-api.com",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Altin fiyati alinamadi." },
      { status: 500 },
    );
  }
}
