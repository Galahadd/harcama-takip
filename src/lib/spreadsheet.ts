import { read, utils } from "xlsx";
import { categorizeDescription } from "./categorize";
import { normalizeText, parseTurkishAmount, toIsoDate } from "./format";
import { parseInstallmentInfo } from "./installments";
import type { Bank, CategoryRule, ParsedExpense } from "./types";

type SheetRow = Array<string | number | null | undefined>;

const sectorMap: Array<{ category: string; keywords: string[] }> = [
  { category: "Market", keywords: ["MARKET", "ALISVERIS"] },
  { category: "Yeme Icme", keywords: ["YEMEK", "RESTORAN", "CAFE"] },
  { category: "Seyahat", keywords: ["SEYAHAT", "ACENTE", "TASIMACILIK", "TURIZM", "KONAKLAMA"] },
  { category: "Elektronik", keywords: ["ELEKTRIK", "ELEKTRONIK", "BILGISAYAR"] },
  { category: "Egitim", keywords: ["EGITIM", "KIRTASIYE", "OFIS"] },
  { category: "Sigorta", keywords: ["SIGORTA"] },
  { category: "Giyim", keywords: ["GIYIM", "AKSESUAR"] },
  { category: "Saglik", keywords: ["SAGLIK", "BAKIM", "ECZANE"] },
  { category: "Ulasim", keywords: ["AKARYAKIT", "ULASIM"] },
  { category: "Eglence", keywords: ["EGLENCE", "HOBI"] },
  { category: "Fatura", keywords: ["TELEKOMUNIKASYON"] },
  { category: "Kisisel Hizmet", keywords: ["KISISEL HIZMET"] },
];

function cellText(value: SheetRow[number]) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseDate(value: string) {
  const match = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (!match) {
    return null;
  }
  return toIsoDate(match[1], match[2], match[3]);
}

function cleanDescription(description: string) {
  return description
    .replace(/\b\d+(?:[.,]\d{2})?\s*TL'?lik işlemin(?:\s*\d+\/\d+\s*taksidi)?/gi, " ")
    .replace(/\d+\/\d+\s*taksidi/gi, " ")
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNegativeAmount(value: string) {
  return value.trim().startsWith("-");
}

function isRefundPair(currentAmount: string, nextAmount: string) {
  return (
    isNegativeAmount(currentAmount) &&
    !isNegativeAmount(nextAmount) &&
    parseTurkishAmount(currentAmount) === parseTurkishAmount(nextAmount)
  );
}

function categoryFromSector(sector: string) {
  const normalized = normalizeText(sector);
  const match = sectorMap.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(normalizeText(keyword))),
  );
  return match?.category ?? null;
}

function categoryForRow(
  description: string,
  sector: string,
  rules: Pick<CategoryRule, "pattern" | "category">[],
) {
  const merchantCategory = categorizeDescription(description, rules);
  if (merchantCategory.matchedRule) {
    return merchantCategory;
  }

  const mappedSector = categoryFromSector(sector);
  if (mappedSector && normalizeText(sector) !== "HIZMET SEKTORLERI") {
    return {
      category: mappedSector,
      matchedRule: "Excel sektoru",
    };
  }

  return merchantCategory.category !== "Diger"
    ? merchantCategory
    : {
        category: mappedSector ?? "Diger",
        matchedRule: mappedSector ? "Excel sektoru" : null,
      };
}

export function parseStatementSpreadsheet(
  buffer: Buffer,
  rules: Pick<CategoryRule, "pattern" | "category">[],
  bank: Bank | "all" = "unknown",
): ParsedExpense[] {
  const workbook = read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeText(cellText(cell)));
    return (
      normalized.some((cell) => cell === "ISLEM TARIHI" || cell === "TARIH") &&
      normalized.some((cell) => cell === "ISLEMLER" || cell === "ISLEM")
    );
  });

  if (headerIndex < 0) {
    return [];
  }

  const header = rows[headerIndex].map((cell) => normalizeText(cellText(cell)));
  const dateIndex = header.findIndex((cell) => cell === "ISLEM TARIHI" || cell === "TARIH");
  const descriptionIndex = header.findIndex((cell) => cell === "ISLEMLER" || cell === "ISLEM");
  const sectorIndex = header.findIndex((cell) => cell === "SEKTOR" || cell === "ETIKET");
  const amountIndex = header.findIndex((cell) => cell === "TUTAR" || cell.startsWith("TUTAR"));
  const isGarantiStatement =
    bank === "garanti" ||
    (header.includes("TARIH") && header.includes("ISLEM") && header.includes("ETIKET"));

  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
    return [];
  }

  const parsed: ParsedExpense[] = [];

  const dataRows = rows.slice(headerIndex + 1);

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const date = parseDate(cellText(row[dateIndex]));
    const rawDescription = cellText(row[descriptionIndex]);
    const description = cleanDescription(rawDescription);
    const installment = parseInstallmentInfo(rawDescription);
    const sector = sectorIndex >= 0 ? cellText(row[sectorIndex]) : "";
    const amountText = cellText(row[amountIndex]);
    const previousAmount = index > 0 ? cellText(dataRows[index - 1][amountIndex]) : "";
    const nextAmount = index < dataRows.length - 1 ? cellText(dataRows[index + 1][amountIndex]) : "";

    if (
      !date ||
      !description ||
      !amountText ||
      (isGarantiStatement ? !isNegativeAmount(amountText) : amountText.trim().startsWith("+")) ||
      (isGarantiStatement && previousAmount && isRefundPair(previousAmount, amountText)) ||
      (isGarantiStatement && nextAmount && isRefundPair(amountText, nextAmount))
    ) {
      continue;
    }

    const amount = parseTurkishAmount(amountText);
    if (amount <= 0) {
      continue;
    }

    const categoryResult = categoryForRow(description, sector, rules);

    parsed.push({
      date,
      description,
      amount,
      category: categoryResult.category,
      suggestedCategory: categoryResult.category,
      matchedRule: categoryResult.matchedRule,
      hashSeed: `${date}|${description}|${amount.toFixed(2)}`,
      installmentCurrent: installment?.installmentCurrent ?? null,
      installmentTotal: installment?.installmentTotal ?? null,
      installmentOriginalAmount: installment?.installmentOriginalAmount ?? null,
    });
  }

  return parsed;
}
