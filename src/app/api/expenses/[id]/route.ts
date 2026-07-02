import { NextResponse } from "next/server";
import { deleteExpense, updateExpense } from "@/lib/db";
import { isKnownCategory } from "@/lib/categorize";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
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

    const expense = await updateExpense(id, {
      date: body.date,
      description: body.description.trim(),
      amount: Number(body.amount),
      category: body.category,
    });

    if (!expense) {
      return NextResponse.json({ error: "Harcama bulunamadi." }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harcama guncellenemedi." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteExpense(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harcama silinemedi." },
      { status: 500 },
    );
  }
}
