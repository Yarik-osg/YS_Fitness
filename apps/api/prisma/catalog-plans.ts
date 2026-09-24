export const CATALOG_PLANS = [
  {
    code: '1_MONTH',
    name: '1 month',
    priceAmount: 99_000,
    intervalMonths: 1,
  },
  {
    code: '3_MONTHS',
    name: '3 months',
    priceAmount: 249_000,
    intervalMonths: 3,
  },
  {
    code: 'FULL_ACCESS',
    name: 'FULL ACCESS',
    priceAmount: 349_000,
    intervalMonths: 3,
  },
] as const;
