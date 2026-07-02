"use client";

import { FormEvent, useEffect, useState } from "react";
import { Calculator, LogOut, Plus, RefreshCcw, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { currentMonthOption, formatCurrency, formatMonth } from "@/lib/format";
import type { GoldEntry } from "@/lib/types";
import Link from "next/link";

export default function YatirimlarPage() {
  const current = currentMonthOption();
  const [entries, setEntries] = useState<GoldEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    month: current.month,
    year: current.year,
    grams: "",
    pricePerGram: "",
    note: "",
  });
  const [livePrice, setLivePrice] = useState("");

  async function loadEntries() {
    setLoading(true);
    const res = await fetch("/api/gold");
    const data = await res.json();
    if (res.ok) {
      setEntries(data.entries);
    } else {
      setMessage(data.error || "Kayitlar alinamadi.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const res = await fetch("/api/gold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(form.month),
        year: Number(form.year),
        grams: Number(form.grams),
        pricePerGram: form.pricePerGram ? Number(form.pricePerGram) : null,
        note: form.note.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Kayit eklenemedi.");
      return;
    }
    setMessage("Kayit eklendi.");
    setForm({ month: current.month, year: current.year, grams: "", pricePerGram: "", note: "" });
    await loadEntries();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Bu kayit silinsin mi?")) return;
    const res = await fetch("/api/gold", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Kayit silinemedi.");
      return;
    }
    setMessage("Kayit silindi.");
    await loadEntries();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const totalGrams = entries.reduce((sum, e) => sum + e.grams, 0);
  const livePriceNum = livePrice ? Number(livePrice.replace(",", ".")) : null;
  const totalCurrentValue = livePriceNum ? totalGrams * livePriceNum : null;
  const totalCostValue = entries.reduce((sum, e) => {
    if (e.pricePerGram !== null) return sum + e.grams * e.pricePerGram;
    return sum;
  }, 0);
  const hasAnyCost = entries.some((e) => e.pricePerGram !== null);
  const profitLoss = totalCurrentValue !== null && hasAnyCost ? totalCurrentValue - totalCostValue : null;

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-600 text-white">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Yatirimlar</h1>
              <p className="text-sm text-slate-500">Gram altin takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-md border border-slate-200 bg-white text-sm">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-l-md border-r border-slate-200"
              >
                <WalletCards size={15} />
                Harcamalar
              </Link>
              <span className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 font-medium rounded-r-md">
                <TrendingUp size={15} />
                Yatirimlar
              </span>
            </nav>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={loadEntries}
              title="Yenile"
            >
              <RefreshCcw size={18} />
            </button>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={logout}
              title="Cikis"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px] lg:px-8">
        <section className="space-y-6">
          {message ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Toplam gram</p>
              <p className="mt-2 text-2xl font-semibold">
                {totalGrams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Maliyet toplami</p>
              <p className="mt-2 text-2xl font-semibold">
                {hasAnyCost ? formatCurrency(totalCostValue) : "—"}
              </p>
              {!hasAnyCost ? (
                <p className="mt-1 text-xs text-slate-400">Alis fiyati girin</p>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Guncel deger</p>
              <p className="mt-2 text-2xl font-semibold">
                {totalCurrentValue !== null ? formatCurrency(totalCurrentValue) : "—"}
              </p>
              {totalCurrentValue === null ? (
                <p className="mt-1 text-xs text-slate-400">Anlık fiyat girin →</p>
              ) : null}
            </div>
            <div className={`rounded-md border p-5 ${profitLoss === null ? "border-slate-200 bg-white" : profitLoss >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-sm ${profitLoss === null ? "text-slate-500" : profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                Kar / Zarar
              </p>
              <p className={`mt-2 text-2xl font-semibold ${profitLoss === null ? "text-slate-950" : profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                {profitLoss !== null
                  ? `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold">Altin kayitlari</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Ay</th>
                    <th className="px-5 py-3 text-right font-medium">Gram</th>
                    <th className="px-5 py-3 text-right font-medium">Alis fiyati / gr</th>
                    <th className="px-5 py-3 text-right font-medium">Maliyet</th>
                    <th className="px-5 py-3 text-right font-medium">Guncel deger</th>
                    <th className="px-5 py-3 font-medium">Not</th>
                    <th className="px-5 py-3 text-right font-medium">Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const cost = entry.pricePerGram !== null ? entry.grams * entry.pricePerGram : null;
                    const current = livePriceNum !== null ? entry.grams * livePriceNum : null;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-medium">
                          {formatMonth(entry.month, entry.year)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {entry.grams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                          {entry.pricePerGram !== null ? formatCurrency(entry.pricePerGram) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {cost !== null ? formatCurrency(cost) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-medium">
                          {current !== null ? formatCurrency(current) : "—"}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!entries.length && !loading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  Henuz altin kaydi yok.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Calculator size={18} className="text-amber-700" />
              <h2 className="text-base font-semibold text-amber-800">Anlik hesaplama</h2>
            </div>
            <p className="mb-3 text-xs text-amber-700">
              Guncel gram altin fiyatini girin, toplam degeriniz hesaplansin.
            </p>
            <input
              className="h-10 w-full rounded-md border border-amber-300 bg-white px-3 text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="Guncel gram fiyati (TRY)"
              value={livePrice}
              onChange={(e) => setLivePrice(e.target.value)}
            />
            {livePriceNum !== null && livePriceNum > 0 ? (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-700">Toplam gram</span>
                  <span className="font-medium">{totalGrams.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} gr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Toplam deger</span>
                  <span className="font-semibold">{formatCurrency(totalGrams * livePriceNum)}</span>
                </div>
                {hasAnyCost ? (
                  <div className={`flex justify-between font-semibold ${profitLoss !== null && profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
                    <span>Kar / Zarar</span>
                    <span>{profitLoss !== null ? `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}` : "—"}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={18} />
              <h2 className="text-base font-semibold">Altin ekle</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m, form.year).replace(` ${form.year}`, "")}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                />
              </div>
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min="0.0001"
                step="0.0001"
                placeholder="Gram (orn: 1.5)"
                value={form.grams}
                onChange={(e) => setForm({ ...form, grams: e.target.value })}
                required
              />
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Alis fiyati / gram (opsiyonel)"
                value={form.pricePerGram}
                onChange={(e) => setForm({ ...form, pricePerGram: e.target.value })}
              />
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Not (opsiyonel)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700">
                <Plus size={16} />
                Kaydet
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Ayni ay icin tekrar kayit eklerseniz mevcut kayit guncellenir.
            </p>
          </form>
        </aside>
      </div>
    </main>
  );
}
