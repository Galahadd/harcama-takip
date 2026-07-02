import pdf from "pdf-parse";
import { categorizeDescription } from "./categorize";
import { parseTurkishAmount, toIsoDate } from "./format";
import type { CategoryRule, ParsedExpense } from "./types";

const datePattern = /(\d{2})[./-](\d{2})[./-](\d{4})/;
const amountPattern = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:TL|TRY)?\s*$/i;

function cleanDescription(description: string) {
  return description
    .replace(/\b(TL|TRY)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSkip(description: string) {
  const upper = description.toLocaleUpperCase("tr-TR");
  return [
    "DONEM BORCU",
    "ASGARI ODEME",
    "SON ODEME",
    "TOPLAM",
    "LIMIT",
    "ODEME",
    "FAIZ",
    "VERGI",
  ].some((keyword) => upper.includes(keyword));
}

export async function extractPdfText(buffer: Buffer) {
  const result = await pdf(buffer);
  return result.text;
}

export function parseGarantiStatementText(
  text: string,
  rules: Pick<CategoryRule, "pattern" | "category">[],
): ParsedExpense[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const parsed: ParsedExpense[] = [];

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    const amountMatch = line.match(amountPattern);

    if (!dateMatch || !amountMatch) {
      continue;
    }

    const [, day, month, year] = dateMatch;
    const amountText = amountMatch[1];
    const description = cleanDescription(
      line
        .slice(dateMatch.index! + dateMatch[0].length, amountMatch.index)
        .replace(datePattern, ""),
    );

    if (!description || shouldSkip(description)) {
      continue;
    }

    const amount = parseTurkishAmount(amountText);
    if (amount <= 0) {
      continue;
    }

    const categoryResult = categorizeDescription(description, rules);
    const date = toIsoDate(day, month, year);

    parsed.push({
      date,
      description,
      amount,
      category: categoryResult.category,
      suggestedCategory: categoryResult.category,
      matchedRule: categoryResult.matchedRule,
      hashSeed: `${date}|${description}|${amount.toFixed(2)}`,
    });
  }

  return parsed;
}
