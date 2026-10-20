"use client";

import { FormEvent, useEffect, useState } from "react";
import { Calculator, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { currentMonthOption, formatCurrency, formatMonth } from "@/lib/format";
import type { GoldEntry, GoldType } from "@/lib/types";
import { goldEntryValue, goldPortfolioTotals, type GoldPrices } from "@/lib/gold-prices";
import { AppShell } from "@/components/app-shell";
import { sessionFetch } from "@/lib/session-fetch";

const GOLD_OPTIONS: Array<{
  value: GoldType;
  label: string;
  unit: "gr" | "adet";
  gramsPerUnit?: number;
  carat: 22 | 24 | null;
}> = [
  { value: "gram_24", label: "Gram altın (24 ayar)", unit: "gr", carat: 24 },
  { value: "gram_22", label: "Gram altın (22 ayar)", unit: "gr", carat: 22 },
  { value: "bracelet_22", label: "Takı / bilezik", unit: "gr", carat: null },
  { value: "quarter", label: "Çeyrek altın", unit: "adet", gramsPerUnit: 1.754, carat: 22 },
  { value: "half", label: "Yarım altın", unit: "adet", gramsPerUnit: 3.508, carat: 22 },
  { value: "full", label: "Tam altın", unit: "adet", gramsPerUnit: 7.016, carat: 22 },
  { value: "republic", label: "Cumhuriyet altını", unit: "adet", gramsPerUnit: 7.216, carat: 22 },
];

function getGoldOption(type: GoldType) {
  return GOLD_OPTIONS.find((option) => option.value === type) ?? GOLD_OPTIONS[0];
}

export default function YatirimlarPage() {
  const current = currentMonthOption();
  const [entries, setEntries] = useState<GoldEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    month: current.month,
    year: current.year,
    goldType: "gram_24" as GoldType,
    jewelryCarat: 22 as 22 | 24,
    quantity: "",
    pricePerGram: "",
    note: "",
  });
  const [prices, setPrices] = useState<GoldPrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceError, setPriceError] = useState("");

  async function loadPrices() {
    setPricesLoading(true);
    setPriceError("");
    try {
      const res = await sessionFetch("/api/gold/price");
      if (!res) return;
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Altın alış fiyatları alınamadı.");
      }
      setPrices(await res.json());
    } catch (error) {
      setPrices(null);
      setPriceError(error instanceof Error ? error.message : "Altın alış fiyatları alınamadı.");
    } finally {
      setPricesLoading(false);
    }
  }

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await sessionFetch("/api/gold");
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıtlar alınamadı.");
      setEntries(data.entries);
    } catch {
      setMessage("Kayıtlar alınamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
    loadPrices();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const res = await sessionFetch("/api/gold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(form.month),
        year: Number(form.year),
        goldType: form.goldType,
        carat: form.goldType === "bracelet_22" ? form.jewelryCarat : undefined,
        quantity: Number(form.quantity),
        pricePerGram: form.pricePerGram ? Number(form.pricePerGram) : null,
        note: form.note.trim() || null,
      }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Kayit eklenemedi.");
      return;
    }
    setMessage("Kayit eklendi.");
    setForm({
      month: current.month,
      year: current.year,
      goldType: "gram_24",
      jewelryCarat: 22,
      quantity: "",
      pricePerGram: "",
      note: "",
    });
    await loadEntries();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Bu kayit silinsin mi?")) return;
    const res = await sessionFetch("/api/gold", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Kayit silinemedi.");
      return;
    }
    setMessage("Kayit silindi.");
    await loadEntries();
  }


  const totalGrams = entries.reduce((sum, e) => sum + e.grams, 0);
  const total24Grams = entries
    .filter((entry) => entry.carat === 24)
    .reduce((sum, entry) => sum + entry.grams, 0);
  const total22Grams = entries
    .filter((entry) => entry.carat === 22)
    .reduce((sum, entry) => sum + entry.grams, 0);
  const { cost: totalCostValue, currentValue: totalCurrentValue, profitLoss, missingCostCount } =
    goldPortfolioTotals(entries, prices);
  const hasAnyCost = entries.some((e) => e.pricePerGram !== null);
  const selectedGold = getGoldOption(form.goldType);

  return (
    <AppShell title="Yatırımlar" description="Altın birikimini ve güncel değerini bir bakışta takip et." actions={<>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => { void loadEntries(); void loadPrices(); }}
              disabled={loading || pricesLoading}
              title="Yenile"
            >
              <RefreshCcw size={18} />
            </button>

      </>}>


      <div className="dashboard-grid">
        <section className="min-w-0 space-y-6">
          {message ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Toplam gram</p>
              <p className="mt-2 text-2xl font-semibold">
                {totalGrams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr
              </p>
              <p className="mt-1 text-xs text-slate-400">
                24 ayar: {total24Grams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr · 22
                ayar: {total22Grams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Toplam alış maliyeti</p>
              <p className="mt-2 text-2xl font-semibold">
                {hasAnyCost ? formatCurrency(totalCostValue) : "—"}
              </p>
              {!hasAnyCost ? (
                <p className="mt-1 text-xs text-slate-400">Alis fiyati girin</p>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Güncel değer</p>
              <p className="mt-2 text-2xl font-semibold">
                {totalCurrentValue !== null ? formatCurrency(totalCurrentValue) : "—"}
              </p>
              {totalCurrentValue === null ? (
                <p className="mt-1 text-xs text-slate-400">
                  {pricesLoading ? "Alış fiyatları yükleniyor…" : "Alış fiyatları alınamadı"}
                </p>
              ) : null}
            </div>
            <div className={`rounded-md border p-5 ${profitLoss === null ? "border-slate-200 bg-white" : profitLoss >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-sm ${profitLoss === null ? "text-slate-500" : profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                Kâr / Zarar
              </p>
              <p className={`mt-2 text-2xl font-semibold ${profitLoss === null ? "text-slate-950" : profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                {profitLoss !== null
                  ? `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}`
                  : "—"}
              </p>
              {missingCostCount > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Alış maliyeti olmayan {missingCostCount} kayıt kâr/zarara dahil edilmedi.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold">Altın varlıklarım</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Ay</th>
                    <th className="px-5 py-3 font-medium">Altın türü</th>
                    <th className="px-5 py-3 text-right font-medium">Miktar</th>
                    <th className="px-5 py-3 text-right font-medium">Gram karşılığı</th>
                    <th className="px-5 py-3 text-right font-medium">Ayar</th>
                    <th className="px-5 py-3 text-right font-medium">Alış fiyatı / gr</th>
                    <th className="px-5 py-3 text-right font-medium">Maliyet</th>
                    <th className="px-5 py-3 font-medium">Not</th>
                    <th className="px-5 py-3 text-right font-medium">İşlem</th>
                    <th className="sticky right-0 bg-amber-50 px-5 py-3 text-right font-medium">Güncel değer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const option = getGoldOption(entry.goldType);
                    const cost = entry.pricePerGram !== null ? entry.grams * entry.pricePerGram : null;
                    const current = goldEntryValue(entry, prices);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-medium">
                          {formatMonth(entry.month, entry.year)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">{option.label}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {entry.quantity.toLocaleString("tr-TR", { maximumFractionDigits: 4 })}{" "}
                          {option.unit}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {entry.grams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">{entry.carat} ayar</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                          {entry.pricePerGram !== null ? formatCurrency(entry.pricePerGram) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {cost !== null ? formatCurrency(cost) : "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{entry.note ?? "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(entry.id)}
                            title="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                        <td className="sticky right-0 whitespace-nowrap bg-amber-50 px-5 py-3 text-right font-semibold">
                          {current !== null ? formatCurrency(current) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!entries.length && !loading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  Henüz bir altın kaydı yok. İlk birikimini ekleyerek başla.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Calculator size={18} className="text-amber-700" />
              <h2 className="text-base font-semibold text-amber-800">Güncel alış fiyatları</h2>
            </div>
            <p className="mb-3 text-xs text-amber-700">
              AltinAPI alış fiyatlarıyla her kayıt kendi ayarına ve gram karşılığına göre hesaplanır.
            </p>
            <div className="space-y-2">
              {([
                ["24 ayar gram alış", prices?.gram24],
                ["22 ayar gram alış", prices?.gram22],
              ] as const).map(([label, quote]) => (
                <div key={label} className="rounded-md border border-amber-200 bg-white p-3">
                  <p className="text-xs text-amber-800">{label}</p>
                  <p className="mt-1 font-semibold">{quote ? `${formatCurrency(quote.bid)} / gr` : "—"}</p>
                  {quote ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Veri zamanı: {new Date(quote.updatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                    </p>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={loadPrices}
                disabled={pricesLoading}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-white text-sm text-amber-800 disabled:opacity-50"
              >
                <RefreshCcw size={16} className={pricesLoading ? "animate-spin" : ""} />
                {pricesLoading ? "Fiyatlar yükleniyor…" : "Fiyatları yenile"}
              </button>
              <p className="text-xs text-amber-700">Fiyatlar 5 dakika önbellekte tutulur.</p>
            </div>
            {priceError ? <p role="alert" className="mt-3 text-sm text-red-700">{priceError}</p> : null}
            {prices?.stale ? (
              <p role="status" className="mt-3 text-xs text-amber-900">Kaynak verisi güncel değil; hesaplama son alınan alış fiyatlarını kullanıyor.</p>
            ) : prices?.marketClosed ? (
              <p className="mt-3 text-xs text-amber-900">Piyasa kapalı; son kayıtlı alış fiyatları kullanılıyor.</p>
            ) : null}
            {totalCurrentValue !== null ? (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-700">Toplam gram</span>
                  <span className="font-medium">{totalGrams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Toplam deger</span>
                  <span className="font-semibold">{formatCurrency(totalCurrentValue)}</span>
                </div>
                {hasAnyCost ? (
                  <div className={`flex justify-between font-semibold ${profitLoss !== null && profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                    <span>Kâr / Zarar</span>
                    <span>{profitLoss !== null ? `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}` : "—"}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={18} />
              <h2 className="text-base font-semibold">Altın ekle</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <label className="block min-w-0"><span className="form-label">Ay</span><select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m, form.year).replace(` ${form.year}`, "")}
                    </option>
                  ))}
                </select></label>
                <label className="block min-w-0"><span className="form-label">Yıl</span><input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                /></label>
              </div>
              <label className="block min-w-0"><span className="form-label">Altın türü</span><select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={form.goldType}
                onChange={(e) =>
                  setForm({ ...form, goldType: e.target.value as GoldType, quantity: "" })
                }
              >
                {GOLD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.gramsPerUnit ? ` (${option.gramsPerUnit} gr/adet)` : ""}
                  </option>
                ))}
              </select></label>
              {form.goldType === "bracelet_22" ? (
                <label className="block min-w-0"><span className="form-label">Takı ayarı</span><select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.jewelryCarat}
                  onChange={(e) =>
                    setForm({ ...form, jewelryCarat: Number(e.target.value) as 22 | 24 })
                  }
                  aria-label="Takı ayarı"
                >
                  <option value={22}>22 ayar</option>
                  <option value={24}>24 ayar</option>
                </select></label>
              ) : null}
              <label className="block min-w-0"><span className="form-label">Miktar</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min={selectedGold.unit === "adet" ? "1" : "0.0001"}
                step={selectedGold.unit === "adet" ? "1" : "0.0001"}
                placeholder={selectedGold.unit === "adet" ? "Adet" : "Gram (örn: 1,5)"}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              /></label>
              {selectedGold.gramsPerUnit && form.quantity ? (
                <p className="text-xs text-slate-500">
                  Gram karşılığı:{" "}
                  {(Number(form.quantity) * selectedGold.gramsPerUnit).toLocaleString("tr-TR", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  gr · {selectedGold.carat} ayar
                </p>
              ) : form.goldType === "bracelet_22" && form.quantity ? (
                <p className="text-xs text-slate-500">
                  {Number(form.quantity).toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr ·{" "}
                  {form.jewelryCarat} ayar
                </p>
              ) : null}
              <label className="block min-w-0"><span className="form-label">Alış fiyatı / gram (TL)</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Alış fiyatı / gram (opsiyonel)"
                value={form.pricePerGram}
                onChange={(e) => setForm({ ...form, pricePerGram: e.target.value })}
              /></label>
              <label className="block min-w-0"><span className="form-label">Not</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Not (opsiyonel)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              /></label>
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700">
                <Plus size={16} />
                Kaydet
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Aynı ay için farklı türlerde veya birden fazla altın kaydı ekleyebilirsiniz.
            </p>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
