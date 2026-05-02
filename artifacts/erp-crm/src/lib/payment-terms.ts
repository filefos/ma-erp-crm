export interface Installment {
  label: string;
  percent: number;
}

export interface InstallmentWithAmount extends Installment {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export interface PaymentTermsPreset {
  key: string;
  label: string;
  text: string;
  installments: Installment[];
}

export const PAYMENT_TERMS_PRESETS: PaymentTermsPreset[] = [
  {
    key: "100_advance",
    label: "100% Advance",
    text: "100% Advance upon LPO",
    installments: [{ label: "Advance", percent: 100 }],
  },
  {
    key: "75_25",
    label: "75% Advance + 25% Before Delivery",
    text: "75% Advance upon LPO, 25% Before Delivery",
    installments: [
      { label: "Advance", percent: 75 },
      { label: "Before Delivery", percent: 25 },
    ],
  },
  {
    key: "50_50",
    label: "50% Advance + 50% Before Delivery",
    text: "50% Advance upon LPO, 50% Before Delivery",
    installments: [
      { label: "Advance", percent: 50 },
      { label: "Before Delivery", percent: 50 },
    ],
  },
  {
    key: "25_75",
    label: "25% Advance + 75% Before Delivery",
    text: "25% Advance upon LPO, 75% Before Delivery",
    installments: [
      { label: "Advance", percent: 25 },
      { label: "Before Delivery", percent: 75 },
    ],
  },
  {
    key: "25_50_25",
    label: "25% Advance + 50% Progress + 25% Final",
    text: "25% Advance upon LPO, 50% Progress Payment, 25% Final Payment",
    installments: [
      { label: "Advance", percent: 25 },
      { label: "Progress Payment", percent: 50 },
      { label: "Final Payment", percent: 25 },
    ],
  },
  {
    key: "25_25_25_25",
    label: "25% Advance + 25% + 25% Progress + 25% Final",
    text: "25% Advance upon LPO, 25% Progress Payment, 25% Progress Payment, 25% Final Payment",
    installments: [
      { label: "Advance", percent: 25 },
      { label: "Progress Payment 1", percent: 25 },
      { label: "Progress Payment 2", percent: 25 },
      { label: "Final Payment", percent: 25 },
    ],
  },
];

const PRESET_BY_KEY = new Map(PAYMENT_TERMS_PRESETS.map((p) => [p.key, p]));

export const getPresetByKey = (key: string): PaymentTermsPreset | undefined =>
  PRESET_BY_KEY.get(key);

const STAGE_KEYWORDS: { match: RegExp; label: string }[] = [
  { match: /\bfinal\b/i, label: "Final Payment" },
  { match: /\bprogress\b/i, label: "Progress Payment" },
  { match: /\b(before|prior to|on|upon)\s+delivery\b/i, label: "Before Delivery" },
  { match: /\bdelivery\b/i, label: "Before Delivery" },
  { match: /\b(installation|hand[- ]?over)\b/i, label: "On Installation" },
  { match: /\bretention\b/i, label: "Retention" },
  { match: /\b(advance|down[\s-]?payment|on\s+lpo|upon\s+lpo|on\s+po|upon\s+po)\b/i, label: "Advance" },
];

const labelFromFragment = (fragment: string, isFirst: boolean): string => {
  for (const { match, label } of STAGE_KEYWORDS) {
    if (match.test(fragment)) return label;
  }
  return isFirst ? "Advance" : "Payment";
};

export function parsePaymentTerms(raw: string | null | undefined): Installment[] {
  if (!raw || !raw.trim()) return [];

  const text = raw.replace(/\s+/g, " ").trim();
  const fragments = text
    .split(/[,;\n]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);

  const installments: Installment[] = [];

  fragments.forEach((frag, idx) => {
    const pctMatch = frag.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!pctMatch) return;
    const percent = parseFloat(pctMatch[1]);
    if (!isFinite(percent) || percent <= 0) return;
    const label = labelFromFragment(frag, idx === 0);
    installments.push({ label, percent });
  });

  return installments;
}

export function calculateInstallments(
  installments: Installment[],
  baseSubtotal: number,
  vatPercent: number
): InstallmentWithAmount[] {
  if (installments.length === 0) return [];
  const totalVatAmount = +(baseSubtotal * vatPercent / 100).toFixed(2);
  const totalGrand = +(baseSubtotal + totalVatAmount).toFixed(2);

  const computed = installments.map((inst) => {
    const subtotal = +(baseSubtotal * inst.percent / 100).toFixed(2);
    const vatAmount = +(subtotal * vatPercent / 100).toFixed(2);
    const total = +(subtotal + vatAmount).toFixed(2);
    return { ...inst, subtotal, vatAmount, total };
  });

  // Absorb rounding drift into the final installment so installments sum exactly to source totals
  // (only when the percentages add up to 100%).
  const sumPct = totalPercent(installments);
  if (Math.abs(sumPct - 100) < 0.001) {
    const sumSubtotal = computed.reduce((s, c) => s + c.subtotal, 0);
    const sumVat = computed.reduce((s, c) => s + c.vatAmount, 0);
    const sumTotal = computed.reduce((s, c) => s + c.total, 0);
    const last = computed[computed.length - 1];
    last.subtotal = +(last.subtotal + (baseSubtotal - sumSubtotal)).toFixed(2);
    last.vatAmount = +(last.vatAmount + (totalVatAmount - sumVat)).toFixed(2);
    last.total = +(last.total + (totalGrand - sumTotal)).toFixed(2);
  }

  return computed;
}

export function totalPercent(installments: Installment[]): number {
  return installments.reduce((s, i) => s + (i.percent ?? 0), 0);
}

export function installmentToTermsText(inst: Installment, index: number, total: number): string {
  const stage = total > 1 ? ` (${index + 1} of ${total})` : "";
  return `${inst.percent}% ${inst.label}${stage}`;
}
