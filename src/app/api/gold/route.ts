import { NextResponse } from "next/server";
import { deleteGoldEntry, listGoldEntries, upsertGoldEntry } from "@/lib/db";

export async function GET() {
  try {
    const entries = await listGoldEntries();
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
    const body = (await request.json()) as {
      month?: number;
      year?: number;
      grams?: number;
      pricePerGram?: number | null;
      note?: string | null;
    };

    if (!body.month || !body.year || !body.grams) {
      return NextResponse.json({ error: "Ay, yil ve gram degeri zorunlu." }, { status: 400 });
    }

    const month = Number(body.month);
    const year = Number(body.year);
    const grams = Number(body.grams);
    const pricePerGram = body.pricePerGram ? Number(body.pricePerGram) : null;

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Gecersiz ay." }, { status: 400 });
    }

    if (grams <= 0) {
      return NextResponse.json({ error: "Gram degeri sifirdan buyuk olmali." }, { status: 400 });
    }

    const entry = await upsertGoldEntry({ month, year, grams, pricePerGram, note: body.note ?? null });
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
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Silinecek kayit id gerekli." }, { status: 400 });
    }
    await deleteGoldEntry(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Altin kaydi silinemedi." },
      { status: 500 },
    );
  }
}
