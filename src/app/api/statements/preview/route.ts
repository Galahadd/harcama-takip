import { NextResponse } from "next/server";
import { listRules } from "@/lib/db";
import { extractPdfText, parseStatementText } from "@/lib/pdf";
import { parseStatementSpreadsheet } from "@/lib/spreadsheet";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF dosyasi gerekli." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rules = await listRules();
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "xls" || extension === "xlsx") {
      const rows = parseStatementSpreadsheet(buffer, rules);
      return NextResponse.json({ rows });
    }

    const text = await extractPdfText(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Bu PDF metin katmani icermiyor. Yapi Kredi internet subesinden tarayici Print to PDF yerine metin secilebilir hesap ozeti PDF'i indirin; OCR henuz desteklenmiyor.",
        },
        { status: 422 },
      );
    }

    const rows = parseStatementText(text, rules);

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF okunamadi." },
      { status: 500 },
    );
  }
}
