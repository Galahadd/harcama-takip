import { NextResponse } from "next/server";
import { currentMonthOption } from "@/lib/format";
import { listExpenses, listFutureInstallments, listInstallmentSummary, listMonthOptions } from "@/lib/db";
import { getRequestUsername } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const username = await getRequestUsername(request);
    if (!username) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    const url = new URL(request.url);
    const fallback = currentMonthOption();
    const month = Number(url.searchParams.get("month") || fallback.month);
    const year = Number(url.searchParams.get("year") || fallback.year);
    const bank = url.searchParams.get("bank") || "all";
    const [expenses, months, futureInstallments, installmentSummary] = await Promise.all([
      listExpenses(username, month, year, bank),
      listMonthOptions(username),
      listFutureInstallments(username, month, year, bank),
      listInstallmentSummary(username, month, year, bank),
    ]);

    const categoryTotals = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    return NextResponse.json({
      month,
      year,
      bank,
      months,
      expenses,
      futureInstallments,
      installmentSummary,
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
