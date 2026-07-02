import type { CategoryRule } from "./types";
import { categories, normalizeText } from "./format";

const keywordCategories: Array<{ category: string; keywords: string[] }> = [
  {
    category: "Market",
    keywords: ["MIGROS", "CARREFOUR", "SOK", "BIM", "A101", "MARKET", "GETIR"],
  },
  {
    category: "Yeme Icme",
    keywords: ["RESTAURANT", "REST", "KAFE", "CAFE", "YEMEK", "BURGER", "PIZZA", "STARBUCKS"],
  },
  {
    category: "Ulasim",
    keywords: ["UBER", "TAKSI", "TAXI", "MARTI", "METRO", "IETT", "AKARYAKIT", "PETROL", "SHELL", "OPET", "BP"],
  },
  {
    category: "Fatura",
    keywords: ["TURKCELL", "VODAFONE", "TURK TELEKOM", "SUPERONLINE", "DIGITURK", "FATURA", "ELEKTRIK", "DOGALGAZ", "SU"],
  },
  {
    category: "Saglik",
    keywords: ["ECZANE", "HASTANE", "MEDICAL", "SAGLIK", "DENT", "KLINIK"],
  },
  {
    category: "Giyim",
    keywords: ["ZARA", "H M", "LCW", "KOTON", "DEFACTO", "MAVI", "BOYNER", "Giyim"],
  },
  {
    category: "Online Alisveris",
    keywords: ["AMAZON", "TRENDYOL", "HEPSIBURADA", "N11", "ALIEXPRESS", "PAZARAMA"],
  },
  {
    category: "Egitim",
    keywords: ["UDEMY", "COURSERA", "OKUL", "UNIVERSITE", "KITAP", "KURS"],
  },
  {
    category: "Seyahat",
    keywords: ["OTEL", "HOTEL", "PEGASUS", "THY", "TURKISH AIR", "AIRBNB", "BOOKING"],
  },
];

export function categorizeDescription(
  description: string,
  rules: Pick<CategoryRule, "pattern" | "category">[],
) {
  const normalized = normalizeText(description);
  const matchedRule = rules.find((rule) => {
    const pattern = normalizeText(rule.pattern);
    return pattern.length > 0 && normalized.includes(pattern);
  });

  if (matchedRule) {
    return {
      category: matchedRule.category,
      matchedRule: matchedRule.pattern,
    };
  }

  const keywordMatch = keywordCategories.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(normalizeText(keyword))),
  );

  return {
    category: keywordMatch?.category ?? "Diger",
    matchedRule: null,
  };
}

export function isKnownCategory(category: string) {
  return categories.includes(category);
}

export function buildRulePattern(description: string) {
  return normalizeText(description).split(" ").slice(0, 4).join(" ");
}
