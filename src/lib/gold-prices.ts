import type { GoldEntry } from "./types";

export type GoldQuote = {
  bid: number;
  updatedAt: string;
};

export type GoldPrices = {
  gram24: GoldQuote;
  gram22: GoldQuote;
  source: "altinapi.com";
  stale: boolean;
  marketClosed: boolean;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid price response");
  }
  return value as Record<string, unknown>;
}

function quote(row: Record<string, unknown>): GoldQuote {
  // The docs specify milliseconds; the live API also returns ISO timestamps.
  const timestamp = row.timestamp;
  const date = typeof timestamp === "number" || typeof timestamp === "string"
    ? new Date(timestamp)
    : new Date(NaN);
  if (typeof row.bid !== "number" || !Number.isFinite(row.bid) || row.bid <= 0 || !Number.isFinite(date.getTime())) {
    throw new Error("Invalid gold bid or timestamp");
  }
  return { bid: row.bid, updatedAt: date.toISOString() };
}

export function parseGoldPrices(payload: unknown): GoldPrices {
  const response = object(payload);
  if (!Array.isArray(response.data) || typeof response.stale !== "boolean") {
    throw new Error("Missing price data");
  }
  const rows = response.data.map(object);
  const gram24 = rows.find((row) => row.symbol === "ALTIN");
  const gram22 = rows.find((row) => row.symbol === "AYAR22");
  if (!gram24 || !gram22) throw new Error("Missing gold symbol");
  return {
    gram24: quote(gram24),
    gram22: quote(gram22),
    source: "altinapi.com",
    stale: response.stale,
    marketClosed: [gram24, gram22].some((row) => row.snapshot_source === "market_closed"),
  };
}

export function goldEntryValue(entry: Pick<GoldEntry, "grams" | "carat">, prices: GoldPrices | null) {
  if (!prices) return null;
  return entry.grams * (entry.carat === 22 ? prices.gram22.bid : prices.gram24.bid);
}

export function goldPortfolioTotals(entries: GoldEntry[], prices: GoldPrices | null) {
  const costedEntries = entries.filter((entry) => entry.pricePerGram !== null);
  const cost = costedEntries.reduce((sum, entry) => sum + entry.grams * entry.pricePerGram!, 0);
  return {
    cost,
    currentValue: prices ? entries.reduce((sum, entry) => sum + goldEntryValue(entry, prices)!, 0) : null,
    profitLoss: prices && costedEntries.length
      ? costedEntries.reduce((sum, entry) => sum + goldEntryValue(entry, prices)!, 0) - cost
      : null,
    missingCostCount: entries.length - costedEntries.length,
  };
}
