export interface Installment {
  label: string;
  percent: number;
  dueDate?: string; // ISO date or DD/MM/YYYY — used by PDC cheques
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
  isPDC?: boolean;
}

/** Keys used to identify payment modes in the UI */
export const PDC_PRESET_KEY = "pdc";
export const CDC_PDC_PRESET_KEY = "cdc_pdc";

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
  {
    key: PDC_PRESET_KEY,
    label: "PDC — Post-Dated Cheques",
    text: "",
    installments: [],
    isPDC: true,
  },
];

const PRESET_BY_KEY = new Map(PAYMENT_TERMS_PRESETS.map((p) => [p.key, p]));

export const getPresetByKey = (key: string): PaymentTermsPreset | undefined =>
  PRESET_BY_KEY.get(key);

/** Returns true if the raw payment-terms string is a PDC schedule */
export function isPDCPaymentTerms(raw: string | null | undefined): boolean {
  return !!raw && raw.trimStart().toUpperCase().startsWith("PDC:");
}

/** Returns true if the raw payment-terms string is a CDC+PDC mixed schedule */
export function isCDCPDCPaymentTerms(raw: string | null | undefined): boolean {
  return !!raw && raw.trimStart().toUpperCase().startsWith("CDC+PDC:");
}

export interface CDCInstallment {
  label: string;
  percent: number;
}

export interface CDCPDCData {
  cdcInstallments: CDCInstallment[];
  pdcCheques: Array<{ percent: number; date: string }>;
}

/**
 * Build a canonical CDC+PDC payment-terms string.
 * Format: CDC+PDC: 30% Advance (CDC), PDC: Cheque 1: 40% due 15/06/2026, Cheque 2: 30% due 15/09/2026
 */
export function buildCDCPDCTermsText(data: CDCPDCData): string {
  const cdcParts = data.cdcInstallments.map(
    (inst) => `${inst.percent}% ${inst.label} (CDC)`
  );
  const pdcParts = data.pdcCheques.map(
    (c, i) => `PDC Cheque ${i + 1}: ${c.percent}% due ${c.date || "TBD"}`
  );
  return `CDC+PDC: ${[...cdcParts, ...pdcParts].join(", ")}`;
}

/**
 * Parse a CDC+PDC payment-terms string into structured data.
 */
export function parseCDCPDCTerms(raw: string): CDCPDCData {
  const body = raw.replace(/^CDC\+PDC:\s*/i, "");
  const cdcInstallments: CDCInstallment[] = [];
  const pdcCheques: Array<{ percent: number; date: string }> = [];

  const cdcRegex = /(\d+(?:\.\d+)?)\s*%\s+([\w\s]+?)\s*\(CDC\)/gi;
  let m: RegExpExecArray | null;
  while ((m = cdcRegex.exec(body)) !== null) {
    const pct = parseFloat(m[1]);
    if (isFinite(pct) && pct > 0)
      cdcInstallments.push({ percent: pct, label: m[2].trim() });
  }

  const pdcRegex = /PDC Cheque\s+\d+:\s*(\d+(?:\.\d+)?)\s*%\s+due\s+([\w/\-]+)/gi;
  while ((m = pdcRegex.exec(body)) !== null) {
    const pct = parseFloat(m[1]);
    if (isFinite(pct) && pct > 0)
      pdcCheques.push({ percent: pct, date: m[2].trim() });
  }

  return { cdcInstallments, pdcCheques };
}

/**
 * Build a canonical CDC payment-terms string from an array of installments.
 * e.g. "30% Advance, 40% Progress Payment, 30% Final Payment"
 */
export function buildCDCTermsText(installments: CDCInstallment[]): string {
  return installments.map((i) => `${i.percent}% ${i.label}`).join(", ");
}

/**
 * Build a canonical PDC payment-terms string from an array of cheques.
 * Stored format (plain-text, parseable):
 *   PDC: Cheque 1: 33% due 15/03/2026, Cheque 2: 33% due 15/06/2026, Cheque 3: 34% due 15/09/2026
 */
export function buildPDCTermsText(
  cheques: Array<{ percent: number; date: string }>
): string {
  const parts = cheques.map(
    (c, i) => `Cheque ${i + 1}: ${c.percent}% due ${c.date}`
  );
  return `PDC: ${parts.join(", ")}`;
}

/**
 * Parse a PDC payment-terms string into structured Installment objects.
 * Each installment label is "PDC Cheque N – DD/MM/YYYY".
 */
export function parsePDCPaymentTerms(raw: string): Installment[] {
  const body = raw.replace(/^PDC:\s*/i, "");
  const results: Installment[] = [];
  const chequeRegex =
    /Cheque\s+(\d+)\s*:\s*(\d+(?:\.\d+)?)\s*%\s+due\s+([\d/\-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = chequeRegex.exec(body)) !== null) {
    const num = m[1];
    const percent = parseFloat(m[2]);
    const date = m[3];
    if (isFinite(percent) && percent > 0) {
      results.push({
        label: `PDC Cheque ${num} – ${date}`,
        percent,
        dueDate: date,
      });
    }
  }
  return results;
}

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

  // PDC fast-path
  if (isPDCPaymentTerms(raw)) return parsePDCPaymentTerms(raw);

  const text = raw.replace(/\s+/g, " ").trim();

  // Coarse split on commas, semicolons, newlines, or " and "
  const coarseFragments = text
    .split(/[,;\n]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);

  // Sub-split any fragment that contains more than one percentage value
  const fragments: string[] = [];
  for (const frag of coarseFragments) {
    const pctRegex = /\d+(?:\.\d+)?\s*%/g;
    const positions: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = pctRegex.exec(frag)) !== null) {
      positions.push(m.index);
    }
    if (positions.length <= 1) {
      fragments.push(frag);
    } else {
      let prev = 0;
      for (let i = 1; i < positions.length; i++) {
        fragments.push(frag.slice(prev, positions[i]).trim());
        prev = positions[i];
      }
      fragments.push(frag.slice(prev).trim());
    }
  }

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

  // Absorb rounding drift into the final installment so installments sum exactly to source totals.
  // Threshold is 1% — handles both floating-point drift (< 0.001%) and user-entered rounded
  // percentages that are slightly off (e.g. 11.90476 + 2.38095 + 50 + 35.8 = 100.08571%).
  const sumPct = totalPercent(installments);
  if (Math.abs(sumPct - 100) < 1) {
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

/**
 * Distribute N cheques equally (last cheque absorbs rounding).
 * Returns array of {percent, date} with date as empty string.
 */
export function distributePDCCheques(
  n: number
): Array<{ percent: number; date: string }> {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return Array.from({ length: n }, (_, i) => ({
    percent: i === n - 1 ? base + remainder : base,
    date: "",
  }));
}
