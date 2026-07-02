import { NextResponse } from "next/server";
import { buildRulePattern, isKnownCategory } from "@/lib/categorize";
import { importStatement, upsertRule } from "@/lib/db";
import { expenseHash } from "@/lib/hash";
import type { ParsedExpense } from "@/lib/types";
import { isUploadedFile } from "@/lib/upload";
import type { Bank } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const month = Number(formData.get("month"));
    const year = Number(formData.get("year"));
    const bank = String(formData.get("bank") || "unknown") as Bank;
    const rowsText = String(formData.get("rows") || "[]");
    const rows = JSON.parse(rowsText) as ParsedExpense[];

    if (!isUploadedFile(file) || !month || !year || !Array.isArray(rows) || !["garanti", "yapikredi"].includes(bank)) {
      return NextResponse.json({ error: "Ay, yil, banka, ekstre dosyasi ve satirlar gerekli." }, { status: 400 });
    }

    const cleanRows = rows
      .filter((row) => row.date && row.description && row.amount > 0 && isKnownCategory(row.category))
      .map((row) => ({
        date: row.date,
        description: row.description.trim(),
        amount: Number(row.amount),
        category: row.category,
        installmentCurrent: row.installmentCurrent ?? null,
        installmentTotal: row.installmentTotal ?? null,
        installmentOriginalAmount: row.installmentOriginalAmount ?? null,
        duplicateHash: expenseHash({
          month,
          year,
          bank,
          date: row.date,
          description: row.description,
          amount: Number(row.amount),
        }),
      }));

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const result = await importStatement({
      month,
      year,
      bank,
      originalFileName: file.name,
      fileBuffer,
      fileMimeType: file.type || "application/pdf",
      expenses: cleanRows,
    });

    for (const row of rows) {
      if (row.category && row.category !== row.suggestedCategory && isKnownCategory(row.category)) {
        const pattern = buildRulePattern(row.description);
        if (pattern) {
          await upsertRule(pattern, row.category);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ekstre ice aktarilamadi." },
      { status: 500 },
    );
  }
}
