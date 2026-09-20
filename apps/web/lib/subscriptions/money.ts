export function kopiykasToHryvnia(amount: number): number {
  return amount / 100;
}

export function formatHryvniaAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function monthlyHryvnia(plan: {
  priceAmount: number;
  intervalMonths: number;
}): number {
  return kopiykasToHryvnia(plan.priceAmount) / plan.intervalMonths;
}

export function savingsHryvnia(
  featured: { priceAmount: number; intervalMonths: number },
  monthly: { priceAmount: number },
): number {
  return kopiykasToHryvnia(
    monthly.priceAmount * featured.intervalMonths - featured.priceAmount,
  );
}
