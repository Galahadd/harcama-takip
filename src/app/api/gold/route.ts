import { NextResponse } from "next/server";
import { deleteGoldEntry, listGoldEntries, upsertGoldEntry } from "@/lib/db";
import type { GoldType } from "@/lib/types";
import { getRequestUsername } from "@/lib/auth";

const GOLD_TYPES: Record<GoldType, { gramsPerUnit: number | null; carat: 22 | 24 | null }> = {
  gram_24: { gramsPerUnit: null, carat: 24 },
  gram_22: { gramsPerUnit: null, carat: 22 },
  bracelet_22: { gramsPerUnit: null, carat: null },
  quarter: { gramsPerUnit: 1.754, carat: 22 },
  half: { gramsPerUnit: 3.508, carat: 22 },
  full: { gramsPerUnit: 7.016, carat: 22 },
  republic: { gramsPerUnit: 7.216, carat: 22 },
};

export async function GET(request: Request) {
  try {
    const username = await getRequestUsername(request);
    if (!username) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    const entries = await listGoldEntries(username);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Altin kayitlari alinamadi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const username = await getRequestUsername(request);
    if (!username) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    const body = (await request.json()) as {
      month?: number;
      year?: number;
      goldType?: GoldType;
      carat?: 22 | 24;
      quantity?: number;
      pricePerGram?: number | null;
      note?: string | null;
    };

    if (!body.month || !body.year || !body.goldType || !body.quantity) {
      return NextResponse.json({ error: "Ay, yil, altin turu ve miktar zorunlu." }, { status: 400 });
    }

    const month = Number(body.month);
    const year = Number(body.year);
    const gold = GOLD_TYPES[body.goldType];
    const quantity = Number(body.quantity);
    const pricePerGram =
      body.pricePerGram !== null && body.pricePerGram !== undefined
        ? Number(body.pricePerGram)
        : null;

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Gecersiz ay." }, { status: 400 });
    }

    if (!gold) {
      return NextResponse.json({ error: "Gecersiz altin turu." }, { status: 400 });
    }

    const carat = gold.carat ?? Number(body.carat);
    if (carat !== 22 && carat !== 24) {
      return NextResponse.json({ error: "Taki icin 22 veya 24 ayar secilmeli." }, { status: 400 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Miktar sifirdan buyuk olmali." }, { status: 400 });
    }

    if (gold.gramsPerUnit !== null && !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Altin adedi tam sayi olmali." }, { status: 400 });
    }

    if (pricePerGram !== null && (!Number.isFinite(pricePerGram) || pricePerGram < 0)) {
      return NextResponse.json({ error: "Gecersiz alis fiyati." }, { status: 400 });
    }

    const grams = gold.gramsPerUnit === null ? quantity : quantity * gold.gramsPerUnit;
    const entry = await upsertGoldEntry({
      username,
      month,
      year,
      goldType: body.goldType,
      quantity,
      carat,
      grams,
      pricePerGram,
      note: body.note ?? null,
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Altin kaydi eklenemedi." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const username = await getRequestUsername(request);
    if (!username) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Silinecek kayit id gerekli." }, { status: 400 });
    }
    await deleteGoldEntry(username, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Altin kaydi silinemedi." },
      { status: 500 },
    );
  }
}
