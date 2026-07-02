import { parseTurkishAmount } from "./format";

export type ParsedInstallment = {
  installmentCurrent: number;
  installmentTotal: number;
  installmentOriginalAmount: number | null;
};

export function parseInstallmentInfo(value: string): ParsedInstallment | null {
  const yapiMatch = value.match(
    /(\d+(?:[.,]\d{2})?)\s*TL'?lik işlemin\s*(\d+)\s*\/\s*(\d+)\s*taksidi/i,
  );
  if (yapiMatch) {
    const current = Number(yapiMatch[2]);
    const total = Number(yapiMatch[3]);
    if (current > 0 && total > 1 && current <= total) {
      return {
        installmentCurrent: current,
        installmentTotal: total,
        installmentOriginalAmount: parseTurkishAmount(yapiMatch[1]),
      };
    }
  }

  const garantiMatch = value.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
  if (garantiMatch) {
    const current = Number(garantiMatch[1]);
    const total = Number(garantiMatch[2]);
    if (current > 0 && total > 1 && current <= total) {
      return {
        installmentCurrent: current,
        installmentTotal: total,
        installmentOriginalAmount: null,
      };
    }
  }

  return null;
}
