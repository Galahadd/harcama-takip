"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  FileUp,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { categories, currentMonthOption, formatCurrency, formatMonth } from "@/lib/format";
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
  "#0f766e",
  "#b45309",
  "#2563eb",
  "#be123c",
  "#4d7c0f",
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
  const [completionMessage, setCompletionMessage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  async function loadSummary(month = selectedMonth, year = selectedYear, bank = selectedBank) {
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/summary?month=${month}&year=${year}&bank=${bank}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Veri alinamadi.");
    } else {
      setSummary(data);
      setSelectedExpenseIds(new Set());
    }
    setLoading(false);
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
    return [...summary.expenses].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "amount") {
        return (a.amount - b.amount) * direction;
      }

      if (sortKey === "category") {
        return a.category.localeCompare(b.category, "tr") * direction;
      }

      return a.date.localeCompare(b.date) * direction;
    });
  }, [summary.expenses, sortDirection, sortKey]);

  const allVisibleSelected =
    sortedExpenses.some((expense) => !expense.projected) &&
    sortedExpenses.filter((expense) => !expense.projected).every((expense) => selectedExpenseIds.has(expense.id));

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
        return new Set();
      }

      const next = new Set(currentIds);
      for (const expense of sortedExpenses) {
        if (!expense.projected) {
          next.add(expense.id);
        }
      }
      return next;
    });
  }

  async function saveManualExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...manualForm,
      amount: Number(manualForm.amount),
    };

    const url = editing ? `/api/expenses/${editing.id}` : "/api/expenses";
    const response = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
    setMessage(editing ? "Harcama guncellendi." : "Harcama eklendi.");
    await loadSummary(date.getMonth() + 1, date.getFullYear());
  }

  async function deleteExpense(id: string) {
    const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
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

    const response = await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
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

    const response = await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: selectedMonth, year: selectedYear, bank: selectedBank }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ay harcamalari silinemedi.");
      return;
    }

    setMessage(`${data.deleted} harcama silindi.`);
    await loadSummary();
  }

  async function previewPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pdfFile) {
      setMessage("Ekstre dosyasi secin.");
      return;
    }

    setPreviewing(true);
    setMessage("");
    const formData = new FormData();
    formData.set("file", pdfFile);
    formData.set("bank", uploadBank);
    const response = await fetch("/api/statements/preview", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setPreviewing(false);

    if (!response.ok) {
      setMessage(data.error || "Ekstre okunamadi.");
      return;
    }

    setPreviewRows(data.rows);
    setMessage(`${data.rows.length} harcama bulundu.`);
  }

  async function importPdf() {
    if (!pdfFile || previewRows.length === 0) {
      setMessage("Ice aktarmak icin once PDF onizlemesi alin.");
      return;
    }

    const formData = new FormData();
    formData.set("file", pdfFile);
    formData.set("month", String(uploadMonth));
    formData.set("year", String(uploadYear));
    formData.set("bank", uploadBank);
    formData.set("rows", JSON.stringify(previewRows));

    const response = await fetch("/api/statements/import", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Ekstre ice aktarilamadi.");
      return;
    }

    setPreviewRows([]);
    setPdfFile(null);
    const doneMessage = `${data.inserted} yeni harcama kaydedildi.`;
    setSelectedMonth(uploadMonth);
    setSelectedYear(uploadYear);
    setMessage(doneMessage);
    setCompletionMessage(doneMessage);
    await loadSummary(uploadMonth, uploadYear);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function startEdit(expense: Expense) {
    setEditing(expense);
    setManualForm({
      date: expense.date,
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
    });
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      {completionMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-sm rounded-md bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Içe aktarma tamamlandi</h2>
            <p className="mt-2 text-sm text-slate-600">{completionMessage}</p>
            <button
              className="mt-5 h-10 w-full rounded-md bg-teal-700 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => setCompletionMessage("")}
            >
              Tamam
            </button>
          </div>
        </div>
      ) : null}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-white">
              <WalletCards size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Aylik Harcama Takibi</h1>
              <p className="text-sm text-slate-500">Garanti BBVA ekstreleri ve manuel harcamalar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-md border border-slate-200 bg-white text-sm">
              <span className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-800 font-medium rounded-l-md border-r border-slate-200">
                <WalletCards size={15} />
                Harcamalar
              </span>
              <Link
                href="/yatirimlar"
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-r-md"
              >
                <TrendingUp size={15} />
                Yatirimlar
              </Link>
            </nav>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={`${selectedYear}-${selectedMonth}`}
              onChange={(event) => {
                const [year, month] = event.target.value.split("-").map(Number);
                setSelectedYear(year);
                setSelectedMonth(month);
              }}
            >
              {monthOptions.map((option) => (
                <option key={`${option.year}-${option.month}`} value={`${option.year}-${option.month}`}>
                  {formatMonth(option.month, option.year)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedBank}
              onChange={(event) => setSelectedBank(event.target.value)}
            >
              {bankOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => loadSummary()}
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <section className="space-y-6">
          {message ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Secili ay</p>
              <p className="mt-2 text-2xl font-semibold">{formatMonth(selectedMonth, selectedYear)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Toplam harcama</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.total)}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Kayit sayisi</p>
              <p className="mt-2 text-2xl font-semibold">{summary.expenses.length}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">Sektor dagilimi</h2>
              <div className="mt-4 h-72">
                {summary.categoryTotals.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.categoryTotals}
                        dataKey="total"
                        nameKey="category"
                        innerRadius={68}
                        outerRadius={104}
                        paddingAngle={2}
                      >
                        {summary.categoryTotals.map((entry, index) => (
                          <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Bu ay icin veri yok.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">Sektor toplamları</h2>
              <div className="mt-4 space-y-3">
                {summary.categoryTotals.map((item, index) => (
                  <div key={item.category} className="grid grid-cols-[1fr_auto] items-center gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span className="truncate text-sm font-medium">{item.category}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${summary.total ? (item.total / summary.total) * 100 : 0}%`,
                            backgroundColor: chartColors[index % chartColors.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                ))}
                {!summary.categoryTotals.length ? (
                  <p className="text-sm text-slate-500">Henuz sektor toplamı yok.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <h2 className="text-base font-semibold">Harcama listesi</h2>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                >
                  <option value="date">Tarihe gore</option>
                  <option value="amount">Tutara gore</option>
                  <option value="category">Sektore gore</option>
                </select>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  value={sortDirection}
                  onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                >
                  <option value="desc">Azalan</option>
                  <option value="asc">Artan</option>
                </select>
                <button
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50"
                  onClick={deleteSelectedExpenses}
                >
                  Secilenleri sil
                </button>
                <button
                  className="h-9 rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50"
                  onClick={deleteCurrentMonthExpenses}
                >
                  Ayi sil
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleExpenses}
                        aria-label="Tum harcamalari sec"
                      />
                    </th>
                    <th className="px-5 py-3 font-medium">Tarih</th>
                    <th className="px-5 py-3 font-medium">Aciklama</th>
                    <th className="px-5 py-3 font-medium">Sektor</th>
                    <th className="px-5 py-3 font-medium">Banka</th>
                    <th className="px-5 py-3 text-right font-medium">Tutar</th>
                    <th className="px-5 py-3 font-medium">Kaynak</th>
                    <th className="px-5 py-3 text-right font-medium">Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3">
                        <input
                          type="checkbox"
                          checked={!expense.projected && selectedExpenseIds.has(expense.id)}
                          onChange={() => toggleExpenseSelection(expense.id)}
                          disabled={expense.projected}
                          aria-label="Harcama sec"
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{expense.date}</td>
                      <td className="min-w-64 px-5 py-3">
                        <div>{expense.description}</div>
                        {expense.installmentCurrent && expense.installmentTotal ? (
                          <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            {expense.installmentCurrent}/{expense.installmentTotal} taksit
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{expense.category}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatBank(expense.bank)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={clsx(
                            "rounded-md px-2 py-1 text-xs font-medium",
                            expense.source === "projected"
                              ? "bg-amber-50 text-amber-700"
                              : expense.source === "pdf"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-teal-50 text-teal-700",
                          )}
                        >
                          {expense.source === "projected"
                            ? "Planlanan"
                            : expense.source === "pdf"
                              ? "PDF"
                              : "Manuel"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {expense.projected ? (
                          <span className="text-xs text-slate-400">Plan</span>
                        ) : (
                          <>
                            <button
                              className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50"
                              onClick={() => startEdit(expense)}
                              title="Duzenle"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-red-700 hover:bg-red-50"
                              onClick={() => deleteExpense(expense.id)}
                              title="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary.expenses.length && !loading ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  Bu ay icin harcama kaydi yok.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <form onSubmit={saveManualExpense} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              {editing ? <Save size={18} /> : <Plus size={18} />}
              <h2 className="text-base font-semibold">{editing ? "Harcamayi duzenle" : "Manuel harcama"}</h2>
            </div>
            <div className="space-y-3">
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="date"
                value={manualForm.date}
                onChange={(event) => setManualForm({ ...manualForm, date: event.target.value })}
                required
              />
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Aciklama"
                value={manualForm.description}
                onChange={(event) => setManualForm({ ...manualForm, description: event.target.value })}
                required
              />
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Tutar"
                value={manualForm.amount}
                onChange={(event) => setManualForm({ ...manualForm, amount: event.target.value })}
                required
              />
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={manualForm.category}
                onChange={(event) => setManualForm({ ...manualForm, category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800">
                  {editing ? <Save size={16} /> : <Plus size={16} />}
                  Kaydet
                </button>
                {editing ? (
                  <button
                    type="button"
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    onClick={() => setEditing(null)}
                  >
                    Iptal
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <form onSubmit={previewPdf} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileUp size={18} />
              <h2 className="text-base font-semibold">Ekstre yukle</h2>
            </div>
            <div className="space-y-3">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="file"
                accept="application/pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
              />
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={uploadMonth}
                  onChange={(event) => setUploadMonth(Number(event.target.value))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month, uploadYear).replace(` ${uploadYear}`, "")}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="number"
                  min="2000"
                  max="2100"
                  value={uploadYear}
                  onChange={(event) => setUploadYear(Number(event.target.value))}
                />
              </div>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={uploadBank}
                onChange={(event) => setUploadBank(event.target.value as Bank)}
              >
                {uploadBankOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">
                <FileUp size={16} />
                {previewing ? "Okunuyor..." : "Onizleme al"}
              </button>
            </div>
          </form>

          {previewRows.length ? (
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Ekstre onizleme</h2>
                <button
                  className="h-9 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
                  onClick={importPdf}
                >
                  Ice aktar
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
                      className="mt-3 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      value={row.category}
                      onChange={(event) => {
                        const next = [...previewRows];
                        next[index] = { ...row, category: event.target.value };
                        setPreviewRows(next);
                      }}
                    >
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
