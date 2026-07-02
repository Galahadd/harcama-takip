export const categories = [
  "Market",
  "Yeme Icme",
  "Ulasim",
  "Fatura",
  "Saglik",
  "Giyim",
  "Online Alisveris",
  "Eglence",
  "Elektronik",
  "Sigorta",
  "Kisisel Hizmet",
  "Egitim",
  "Seyahat",
  "Diger",
];

export const bankOptions = [
  { value: "all", label: "Tum bankalar" },
  { value: "garanti", label: "Garanti BBVA" },
  { value: "yapikredi", label: "Yapi Kredi" },
  { value: "manual", label: "Manuel" },
] as const;

export const uploadBankOptions = [
  { value: "garanti", label: "Garanti BBVA" },
  { value: "yapikredi", label: "Yapi Kredi" },
] as const;

export function formatBank(bank: string) {
  return bankOptions.find((option) => option.value === bank)?.label ?? "Bilinmeyen";
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function currentMonthOption() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export function toIsoDate(day: string, month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseTurkishAmount(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.abs(parsed);
}

export function normalizeText(value: string) {
  return value
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
