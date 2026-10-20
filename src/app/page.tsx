"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  FileUp,
  ArrowDownLeft,
  CalendarDays,
  ChartNoAxesColumn,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  Layers3,
  Search,
  SlidersHorizontal,
  WalletCards,
  X,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { sessionFetch } from "@/lib/session-fetch";
import clsx from "clsx";
import { EmptyState, FormDialog, PanelHeading, StatCard, TablePagination } from "@/components/finance-ui";
import { categories, currentMonthOption, formatCategory, formatCurrency, formatMonth } from "@/lib/format";
import {
  bankOptions,
  formatBank,
  uploadBankOptions,
} from "@/lib/format";
import type {
  Bank,
  CategoryTotal,
  Expense,
  FutureInstallment,
  InstallmentSummary,
  MonthOption,
  ParsedExpense,
} from "@/lib/types";

const chartColors = [
  "#7a68dd",
  "#3c9c91",
  "#e5b35a",
  "#7395cc",
  "#ba78af",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#475569",
  "#db2777",
];

type Summary = {
  month: number;
  year: number;
  bank: string;
  months: MonthOption[];
  expenses: Expense[];
  futureInstallments: FutureInstallment[];
  installmentSummary: InstallmentSummary;
  total: number;
  categoryTotals: CategoryTotal[];
};

type SortKey = "date" | "amount" | "category";
type SortDirection = "asc" | "desc";

const emptySummary: Summary = {
  ...currentMonthOption(),
  bank: "all",
  months: [],
  expenses: [],
  futureInstallments: [],
  installmentSummary: {
    activeInstallments: [],
    monthlyInstallmentTotals: [],
    bankTotals: [],
    remainingTotal: 0,
    nextMonthTotal: 0,
    maxMonthlyTotal: 0,
  },
  total: 0,
  categoryTotals: [],
};

function previousMonthOption() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

export default function Home() {
  const current = currentMonthOption();
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedBank, setSelectedBank] = useState("all");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    category: "Diger",
  });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadBank, setUploadBank] = useState<Bank>("garanti");
  const previousMonth = previousMonthOption();
  const [uploadMonth, setUploadMonth] = useState(previousMonth.getMonth() + 1);
  const [uploadYear, setUploadYear] = useState(previousMonth.getFullYear());
  const [previewRows, setPreviewRows] = useState<ParsedExpense[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [activePanel, setActivePanel] = useState<"expense" | "statement" | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const summaryRequest = useRef(0);

  async function loadSummary(month = selectedMonth, year = selectedYear, bank = selectedBank) {
    const requestId = ++summaryRequest.current;
    setLoading(true);
    setMessage("");
    try {
      const response = await sessionFetch(`/api/summary?month=${month}&year=${year}&bank=${bank}`);
      if (!response) return;
      const data = await response.json();
      if (requestId !== summaryRequest.current) return;
      if (!response.ok) throw new Error(data.error || "Veri alınamadı.");
      setSummary(data);
      setSelectedExpenseIds(new Set());
    } catch (error) {
      if (requestId === summaryRequest.current) setMessage(error instanceof Error ? error.message : "Bağlantı kurulamadı. Yeniden deneyin.");
    } finally {
      if (requestId === summaryRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedBank]);

  const monthOptions = useMemo(() => {
    const known = summary.months.map((item) => `${item.year}-${item.month}`);
    const selectedKey = `${selectedYear}-${selectedMonth}`;
    const options = known.includes(selectedKey)
      ? summary.months
      : [{ month: selectedMonth, year: selectedYear }, ...summary.months];
    return options;
  }, [summary.months, selectedMonth, selectedYear]);

  const sortedExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return summary.expenses.filter((expense) =>
      (sourceFilter === "all" || expense.source === sourceFilter) &&
      (!query || (expense.description + " " + formatCategory(expense.category) + " " + expense.category + " " + formatBank(expense.bank)).toLocaleLowerCase("tr-TR").includes(query))
    ).sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "amount") {
        return (a.amount - b.amount) * direction;
      }

      if (sortKey === "category") {
        return a.category.localeCompare(b.category, "tr") * direction;
      }

      return a.date.localeCompare(b.date) * direction;
    });
  }, [summary.expenses, sortDirection, sortKey, search, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(sortedExpenses.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visibleExpenses = sortedExpenses.slice((currentPage - 1) * 10, currentPage * 10);
  const groupedCategories = summary.categoryTotals.length > 5
    ? [...summary.categoryTotals.slice(0, 4), { category: "Diğer kategoriler", total: summary.categoryTotals.slice(4).reduce((sum, item) => sum + item.total, 0) }]
    : summary.categoryTotals;
  const categoryRows = expandedCategories ? summary.categoryTotals : groupedCategories;
  const installmentMonths = summary.installmentSummary.monthlyInstallmentTotals.slice(0, 6);

  const allVisibleSelected =
    visibleExpenses.some((expense) => !expense.projected) &&
    visibleExpenses.filter((expense) => !expense.projected).every((expense) => selectedExpenseIds.has(expense.id));

  function toggleExpenseSelection(id: string) {
    setSelectedExpenseIds((currentIds) => {
      const next = new Set(currentIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllVisibleExpenses() {
    setSelectedExpenseIds((currentIds) => {
      if (allVisibleSelected) {
        const next = new Set(currentIds);
        for (const expense of visibleExpenses) next.delete(expense.id);
        return next;
      }

      const next = new Set(currentIds);
      for (const expense of visibleExpenses) {
        if (!expense.projected) {
          next.add(expense.id);
        }
      }
      return next;
    });
  }

  async function saveManualExpense(event: FormEvent<HTMLFormElement>) {

    if (saving) { event.preventDefault(); return; }
    setSaving(true);
    setMessage("");
    try {
      event.preventDefault();
      const payload = {
        ...manualForm,
        amount: Number(manualForm.amount),
      };

      const url = editing ? `/api/expenses/${editing.id}` : "/api/expenses";
      const response = await sessionFetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response) return;
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Harcama kaydedilemedi.");
        return;
      }

      const date = new Date(manualForm.date);
      setSelectedMonth(date.getMonth() + 1);
      setSelectedYear(date.getFullYear());
      setManualForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        category: "Diger",
      });
      setEditing(null);
      setActivePanel(null);
      setMessage(editing ? "Harcama güncellendi." : "Harcama eklendi.");
      await loadSummary(date.getMonth() + 1, date.getFullYear());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    const response = await sessionFetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!response) return;
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "Harcama silinemedi.");
      return;
    }
    setMessage("Harcama silindi.");
    await loadSummary();
  }

  async function deleteSelectedExpenses() {
    const ids = [...selectedExpenseIds];
    if (!ids.length) {
      setMessage("Silmek icin once harcama secin.");
      return;
    }

    if (!window.confirm(`${ids.length} harcama silinsin mi?`)) {
      return;
    }

    const response = await sessionFetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response) return;
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Secili harcamalar silinemedi.");
      return;
    }

    setMessage(`${data.deleted} harcama silindi.`);
    await loadSummary();
  }

  async function deleteCurrentMonthExpenses() {
    const bankLabel = selectedBank === "all" ? "tum bankalar" : formatBank(selectedBank);
    if (!window.confirm(`${formatMonth(selectedMonth, selectedYear)} icin ${bankLabel} harcamalari silinsin mi?`)) {
      return;
    }

    const response = await sessionFetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: selectedMonth, year: selectedYear, bank: selectedBank }),
    });
    if (!response) return;
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ay harcamalari silinemedi.");
      return;
    }

    setMessage(`${data.deleted} harcama silindi.`);
    await loadSummary();
  }

  async function previewPdf(event: FormEvent<HTMLFormElement>) {


    try {
      event.preventDefault();
      if (!pdfFile) {
        setMessage("Ekstre dosyası seçin.");
        return;
      }

      setPreviewing(true);
      setMessage("");
      const formData = new FormData();
      formData.set("file", pdfFile);
      formData.set("bank", uploadBank);
      const response = await sessionFetch("/api/statements/preview", {
        method: "POST",
        body: formData,
      });
      if (!response) return;
      const data = await response.json();
      setPreviewing(false);

      if (!response.ok) {
        setMessage(data.error || "Ekstre okunamadı.");
        return;
      }

      setPreviewRows(data.rows);
      setMessage(`${data.rows.length} harcama bulundu.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally {
      setPreviewing(false);
    }
  }

  async function importPdf() {

    if (importing) return;
    setImporting(true);
    try {
      if (!pdfFile || previewRows.length === 0) {
        setMessage("İçe aktarmak için önce ekstre önizlemesi alın.");
        return;
      }

      const formData = new FormData();
      formData.set("file", pdfFile);
      formData.set("month", String(uploadMonth));
      formData.set("year", String(uploadYear));
      formData.set("bank", uploadBank);
      formData.set("rows", JSON.stringify(previewRows));

      const response = await sessionFetch("/api/statements/import", {
        method: "POST",
        body: formData,
      });
      if (!response) return;
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Ekstre içe aktarılamadı.");
        return;
      }

      setPreviewRows([]);
      setPdfFile(null);
      const doneMessage = `${data.inserted} yeni harcama kaydedildi.`;
      setSelectedMonth(uploadMonth);
      setSelectedYear(uploadYear);
      setMessage(doneMessage);
      setCompletionMessage(doneMessage);
      setActivePanel(null);
      await loadSummary(uploadMonth, uploadYear);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally {
      setImporting(false);
    }
  }

  function startEdit(expense: Expense) {
    setMessage("");
    setActivePanel("expense");
    setEditing(expense);
    setManualForm({
      date: expense.date,
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
    });
  }

  function openExpense() {
    setEditing(null);
    setMessage("");
    setManualForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", category: "Diger" });
    setActivePanel("expense");
  }

  return (
    <AppShell title="Harcamalar" description="Aylık harcamalarını, ekstrelerini ve taksitlerini takip et." actions={<>
      <button className="btn-secondary" onClick={() => setActivePanel("statement")}><FileUp size={16} />Ekstre yükle</button>
      <button className="btn-primary" onClick={openExpense}><Plus size={17} />Harcama ekle</button>
    </>}>
      <div className="filter-bar">
        <div className="filter-controls">
          <span className="filter-label"><SlidersHorizontal size={15} />Görünüm</span>
          <label className="filter-field"><span>Dönem</span><select aria-label="Ay seçimi" value={selectedYear + "-" + selectedMonth} onChange={(event) => {
            const [year, month] = event.target.value.split("-").map(Number); setSelectedYear(year); setSelectedMonth(month); setPage(1);
          }}>{monthOptions.map((option) => <option key={option.year + "-" + option.month} value={option.year + "-" + option.month}>{formatMonth(option.month, option.year)}</option>)}</select></label>
          <label className="filter-field"><span>Banka</span><select aria-label="Banka filtresi" value={selectedBank} onChange={(event) => { setSelectedBank(event.target.value); setPage(1); }}>{bankOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <div className="filter-meta"><CalendarDays size={14} /><span>{formatMonth(selectedMonth, selectedYear)}</span><button className="icon-button" onClick={() => loadSummary()} disabled={loading} aria-label="Harcama verilerini yenile" title="Verileri yenile"><RefreshCcw size={16} className={loading ? "animate-spin" : ""} /></button></div>
      </div>
      {completionMessage ? <div className="notice success" role="status"><CheckCircle2 size={18} /><p>{completionMessage}</p><button className="icon-button" aria-label="Bildirimi kapat" onClick={() => { setCompletionMessage(""); setMessage(""); }}><X size={17} /></button></div> : message ? <div className="notice" role="status"><CircleHelp size={17} /><p>{message}</p><button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setMessage("")}><X size={17} /></button></div> : null}
      <div className="stats-grid">
        <StatCard label="Toplam harcama" value={formatCurrency(summary.total)} detail={summary.expenses.some((item) => item.projected) ? "Planlanan taksitler dahil" : "Seçili dönemdeki toplam tutar"} icon={WalletCards} featured loading={loading} />
        <StatCard label="İşlem sayısı" value={summary.expenses.length.toLocaleString("tr-TR")} detail={summary.expenses.filter((item) => item.projected).length + " planlanan taksit"} icon={ArrowDownLeft} loading={loading} />
        <StatCard label="Gelecek ay taksit" value={formatCurrency(summary.installmentSummary.nextMonthTotal)} detail="Kayıtlardan hesaplanan ödeme" icon={CreditCard} loading={loading} />
        <StatCard label="Kategori sayısı" value={summary.categoryTotals.length} detail="Seçili dönemde harcama yapılan" icon={Layers3} loading={loading} />
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <PanelHeading title="Harcama dağılımı" description="Toplam tutarın kategorilere göre dağılımı" action={<span className="panel-badge">{formatMonth(selectedMonth, selectedYear)}</span>} />
          {loading ? <div className="skeleton chart-skeleton" aria-label="Harcama dağılımı yükleniyor" /> : summary.categoryTotals.length ? <>
            <div className="distribution-layout">
              <div className="donut-wrap" role="img" aria-label={summary.categoryTotals.length + " kategori için harcama dağılımı. Tutarlar yanındaki listede gösterilir."}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={groupedCategories.map((item) => ({ ...item, category: formatCategory(item.category) }))} dataKey="total" nameKey="category" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none" cornerRadius={4} isAnimationActive={false}>{groupedCategories.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer>
                <div className="donut-center"><strong>{summary.categoryTotals.length}</strong><span>kategori</span></div>
              </div>
              <div className="category-list">{categoryRows.map((item, index) => <div key={item.category} className="category-item"><div className="category-label"><span><i style={{ background: chartColors[index % chartColors.length] }} aria-hidden="true" />{formatCategory(item.category)}</span><b>{formatCurrency(item.total)}</b></div><div className="category-bar" aria-hidden="true"><span style={{ width: (summary.total ? item.total / summary.total * 100 : 0) + "%", background: chartColors[index % chartColors.length] }} /></div></div>)}
              {summary.categoryTotals.length > 5 ? <button className="btn-text" onClick={() => setExpandedCategories(!expandedCategories)} aria-expanded={expandedCategories}>{expandedCategories ? "Daha az göster" : "Tüm kategorileri göster"}</button> : null}</div>
            </div>
          </> : <EmptyState title="Henüz dağılım verisi yok" description="Harcama eklediğinde kategori dağılımını burada görebilirsin." icon={ChartNoAxesColumn} action={<button className="btn-text" onClick={openExpense}><Plus size={14} />Harcama ekle</button>} />}
        </section>
        <section className="panel">
          <PanelHeading title="Taksit planı" description="Kayıtlı ekstrelerden hesaplanan aylık ödemeler" action={<span className="panel-badge"><CreditCard size={11} />Planlanan</span>} />
          {loading ? <div className="skeleton chart-skeleton" aria-label="Taksit planı yükleniyor" /> : installmentMonths.length ? <div className="panel-body">
            <div className="monthly-bars" role="img" aria-label={installmentMonths.map((month) => formatMonth(month.month, month.year) + ": " + formatCurrency(month.total)).join(", ")}>{installmentMonths.map((item) => <div className="monthly-bar" key={item.year + "-" + item.month} title={formatMonth(item.month, item.year) + ": " + formatCurrency(item.total)}><div style={{ height: Math.max(4, item.total / (summary.installmentSummary.maxMonthlyTotal || 1) * 100) + "%" }} /><span>{formatMonth(item.month, item.year).split(" ")[0].slice(0,3)}</span></div>)}</div>
            <div className="installment-summary"><span>Kalan taksit toplamı</span><strong>{formatCurrency(summary.installmentSummary.remainingTotal)}</strong></div>
            <p className="market-notice">Yeni ekstreler yüklendiğinde taksit planı güncellenir.</p>
          </div> : <EmptyState title="Gelecek taksit bulunmuyor" description="Taksitli işlemler içeren bir ekstre yüklediğinde ödeme planın burada görünür." icon={CreditCard} />}
        </section>
      </div>
      <section className="panel data-panel">
        <PanelHeading title="İşlem geçmişi" description={sortedExpenses.length + " kayıt · " + formatMonth(selectedMonth, selectedYear)} action={<div className="table-tools">
          <label className="search-input"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Harcamalarda ara" placeholder="İşlem veya kategori ara" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <select aria-label="Kayıt kaynağı" value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}><option value="all">Tüm kaynaklar</option><option value="manual">Manuel</option><option value="pdf">Ekstre</option><option value="projected">Planlanan</option></select>
          <select aria-label="Sıralama alanı" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="date">Tarih</option><option value="amount">Tutar</option><option value="category">Kategori</option></select>
          <select aria-label="Sıralama yönü" value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">Azalan</option><option value="asc">Artan</option></select>
        </div>} />
        <div className="table-selection"><span>{selectedExpenseIds.size ? selectedExpenseIds.size + " işlem seçildi" : "Düzenlemek veya silmek için bir işlem seç."}</span><div className="flex gap-2"><button className="btn-danger" disabled={!selectedExpenseIds.size} onClick={deleteSelectedExpenses}><Trash2 size={13} />Seçilenleri sil</button><button className="btn-text" onClick={deleteCurrentMonthExpenses}>Ayın kayıtlarını sil</button></div></div>
        {loading ? <div aria-label="İşlemler yükleniyor" role="status">{[0,1,2].map((row) => <div className="skeleton table-skeleton" key={row} />)}</div> : <>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Harcama tablosu"><table className="data-table"><caption className="sr-only">Seçili dönemin harcamaları ve planlanan taksitleri</caption><thead><tr>
            <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleExpenses} aria-label="Bu sayfadaki harcamaları seç" /></th><th aria-sort={sortKey === "date" ? sortDirection === "asc" ? "ascending" : "descending" : undefined}>Tarih</th><th>Açıklama</th><th aria-sort={sortKey === "category" ? sortDirection === "asc" ? "ascending" : "descending" : undefined}>Kategori</th><th>Banka</th><th>Kaynak</th><th className="number-cell" aria-sort={sortKey === "amount" ? sortDirection === "asc" ? "ascending" : "descending" : undefined}>Tutar</th><th className="text-right">İşlem</th>
          </tr></thead><tbody>{visibleExpenses.map((expense) => <tr key={expense.id}>
            <td><input type="checkbox" checked={!expense.projected && selectedExpenseIds.has(expense.id)} disabled={expense.projected} onChange={() => toggleExpenseSelection(expense.id)} aria-label={expense.description + " harcamasını seç"} /></td>
            <td className="date-cell">{new Date(expense.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}</td>
            <td className="description-cell"><div>{expense.description}</div>{expense.installmentCurrent && expense.installmentTotal ? <span className="installment-tag">{expense.installmentCurrent}/{expense.installmentTotal} taksit</span> : null}</td>
            <td>{formatCategory(expense.category)}</td><td className="whitespace-nowrap">{formatBank(expense.bank)}</td>
            <td><span className={clsx("source-badge", expense.source)}>{expense.source === "projected" ? "Planlanan" : expense.source === "pdf" ? "Ekstre" : "Manuel"}</span></td>
            <td className="number-cell">{formatCurrency(expense.amount)}</td>
            <td className="row-actions">{expense.projected ? <span className="source-badge">Plan</span> : <><button onClick={() => startEdit(expense)} aria-label={expense.description + " harcamasını düzenle"} title="Düzenle"><Pencil size={14} /></button><button className="delete-action" onClick={() => deleteExpense(expense.id)} aria-label={expense.description + " harcamasını sil"} title="Sil"><Trash2 size={14} /></button></>}</td>
          </tr>)}</tbody></table></div>
          {!sortedExpenses.length ? <EmptyState title={search || sourceFilter !== "all" ? "Eşleşen işlem bulunamadı" : "Bu dönemde işlem bulunmuyor"} description={search || sourceFilter !== "all" ? "Farklı bir arama veya kaynak filtresi deneyebilirsin." : "Manuel harcama ekleyebilir veya bir banka ekstresi yükleyebilirsin."} action={!search && sourceFilter === "all" ? <button className="btn-secondary" onClick={() => setActivePanel("statement")}><FileUp size={15} />Ekstre yükle</button> : undefined} /> : null}
        </>}
        <TablePagination page={currentPage} pages={pageCount} total={sortedExpenses.length} pageSize={10} onChange={setPage} />
      </section>
      <FormDialog open={activePanel === "expense"} onClose={() => { setActivePanel(null); setEditing(null); }} title={editing ? "Harcamayı düzenle" : "Harcama ekle"} description="Tutar ve kategori bilgilerini girerek işlemi hesabına kaydet.">
        {message && activePanel === "expense" ? <p className="notice" role="status">{message}</p> : null}
          <form onSubmit={saveManualExpense} aria-busy={saving} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              {editing ? <Save size={18} /> : <Plus size={18} />}
              <h2 className="text-base font-semibold">{editing ? "Harcamayı düzenle" : "Harcama ekle"}</h2>
            </div>
            <div className="space-y-3">
              <label className="block min-w-0"><span className="form-label">İşlem tarihi</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="date"
                value={manualForm.date}
                onChange={(event) => setManualForm({ ...manualForm, date: event.target.value })}
                required
              /></label>
              <label className="block min-w-0"><span className="form-label">Açıklama</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Açıklama"
                value={manualForm.description}
                onChange={(event) => setManualForm({ ...manualForm, description: event.target.value })}
                required
              /></label>
              <label className="block min-w-0"><span className="form-label">Tutar (TL)</span><input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Tutar"
                value={manualForm.amount}
                onChange={(event) => setManualForm({ ...manualForm, amount: event.target.value })}
                required
              /></label>
              <label className="block min-w-0"><span className="form-label">Kategori</span><select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={manualForm.category}
                onChange={(event) => setManualForm({ ...manualForm, category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{formatCategory(category)}</option>
                ))}
              </select></label>
              <div className="flex gap-2">
                <button disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800">
                  {editing ? <Save size={16} /> : <Plus size={16} />}
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
                {editing ? (
                  <button
                    type="button"
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    onClick={() => { setEditing(null); setActivePanel(null); }}
                  >
                    İptal
                  </button>
                ) : null}
              </div>
            </div>
          </form>
      </FormDialog>
      <FormDialog open={activePanel === "statement"} onClose={() => setActivePanel(null)} title="Ekstre yükle" description="PDF veya Excel dosyanı seç, işlemleri kontrol ederek içe aktar.">
        {message && activePanel === "statement" ? <p className="notice" role="status">{message}</p> : null}
          <form onSubmit={previewPdf} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileUp size={18} />
              <h2 className="text-base font-semibold">Ekstre yükle</h2>
            </div>
            <div className="space-y-3">
              <label className="block"><span className="form-label">Ekstre dosyası</span><input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="file"
                accept="application/pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={previewing || importing}
                onChange={(event) => { setPdfFile(event.target.files?.[0] || null); setPreviewRows([]); setMessage(""); }}
              /></label>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <label className="block min-w-0"><span className="form-label">Ekstre ayı</span><select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={uploadMonth}
                  onChange={(event) => setUploadMonth(Number(event.target.value))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month, uploadYear).replace(` ${uploadYear}`, "")}
                    </option>
                  ))}
                </select></label>
                <label className="block min-w-0"><span className="form-label">Yıl</span><input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="number"
                  min="2000"
                  max="2100"
                  value={uploadYear}
                  onChange={(event) => setUploadYear(Number(event.target.value))}
                /></label>
              </div>
              <label className="block min-w-0"><span className="form-label">Banka</span><select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={uploadBank}
                disabled={previewing || importing}
                onChange={(event) => { setUploadBank(event.target.value as Bank); setPreviewRows([]); setMessage(""); }}
              >
                {uploadBankOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select></label>
              <button disabled={previewing || !pdfFile} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">
                <FileUp size={16} />
                {previewing ? "Okunuyor..." : "Önizleme al"}
              </button>
            </div>
          </form>

          {previewRows.length ? (
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Ekstre önizleme</h2>
                <button
                  className="h-9 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                  disabled={importing}
                  onClick={importPdf}
                >
                  {importing ? "İçe aktarılıyor…" : "İçe aktar"}
                </button>
              </div>
              <div className="max-h-96 space-y-3 overflow-auto pr-1">
                {previewRows.map((row, index) => (
                  <div key={`${row.hashSeed}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.description}</p>
                        <p className="text-xs text-slate-500">
                          {row.date}
                          {row.installmentCurrent && row.installmentTotal
                            ? ` · ${row.installmentCurrent}/${row.installmentTotal} taksit`
                            : ""}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm font-semibold">{formatCurrency(row.amount)}</p>
                    </div>
                    <select
                      aria-label={row.description + " kategorisi"}
                      className="mt-3 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      value={row.category}
                      onChange={(event) => {
                        const next = [...previewRows];
                        next[index] = { ...row, category: event.target.value };
                        setPreviewRows(next);
                      }}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>{formatCategory(category)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

      </FormDialog>
    </AppShell>
  );
}
