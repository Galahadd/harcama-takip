export type ExpenseSource = "pdf" | "manual" | "projected";
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
  installmentCurrent: number | null;
  installmentTotal: number | null;
  installmentOriginalAmount: number | null;
  projected: boolean;
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
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  installmentOriginalAmount?: number | null;
};

export type MonthOption = {
  month: number;
  year: number;
};

export type CategoryTotal = {
  category: string;
  total: number;
};

export type FutureInstallment = {
  id: string;
  description: string;
  amount: number;
  category: string;
  bank: Bank;
  month: number;
  year: number;
  installmentNumber: number;
  installmentTotal: number;
};

export type ActiveInstallment = {
  id: string;
  description: string;
  amount: number;
  category: string;
  bank: Bank;
  currentInstallment: number;
  totalInstallments: number;
  remainingInstallments: number;
  remainingTotal: number;
  lastMonth: number;
  lastYear: number;
};

export type MonthlyInstallmentTotal = {
  month: number;
  year: number;
  total: number;
  count: number;
  bankTotals: Array<{
    bank: Bank;
    total: number;
  }>;
};

export type InstallmentBankTotal = {
  bank: Bank;
  total: number;
};

export type InstallmentSummary = {
  activeInstallments: ActiveInstallment[];
  monthlyInstallmentTotals: MonthlyInstallmentTotal[];
  bankTotals: InstallmentBankTotal[];
  remainingTotal: number;
  nextMonthTotal: number;
  maxMonthlyTotal: number;
};

export type GoldType =
  | "gram_24"
  | "gram_22"
  | "bracelet_22"
  | "quarter"
  | "half"
  | "full"
  | "republic";

export type GoldEntry = {
  id: string;
  month: number;
  year: number;
  goldType: GoldType;
  quantity: number;
  carat: 22 | 24;
  grams: number;
  pricePerGram: number | null;
  note: string | null;
  createdAt: string;
};
