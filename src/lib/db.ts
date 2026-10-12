import postgres from "postgres";
import type {
  ActiveInstallment,
  Bank,
  CategoryRule,
  Expense,
  FutureInstallment,
  GoldEntry,
  AppUser,
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
    create table if not exists users (
      username text primary key,
      created_at timestamptz not null default now(),
      check (username ~ '^[a-z0-9._-]{3,40}$')
    )
  `;
  await db`create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const seedUsers = await db`
    insert into app_migrations (name) values ('seed-default-users-v1')
    on conflict do nothing returning name
  `;
  if (seedUsers.length) {
    await db`insert into users (username) values ('recep.kaya11'), ('emre.aydin') on conflict do nothing`;
  }
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
  await db`alter table statements add column if not exists user_id text`;
  await db`update statements set user_id = 'recep.kaya11' where user_id is null`;
  await db`alter table statements alter column user_id set not null`;
  await db`alter table statements drop constraint if exists statements_month_year_original_file_name_key`;
  await db`create unique index if not exists statements_user_month_file_key on statements(user_id, month, year, original_file_name)`;
  await db`alter table expenses add column if not exists bank text not null default 'unknown'`;
  await db`alter table expenses add column if not exists user_id text`;
  await db`update expenses set user_id = 'recep.kaya11' where user_id is null`;
  await db`alter table expenses alter column user_id set not null`;
  await db`alter table expenses drop constraint if exists expenses_duplicate_hash_key`;
  await db`create unique index if not exists expenses_user_duplicate_key on expenses(user_id, duplicate_hash)`;
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
  await db`alter table gold_entries add column if not exists user_id text`;
  await db`update gold_entries set user_id = 'recep.kaya11' where user_id is null`;
  await db`alter table gold_entries alter column user_id set not null`;
  await db`update gold_entries set quantity = grams where gold_type = 'gram_24' and quantity = 1 and grams <> 1`;
  await db`alter table gold_entries drop constraint if exists gold_entries_month_year_key`;

  await db`alter table category_rules add column if not exists user_id text`;
  await db`update category_rules set user_id = 'recep.kaya11' where user_id is null`;
  await db`alter table category_rules alter column user_id set not null`;
  await db`alter table category_rules drop constraint if exists category_rules_pattern_key`;
  await db`create unique index if not exists category_rules_user_pattern_key on category_rules(user_id, pattern)`;

  const transfer = await db`
    insert into app_migrations (name) values ('transfer-emre-gold-v1')
    on conflict do nothing returning name
  `;
  if (transfer.length) {
    await db`
      update gold_entries
      set user_id = 'emre.aydin'
      where user_id = 'recep.kaya11'
        and lower(trim(note)) in (
          'yaren emır bilezik', 'yaren emır yarımlar', 'yaren emır iontegra', 'yaren emır',
          'yaren emir bilezik', 'yaren emir yarımlar', 'yaren emir iontegra', 'yaren emir'
        )
    `;
  }

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

export async function listUsers(): Promise<AppUser[]> {
  await ensureSchema();
  const rows = await sql()<AppUser[]>`select username, created_at as "createdAt" from users order by created_at`;
  return rows;
}

export async function userExists(username: string) {
  await ensureSchema();
  const rows = await sql()`select 1 from users where username = ${username} limit 1`;
  return rows.length > 0;
}

export async function createUser(username: string): Promise<AppUser | null> {
  await ensureSchema();
  const rows = await sql()<AppUser[]>`
    insert into users (username) values (${username})
    on conflict (username) do nothing
    returning username, created_at as "createdAt"
  `;
  return rows[0] ?? null;
}

export async function renameUser(currentUsername: string, newUsername: string): Promise<boolean> {
  await ensureSchema();
  const db = sql();

  return db.begin(async (tx) => {
    const updated = await tx`
      update users
      set username = ${newUsername}
      where username = ${currentUsername}
        and not exists (select 1 from users where username = ${newUsername})
      returning username
    `;

    if (!updated.length) return false;

    await tx`update statements set user_id = ${newUsername} where user_id = ${currentUsername}`;
    await tx`update expenses set user_id = ${newUsername} where user_id = ${currentUsername}`;
    await tx`update gold_entries set user_id = ${newUsername} where user_id = ${currentUsername}`;
    await tx`update category_rules set user_id = ${newUsername} where user_id = ${currentUsername}`;
    return true;
  });
}

export async function listRules(username: string) {
  await ensureSchema();
  const rows = await sql()<CategoryRule[]>`
    select id, pattern, category, created_at as "createdAt"
    from category_rules where user_id = ${username}
    order by created_at desc
  `;
  return rows;
}

export async function upsertRule(username: string, pattern: string, category: string) {
  await ensureSchema();
  await sql()`
    insert into category_rules (user_id, pattern, category)
    values (${username}, ${pattern}, ${category})
    on conflict (user_id, pattern) do update set category = excluded.category
  `;
}

export async function listMonthOptions(username: string): Promise<MonthOption[]> {
  await ensureSchema();
  const rows = await sql()<MonthOption[]>`
    select distinct month, year
    from (
      select statements.month, statements.year
      from expenses
      join statements on statements.id = expenses.statement_id
      where expenses.source = 'pdf' and expenses.user_id = ${username}

      union

      select extract(month from expense_date)::int as month,
             extract(year from expense_date)::int as year
      from expenses
      where source = 'manual' and user_id = ${username}

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
          and expenses.user_id = ${username}
          and expenses.installment_current is not null
          and expenses.installment_total is not null
          and expenses.installment_total > expenses.installment_current
      ) projected_months
    ) months
    order by year desc, month desc
  `;
  return rows;
}

async function listProjectedInstallmentRowsForMonth(username: string, month: number, year: number, bank?: string) {
  const targetIndex = monthIndex(month, year);
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf' and expenses.user_id = ${username}
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
          where expenses.source = 'pdf' and expenses.user_id = ${username}
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (${targetIndex} - (statements.year * 12 + statements.month - 1)) between 1 and (expenses.installment_total - expenses.installment_current)
        `;

  return dedupeInstallmentSnapshots(rows);
}

async function listProjectedInstallmentRowsForRange(username: string, startIndex: number, endIndex: number, bank?: string) {
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*, statements.month as statement_month, statements.year as statement_year
          from expenses
          join statements on statements.id = expenses.statement_id
          where expenses.source = 'pdf' and expenses.user_id = ${username}
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
          where expenses.source = 'pdf' and expenses.user_id = ${username}
            and expenses.installment_current is not null
            and expenses.installment_total is not null
            and expenses.installment_total > expenses.installment_current
            and (statements.year * 12 + statements.month) <= ${endIndex}
            and ((statements.year * 12 + statements.month - 1) + (expenses.installment_total - expenses.installment_current)) >= ${startIndex}
        `;

  return dedupeInstallmentSnapshots(rows);
}

async function listProjectedExpensesForMonth(username: string, month: number, year: number, bank?: string) {
  const rows = await listProjectedInstallmentRowsForMonth(username, month, year, bank);
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

export async function listExpenses(username: string, month: number, year: number, bank?: string) {
  await ensureSchema();
  const rows =
    bank && bank !== "all"
      ? await sql()`
          select expenses.*
          from expenses
          left join statements on statements.id = expenses.statement_id
          where expenses.user_id = ${username} and (
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
          where expenses.user_id = ${username} and (
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
  const projectedExpenses = await listProjectedExpensesForMonth(username, month, year, bank);
  const uniqueProjectedExpenses = projectedExpenses.filter(
    (projected, index, allProjected) =>
      !expenses.some((expense) => sameInstallmentOccurrence(projected, expense)) &&
      allProjected.findIndex((candidate) => sameInstallmentOccurrence(projected, candidate)) === index,
  );
  return [...expenses, ...uniqueProjectedExpenses].sort((a, b) => {
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

function normalizeInstallmentDescription(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function amountsMatch(left: unknown, right: unknown) {
  return Math.abs(Number(left) - Number(right)) <= 0.05;
}

function sameInstallmentChain(left: Record<string, unknown>, right: Record<string, unknown>) {
  if (
    String(left.bank) !== String(right.bank) ||
    normalizeInstallmentDescription(left.description) !== normalizeInstallmentDescription(right.description) ||
    Number(left.installment_total) !== Number(right.installment_total) ||
    !amountsMatch(left.amount, right.amount)
  ) {
    return false;
  }

  const leftOriginalAmount = left.installment_original_amount;
  const rightOriginalAmount = right.installment_original_amount;
  return (
    leftOriginalAmount === null ||
    leftOriginalAmount === undefined ||
    rightOriginalAmount === null ||
    rightOriginalAmount === undefined ||
    amountsMatch(leftOriginalAmount, rightOriginalAmount)
  );
}

function dedupeInstallmentSnapshots(rows: Record<string, unknown>[]) {
  const latestFirst = [...rows].sort((left, right) => {
    const statementDiff =
      monthIndex(Number(right.statement_month), Number(right.statement_year)) -
      monthIndex(Number(left.statement_month), Number(left.statement_year));
    if (statementDiff !== 0) return statementDiff;

    const installmentDiff = Number(right.installment_current) - Number(left.installment_current);
    if (installmentDiff !== 0) return installmentDiff;

    return String(right.created_at).localeCompare(String(left.created_at));
  });

  return latestFirst.filter(
    (row, index, allRows) => allRows.findIndex((candidate) => sameInstallmentChain(row, candidate)) === index,
  );
}

function sameInstallmentOccurrence(left: Expense, right: Expense) {
  if (
    left.installmentCurrent === null ||
    right.installmentCurrent === null ||
    left.installmentTotal === null ||
    right.installmentTotal === null
  ) {
    return false;
  }

  return (
    left.bank === right.bank &&
    normalizeInstallmentDescription(left.description) === normalizeInstallmentDescription(right.description) &&
    left.installmentCurrent === right.installmentCurrent &&
    left.installmentTotal === right.installmentTotal &&
    amountsMatch(left.amount, right.amount) &&
    (left.installmentOriginalAmount === null ||
      right.installmentOriginalAmount === null ||
      amountsMatch(left.installmentOriginalAmount, right.installmentOriginalAmount))
  );
}

export async function listFutureInstallments(
  username: string,
  month: number,
  year: number,
  bank?: string,
): Promise<FutureInstallment[]> {
  await ensureSchema();
  const startIndex = monthIndex(month, year);
  const endIndex = startIndex + 12;
  const rows = await listProjectedInstallmentRowsForRange(username, startIndex, endIndex, bank);
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
  username: string,
  month: number,
  year: number,
  bank?: string,
): Promise<InstallmentSummary> {
  await ensureSchema();
  const startIndex = monthIndex(month, year);
  const endIndex = startIndex + 11;
  const rows = await listProjectedInstallmentRowsForRange(username, startIndex, endIndex, bank);

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
  username: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  duplicateHash: string;
}) {
  await ensureSchema();
  const rows = await sql()`
    insert into expenses (user_id, expense_date, description, amount, category, source, bank, duplicate_hash)
    values (${input.username}, ${input.date}, ${input.description}, ${input.amount}, ${input.category}, 'manual', 'manual', ${input.duplicateHash})
    returning *
  `;
  return mapExpense(rows[0]);
}

export async function updateExpense(
  username: string,
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
    where id = ${id} and user_id = ${username}
    returning *
  `;
  return rows[0] ? mapExpense(rows[0]) : null;
}

export async function deleteExpense(username: string, id: string) {
  await ensureSchema();
  await sql()`delete from expenses where id = ${id} and user_id = ${username}`;
}

export async function deleteExpensesByIds(username: string, ids: string[]) {
  await ensureSchema();
  if (!ids.length) {
    return 0;
  }
  const db = sql();
  const rows = await db`delete from expenses where user_id = ${username} and id in ${db(ids)} returning id`;
  return rows.length;
}

export async function deleteMonthExpenses(input: { username: string; month: number; year: number; bank?: string }) {
  await ensureSchema();
  const rows =
    input.bank && input.bank !== "all"
      ? await sql()`
          delete from expenses
          where expenses.user_id = ${input.username} and (
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
          where expenses.user_id = ${input.username} and (
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
  username: string;
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
      insert into statements (user_id, month, year, bank, file_path, original_file_name)
      values (${input.username}, ${input.month}, ${input.year}, ${input.bank}, 'postgres://pending', ${input.originalFileName})
      on conflict (user_id, month, year, original_file_name)
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
          user_id, statement_id, expense_date, description, amount, category, source, bank,
          installment_current, installment_total, installment_original_amount, duplicate_hash
        )
        values (
          ${input.username},
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
        on conflict (user_id, duplicate_hash) do nothing
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

export async function listGoldEntries(username: string): Promise<GoldEntry[]> {
  await ensureSchema();
  const rows = await sql()`
    select * from gold_entries where user_id = ${username} order by year desc, month desc
  `;
  return rows.map(mapGoldEntry);
}

export async function upsertGoldEntry(input: {
  username: string;
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
    insert into gold_entries (user_id, month, year, gold_type, quantity, carat, grams, price_per_gram, note)
    values (
      ${input.username},
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

export async function deleteGoldEntry(username: string, id: string): Promise<void> {
  await ensureSchema();
  await sql()`delete from gold_entries where id = ${id} and user_id = ${username}`;
}
