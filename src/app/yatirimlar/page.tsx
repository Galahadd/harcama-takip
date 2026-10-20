"use client";

import { FormEvent, useEffect, useState } from "react";
import { CircleHelp, Coins, Landmark, Plus, RefreshCcw, Search, ShieldCheck, TrendingUp, Trash2, WalletCards, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState, FormDialog, PanelHeading, StatCard, TablePagination } from "@/components/finance-ui";
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
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
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

    if (saving) { event.preventDefault(); return; }
    setSaving(true);
    try {
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
      setMessage("Yatırım kaydı eklendi.");
      setShowForm(false);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally {
      setSaving(false);
    }
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


  const holdingColors = ["#7a68dd", "#3c9c91", "#e5b35a", "#7395cc", "#ba78af"];
  const holdings = GOLD_OPTIONS.map((option) => ({
    label: option.label,
    grams: entries.filter((entry) => entry.goldType === option.value).reduce((sum, entry) => sum + entry.grams, 0),
  })).filter((holding) => holding.grams > 0).sort((a,b) => b.grams - a.grams);
  const distribution = holdings.length > 5
    ? [...holdings.slice(0,4), { label: "Diğer türler", grams: holdings.slice(4).reduce((sum, holding) => sum + holding.grams, 0) }]
    : holdings;
  const query = search.trim().toLocaleLowerCase("tr-TR");
  const filteredEntries = entries.filter((entry) =>
    (typeFilter === "all" || entry.goldType === typeFilter) &&
    (!query || (getGoldOption(entry.goldType).label + " " + (entry.note || "")).toLocaleLowerCase("tr-TR").includes(query)));
  const pageCount = Math.max(1,Math.ceil(filteredEntries.length / 10));
  const currentPage = Math.min(page,pageCount);
  const visibleEntries = filteredEntries.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <AppShell title="Yatırımlar" description="Altın varlıklarını, alış maliyetini ve güncel portföy değerini takip et." actions={<>
      <button className="btn-secondary" onClick={() => { void loadEntries(); void loadPrices(); }} disabled={loading || pricesLoading}><RefreshCcw size={16} className={loading || pricesLoading ? "animate-spin" : ""} />Verileri yenile</button>
      <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={17} />Yatırım ekle</button>
    </>}>
      {message ? <div className="notice" role="status"><CircleHelp size={17} /><p>{message}</p><button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setMessage("")}><X size={17} /></button></div> : null}
      <div className="stats-grid">
        <StatCard label="Portföy değeri" value={totalCurrentValue !== null ? formatCurrency(totalCurrentValue) : "—"} detail={totalCurrentValue === null ? "Güncel fiyat bilgisi bekleniyor" : "Son alınan altın alış fiyatlarıyla"} icon={Landmark} featured loading={loading || pricesLoading} />
        <StatCard label="Toplam altın" value={totalGrams.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " gr"} detail={total24Grams.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " gr 24 ayar · " + total22Grams.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " gr 22 ayar"} icon={Coins} loading={loading} />
        <StatCard label="Alış maliyeti" value={hasAnyCost ? formatCurrency(totalCostValue) : "—"} detail={hasAnyCost ? "Alış fiyatı girilen varlıklar" : "Kayıtlara alış fiyatı ekleyebilirsin"} icon={WalletCards} loading={loading} />
        <StatCard label="Kâr / zarar" value={profitLoss !== null ? (profitLoss >= 0 ? "+" : "") + formatCurrency(profitLoss) : "—"} detail={missingCostCount ? missingCostCount + " maliyetsiz kayıt hesaplamaya dahil değil" : "Alış maliyeti bilinen varlıklar"} icon={TrendingUp} tone={profitLoss === null ? "default" : profitLoss >= 0 ? "positive" : "negative"} loading={loading || pricesLoading} />
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <PanelHeading title="Portföy dağılımı" description="Altın türlerine göre gram karşılığı" action={<span className="panel-badge">{entries.length} varlık kaydı</span>} />
          {loading ? <div className="skeleton chart-skeleton" aria-label="Portföy dağılımı yükleniyor" /> : distribution.length ? <div className="distribution-layout">
            <div className="donut-wrap" role="img" aria-label={distribution.map((holding) => holding.label + ": " + holding.grams.toLocaleString("tr-TR") + " gram").join(", ")}>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="grams" nameKey="label" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none" cornerRadius={4} isAnimationActive={false}>{distribution.map((holding,index) => <Cell key={holding.label} fill={holdingColors[index % holdingColors.length]} />)}</Pie><Tooltip formatter={(value) => Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 4 }) + " gr"} /></PieChart></ResponsiveContainer>
              <div className="donut-center"><strong>{holdings.length}</strong><span>altın türü</span></div>
            </div>
            <div className="category-list">{distribution.map((holding,index) => <div className="category-item" key={holding.label}><div className="category-label"><span><i style={{background:holdingColors[index % holdingColors.length]}} aria-hidden="true" />{holding.label}</span><b>{holding.grams.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} gr</b></div><div className="category-bar" aria-hidden="true"><span style={{ width: (totalGrams ? holding.grams / totalGrams * 100 : 0) + "%", background:holdingColors[index % holdingColors.length] }} /></div></div>)}</div>
          </div> : <EmptyState title="Portföyün henüz boş" description="İlk altın kaydını eklediğinde türlere göre dağılımını burada görebilirsin." icon={Coins} action={<button className="btn-text" onClick={() => setShowForm(true)}><Plus size={14} />Yatırım ekle</button>} />}
        </section>
        <section className="panel">
          <PanelHeading title="Altın alış fiyatları" description="AltinAPI · Türk lirası / gram" action={<button className="icon-button" onClick={loadPrices} disabled={pricesLoading} aria-label="Altın fiyatlarını yenile" title="Fiyatları yenile"><RefreshCcw size={15} className={pricesLoading ? "animate-spin" : ""} /></button>} />
          <div className="panel-body">
            <div className="market-quotes">{([["24 ayar",prices?.gram24],["22 ayar",prices?.gram22]] as const).map(([label,quote]) => <div className="market-quote" key={label}><span>{label} gram alış</span><strong>{quote ? formatCurrency(quote.bid) : "—"}</strong><small>{quote ? new Date(quote.updatedAt).toLocaleString("tr-TR", { timeZone:"Europe/Istanbul", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : pricesLoading ? "Fiyatlar yükleniyor…" : "Fiyat alınamadı"}</small></div>)}</div>
            {priceError ? <p className="notice error" role="alert" style={{marginTop:16,marginBottom:0}}>{priceError}</p> : null}
            {prices?.stale ? <p className="market-notice" role="status"><CircleHelp size={14} />Veri güncel değil; hesaplamada son alınan alış fiyatları kullanılıyor.</p> : prices?.marketClosed ? <p className="market-notice"><CircleHelp size={14} />Piyasa kapalı. Son kayıtlı alış fiyatları gösteriliyor.</p> : null}
            <p className="market-notice"><ShieldCheck size={14} />Her varlık kendi ayarı ve gram karşılığıyla hesaplanır. Fiyatlar 5 dakika önbellekte tutulur.</p>
          </div>
        </section>
      </div>
      <section className="panel data-panel">
        <PanelHeading title="Altın varlıklarım" description={filteredEntries.length + " kayıt · Varlık ve maliyet detayları"} action={<div className="table-tools">
          <label className="search-input"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Yatırımlarda ara" placeholder="Altın türü veya not ara" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <select aria-label="Altın türü filtresi" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}><option value="all">Tüm altın türleri</option>{GOLD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>} />
        {loading ? <div aria-label="Yatırım kayıtları yükleniyor" role="status">{[0,1,2].map((row) => <div className="skeleton table-skeleton" key={row} />)}</div> : <>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Altın varlık tablosu"><table className="data-table"><caption className="sr-only">Altın türleri, miktarları, alış maliyetleri ve güncel değerleri</caption><thead><tr><th>Varlık</th><th className="number-cell">Miktar</th><th className="number-cell">Alış maliyeti</th><th className="number-cell">Güncel değer</th><th>Not</th><th className="text-right">İşlem</th></tr></thead><tbody>
            {visibleEntries.map((entry) => {
              const option = getGoldOption(entry.goldType);
              const cost = entry.pricePerGram !== null ? entry.grams * entry.pricePerGram : null;
              const currentValue = goldEntryValue(entry,prices);
              return <tr key={entry.id}>
                <td><div className="gold-type"><span><Coins size={15} aria-hidden="true" /></span><div><strong>{option.label}</strong><small>{formatMonth(entry.month,entry.year)} · {entry.carat} ayar</small></div></div></td>
                <td className="number-cell">{entry.quantity.toLocaleString("tr-TR", { maximumFractionDigits:4 })} {option.unit}<small className="table-subline">{entry.grams.toLocaleString("tr-TR", { maximumFractionDigits:4 })} gr karşılığı</small></td>
                <td className="number-cell">{cost !== null ? formatCurrency(cost) : "—"}<small className="table-subline">{entry.pricePerGram !== null ? formatCurrency(entry.pricePerGram) + " / gr" : "Alış fiyatı girilmemiş"}</small></td>
                <td className="number-cell">{currentValue !== null ? formatCurrency(currentValue) : "—"}{currentValue !== null && cost !== null ? <small className={"table-subline " + (currentValue - cost >= 0 ? "positive" : "negative")}>{currentValue - cost >= 0 ? "+" : ""}{formatCurrency(currentValue-cost)}</small> : null}</td>
                <td className="note-cell">{entry.note || "—"}</td><td className="row-actions"><button className="delete-action" aria-label={option.label + " kaydını sil"} onClick={() => handleDelete(entry.id)} title="Kaydı sil"><Trash2 size={14} /></button></td>
              </tr>;
            })}
          </tbody></table></div>
          {!filteredEntries.length ? <EmptyState title={search || typeFilter !== "all" ? "Eşleşen varlık bulunamadı" : "Henüz yatırım kaydı yok"} description={search || typeFilter !== "all" ? "Arama veya altın türü filtresini değiştirebilirsin." : "Altın türünü ve miktarını girerek portföyünü oluşturmaya başlayabilirsin."} icon={Coins} action={!search && typeFilter === "all" ? <button className="btn-secondary" onClick={() => setShowForm(true)}><Plus size={15} />Yatırım ekle</button> : undefined} /> : null}
        </>}
        <TablePagination page={currentPage} pages={pageCount} total={filteredEntries.length} pageSize={10} onChange={setPage} />
      </section>
      <FormDialog open={showForm} onClose={() => setShowForm(false)} title="Yatırım ekle" description="Altın türünü, miktarını ve varsa alış maliyetini gir.">
        {message && showForm ? <p className="notice" role="status">{message}</p> : null}
          <form onSubmit={handleSubmit} aria-busy={saving} className="rounded-md border border-slate-200 bg-white p-5">
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
              <button disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700">
                <Plus size={16} />
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Aynı ay için farklı türlerde veya birden fazla altın kaydı ekleyebilirsiniz.
            </p>
          </form>
      </FormDialog>
    </AppShell>
  );
}
