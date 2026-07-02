import postgres from "postgres";
import type { CategoryRule, Expense, MonthOption } from "./types";

let client: ReturnType<typeof postgres> | null = null;
let schemaReady = false;

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : "require",
      max: 3,
    });
  }

  return client;
}

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }

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

  schemaReady = true;
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    statementId: row.statement_id ? String(row.statement_id) : null,
    date: new Date(String(row.expense_date)).toISOString().slice(0, 10),
    description: String(row.description),
    amount: Number(row.amount),
    category: String(row.category),
    source: row.source === "manual" ? "manual" : "pdf",
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
    select distinct extract(month from expense_date)::int as month,
           extract(year from expense_date)::int as year
    from expenses
    order by year desc, month desc
  `;
  return rows;
}

export async function listExpenses(month: number, year: number) {
  await ensureSchema();
  const rows = await sql()`
    select *
    from expenses
    where extract(month from expense_date)::int = ${month}
      and extract(year from expense_date)::int = ${year}
    order by expense_date desc, created_at desc
  `;
  return rows.map(mapExpense);
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
    insert into expenses (expense_date, description, amount, category, source, duplicate_hash)
    values (${input.date}, ${input.description}, ${input.amount}, ${input.category}, 'manual', ${input.duplicateHash})
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

export async function importStatement(input: {
  month: number;
  year: number;
  originalFileName: string;
  fileBuffer: Buffer;
  fileMimeType: string;
  expenses: Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    duplicateHash: string;
  }>;
}) {
  await ensureSchema();
  const db = sql();

  return db.begin(async (tx) => {
    const statementRows = await tx`
      insert into statements (month, year, file_path, original_file_name)
      values (${input.month}, ${input.year}, 'postgres://pending', ${input.originalFileName})
      on conflict (month, year, original_file_name)
      do update set uploaded_at = now()
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
          statement_id, expense_date, description, amount, category, source, duplicate_hash
        )
        values (
          ${statementId},
          ${expense.date},
          ${expense.description},
          ${expense.amount},
          ${expense.category},
          'pdf',
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
