import pdf from "pdf-parse";
import { categorizeDescription } from "./categorize";
import { normalizeText, parseTurkishAmount, toIsoDate } from "./format";
import type { CategoryRule, ParsedExpense } from "./types";

const dateAtStartPattern = /^(\d{2})[./-](\d{2})[./-](\d{4})(.*)$/;
const signedAmountPattern = /([+-]?\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:TL|TRY)?/gi;
const yapiCardPattern = /\d{4}\s+\d{2}\*{2}\s+\*{4}\s+\d{4}/;

const garantiCategoryMap: Array<{ category: string; keywords: string[] }> = [
  { category: "Market", keywords: ["MARKET"] },
  { category: "Yeme Icme", keywords: ["YEME ICME"] },
  { category: "Ulasim", keywords: ["ULASIM", "AKARYAKIT"] },
  { category: "Giyim", keywords: ["GIYIM AKSESUAR"] },
  { category: "Elektronik", keywords: ["ELEKTRONIK"] },
  { category: "Sigorta", keywords: ["EMEKLILIK SIGORTA", "SIGORTA"] },
  { category: "Kisisel Hizmet", keywords: ["KISISEL HIZMET"] },
  { category: "Eglence", keywords: ["EGLENCE HOBI"] },
  { category: "Diger", keywords: ["DIGER"] },
];

function cleanDescription(description: string) {
  return description
    .replace(/\b(TL|TRY)\b/gi, "")
    .replace(yapiCardPattern, " ")
    .replace(/\bISTANBUL\b/gi, " ")
    .replace(/\bİSTANBUL\b/gi, " ")
    .replace(/\bTR\b/g, " ")
    .replace(/\bGB\b/g, " ")
    .replace(/\bNL\b/g, " ")
    .replace(/\bIR\b/g, " ")
    .replace(/\bSW\b/g, " ")
    .replace(/\b\d+(?:[.,]\d{2})?\s*TL'?lik işlemin(?:\s*\d+\/\d+\s*taksidi)?/gi, " ")
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*TL\/\d+/gi, " ")
    .replace(/\d+\/\d+\s*taksidi/gi, " ")
    .replace(/\b(Market|Ulaşım|Ulasim|Akaryakıt|Akaryakit|Elektronik|Diğer|Diger)\d{1,3},\d{2}/gi, " ")
    .replace(/[+-]\s*$/g, " ")
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
    "ÖDEME",
    "HESAP OZETI BORCU",
    "HESAP ÖZETI BORCU",
    "HESAP ÖZETİ BORCU",
    "FAIZ",
    "FAİZ",
    "VERGI",
    "VERGİ",
  ].some((keyword) => upper.includes(keyword));
}

export async function extractPdfText(buffer: Buffer) {
  const result = await pdf(buffer);
  return result.text;
}

function compactLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isIgnoredLine(line: string) {
  return (
    /^\d+\s*\/\s*\d+$/.test(line) ||
    line === "Tarih" ||
    line === "İşlem" ||
    line === "EtiketBonusTutar (TL)" ||
    line.includes("Tarih İşlem") ||
    line.includes("İşlem Tarihiİşlemler") ||
    line.includes("Toplam Açık Provizyon")
  );
}

function groupTransactions(lines: string[]) {
  const groups: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    if (dateAtStartPattern.test(line)) {
      if (current.length) {
        groups.push(current.join(" "));
      }
      current = [line];
      continue;
    }

    if (current.length) {
      current.push(line);
    }
  }

  if (current.length) {
    groups.push(current.join(" "));
  }

  return groups;
}

function findLastAmount(value: string) {
  const matches = [...value.matchAll(signedAmountPattern)];
  return matches.at(-1) ?? null;
}

function findFirstAmount(value: string) {
  return [...value.matchAll(signedAmountPattern)].at(0) ?? null;
}

function isNegativeAmount(value: string) {
  return value.trim().startsWith("-");
}

function isRefundPair(currentGroup: string, nextGroup: string) {
  const currentAmount = findLastAmount(currentGroup)?.[1];
  const nextAmount = findLastAmount(nextGroup)?.[1];

  if (!currentAmount || !nextAmount || !isNegativeAmount(currentAmount) || isNegativeAmount(nextAmount)) {
    return false;
  }

  return parseTurkishAmount(currentAmount) === parseTurkishAmount(nextAmount);
}

function mapGarantiCategory(value: string) {
  const normalized = normalizeText(value);
  const match = garantiCategoryMap.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.category ?? null;
}

function stripGarantiCategory(value: string) {
  return value
    .replace(/Yeme\s*\/\s*İçme/gi, " ")
    .replace(/Yeme\s*\/\s*Icme/gi, " ")
    .replace(/Giyim\s*\/\s*Aksesuar/gi, " ")
    .replace(/Emeklilik\s*\/\s*Sigorta/gi, " ")
    .replace(/Eğlence\s*\/\s*Hobi/gi, " ")
    .replace(/Eglence\s*\/\s*Hobi/gi, " ")
    .replace(/Kişisel Hizmet/gi, " ")
    .replace(/Kisisel Hizmet/gi, " ")
    .replace(/\b(Market|Ulaşım|Ulasim|Akaryakıt|Akaryakit|Elektronik|Diğer|Diger)\b/gi, " ");
}

function buildParsedExpense(input: {
  group: string;
  rules: Pick<CategoryRule, "pattern" | "category">[];
  preferPdfCategory?: boolean;
}) {
  const dateMatch = input.group.match(dateAtStartPattern);
  const amountMatch = findLastAmount(input.group);

  if (!dateMatch || !amountMatch || amountMatch.index === undefined) {
    return null;
  }

  const [, day, month, year] = dateMatch;
  const amountText = amountMatch[1];
  const amount = parseTurkishAmount(amountText);
  if (amount <= 0 || !isNegativeAmount(amountText)) {
    return null;
  }

  const beforeAmount = input.group.slice(10, amountMatch.index);
  const pdfCategory = input.preferPdfCategory ? mapGarantiCategory(beforeAmount) : null;
  const description = cleanDescription(
    input.preferPdfCategory ? stripGarantiCategory(beforeAmount) : beforeAmount,
  );

  if (!description || shouldSkip(description)) {
    return null;
  }

  const categoryResult = categorizeDescription(description, input.rules);
  const category = pdfCategory ?? categoryResult.category;
  const date = toIsoDate(day, month, year);

  return {
    date,
    description,
    amount,
    category,
    suggestedCategory: category,
    matchedRule: pdfCategory ? "PDF etiketi" : categoryResult.matchedRule,
    hashSeed: `${date}|${description}|${amount.toFixed(2)}`,
  } satisfies ParsedExpense;
}

function buildYapiExpense(
  group: string,
  rules: Pick<CategoryRule, "pattern" | "category">[],
) {
  const dateMatch = group.match(dateAtStartPattern);
  const cardMatch = group.match(yapiCardPattern);

  if (!dateMatch || !cardMatch || cardMatch.index === undefined) {
    return buildParsedExpense({ group, rules });
  }

  const [, day, month, year] = dateMatch;
  const afterCard = group.slice(cardMatch.index + cardMatch[0].length);
  const amountMatch = findFirstAmount(afterCard);

  if (!amountMatch) {
    return null;
  }

  const amountText = amountMatch[1];
  const amount = parseTurkishAmount(amountText);
  if (amount <= 0 || !isNegativeAmount(amountText)) {
    return null;
  }

  const description = cleanDescription(group.slice(10, cardMatch.index));
  if (!description || shouldSkip(description)) {
    return null;
  }

  const categoryResult = categorizeDescription(description, rules);
  const date = toIsoDate(day, month, year);

  return {
    date,
    description,
    amount,
    category: categoryResult.category,
    suggestedCategory: categoryResult.category,
    matchedRule: categoryResult.matchedRule,
    hashSeed: `${date}|${description}|${amount.toFixed(2)}`,
  } satisfies ParsedExpense;
}

export function parseStatementText(
  text: string,
  rules: Pick<CategoryRule, "pattern" | "category">[],
): ParsedExpense[] {
  const lines = compactLines(text);
  const isGaranti = text.includes("Garanti") || text.includes("BONUS PLATINUM");
  const isYapiKredi = text.includes("Yapı ve Kredi") || text.includes("yapikredi");
  const groups = groupTransactions(lines);
  const filteredGroups = groups.filter((group, index) => {
    const previous = groups[index - 1];
    const next = groups[index + 1];
    return !((previous && isRefundPair(previous, group)) || (next && isRefundPair(group, next)));
  });

  return filteredGroups
    .map((group) =>
      isYapiKredi
        ? buildYapiExpense(group, rules)
        : buildParsedExpense({ group, rules, preferPdfCategory: isGaranti }),
    )
    .filter((row): row is ParsedExpense => row !== null);
}
