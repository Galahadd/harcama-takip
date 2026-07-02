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
  WalletCards,
} from "lucide-react";
import clsx from "clsx";
import { categories, currentMonthOption, formatCurrency, formatMonth } from "@/lib/format";
import type { CategoryTotal, Expense, MonthOption, ParsedExpense } from "@/lib/types";

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
  months: MonthOption[];
  expenses: Expense[];
  total: number;
  categoryTotals: CategoryTotal[];
};

const emptySummary: Summary = {
  ...currentMonthOption(),
  months: [],
  expenses: [],
  total: 0,
  categoryTotals: [],
};

export default function Home() {
  const current = currentMonthOption();
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);
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
  const [previewRows, setPreviewRows] = useState<ParsedExpense[]>([]);
  const [previewing, setPreviewing] = useState(false);

  async function loadSummary(month = selectedMonth, year = selectedYear) {
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/summary?month=${month}&year=${year}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Veri alinamadi.");
    } else {
      setSummary(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const monthOptions = useMemo(() => {
    const known = summary.months.map((item) => `${item.year}-${item.month}`);
    const selectedKey = `${selectedYear}-${selectedMonth}`;
    const options = known.includes(selectedKey)
      ? summary.months
      : [{ month: selectedMonth, year: selectedYear }, ...summary.months];
    return options;
  }, [summary.months, selectedMonth, selectedYear]);

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

  async function previewPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pdfFile) {
      setMessage("PDF dosyasi secin.");
      return;
    }

    setPreviewing(true);
    setMessage("");
    const formData = new FormData();
    formData.set("file", pdfFile);
    const response = await fetch("/api/statements/preview", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setPreviewing(false);

    if (!response.ok) {
      setMessage(data.error || "PDF okunamadi.");
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
    formData.set("month", String(selectedMonth));
    formData.set("year", String(selectedYear));
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
    setMessage(`${data.inserted} yeni harcama kaydedildi.`);
    await loadSummary();
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
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold">Harcama listesi</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Tarih</th>
                    <th className="px-5 py-3 font-medium">Aciklama</th>
                    <th className="px-5 py-3 font-medium">Sektor</th>
                    <th className="px-5 py-3 text-right font-medium">Tutar</th>
                    <th className="px-5 py-3 font-medium">Kaynak</th>
                    <th className="px-5 py-3 text-right font-medium">Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3">{expense.date}</td>
                      <td className="min-w-64 px-5 py-3">{expense.description}</td>
                      <td className="whitespace-nowrap px-5 py-3">{expense.category}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={clsx(
                            "rounded-md px-2 py-1 text-xs font-medium",
                            expense.source === "pdf"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-teal-50 text-teal-700",
                          )}
                        >
                          {expense.source === "pdf" ? "PDF" : "Manuel"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
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
              <h2 className="text-base font-semibold">PDF ekstre yukle</h2>
            </div>
            <div className="space-y-3">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="file"
                accept="application/pdf"
                onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
              />
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">
                <FileUp size={16} />
                {previewing ? "Okunuyor..." : "Onizleme al"}
              </button>
            </div>
          </form>

          {previewRows.length ? (
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">PDF onizleme</h2>
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
                        <p className="text-xs text-slate-500">{row.date}</p>
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
