import postgres from "postgres";
import type {
  ActiveInstallment,
  Bank,
  CategoryRule,
  Expense,
  FutureInstallment,
  GoldEntry,
  InstallmentSummary,
  MonthOption,
  MonthlyInstallmentTotal,
} from "./types";

let client: ReturnType<typeof postgres> | null = null;
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL
  );
}

function sql() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL, POSTGRES_URL, SUPABASE_DATABASE_URL or SUPABASE_DB_URL is required.");
  }

  if (!client) {
    client = postgres(databaseUrl, {
      ssl: databaseUrl.includes("sslmode=disable") ? false : "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 10,
      prepare: false,
    });
  }

  return client;
}

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  if (process.env.SKIP_SCHEMA_SETUP === "1") {
    schemaReady = true;
    return;
  }

  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = prepareSchema().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  await schemaPromise;
}

async function prepareSchema() {
  const db = sql();
  await db`create extension if not exists pgcrypto`;
  await db`
    create table if not exists statements (
      id uuid primary key default gen_random_uuid(),
      month integer not null check (month between 1 and 12),
      year integer not null check (year between 2000 and 2100),
      file_path text not null,
      original_file_name text not null,
      uploaded_at timestamptz not null default now(),
      unique(month, year, original_file_name)
    )
  `;
  await db`
    create table if not exists expenses (
      id uuid primary key default gen_random_uuid(),
      statement_id uuid references statements(id) on delete cascade,
      expense_date date not null,
      description text not null,
      amount numeric(12,2) not null check (amount >= 0),
      category text not null,
      source text not null check (source in ('pdf', 'manual')),
      duplicate_hash text not null unique,
      created_at timestamptz not null default now()
    )
  `;
  await db`
    create table if not exists category_rules (
      id uuid primary key default gen_random_uuid(),
      pattern text not null unique,
      category text not null,
      created_at timestamptz not null default now()
    )
  `;
  await db`
    create table if not exists statement_files (
      statement_id uuid primary key references statements(id) on delete cascade,
      content bytea not null,
      mime_type text not null default 'application/pdf',
      size_bytes integer not null,
      stored_at timestamptz not null default now()
    )
  `;
  await db`alter table statements add column if not exists bank text not null default 'unknown'`;
  await db`alter table expenses add column if not exists bank text not null default 'unknown'`;
  await db`alter table expenses add column if not exists installment_current integer`;
  await db`alter table expenses add column if not exists installment_total integer`;
  await db`alter table expenses add column if not exists installment_original_amount numeric(12,2)`;
  await db`
    create table if not exists gold_entries (
      id uuid primary key default gen_random_uuid(),
      month integer not null check (month between 1 and 12),
      year integer not null check (year between 2000 and 2100),
      grams numeric(10,4) not null check (grams > 0),
      gold_type text not null default 'gram_24',
      quantity numeric(10,4) not null default 1 check (quantity > 0),
      carat integer not null default 24 check (carat in (22, 24)),
      price_per_gram numeric(12,2),
      note text,
      created_at timestamptz not null default now()
    )
  `;
  await db`alter table gold_entries add column if not exists price_per_gram numeric(12,2)`;
  await db`alter table gold_entries add column if not exists gold_type text not null default 'gram_24'`;
  await db`alter table gold_entries add column if not exists quantity numeric(10,4) not null default 1`;
  await db`alter table gold_entries add column if not exists carat integer not null default 24`;
  await db`update gold_entries set quantity = grams where gold_type = 'gram_24' and quantity = 1 and grams <> 1`;
  await db`alter table gold_entries drop constraint if exists gold_entries_month_year_key`;

  schemaReady = true;
  schemaPromise = null;
}

function mapExpense(row: Record<string, unknown>): Expense {
  const projected = Boolean(row.projected);
  return {
    id: String(row.id),
    statementId: row.statement_id ? String(row.statement_id) : null,
    date: new Date(String(row.expense_date)).toISOString().slice(0, 10),
    description: String(row.description),
    amount: Number(row.amount),
    category: String(row.category),
    source: projected ? "projected" : row.source === "manual" ? "manual" : "pdf",
    bank: String(row.bank || "unknown") as Bank,
    installmentCurrent: row.installment_current === null ? null : Number(row.installment_current),
    installmentTotal: row.installment_total === null ? null : Number(row.installment_total),
    installmentOriginalAmount:
      row.installment_original_amount === null ? null : Number(row.installment_original_amount),
    projected,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listRules() {
  await ensureSchema();
  const rows = await sql()<CategoryRule[]>`
    select id, pattern, category, created_at as "createdAt"
    from category_rules
    order by created_at desc
  `;
  return rows;
}

export async function upsertRule(pattern: string, category: string) {
  await ensureSchema();
  await sql()`
    insert into category_rules (pattern, category)
    values (${pattern}, ${category})
    on conflict (pattern) do update set category = excluded.category
  `;
}

export async function listMonthOptions(): Promise<MonthOption[]> {
  await ensureSchema();
  const rows = await sql()<MonthOption[]>`
    select distinct month, year
    from (
      select statements.month, statements.year
      from expenses
      join statements on statements.id = expenses.statement_id
      where expenses.source = 'pdf'

      union

      select extract(month from expense_date)::int as month,
             extract(year from expense_date)::int as year
      from expenses
      where source = 'manual'

      union

      select ((projected_index % 12) + 1)::int as month,
             floor(projected_index / 12)::int as year
      from (
        select (
          statements.year * 12
          + statements.month
          - 1
          + (installment_number - expenses.installment_current)
        )::int as projected_index
        from expenses
        join statements on statements.id = expenses.statement_id
        cross join lateral generate_series(
          expenses.installment_current + 1,
          expenses.installment_total
        ) as series(installment_number)
        where expenses.source = 'pdf'
          and expenses.installment_current is not null
          and expenses.installment_total is not null
          and expenses.installment_total > expenses.installment_current
      ) projected_months
    ) months
    order by year desc, month desc
  `;
  return rows;
}

async function listProjectedInstallmentRowsForMonth(month: number, year: number, bank?: string) {
  const targetIndex = monthIndex(month, year);
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf'
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (${targetIndex} - (statements.year * 12 + statements.month - 1)) between 1 and (expenses.installment_total - expenses.installment_current)
            and expenses.bank = ${bank}
        `
      : await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf'
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (${targetIndex} - (statements.year * 12 + statements.month - 1)) between 1 and (expenses.installment_total - expenses.installment_current)
        `;

  return rows;
}

async function listProjectedInstallmentRowsForRange(startIndex: number, endIndex: number, bank?: string) {
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf'
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (statements.year * 12 + statements.month) <= ${endIndex}
            and ((statements.year * 12 + statements.month - 1) + (expenses.installment_total - expenses.installment_current)) >= ${startIndex}
            and expenses.bank = ${bank}
        `
      : await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf'
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (statements.year * 12 + statements.month) <= ${endIndex}
            and ((statements.year * 12 + statements.month - 1) + (expenses.installment_total - expenses.installment_current)) >= ${startIndex}
        `;

  return rows;
}

async function listProjectedExpensesForMonth(month: number, year: number, bank?: string) {
  const rows = await listProjectedInstallmentRowsForMonth(month, year, bank);
  const projectedRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const current = Number(row.installment_current);
    const total = Number(row.installment_total);
    const statementMonth = Number(row.statement_month);
    const statementYear = Number(row.statement_year);

    const installmentNumber = current + (monthIndex(month, year) - monthIndex(statementMonth, statementYear));

    if (installmentNumber <= current || installmentNumber > total) {
      continue;
    }

    projectedRows.push({
      ...row,
      id: `${row.id}-projected-${installmentNumber}`,
      expense_date: `${year}-${String(month).padStart(2, "0")}-01`,
      source: "projected",
      installment_current: installmentNumber,
      projected: true,
    });
  }

  return projectedRows.map(mapExpense);
}

export async function listExpenses(month: number, year: number, bank?: string) {
  await ensureSchema();
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*
          from expenses
          left join statements on statements.id = expenses.statement_id
          where (
              (expenses.source = 'manual'
                and extract(month from expenses.expense_date)::int = ${month}
                and extract(year from expenses.expense_date)::int = ${year})
              or
              (expenses.source = 'pdf'
                and statements.month = ${month}
                and statements.year = ${year})
            )
            and expenses.bank = ${bank}
          order by expenses.expense_date desc, expenses.created_at desc
        `
      : await sql()`
          select expenses.*
          from expenses
          left join statements on statements.id = expenses.statement_id
          where (
              (expenses.source = 'manual'
                and extract(month from expenses.expense_date)::int = ${month}
                and extract(year from expenses.expense_date)::int = ${year})
              or
              (expenses.source = 'pdf'
                and statements.month = ${month}
                and statements.year = ${year})
            )
          order by expenses.expense_date desc, expenses.created_at desc
        `;
  const expenses = rows.map(mapExpense);
  const projectedExpenses = await listProjectedExpensesForMonth(month, year, bank);
  return [...expenses, ...projectedExpenses].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    return dateDiff || b.createdAt.localeCompare(a.createdAt);
  });
}

function addMonths(month: number, year: number, offset: number) {
  const zeroBased = month - 1 + offset;
  return {
    month: (zeroBased % 12) + 1,
    year: year + Math.floor(zeroBased / 12),
  };
}

function monthIndex(month: number, year: number) {
  return year * 12 + month - 1;
}

export async function listFutureInstallments(
  month: number,
  year: number,
  bank?: string,
): Promise<FutureInstallment[]> {
  await ensureSchema();
  const startIndex = monthIndex(month, year);
  const endIndex = startIndex + 12;
  const rows = await listProjectedInstallmentRowsForRange(startIndex, endIndex, bank);
  const future: FutureInstallment[] = [];

  for (const row of rows) {
    const current = Number(row.installment_current);
    const total = Number(row.installment_total);
    const statementMonth = Number(row.statement_month);
    const statementYear = Number(row.statement_year);

    for (let installmentNumber = current + 1; installmentNumber <= total; installmentNumber += 1) {
      const projected = addMonths(statementMonth, statementYear, installmentNumber - current);
      const projectedIndex = monthIndex(projected.month, projected.year);
      if (projectedIndex < startIndex || projectedIndex > endIndex) {
        continue;
      }

      future.push({
        id: `${row.id}-${installmentNumber}`,
        description: String(row.description),
        amount: Number(row.amount),
        category: String(row.category),
        bank: String(row.bank || "unknown") as Bank,
        month: projected.month,
        year: projected.year,
        installmentNumber,
        installmentTotal: total,
      });
    }
  }

  return future.sort((a, b) => {
    const dateDiff = monthIndex(a.month, a.year) - monthIndex(b.month, b.year);
    return dateDiff || a.description.localeCompare(b.description, "tr");
  });
}

export async function listInstallmentSummary(
  month: number,
  year: number,
  bank?: string,
): Promise<InstallmentSummary> {
  await ensureSchema();
  const startIndex = monthIndex(month, year);
  const endIndex = startIndex + 11;
  const rows = await listProjectedInstallmentRowsForRange(startIndex, endIndex, bank);

  const activeById = new Map<string, ActiveInstallment>();
  const monthlyByKey = new Map<string, MonthlyInstallmentTotal>();
  const bankTotals = new Map<Bank, number>();

  for (const row of rows) {
    const id = String(row.id);
    const current = Number(row.installment_current);
    const total = Number(row.installment_total);
    const amount = Number(row.amount);
    const statementMonth = Number(row.statement_month);
    const statementYear = Number(row.statement_year);
    const rowBank = String(row.bank || "unknown") as Bank;
    const remainingInstallments = total - current;
    const last = addMonths(statementMonth, statementYear, remainingInstallments);

    if (!activeById.has(id)) {
      activeById.set(id, {
        id,
        description: String(row.description),
        amount,
        category: String(row.category),
        bank: rowBank,
        currentInstallment: current,
        totalInstallments: total,
        remainingInstallments,
        remainingTotal: amount * remainingInstallments,
        lastMonth: last.month,
        lastYear: last.year,
      });
      bankTotals.set(rowBank, (bankTotals.get(rowBank) || 0) + amount * remainingInstallments);
    }

    for (let installmentNumber = current + 1; installmentNumber <= total; installmentNumber += 1) {
      const projected = addMonths(statementMonth, statementYear, installmentNumber - current);
      const projectedIndex = monthIndex(projected.month, projected.year);
      if (projectedIndex < startIndex || projectedIndex > endIndex) {
        continue;
      }

      const key = `${projected.year}-${projected.month}`;
      const monthly = monthlyByKey.get(key) ?? {
        month: projected.month,
        year: projected.year,
        total: 0,
        count: 0,
        bankTotals: [],
      };
      monthly.total += amount;
      monthly.count += 1;

      const bankTotal = monthly.bankTotals.find((item) => item.bank === rowBank);
      if (bankTotal) {
        bankTotal.total += amount;
      } else {
        monthly.bankTotals.push({ bank: rowBank, total: amount });
      }

      monthlyByKey.set(key, monthly);
    }
  }

  const monthlyInstallmentTotals = [...monthlyByKey.values()]
    .map((item) => ({
      ...item,
      bankTotals: item.bankTotals.sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => monthIndex(a.month, a.year) - monthIndex(b.month, b.year));

  const nextMonth = addMonths(month, year, 1);
  const nextMonthTotal =
    monthlyInstallmentTotals.find((item) => item.month === nextMonth.month && item.year === nextMonth.year)?.total ?? 0;
  const maxMonthlyTotal = monthlyInstallmentTotals.reduce((max, item) => Math.max(max, item.total), 0);

  return {
    activeInstallments: [...activeById.values()].sort((a, b) => b.remainingTotal - a.remainingTotal),
    monthlyInstallmentTotals,
    bankTotals: [...bankTotals.entries()]
      .map(([bankKey, total]) => ({ bank: bankKey, total }))
      .sort((a, b) => b.total - a.total),
    remainingTotal: [...activeById.values()].reduce((sum, item) => sum + item.remainingTotal, 0),
    nextMonthTotal,
    maxMonthlyTotal,
  };
}

export async function createManualExpense(input: {
  date: string;
  description: string;
  amount: number;
  category: string;
  duplicateHash: string;
}) {
  await ensureSchema();
  const rows = await sql()`
    insert into expenses (expense_date, description, amount, category, source, bank, duplicate_hash)
    values (${input.date}, ${input.description}, ${input.amount}, ${input.category}, 'manual', 'manual', ${input.duplicateHash})
    returning *
  `;
  return mapExpense(rows[0]);
}

export async function updateExpense(
  id: string,
  input: { date: string; description: string; amount: number; category: string },
) {
  await ensureSchema();
  const rows = await sql()`
    update expenses
    set expense_date = ${input.date},
        description = ${input.description},
        amount = ${input.amount},
        category = ${input.category}
    where id = ${id}
    returning *
  `;
  return rows[0] ? mapExpense(rows[0]) : null;
}

export async function deleteExpense(id: string) {
  await ensureSchema();
  await sql()`delete from expenses where id = ${id}`;
}

export async function deleteExpensesByIds(ids: string[]) {
  await ensureSchema();
  if (!ids.length) {
    return 0;
  }
  const db = sql();
  const rows = await db`delete from expenses where id in ${db(ids)} returning id`;
  return rows.length;
}

export async function deleteMonthExpenses(input: { month: number; year: number; bank?: string }) {
  await ensureSchema();
  const rows =
    input.bank && input.bank !== "all"
      ? await sql()`
          delete from expenses
          where (
              (expenses.source = 'manual'
                and extract(month from expenses.expense_date)::int = ${input.month}
                and extract(year from expenses.expense_date)::int = ${input.year})
              or
              (expenses.source = 'pdf'
                and exists (
                  select 1
                  from statements
                  where statements.id = expenses.statement_id
                    and statements.month = ${input.month}
                    and statements.year = ${input.year}
                ))
            )
            and expenses.bank = ${input.bank}
          returning id
        `
      : await sql()`
          delete from expenses
          where (
              (expenses.source = 'manual'
                and extract(month from expenses.expense_date)::int = ${input.month}
                and extract(year from expenses.expense_date)::int = ${input.year})
              or
              (expenses.source = 'pdf'
                and exists (
                  select 1
                  from statements
                  where statements.id = expenses.statement_id
                    and statements.month = ${input.month}
                    and statements.year = ${input.year}
                ))
            )
          returning id
        `;
  return rows.length;
}

export async function importStatement(input: {
  month: number;
  year: number;
  bank: Bank;
  originalFileName: string;
  fileBuffer: Buffer;
  fileMimeType: string;
  expenses: Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    duplicateHash: string;
    installmentCurrent?: number | null;
    installmentTotal?: number | null;
    installmentOriginalAmount?: number | null;
  }>;
}) {
  await ensureSchema();
  const db = sql();

  return db.begin(async (tx) => {
    const statementRows = await tx`
      insert into statements (month, year, bank, file_path, original_file_name)
      values (${input.month}, ${input.year}, ${input.bank}, 'postgres://pending', ${input.originalFileName})
      on conflict (month, year, original_file_name)
      do update set uploaded_at = now(), bank = excluded.bank
      returning id
    `;

    const statementId = String(statementRows[0].id);
    const filePath = `postgres://statement-files/${statementId}`;
    await tx`
      update statements
      set file_path = ${filePath}
      where id = ${statementId}
    `;
    await tx`
      insert into statement_files (statement_id, content, mime_type, size_bytes)
      values (${statementId}, ${input.fileBuffer}, ${input.fileMimeType}, ${input.fileBuffer.byteLength})
      on conflict (statement_id)
      do update set
        content = excluded.content,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        stored_at = now()
    `;

    let inserted = 0;

    for (const expense of input.expenses) {
      const rows = await tx`
        insert into expenses (
          statement_id, expense_date, description, amount, category, source, bank,
          installment_current, installment_total, installment_original_amount, duplicate_hash
        )
        values (
          ${statementId},
          ${expense.date},
          ${expense.description},
          ${expense.amount},
          ${expense.category},
          'pdf',
          ${input.bank},
          ${expense.installmentCurrent ?? null},
          ${expense.installmentTotal ?? null},
          ${expense.installmentOriginalAmount ?? null},
          ${expense.duplicateHash}
        )
        on conflict (duplicate_hash) do nothing
        returning id
      `;
      inserted += rows.length;
    }

    return { statementId, inserted };
  });
}

function mapGoldEntry(row: Record<string, unknown>): GoldEntry {
  return {
    id: String(row.id),
    month: Number(row.month),
    year: Number(row.year),
    goldType: String(row.gold_type ?? "gram_24") as GoldEntry["goldType"],
    quantity: Number(row.quantity ?? row.grams),
    carat: Number(row.carat ?? 24) as GoldEntry["carat"],
    grams: Number(row.grams),
    pricePerGram: row.price_per_gram !== null && row.price_per_gram !== undefined ? Number(row.price_per_gram) : null,
    note: row.note ? String(row.note) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listGoldEntries(): Promise<GoldEntry[]> {
  await ensureSchema();
  const rows = await sql()`
    select * from gold_entries order by year desc, month desc
  `;
  return rows.map(mapGoldEntry);
}

export async function upsertGoldEntry(input: {
  month: number;
  year: number;
  goldType: GoldEntry["goldType"];
  quantity: number;
  carat: GoldEntry["carat"];
  grams: number;
  pricePerGram?: number | null;
  note?: string | null;
}): Promise<GoldEntry> {
  await ensureSchema();
  const rows = await sql()`
    insert into gold_entries (month, year, gold_type, quantity, carat, grams, price_per_gram, note)
    values (
      ${input.month},
      ${input.year},
      ${input.goldType},
      ${input.quantity},
      ${input.carat},
      ${input.grams},
      ${input.pricePerGram ?? null},
      ${input.note ?? null}
    )
    returning *
  `;
  return mapGoldEntry(rows[0]);
}

export async function deleteGoldEntry(id: string): Promise<void> {
  await ensureSchema();
  await sql()`delete from gold_entries where id = ${id}`;
}
