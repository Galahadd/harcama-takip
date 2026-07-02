import { NextResponse } from "next/server";
import { listRules } from "@/lib/db";
import { extractPdfText, parseGarantiStatementText } from "@/lib/pdf";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF dosyasi gerekli." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rules = await listRules();
    const text = await extractPdfText(buffer);
    const rows = parseGarantiStatementText(text, rules);

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF okunamadi." },
      { status: 500 },
    );
  }
}
