import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function loadSource(file, globals = {}, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
    AbortSignal,
    ...globals,
  });
  return exports;
}

const gold = loadSource("../src/lib/gold-prices.ts");
const payload = () => ({
  stale: false,
  data: [
    { symbol: "ALTIN", bid: 6800, ask: 7000, timestamp: 1790000000000 },
    { symbol: "AYAR22", bid: 6200, ask: 6400, timestamp: "2026-09-19T02:11:33+03:00" },
  ],
});
const entry = (grams, carat, pricePerGram) => ({ grams, carat, pricePerGram });

test("uses bids and supports both documented and live timestamp formats", () => {
  const prices = gold.parseGoldPrices(payload());
  assert.equal(prices.gram24.bid, 6800);
  assert.equal(prices.gram22.bid, 6200);
  assert.equal(prices.gram22.updatedAt, "2026-09-18T23:11:33.000Z");
});

test("rejects missing symbols, invalid bids, timestamps and malformed payloads", () => {
  for (const bad of [null, {}, { data: [], stale: false }]) {
    assert.throws(() => gold.parseGoldPrices(bad));
  }
  for (const bid of [0, -1, NaN, Infinity, null, "6.800,00"]) {
    const data = payload();
    data.data[0].bid = bid;
    assert.throws(() => gold.parseGoldPrices(data));
  }
  const data = payload();
  data.data[1].timestamp = "invalid";
  assert.throws(() => gold.parseGoldPrices(data));
});

test("preserves stale and closed-market status", () => {
  const data = payload();
  data.stale = true;
  data.data[0].snapshot_source = "market_closed";
  const prices = gold.parseGoldPrices(data);
  assert.equal(prices.stale, true);
  assert.equal(prices.marketClosed, true);
});

test("values gram gold, coins and jewelry with their saved carat and gram equivalent", () => {
  const prices = gold.parseGoldPrices(payload());
  assert.equal(gold.goldEntryValue(entry(2, 24, null), prices), 13600);
  assert.equal(gold.goldEntryValue(entry(7.216, 22, null), prices), 7.216 * 6200);
  assert.equal(gold.goldEntryValue(entry(20, 22, null), prices), 124000);
  assert.equal(gold.goldEntryValue(entry(20, 24, null), prices), 136000);
  assert.equal(gold.goldEntryValue(entry(20, 24, null), null), null);
});

test("unknown costs do not become profit, zero cost remains an explicit cost", () => {
  const prices = gold.parseGoldPrices(payload());
  const totals = gold.goldPortfolioTotals([
    entry(2, 24, 6000), entry(10, 22, 6500), entry(5, 24, null),
  ], prices);
  assert.equal(totals.currentValue, 109600);
  assert.equal(totals.cost, 77000);
  assert.equal(totals.profitLoss, -1400);
  assert.equal(totals.missingCostCount, 1);
  assert.equal(gold.goldPortfolioTotals([entry(1, 22, 0)], prices).profitLoss, 6200);
  assert.equal(gold.goldPortfolioTotals([entry(1, 22, null)], prices).profitLoss, null);
  assert.equal(gold.goldPortfolioTotals([], prices).profitLoss, null);
  assert.equal(gold.goldPortfolioTotals([entry(1, 22, 6000)], null).currentValue, null);
});

function route(fetch, apiKey = "test-secret", authenticated = true) {
  return loadSource("../src/app/api/gold/price/route.ts", {
    fetch, process: { env: { ALTINAPI_API_KEY: apiKey } },
  }, {
    "@/lib/gold-prices": gold,
    "next/headers": { cookies: async () => ({ get: () => ({ value: "test-session" }) }) },
    "@/lib/auth": { authCookieName: "expense_session", isValidSession: async () => authenticated },
  });
}

test("unauthenticated calls cannot consume the API quota", async () => {
  let calls = 0;
  const response = await route(() => { calls++; }, "test-secret", false).GET();
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("route sends the key only in a header and caches upstream for five minutes", async () => {
  const handler = route(async (url, options) => {
    assert.equal(url, "https://altinapi.com/api/v1/prices");
    assert.equal(options.headers["X-API-Key"], "test-secret");
    assert.equal(options.next.revalidate, 300);
    return { ok: true, json: async () => payload() };
  });
  const response = await handler.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const text = await response.text();
  assert.ok(!text.includes("test-secret"));
  assert.equal(JSON.parse(text).gram22.bid, 6200);
});

test("route handles missing key, rate limits, provider failures and malformed responses safely", async () => {
  const noKey = route(() => { throw new Error("must not fetch"); }, "");
  assert.equal((await noKey.GET()).status, 503);
  for (const status of [401, 403, 429, 503]) {
    const response = await route(async () => ({ ok: false, status })).GET();
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("test-secret"));
  }
  for (const fetcher of [
    async () => { throw new Error("timeout test-secret"); },
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    const response = await route(fetcher).GET();
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("test-secret"));
  }
});
