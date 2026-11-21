// Amounts are integers in thousandths of the currency unit.
const SCALE = 1000;

/** Digits after the decimal point for a currency code (TND 3, EUR 2). */
export function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** "45.000 TND" */
export function formatMoney(amount: number, currency: string): string {
  return `${(amount / SCALE).toFixed(currencyDecimals(currency))} ${currency}`;
}

/** "45.5" as 45500; null when it isn't a non-negative amount. */
export function parseMoney(input: string): number | null {
  const text = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  return Math.round(Number(text) * SCALE);
}

/** 45500 as "45.5", for a form field. */
export function moneyInput(amount: number | null | undefined): string {
  if (amount == null) return "";
  return String(amount / SCALE);
}
