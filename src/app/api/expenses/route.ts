import { NextResponse } from "next/server";
import { createManualExpense, deleteExpensesByIds, deleteMonthExpenses } from "@/lib/db";
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
        bank: "manual",
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

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[];
      month?: number;
      year?: number;
      bank?: string;
    };

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const deleted = await deleteExpensesByIds(body.ids);
      return NextResponse.json({ deleted });
    }

    if (body.month && body.year) {
      const deleted = await deleteMonthExpenses({
        month: Number(body.month),
        year: Number(body.year),
        bank: body.bank,
      });
      return NextResponse.json({ deleted });
    }

    return NextResponse.json({ error: "Silinecek harcama veya ay bilgisi gerekli." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harcama silinemedi." },
      { status: 500 },
    );
  }
}
