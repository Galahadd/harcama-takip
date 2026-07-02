import { NextResponse } from "next/server";
import { currentMonthOption } from "@/lib/format";
import { listExpenses, listMonthOptions } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const fallback = currentMonthOption();
    const month = Number(url.searchParams.get("month") || fallback.month);
    const year = Number(url.searchParams.get("year") || fallback.year);
    const [expenses, months] = await Promise.all([listExpenses(month, year), listMonthOptions()]);

    const categoryTotals = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    return NextResponse.json({
      month,
      year,
      months,
      expenses,
      total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      categoryTotals: Object.entries(categoryTotals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ozet alinamadi." },
      { status: 500 },
    );
  }
}
