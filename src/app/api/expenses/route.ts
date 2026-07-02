import { NextResponse } from "next/server";
import { createManualExpense } from "@/lib/db";
import { expenseHash } from "@/lib/hash";
import { isKnownCategory } from "@/lib/categorize";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      description?: string;
      amount?: number;
      category?: string;
    };

    if (!body.date || !body.description || !body.amount || !body.category) {
      return NextResponse.json({ error: "Tarih, tutar, aciklama ve sektor zorunlu." }, { status: 400 });
    }

    if (!isKnownCategory(body.category)) {
      return NextResponse.json({ error: "Gecersiz sektor." }, { status: 400 });
    }

    const date = new Date(body.date);
    const expense = await createManualExpense({
      date: body.date,
      description: body.description.trim(),
      amount: Number(body.amount),
      category: body.category,
      duplicateHash: expenseHash({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        date: body.date,
        description: body.description,
        amount: Number(body.amount),
      }),
    });

    return NextResponse.json({ expense });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harcama eklenemedi." },
      { status: 500 },
    );
  }
}
