import { createHash } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function expenseHash(input: {
  month: number;
  year: number;
  date: string;
  description: string;
  amount: number;
}) {
  return sha256(
    [
      input.year,
      input.month,
      input.date,
      input.description.trim().toLocaleUpperCase("tr-TR"),
      input.amount.toFixed(2),
    ].join("|"),
  );
}
