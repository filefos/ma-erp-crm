const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function intToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + intToWords(n % 100) : "");
  if (n < 1000000) return intToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + intToWords(n % 1000) : "");
  if (n < 1000000000) return intToWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + intToWords(n % 1000000) : "");
  return intToWords(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 ? " " + intToWords(n % 1000000000) : "");
}

export function numberToWords(amount: number): string {
  if (!amount || amount === 0) return "AED Zero Dirhams Only";
  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded);
  const decPart = Math.round((rounded - intPart) * 100);
  let words = "AED " + intToWords(intPart) + " Dirhams";
  if (decPart > 0) words += " and " + intToWords(decPart) + " Fils";
  return words + " Only";
}

export function formatAED(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "0.00";
  return amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
