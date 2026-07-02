export type ExpenseSource = "pdf" | "manual";
export type Bank = "garanti" | "yapikredi" | "manual" | "unknown";

export type Expense = {
  id: string;
  statementId: string | null;
  date: string;
  description: string;
  amount: number;
  category: string;
  source: ExpenseSource;
  bank: Bank;
  createdAt: string;
};

export type Statement = {
  id: string;
  month: number;
  year: number;
  filePath: string;
  originalFileName: string;
  bank: Bank;
  uploadedAt: string;
};

export type CategoryRule = {
  id: string;
  pattern: string;
  category: string;
  createdAt: string;
};

export type ParsedExpense = {
  date: string;
  description: string;
  amount: number;
  category: string;
  suggestedCategory: string;
  matchedRule: string | null;
  hashSeed: string;
};

export type MonthOption = {
  month: number;
  year: number;
};

export type CategoryTotal = {
  category: string;
  total: number;
};
