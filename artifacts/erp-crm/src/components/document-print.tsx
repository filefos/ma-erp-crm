import React from "react";
import { numberToWords, formatAED } from "@/lib/number-to-words";
import { parseTechSpecs } from "@/lib/tech-spec-templates";
import { STANDARD_TC } from "@/lib/tc-templates";
import eliteLogo from "../assets/elite-prefab-logo.png";
import primeLogo from "../assets/prime-max-logo.png";
import { usePrintSettings, getPageCss } from "@/contexts/print-settings-context";
import { parsePaymentTerms, calculateInstallments, isPDCPaymentTerms } from "@/lib/payment-terms";

export interface DocumentItem {
  description: string;
  sizeStatus?: string;
  unitPrice?: number;
  quantity: number;
  unit?: string;
  discount?: number;
  total?: number;
  vatPercent?: number;
}

export interface AdditionalCommercialItem {
  description: string;
  status: string;
  price?: number;
  quantity?: number;
  amount?: number;
}

export type DocumentType = "quotation" | "proforma" | "tax_invoice" | "delivery_note" | "purchase_order";

export interface DocumentData {
  type: DocumentType;
  docNumber: string;
  companyId: number;
  companyRef?: string;
  companyLogo?: string;
  clientName: string;
  clientContact?: string;
  clientContactPerson?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientTrn?: string;
  companyTrn?: string;
  customerTrn?: string;
  projectRef?: string;
  projectName?: string;
  projectLocation?: string;
  date?: string;
  validity?: string;
  leadTime?: string;
  supplyDate?: string;
  invoiceDate?: string;
  vatPercent?: number;
  subtotal?: number;
  discount?: number;
  vatAmount?: number;
  grandTotal: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  termsConditions?: string;
  techSpecs?: string;
  additionalItems?: AdditionalCommercialItem[];
  customSections?: { title: string; content: string }[];
  items: DocumentItem[];
  preparedByName?: string;
  preparedBySignatureUrl?: string;
  stampUrl?: string;
  approvedByName?: string;
  salesPersonContact?: string;
  salesPersonPhone?: string;
  salesPersonEmail?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContactNumber?: string;
  vehicleMulkiya?: string;
  receiverName?: string;
  receiverDesignation?: string;
  receiverContact?: string;
  deliveryLocation?: string;
  deliveryDate?: string;
  loadingDate?: string;
  offloadingDate?: string;
  noteForClient?: string;
  noteForTransporter?: string;
  deliveryAddress?: string;
  notes?: string;
  installmentNote?: string;
  installmentFraction?: number;
  supplierName?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  printedByUniqueId?: string;
  salesPersonDesignation?: string;
  clientDesignation?: string;
  clientCode?: string;
  clientAddress?: string;
  lpoRef?: string;
}

interface CompanyInfo {
  name: string;
  address: string;
  trn: string;
  phone: string;
  email: string;
  contact: string;
  website?: string;
  bank?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
    swift: string;
    currency: string;
  };
}

const COMPANIES: Record<number, CompanyInfo> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    address: "Office Address: Plot # 2040, Al Sajja Industrial Area, Sharjah, UAE",
    trn: "105383255400003",
    phone: "056 616 3555",
    email: "sales@primemaxprefab.com",
    contact: "ASIF LATIF",
    website: "www.primemaxprefab.com",
    bank: {
      bankName: "Abu Dhabi Commercial Bank (ADCB)",
      accountTitle: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
      accountNumber: "14498851920002",
      iban: "AE300030014498851920002",
      swift: "ADCBAEAA",
      currency: "AED",
    },
  },
  2: {
    name: "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC",
    address: "Office Address: Plot # 2040, Al Sajja Industrial Area, Sharjah, UAE",
    trn: "104200550200003",
    phone: "054 777 7862",
    email: "asif@eliteprefab.com",
    contact: "Asif Latif",
    website: "www.eliteprefab.ae",
    bank: {
      bankName: "Abu Dhabi Commercial Bank (ADCB)",
      accountTitle: "ELITE PRE FABRICATED HOUSES TRADING CO. LLC",
      accountNumber: "13438011920001",
      iban: "AE320030013438011920001",
      swift: "ADCBAEAAXXX",
      currency: "AED",
    },
  },
};

const DEFAULT_ADDITIONAL_ITEMS: AdditionalCommercialItem[] = [
  { description: "Transportation including RTA Permit", status: "Included", price: 0, quantity: 1 },
  { description: "Brand New SUPER GENERAL SPLIT AC UNIT", status: "Excluded", price: 0, quantity: 1 },
  { description: "Foundation Detail", status: "Excluded", price: 0, quantity: 1 },
  { description: "Staircase", status: "Excluded", price: 0, quantity: 1 },
  { description: "Additional Commercial Item", status: "Excluded", price: 0, quantity: 1 },
];

const DOC_TITLES: Record<DocumentType, string> = {
  quotation: "QUOTATION ON PREFABRICATED CABIN",
  proforma: "PROFORMA INVOICE",
  tax_invoice: "TAX INVOICE",
  delivery_note: "DELIVERY NOTE",
  purchase_order: "PURCHASE ORDER",
};

const REF_LABELS: Record<DocumentType, string> = {
  quotation: "Quotation Ref.",
  proforma: "Proforma Invoice No.",
  tax_invoice: "Tax Invoice No.",
  delivery_note: "Delivery Note No.",
  purchase_order: "PO Number",
};

// ── Document brand theme ────────────────────────────────────────────────────
interface DocTheme {
  headerBg: string;
  headerGradient?: string;
  accentStripe?: string;
  titleBg: string;
  titleGradient?: string;
  sectionHeaderBg: string;
  sectionHeaderGradient?: string;
  sectionHeaderEdge?: string;
  labelBg: string;
  labelHalfBg: string;
  tableHeaderBg: string;
  navyBarBg: string;
  navyBarGradient?: string;
  navyBarEdge?: string;
  navyBarAmountBg: string;
  oddRowBg: string;
  addItemsOddBg: string;
  addItemsEvenBg: string;
  specOddBg: string;
  tcOddBg: string;
  vatRowBg: string;
  grandTotalBg: string;
  footerColor: string;
  footerBorderColor: string;
  chequeColor: string;
  tcSectionHeaderBg: string;
  tcSectionHeaderGradient?: string;
  tcSectionHeaderEdge?: string;
  tcHighlightColor: string;
}

const PRIME_THEME: DocTheme = {
  headerBg: "#1E0040",
  headerGradient: "linear-gradient(135deg, #0D001C 0%, #1E0040 35%, #2A0050 100%)",
  accentStripe: "linear-gradient(90deg, #CC00CC 0%, #8B008B 50%, #CC00CC 100%)",
  titleBg: "#8B008B",
  titleGradient: "linear-gradient(90deg, #660066 0%, #8B008B 50%, #660066 100%)",
  sectionHeaderBg: "#1E0040",
  sectionHeaderGradient: "linear-gradient(180deg, #2A0050 0%, #1E0040 60%, #0D001C 100%)",
  sectionHeaderEdge: "#050010",
  labelBg: "#8B008B",
  labelHalfBg: "#8B008B",
  tableHeaderBg: "#1E0040",
  navyBarBg: "#1E0040",
  navyBarGradient: "linear-gradient(180deg, #2A0050 0%, #1E0040 50%, #0D001C 100%)",
  navyBarEdge: "#050010",
  navyBarAmountBg: "#8B008B",
  oddRowBg: "#f5e6f5",
  addItemsOddBg: "#f8f0f8",
  addItemsEvenBg: "#ffffff",
  specOddBg: "#f9f2f9",
  tcOddBg: "#f5e6f5",
  vatRowBg: "#eddeed",
  grandTotalBg: "#8B008B",
  footerColor: "#1E0040",
  footerBorderColor: "#8B008B",
  chequeColor: "#8B008B",
  tcSectionHeaderBg: "#8B008B",
  tcSectionHeaderGradient: "linear-gradient(180deg, #AA00AA 0%, #8B008B 40%, #660066 100%)",
  tcSectionHeaderEdge: "#330033",
  tcHighlightColor: "#8B008B",
};

const ELITE_THEME: DocTheme = {
  headerBg: "#0D0D0D",
  titleBg: "#8B0000",
  titleGradient: "linear-gradient(90deg, #8B0000 0%, #C00000 50%, #8B0000 100%)",
  sectionHeaderBg: "#0D0D0D",
  sectionHeaderGradient: "linear-gradient(180deg, #444444 0%, #222222 50%, #0D0D0D 100%)",
  sectionHeaderEdge: "#000000",
  labelBg: "#1E1E1E",
  labelHalfBg: "#1E1E1E",
  tableHeaderBg: "#0D0D0D",
  navyBarBg: "#0D0D0D",
  navyBarGradient: "linear-gradient(180deg, #3A3A3A 0%, #1E1E1E 50%, #0D0D0D 100%)",
  navyBarEdge: "#000000",
  navyBarAmountBg: "#6B0000",
  oddRowBg: "#F3F3F3",
  addItemsOddBg: "#F3F3F3",
  addItemsEvenBg: "#ffffff",
  specOddBg: "#F3F3F3",
  tcOddBg: "#F5F5F5",
  vatRowBg: "#E0E0E0",
  grandTotalBg: "#8B0000",
  footerColor: "#0D0D0D",
  footerBorderColor: "#8B0000",
  chequeColor: "#8B0000",
  tcSectionHeaderBg: "#1E1E1E",
  tcSectionHeaderGradient: "linear-gradient(180deg, #555555 0%, #2A2A2A 50%, #0D0D0D 100%)",
  tcSectionHeaderEdge: "#000000",
  tcHighlightColor: "#8B0000",
};

const MODERN_THEME: DocTheme = {
  headerBg: "#C2410C",
  headerGradient: "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #EA580C 100%)",
  accentStripe: "linear-gradient(90deg, #FB923C 0%, #EA580C 50%, #FB923C 100%)",
  titleBg: "#EA580C",
  titleGradient: "linear-gradient(90deg, #C2410C 0%, #EA580C 50%, #C2410C 100%)",
  sectionHeaderBg: "#C2410C",
  sectionHeaderGradient: "linear-gradient(180deg, #EA580C 0%, #C2410C 60%, #9A3412 100%)",
  sectionHeaderEdge: "#7C2D12",
  labelBg: "#EA580C",
  labelHalfBg: "#EA580C",
  tableHeaderBg: "#C2410C",
  navyBarBg: "#C2410C",
  navyBarGradient: "linear-gradient(180deg, #EA580C 0%, #C2410C 50%, #9A3412 100%)",
  navyBarEdge: "#7C2D12",
  navyBarAmountBg: "#EA580C",
  oddRowBg: "#FFF7ED",
  addItemsOddBg: "#FFF7ED",
  addItemsEvenBg: "#ffffff",
  specOddBg: "#FFF7ED",
  tcOddBg: "#FFF7ED",
  vatRowBg: "#FFEDD5",
  grandTotalBg: "#EA580C",
  footerColor: "#C2410C",
  footerBorderColor: "#EA580C",
  chequeColor: "#EA580C",
  tcSectionHeaderBg: "#EA580C",
  tcSectionHeaderGradient: "linear-gradient(180deg, #FB923C 0%, #EA580C 40%, #C2410C 100%)",
  tcSectionHeaderEdge: "#7C2D12",
  tcHighlightColor: "#EA580C",
};

const MINIMAL_THEME: DocTheme = {
  headerBg: "#374151",
  headerGradient: "linear-gradient(135deg, #1F2937 0%, #374151 50%, #4B5563 100%)",
  titleBg: "#374151",
  titleGradient: "linear-gradient(90deg, #1F2937 0%, #374151 50%, #1F2937 100%)",
  sectionHeaderBg: "#374151",
  sectionHeaderGradient: "linear-gradient(180deg, #4B5563 0%, #374151 60%, #1F2937 100%)",
  labelBg: "#6B7280",
  labelHalfBg: "#6B7280",
  tableHeaderBg: "#374151",
  navyBarBg: "#374151",
  navyBarGradient: "linear-gradient(180deg, #4B5563 0%, #374151 50%, #1F2937 100%)",
  navyBarAmountBg: "#6B7280",
  oddRowBg: "#F9FAFB",
  addItemsOddBg: "#F9FAFB",
  addItemsEvenBg: "#ffffff",
  specOddBg: "#F9FAFB",
  tcOddBg: "#F9FAFB",
  vatRowBg: "#F3F4F6",
  grandTotalBg: "#374151",
  footerColor: "#6B7280",
  footerBorderColor: "#D1D5DB",
  chequeColor: "#374151",
  tcSectionHeaderBg: "#374151",
  tcHighlightColor: "#374151",
};

const SIMPLE_THEME: DocTheme = {
  headerBg: "#000000",
  titleBg: "#111827",
  titleGradient: "linear-gradient(90deg, #000000 0%, #111827 50%, #000000 100%)",
  sectionHeaderBg: "#111827",
  sectionHeaderGradient: "linear-gradient(180deg, #374151 0%, #1F2937 50%, #000000 100%)",
  labelBg: "#374151",
  labelHalfBg: "#374151",
  tableHeaderBg: "#000000",
  navyBarBg: "#000000",
  navyBarGradient: "linear-gradient(180deg, #374151 0%, #111827 50%, #000000 100%)",
  navyBarAmountBg: "#374151",
  oddRowBg: "#F9FAFB",
  addItemsOddBg: "#F9FAFB",
  addItemsEvenBg: "#ffffff",
  specOddBg: "#F9FAFB",
  tcOddBg: "#F9FAFB",
  vatRowBg: "#F3F4F6",
  grandTotalBg: "#000000",
  footerColor: "#374151",
  footerBorderColor: "#D1D5DB",
  chequeColor: "#000000",
  tcSectionHeaderBg: "#000000",
  tcHighlightColor: "#000000",
};

const DocThemeContext = React.createContext<DocTheme>(PRIME_THEME);
// ──────────────────────────────────────────────────────────────────────────

function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th
      className={`border border-gray-400 px-2 py-[2px] text-xs font-bold bg-gray-100 ${right ? "text-right" : center ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children, right, center, bold, colSpan, green, red, style,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
  bold?: boolean;
  colSpan?: number;
  green?: boolean;
  red?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      style={style}
      className={`border border-gray-400 px-2 py-[2px] text-xs ${right ? "text-right" : center ? "text-center" : "text-left"} ${bold ? "font-bold" : ""} ${green ? "text-green-700 font-bold" : ""} ${red ? "text-red-600 font-bold" : ""}`}
    >
      {children}
    </td>
  );
}

function LabelTd({ children }: { children: React.ReactNode }) {
  const theme = React.useContext(DocThemeContext);
  return (
    <td className="border border-gray-400 px-2 py-[2px] text-[11px] font-semibold text-white whitespace-nowrap w-[18%]"
      style={{ backgroundColor: theme.labelBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      {children}
    </td>
  );
}

function LabelTdHalf({ children }: { children: React.ReactNode }) {
  const theme = React.useContext(DocThemeContext);
  return (
    <td className="border border-gray-400 px-2 py-0 text-[10.5px] font-semibold text-white whitespace-nowrap"
      style={{ width: "38%", backgroundColor: theme.labelHalfBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      {children}
    </td>
  );
}


function DetailTd({ children }: { children?: React.ReactNode }) {
  return (
    <td className="border border-gray-400 px-2 py-0 text-[10.5px] text-left">{children}</td>
  );
}

function NavyBar({ children, amount }: { children: React.ReactNode; amount?: string }) {
  const theme = React.useContext(DocThemeContext);
  const ps = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;
  return (
    <tr style={ps}>
      <td
        className="border border-gray-400 px-2 text-[11px] font-black uppercase text-white"
        style={{
          background: theme.navyBarGradient ?? theme.navyBarBg,
          boxShadow: theme.navyBarEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.navyBarEdge}` : undefined,
          padding: theme.navyBarEdge ? "4px 8px 9px" : "2px 8px",
          textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.4)",
          ...ps,
        } as React.CSSProperties}
      >
        {children}
      </td>
      {amount !== undefined && (
        <td
          className="border border-gray-400 text-[11px] font-black text-right text-white whitespace-nowrap"
          style={{
            width: 130,
            background: theme.navyBarGradient ?? theme.navyBarAmountBg,
            boxShadow: theme.navyBarEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.navyBarEdge}` : undefined,
            padding: theme.navyBarEdge ? "4px 8px 9px" : "2px 8px",
            textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.4)",
            ...ps,
          } as React.CSSProperties}
        >
          {amount}
        </td>
      )}
    </tr>
  );
}

function PageFooter({ left, page, hideDisclaimer, showPageNumbers, footerText }: {
  left: React.ReactNode;
  page: string;
  hideDisclaimer?: boolean;
  showPageNumbers?: boolean;
  footerText?: string;
}) {
  const theme = React.useContext(DocThemeContext);
  const displayPage = showPageNumbers !== false ? page : "";
  return (
    <div className="doc-page-footer">
      {footerText && (
        <div className="text-center text-[9px] font-medium mb-0.5" style={{ color: theme.footerColor, opacity: 0.8 }}>
          {footerText}
        </div>
      )}
      {!hideDisclaimer && (
        <div className="text-center text-[10px] italic mb-1" style={{ color: theme.footerColor }}>
          This is a computer generated document. No signature or stamp required.
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] pt-1" style={{ color: theme.footerColor, borderTop: `1px solid ${theme.footerBorderColor}` }}>
        <span className="font-mono tracking-wide">{left}</span>
        <span className="font-semibold">{displayPage}</span>
      </div>
    </div>
  );
}

function WordsRow({ words, colSpan }: { words: string; colSpan?: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan ?? 2}
        className="border border-gray-400 px-2 py-0.5 text-[11px] bg-gray-50 italic"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
      >
        <span className="not-italic font-semibold">In Words: </span>{words}
      </td>
    </tr>
  );
}

export function DocumentPrint({ data }: { data: DocumentData }) {
  const { settings } = usePrintSettings();
  const baseTheme = data.companyId === 2 ? ELITE_THEME : PRIME_THEME;
  const templateOverrides: Record<string, DocTheme> = {
    modern: MODERN_THEME, minimal: MINIMAL_THEME, simple: SIMPLE_THEME,
  };
  const theme = templateOverrides[settings.template] ?? baseTheme;
  const effectiveTheme: typeof theme = settings.accentColor ? {
    ...theme,
    labelBg: settings.accentColor,
    labelHalfBg: settings.accentColor,
    sectionHeaderBg: settings.accentColor,
    sectionHeaderGradient: settings.accentColor,
    navyBarBg: settings.accentColor,
    navyBarAmountBg: settings.accentColor,
    navyBarGradient: settings.accentColor,
    tableHeaderBg: settings.accentColor,
    titleBg: settings.accentColor,
    titleGradient: settings.accentColor,
  } : theme;
  const co = COMPANIES[data.companyId] ?? COMPANIES[1];
  const coName = data.companyRef ?? co.name;
  const companyLogo = data.companyId === 2 ? eliteLogo : primeLogo;
  const isDelivery = data.type === "delivery_note";
  const _now = new Date();
  const printDate = _now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const printTime = _now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const isQuotation = data.type === "quotation";
  const isTax = data.type === "tax_invoice";
  const isPO = data.type === "purchase_order";
  const vat = data.vatPercent ?? 5;
  const projectItemsSubtotal = data.subtotal ?? data.items.reduce((s, i) => s + (i.total ?? (i.unitPrice ?? 0) * i.quantity), 0);
  const additionalTotal = (data.additionalItems ?? []).reduce(
    (s, ai) => s + (ai.status === "Included" ? ((ai.price ?? 0) * (ai.quantity ?? 1)) : 0), 0
  );
  const combinedSubtotalExclVat = projectItemsSubtotal + additionalTotal;
  const hasDiscount = data.items.some(i => (i.discount ?? 0) > 0);
  // Always recalculate VAT from the live combined subtotal so it is consistent
  // with the displayed additional-items table (especially for proformas created
  // before additional items were carried over from the quotation).
  const vatAmt = +(combinedSubtotalExclVat * vat / 100).toFixed(2);
  // Always derive grand total from live numbers so the document is self-consistent.
  // Tax invoices now show the full contract value in Module 1; the installment
  // breakdown appears separately in Module 2 (Payment Schedule).
  const grand = +(combinedSubtotalExclVat + vatAmt).toFixed(2);
  // Keep 'subtotal' as project-items-only alias for BAR 1
  const subtotal = projectItemsSubtotal;
  const docDate = data.invoiceDate ?? data.date ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const clientContact = data.clientContactPerson ?? data.clientContact ?? "—";
  const customerTrn = data.customerTrn ?? data.clientTrn ?? "—";

  const additionalItems = data.additionalItems ?? DEFAULT_ADDITIONAL_ITEMS;

  const qrText = [
    `REF: ${data.docNumber}`,
    `TYPE: ${DOC_TITLES[data.type] ?? data.type.toUpperCase()}`,
    `CLIENT: ${data.clientName}`,
    `DATE: ${docDate}`,
    `AMT: AED ${formatAED(grand)}`,
    `CO: ${coName}`,
  ].join("\n");
  // Each doc type that has a public viewer gets a URL QR so scanning opens
  // the real styled document. Others fall back to plain informational text.
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "https://primerpsystem.com";
  const PUBLIC_DOC_PATHS: Partial<Record<DocumentType, string>> = {
    quotation:     "/doc/q/",
    proforma:      "/doc/pi/",
    tax_invoice:   "/doc/ti/",
    delivery_note: "/doc/dn/",
  };
  const docPath = PUBLIC_DOC_PATHS[data.type];
  const qrPayload = docPath
    ? `${publicOrigin}${docPath}${encodeURIComponent(data.docNumber)}`
    : qrText;
  const qrData = encodeURIComponent(qrPayload);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}&margin=4&color=000000&bgcolor=ffffff`;

  return (
    <DocThemeContext.Provider value={effectiveTheme}>
      <style>{`
        .print-doc[data-spacing="compact"] td,
        .print-doc[data-spacing="compact"] th { padding-top: 0 !important; padding-bottom: 0 !important; }
        .print-doc[data-spacing="relaxed"] td,
        .print-doc[data-spacing="relaxed"] th { padding-top: 5px !important; padding-bottom: 5px !important; }
        @media print {
          ${getPageCss(settings)}
          html, body { background: white !important; }
          body * { visibility: hidden; }
          .print-doc, .print-doc * { visibility: visible; }
          .print-doc { position: absolute; left: 0; top: 0; width: 100%; max-width: 100% !important;
            box-shadow: none !important; border: none !important; padding: 0 !important;
            margin: 0 !important; border-radius: 0 !important;
            min-height: 0 !important; height: auto !important;
            display: block !important; }
          .print-doc { orphans: 3; widows: 3; }
          /* Forced section break only between the three quotation pages */
          .print-page-break {
            page-break-before: always !important; break-before: page !important;
            margin-top: 0 !important; padding-top: 0 !important;
          }
          /* Keep critical blocks together so they never split awkwardly */
          table { page-break-inside: avoid !important; break-inside: avoid !important; }
          tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
          /* Allow the line-items table to flow across pages naturally */
          table.print-items-table { page-break-inside: auto !important; break-inside: auto !important; }
          table.print-items-table tbody tr, table.print-items-table tbody td { page-break-inside: avoid !important; break-inside: avoid !important; }
          .print-tc-text > div { page-break-inside: avoid !important; break-inside: avoid !important; }
          h1, h2, h3, h4 { page-break-after: avoid !important; break-after: avoid !important; }
          /* Spec / TC density tweaks so they fill the page without overflowing */
          .print-spec-table td, .print-spec-table th {
            font-size: 7.5pt !important; padding: 1.5pt 4pt !important; line-height: 1.25 !important;
          }
          .print-tc-text {
            font-size: 8pt !important; line-height: 1.45 !important; padding: 6pt 8pt !important;
          }
          .print-page-break .text-\\[22px\\] { font-size: 14pt !important; }
          .print-page-break .text-\\[11px\\] { font-size: 7.5pt !important; }
          .print-page-break .text-\\[15px\\] { font-size: 10pt !important; }
          .print-page-break .py-3 { padding-top: 4pt !important; padding-bottom: 4pt !important; }
          .print-page-break .py-2 { padding-top: 3pt !important; padding-bottom: 3pt !important; }
          .print-page-break .mb-3 { margin-bottom: 4pt !important; }
          .print-page-break .mt-4 { margin-top: 4pt !important; }
          .print-page-break .mt-6 { margin-top: 6pt !important; }
          .print-page-break .mb-4 { margin-bottom: 4pt !important; }
          .print-page-break .pt-4 { padding-top: 4pt !important; }
          .print-page-break .p-4 { padding: 6pt !important; }
          .print-page-break .gap-8 { gap: 16pt !important; }
          .print-page-break .h-12 { height: 28pt !important; }
          .print-page-break .h-10 { height: 20pt !important; }
          /* Fixed footer pinned to bottom of every printed page */
          .doc-page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            padding-top: 4pt;
            padding-left: 3px;
            padding-right: 3px;
          }
          /* Signature block flows naturally after content in print */
          .print-sig-block {
            margin-top: 16pt;
          }
          /* Page number label visible on print */
          .page-num-label { display: inline !important; }
          /* Watermark repeats on every printed page via position:fixed */
          .print-watermark {
            position: fixed !important;
            inset: 0 !important;
            z-index: 9999;
            pointer-events: none;
          }
        }
      `}</style>

      <div
        className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[850px] mx-auto py-4 px-[13px] shadow-lg rounded-lg flex flex-col min-h-[1123px] relative"
        data-spacing={settings.lineSpacing ?? "normal"}
        style={settings.fontScale !== 1 ? { fontSize: `${settings.fontScale * 13}px` } : undefined}
      >
        {/* ── WATERMARK OVERLAY — position:absolute on screen, fixed on print so it repeats every page ── */}
        {settings.watermark && (
          <div
            aria-hidden="true"
            className="print-watermark"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties}
          >
            <span
              style={{
                fontSize: 80,
                fontWeight: 900,
                letterSpacing: 8,
                textTransform: "uppercase",
                color: `rgba(200,0,0,${(settings.watermarkOpacity ?? 15) / 100})`,
                transform: "rotate(-35deg)",
                userSelect: "none",
                whiteSpace: "nowrap",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              } as React.CSSProperties}
            >
              {settings.watermark}
            </span>
          </div>
        )}

        {/* ── LETTERHEAD ─────────────────────────────────────────────── */}
        <div className="pdf-repeat-header overflow-hidden mb-[2px]" style={{ borderRadius: theme.accentStripe ? "4px 4px 0 0" : 0 }}>
          {/* 3D slab top highlight */}
          {theme.accentStripe && (
            <div style={{ height: 3, background: "linear-gradient(90deg,#050010 0%,#1E0040 30%,#660066 50%,#1E0040 70%,#050010 100%)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />
          )}
          {/* Main header — 3D light-source gradient */}
          <div style={{
            background: theme.accentStripe
              ? "linear-gradient(160deg, #2A0050 0%, #1E0040 45%, #0D001C 100%)"
              : (theme.headerGradient ?? theme.headerBg),
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
            boxShadow: theme.accentStripe ? "inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -3px 8px rgba(0,0,0,0.5)" : undefined,
          } as React.CSSProperties}>
            {companyLogo && (
              /* 3D beveled logo card */
              <div style={{
                background: "linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%)",
                borderRadius: 7,
                padding: "6px 8px",
                flexShrink: 0,
                border: theme.accentStripe ? "2px solid" : "1px solid #ccc",
                borderColor: theme.accentStripe ? "rgba(255,255,255,0.9) rgba(80,0,80,0.6) rgba(80,0,80,0.6) rgba(255,255,255,0.9)" : "#ccc",
                boxShadow: theme.accentStripe
                  ? "5px 5px 12px rgba(0,0,0,0.55), -2px -2px 5px rgba(255,255,255,0.15), inset 1px 1px 3px rgba(255,255,255,0.5)"
                  : "0 2px 6px rgba(0,0,0,0.3)",
                WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
              } as React.CSSProperties}>
                <img src={companyLogo} alt="Company Logo" style={{ maxHeight: Math.round(65 * (settings.logoScale ?? 1)), maxWidth: Math.round(135 * (settings.logoScale ?? 1)), height: "auto", display: "block" }} />
              </div>
            )}
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              {/* 3D extruded company name */}
              <div style={{
                fontSize: 23,
                fontWeight: 900,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                lineHeight: 1.1,
                color: "#FFFFFF",
                textShadow: theme.accentStripe
                  ? "1px 1px 0 #8B008B, 2px 2px 0 #660066, 3px 3px 0 #440044, 4px 4px 0 #220022, 5px 5px 8px rgba(0,0,0,0.7), 0 0 20px rgba(139,0,139,0.3)"
                  : "1px 1px 0 rgba(0,0,0,0.4), 2px 2px 0 rgba(0,0,0,0.3), 3px 3px 5px rgba(0,0,0,0.5)",
              }}>{coName}</div>
              {/* Magenta accent rule */}
              {theme.accentStripe && (
                <div style={{ height: 2, width: 200, background: "linear-gradient(90deg,#CC00CC,rgba(204,0,204,0))", margin: "5px 0 3px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />
              )}
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginTop: theme.accentStripe ? 0 : 4 }}>{co.address}{!isQuotation ? ` | TRN: ${co.trn}` : ""}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
            </div>

            {/* ── QR CODE — top-right of header ── */}
            {settings.showQrCode !== false && <div style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties}>
              <div style={{
                background: "#ffffff",
                borderRadius: 6,
                padding: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)",
                border: "2px solid rgba(255,255,255,0.85)",
              }}>
                <img
                  src={qrUrl}
                  alt="Document QR"
                  style={{ width: 90, height: 90, display: "block" }}
                  crossOrigin="anonymous"
                />
              </div>
              <div style={{
                fontSize: 8,
                color: "rgba(255,255,255,0.8)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textAlign: "center",
                fontWeight: 600,
              }}>
                Scan to Download
              </div>
            </div>}
          </div>
          {/* 3D slab bottom edge — creates the "thickness" illusion */}
          {theme.accentStripe && (
            <div style={{ height: 5, background: "linear-gradient(90deg,#050010 0%,#1E0040 30%,#660066 50%,#1E0040 70%,#050010 100%)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />
          )}
          {/* Title banner — raised panel */}
          <div style={{
            background: theme.titleGradient ?? theme.titleBg,
            textAlign: "center",
            padding: "6px 0 5px",
            boxShadow: theme.accentStripe ? "inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3)" : undefined,
            WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          } as React.CSSProperties}>
            <span style={{
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#fff",
              textShadow: theme.accentStripe ? "0 1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)" : "none",
            }}>{DOC_TITLES[data.type]}</span>
          </div>
        </div>

        {/* ── COMPANY / CLIENT + REFERENCE (4-column) ─────────────────── */}
        {isPO ? (
          <>
            <table className="w-full border-collapse border border-gray-400 mb-3">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 text-[11px] font-bold text-white text-left" style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, boxShadow: theme.sectionHeaderEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.sectionHeaderEdge}` : undefined, padding: theme.sectionHeaderEdge ? "2px 6px 4px" : "1px 8px", textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Buyer (Our Company)</th>
                  <th colSpan={2} className="border border-gray-400 px-2 text-[11px] font-bold text-white text-left" style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, boxShadow: theme.sectionHeaderEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.sectionHeaderEdge}` : undefined, padding: theme.sectionHeaderEdge ? "2px 6px 4px" : "1px 8px", textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Supplier Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr><LabelTd>Company</LabelTd><Td>{coName}</Td><LabelTd>Supplier</LabelTd><Td>{data.supplierName ?? data.clientName}</Td></tr>
                <tr><LabelTd>Contact Person</LabelTd><Td>{co.contact}</Td><LabelTd>Contact Person</LabelTd><Td>{data.supplierContact ?? "—"}</Td></tr>
                <tr><LabelTd>Contact #</LabelTd><Td>{co.phone}</Td><LabelTd>Contact #</LabelTd><Td>{data.supplierPhone ?? "—"}</Td></tr>
                <tr><LabelTd>Email</LabelTd><Td>{co.email}</Td><LabelTd>Email</LabelTd><Td>{data.supplierEmail ?? "—"}</Td></tr>
                <tr><LabelTd>PO Number</LabelTd><Td><span className="font-bold font-mono">{data.docNumber}</span></Td><LabelTd>Date</LabelTd><Td>{docDate}</Td></tr>
                <tr><LabelTd>Delivery Date</LabelTd><Td>{data.deliveryDate ?? "—"}</Td><LabelTd>Payment Terms</LabelTd><Td>{data.paymentTerms ?? "—"}</Td></tr>
                <tr><LabelTd>Delivery Address</LabelTd><Td>{data.deliveryAddress ?? data.deliveryLocation ?? "—"}</Td><LabelTd>Our TRN</LabelTd><Td>{co.trn}</Td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <div className="flex gap-2 mb-[2px]">
            {/* ── Company Detail (left) ── */}
            <table className="flex-1 border-collapse border border-gray-400">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 text-[11px] font-bold text-white text-left" style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, boxShadow: theme.sectionHeaderEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.sectionHeaderEdge}` : undefined, padding: theme.sectionHeaderEdge ? "2px 6px 4px" : "1px 8px", textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Company Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr><LabelTdHalf>Company</LabelTdHalf><DetailTd>{coName}</DetailTd></tr>
                <tr><LabelTdHalf>Office Address</LabelTdHalf><DetailTd>{co.address}</DetailTd></tr>
                <tr><LabelTdHalf>Contact Person</LabelTdHalf><DetailTd>{data.salesPersonContact ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Contact #</LabelTdHalf><DetailTd>{data.salesPersonPhone ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Email</LabelTdHalf><DetailTd>{data.salesPersonEmail ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Sales Person ID</LabelTdHalf><DetailTd>{data.printedByUniqueId ?? "—"}</DetailTd></tr>
                <tr><LabelTdHalf>Designation</LabelTdHalf><DetailTd>{data.salesPersonDesignation ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>{REF_LABELS[data.type]}</LabelTdHalf><DetailTd><span className="font-bold font-mono">{data.docNumber}</span></DetailTd></tr>
                <tr>
                  <LabelTdHalf>{isTax ? "Invoice Date" : "Date"}</LabelTdHalf>
                  <DetailTd>{docDate}{data.supplyDate ? ` | Supply: ${data.supplyDate}` : ""}</DetailTd>
                </tr>
                {(data.validity || data.type === "quotation") && (
                  <tr><LabelTdHalf>Quotation Validity</LabelTdHalf><DetailTd>{data.validity || "—"}</DetailTd></tr>
                )}
                {(data.leadTime || data.type === "quotation") && (
                  <tr><LabelTdHalf>Lead Time for Delivery</LabelTdHalf><DetailTd>{data.leadTime || "—"}</DetailTd></tr>
                )}
                {(isTax || data.type === "proforma") && (
                  <tr><LabelTdHalf>Company TRN</LabelTdHalf><DetailTd>{data.companyTrn ?? co.trn}</DetailTd></tr>
                )}
              </tbody>
            </table>

            {/* ── Client DETAIL (right) ── */}
            <table className="flex-1 border-collapse border border-gray-400">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 text-[11px] font-bold text-white text-left" style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, boxShadow: theme.sectionHeaderEdge ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -5px 0 ${theme.sectionHeaderEdge}` : undefined, padding: theme.sectionHeaderEdge ? "2px 6px 4px" : "1px 8px", textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 1px 2px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Client DETAIL</th>
                </tr>
              </thead>
              <tbody>
                <tr><LabelTdHalf>Company</LabelTdHalf><DetailTd>{data.clientName}</DetailTd></tr>
                <tr><LabelTdHalf>Office Address</LabelTdHalf><DetailTd>{data.clientAddress ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Contact Person</LabelTdHalf><DetailTd>{clientContact !== "—" ? clientContact : ""}</DetailTd></tr>
                <tr><LabelTdHalf>Contact #</LabelTdHalf><DetailTd>{data.clientPhone ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Email</LabelTdHalf><DetailTd>{data.clientEmail ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Designation</LabelTdHalf><DetailTd>{data.clientDesignation ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>CLIENT ID</LabelTdHalf><DetailTd>{data.clientCode ?? "—"}</DetailTd></tr>
                <tr><LabelTdHalf>Project Ref</LabelTdHalf><DetailTd>{data.projectRef ?? data.projectName ?? ""}</DetailTd></tr>
                <tr><LabelTdHalf>Project / Site</LabelTdHalf><DetailTd>{data.projectLocation ?? data.deliveryLocation ?? ""}</DetailTd></tr>
                {(isTax || data.type === "proforma" || isDelivery) && (
                  <tr><LabelTdHalf>LPO Ref #</LabelTdHalf><DetailTd><span className={data.lpoRef ? "font-bold font-mono" : ""}>{data.lpoRef || "—"}</span></DetailTd></tr>
                )}
                {(isTax || data.type === "proforma") && (
                  <tr><LabelTdHalf>Customer TRN</LabelTdHalf><DetailTd>{customerTrn !== "—" ? customerTrn : ""}</DetailTd></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DELIVERY NOTE DETAILS ───────────────────────────────────── */}
        {isDelivery && (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <tbody>
              <tr>
                <Td><span className="font-semibold">Delivery Date: </span>{data.deliveryDate ?? docDate}</Td>
                <Td><span className="font-semibold">Delivery Location: </span>{data.deliveryLocation ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Loading Date: </span>{data.loadingDate ?? "—"}</Td>
                <Td><span className="font-semibold">Offloading Date: </span>{data.offloadingDate ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Driver Name: </span>{data.driverName ?? "—"}</Td>
                <Td><span className="font-semibold">Driver Contact No.: </span>{data.driverContactNumber ?? "—"}</Td>
              </tr>
              <tr>
                <Td colSpan={2}><span className="font-semibold">Vehicle No.: </span>{data.vehicleNumber ?? "—"}</Td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── LINE ITEMS TABLE ─────────────────────────────────────────── */}
        <table className="print-items-table w-full border-collapse border border-gray-400 mb-0">
          <thead>
            <tr style={{ backgroundColor: effectiveTheme.tableHeaderBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-8">S#</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-left">Description</th>
              {settings.showColUnit !== false && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center">Size/status</th>}
              {!isDelivery && settings.showColUnitPrice !== false && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Price(AED)</th>}
              {settings.showColQty !== false && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Qty.</th>}
              {hasDiscount && !isDelivery && settings.showColDiscount !== false && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center">Disc%</th>}
              {isTax && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center">VAT %</th>}
              {!isDelivery && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Total(AED)</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <Td colSpan={isDelivery ? 3 : isTax ? 7 : 6} center>
                  <span className="text-gray-400 italic">No items</span>
                </Td>
              </tr>
            )}
            {data.items.map((item, i) => {
              const ts = settings.tableStyle ?? "striped";
              const rowBg = ts === "striped"
                ? (i % 2 === 0 ? "#ffffff" : effectiveTheme.oddRowBg)
                : "#ffffff";
              const rowBorder = ts === "bold" ? "2px solid #6b7280" : undefined;
              return (
              <tr key={i} style={{ backgroundColor: rowBg, borderBottom: rowBorder, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <Td center bold>{String(i + 1).padStart(2, "0")}</Td>
                <Td style={{ whiteSpace: "pre-line" }}>{item.description}</Td>
                {settings.showColUnit !== false && <Td center>{item.sizeStatus ?? item.unit ?? "—"}</Td>}
                {!isDelivery && settings.showColUnitPrice !== false && <Td right>{item.unitPrice != null ? formatAED(item.unitPrice) : "—"}</Td>}
                {settings.showColQty !== false && <Td right>{item.quantity}</Td>}
                {hasDiscount && !isDelivery && settings.showColDiscount !== false && <Td center>{(item.discount ?? 0) > 0 ? `${item.discount}%` : "—"}</Td>}
                {isTax && <Td center>{item.vatPercent ?? vat}%</Td>}
                {!isDelivery && <Td right bold>{item.total != null ? formatAED(item.total) : "—"}</Td>}
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── TOTALS / ADDITIONAL ITEMS BLOCK ─────────────────────────── */}
        {isPO && (
          <table className="w-full border-collapse border border-gray-400 mb-3 mt-0">
            <tbody>
              <tr className="text-white" style={{ backgroundColor: theme.navyBarBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <td className="border border-gray-400 px-2 py-2 text-sm font-black">TOTAL AMOUNT (AED)</td>
                <td className="border border-gray-400 px-2 py-2 text-sm font-black text-right">{formatAED(grand)}</td>
              </tr>
              <tr>
                <Td colSpan={2}><span className="font-semibold">Total in Words: </span><span className="italic">{numberToWords(grand)}</span></Td>
              </tr>
            </tbody>
          </table>
        )}

        {!isDelivery && !isPO && (
          <>
            {/* ── BAR 1: TOTAL AMOUNT IN WORDS = EXCLUDING VAT (PROJECT ITEMS) ── */}
            <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
              <tbody>
                <NavyBar amount={formatAED(subtotal)}>
                  Total Amount in Words = Excluding VAT (Project Items)
                </NavyBar>
                <WordsRow words={numberToWords(subtotal)} />
              </tbody>
            </table>

            {/* ── ADDITIONAL COMMERCIAL ITEMS ─────────────────────────────── */}
            {(isQuotation || data.type === "proforma" || isTax) && (
              <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
                <tbody>
                  {additionalItems.map((row, idx) => {
                    const rowTotal = (row.price ?? 0) * (row.quantity ?? 1);
                    return (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? theme.addItemsOddBg : theme.addItemsEvenBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                        <td className="border border-gray-400 px-2 py-[2px] text-xs">{row.description}</td>
                        <td
                          className="border border-gray-400 px-2 py-[2px] text-xs text-center font-semibold whitespace-nowrap"
                          style={{ width: 90 }}
                        >
                          <span className={row.status === "Included" ? "text-green-700" : "text-red-600"}>
                            {row.status}
                          </span>
                        </td>
                        <td className="border border-gray-400 px-2 py-[2px] text-xs text-right whitespace-nowrap" style={{ width: 100 }}>
                          {row.status === "Included" && (row.price ?? 0) > 0 ? formatAED(row.price!) : ""}
                        </td>
                        <td className="border border-gray-400 px-2 py-[2px] text-xs text-right whitespace-nowrap" style={{ width: 80 }}>
                          {row.status === "Included" ? (row.quantity ?? 1) : ""}
                        </td>
                        <td className="border border-gray-400 px-2 py-[2px] text-xs text-right font-semibold whitespace-nowrap" style={{ width: 110 }}>
                          {row.status === "Included" && rowTotal > 0 ? formatAED(rowTotal) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── BAR 2: TOTAL AMOUNT IN WORDS = EXCLUDING VAT ─────────────── */}
            <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
              <tbody>
                <NavyBar amount={formatAED(combinedSubtotalExclVat)}>
                  Total Amount in Words = Excluding VAT
                </NavyBar>
                <WordsRow words={numberToWords(combinedSubtotalExclVat)} />
              </tbody>
            </table>

            {/* ── VAT + GRAND TOTAL (right-aligned, same as quotation) ─────── */}
            <div className="flex justify-end border border-gray-400 mb-0 mt-0">
              <div className="flex-shrink-0" style={{ width: 200 }}>
                <table className="w-full border-collapse h-full">
                  <tbody>
                    {(data.discount ?? 0) > 0 && (
                      <tr>
                        <td className="border border-gray-300 px-2 py-[2px] text-xs">Discount ({data.discount}%)</td>
                        <td className="border border-gray-300 px-2 py-[2px] text-xs text-right font-semibold">
                          – {formatAED((subtotal * (data.discount ?? 0)) / 100)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: theme.vatRowBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold">VAT {vat}%</td>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold text-right">{formatAED(vatAmt)}</td>
                    </tr>
                    <tr style={{ background: theme.titleGradient ?? theme.grandTotalBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-black text-white">Grand Total (AED)</td>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-black text-white text-right">{formatAED(grand)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── BAR 3: GRAND TOTAL AMOUNT IN WORDS ───────────────────────── */}
            <table className="w-full border-collapse border border-gray-400 mb-2 mt-0">
              <tbody>
                <NavyBar amount={formatAED(grand)}>
                  Grand Total Amount in Words
                </NavyBar>
                <WordsRow words={numberToWords(grand)} />
              </tbody>
            </table>

            {/* ── PAYMENT INSTRUCTION (proforma/tax invoice — this installment only) */}
            {(data.type === "proforma" || isTax) && data.installmentFraction && data.paymentTerms && (() => {
              const frac        = data.installmentFraction;
              const pct         = Math.round(frac * 100);
              const instSubtotal = +(combinedSubtotalExclVat * frac).toFixed(2);
              const instVat      = +(instSubtotal * vat / 100).toFixed(2);
              const instTotal    = +(instSubtotal + instVat).toFixed(2);
              const label        = data.installmentNote ?? `${pct}% Payment`;
              return (
                <>
                  {/* Label bar — no amount, just the stage label */}
                  <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
                    <tbody>
                      <NavyBar>{label}</NavyBar>
                    </tbody>
                  </table>
                  {/* Bank details (left) + VAT/Grand Total (right) — side by side */}
                  <div className="flex border border-gray-400 mb-2 mt-0" style={{ alignItems: "stretch" }}>
                    {/* Bank details — left */}
                    {co.bank && settings.showBankDetails && (
                      <table className="flex-1 border-collapse text-[10px]" style={{ borderRight: "1px solid #9ca3af" }}>
                        <tbody>
                          <tr>
                            <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200 w-[38%]">Account Title</td>
                            <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.accountTitle}</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200">Account #</td>
                            <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.accountNumber}</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200">IBAN</td>
                            <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.iban}</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap">Swift Code</td>
                            <td className="px-2 py-[2px] font-semibold">{co.bank.swift}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {/* VAT + Grand Total — right */}
                    <div className="flex-shrink-0 flex flex-col justify-end" style={{ width: 200 }}>
                      <table className="w-full border-collapse h-full">
                        <tbody>
                          <tr style={{ backgroundColor: theme.vatRowBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                            <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold">VAT {vat}%</td>
                            <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold text-right">{formatAED(instVat)}</td>
                          </tr>
                          <tr style={{ background: theme.titleGradient ?? theme.grandTotalBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                            <td className="border border-gray-300 px-2 py-[2px] text-xs font-black text-white">Grand Total (AED)</td>
                            <td className="border border-gray-300 px-2 py-[2px] text-xs font-black text-white text-right">{formatAED(instTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Grand Total Amount in Words — below bank details */}
                  <table className="w-full border-collapse border border-gray-400 mb-2 mt-0">
                    <tbody>
                      <NavyBar amount={formatAED(instTotal)}>
                        Grand Total Amount in Words
                      </NavyBar>
                      <WordsRow words={numberToWords(instTotal)} />
                    </tbody>
                  </table>
                </>
              );
            })()}

            {/* ── BANK DETAILS (invoices only; hidden for installment invoices since
                   bank details are already shown inside the Payment Instruction) ── */}
            {co.bank && !isQuotation && settings.showBankDetails && !data.installmentFraction && (
              <table className="w-full border-collapse border border-gray-400 mb-2 mt-0 text-[10px]">
                <tbody>
                  <tr style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <td colSpan={2} className="px-2 py-[4px] text-[10px] font-bold text-white uppercase tracking-wide">Bank Details</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200 w-[28%]">Account Title</td>
                    <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.accountTitle}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200">Account #</td>
                    <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.accountNumber}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap border-b border-gray-200">IBAN</td>
                    <td className="px-2 py-[2px] font-semibold border-b border-gray-200">{co.bank.iban}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-[2px] text-gray-500 whitespace-nowrap">Swift Code</td>
                    <td className="px-2 py-[2px] font-semibold">{co.bank.swift}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── PAYMENT SCHEDULE ─────────────────────────────────────────── */}
        {/* Quotations: show all installment rows.                           */}
        {/* Proforma / Tax Invoice: show ONLY this invoice's installment.    */}
        {data.type === "quotation" && data.paymentTerms && (() => {
          const installments = parsePaymentTerms(data.paymentTerms);
          if (installments.length === 0) return null;
          const schedule = calculateInstallments(installments, combinedSubtotalExclVat, vat);
          const isPDC = isPDCPaymentTerms(data.paymentTerms);
          const scheduleTotal = schedule.reduce((s, r) => s + r.total, 0);
          const scheduleSubtotalSum = schedule.reduce((s, r) => s + r.subtotal, 0);
          const scheduleVatSum = schedule.reduce((s, r) => s + r.vatAmount, 0);
          return (
            <table className="w-full border-collapse border border-gray-400 mb-2 mt-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <thead>
                <tr>
                  <th
                    colSpan={isPDC ? 6 : 5}
                    className="px-2 text-[11px] font-black text-white text-left"
                    style={{
                      background: theme.titleGradient ?? theme.grandTotalBg,
                      padding: "5px 8px 6px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      textShadow: "0 1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)",
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    } as React.CSSProperties}
                  >
                    {isPDC ? "Post-Dated Cheque (PDC) Payment Terms" : "Payment Terms"}
                    <span className="ml-3 font-normal text-[10px] opacity-80 normal-case tracking-normal">
                      — {isPDC ? data.paymentTerms : installments.map(inst => `${+inst.percent.toFixed(2)}% ${inst.label}`).join(" · ")}
                    </span>
                  </th>
                </tr>
                <tr style={{ background: theme.sectionHeaderGradient ?? theme.sectionHeaderBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-left" style={{ width: isPDC ? "28%" : "34%" }}>
                    {isPDC ? "Cheque" : "Stage"}
                  </th>
                  {isPDC && (
                    <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-center" style={{ width: "16%" }}>
                      Due Date
                    </th>
                  )}
                  <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-center" style={{ width: "8%" }}>%</th>
                  <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-right" style={{ width: "20%" }}>Amount (Excl. VAT)</th>
                  <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-right" style={{ width: "14%" }}>VAT {vat}%</th>
                  <th className="border border-gray-300 px-2 py-[3px] text-[10px] font-bold text-white text-right" style={{ width: "20%" }}>Total (AED)</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8f8f8", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <td className="border border-gray-300 px-2 py-[3px] text-[10px] font-semibold">{row.label}</td>
                    {isPDC && <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-center font-mono">{row.dueDate ?? "—"}</td>}
                    <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-center">{row.percent}%</td>
                    <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-mono">{formatAED(row.subtotal)}</td>
                    <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-mono">{formatAED(row.vatAmount)}</td>
                    <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-bold font-mono">{formatAED(row.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: theme.vatRowBg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <td className="border border-gray-300 px-2 py-[3px] text-[10px] font-black" colSpan={isPDC ? 3 : 2}>Total</td>
                  <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-black font-mono">{formatAED(scheduleSubtotalSum)}</td>
                  <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-black font-mono">{formatAED(scheduleVatSum)}</td>
                  <td className="border border-gray-300 px-2 py-[3px] text-[10px] text-right font-black font-mono">{formatAED(scheduleTotal)}</td>
                </tr>
              </tbody>
            </table>
          );
        })()}

        {/* ── NOTES ───────────────────────────────────────────────────── */}
        {data.notes && settings.showNotes && (
          <div className="border border-gray-400 p-1.5 mb-2 bg-gray-50">
            <span className="font-bold">Notes: </span>{data.notes}
          </div>
        )}

        {/* ── DELIVERY NOTE — NOTES FOR CLIENT & TRANSPORTER ──────────── */}
        {isDelivery && (data.noteForClient || data.noteForTransporter) && (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <tbody>
              {data.noteForClient && (
                <tr>
                  <td className="border border-gray-400 px-2 py-1.5 w-1/4 text-xs font-black bg-purple-800 text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    NOTE FOR CLIENT
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-xs" style={{ whiteSpace: "pre-wrap" }}>{data.noteForClient}</td>
                </tr>
              )}
              {data.noteForTransporter && (
                <tr>
                  <td className="border border-gray-400 px-2 py-1.5 w-1/4 text-xs font-black bg-slate-700 text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    NOTE FOR TRANSPORTER
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-xs" style={{ whiteSpace: "pre-wrap" }}>{data.noteForTransporter}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* ── DELIVERY RECEIVER BLOCK ─────────────────────────────────── */}
        {isDelivery && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
            <div className="border border-gray-400 p-3">
              <div className="font-bold mb-6">Prepared / Dispatched By:</div>
              <div className="border-t border-gray-500 pt-1">Name &amp; Signature</div>
            </div>
            <div className="border border-gray-400 p-3">
              <div className="font-bold mb-1">Received By:</div>
              <div className="text-gray-600 mb-4">{data.receiverName ?? "________________________"}</div>
              <div className="border-t border-gray-500 pt-1">Name, Signature &amp; Stamp</div>
            </div>
            <div className="border border-gray-400 p-3">
              <div className="font-bold mb-1">Delivery Date &amp; Time:</div>
              <div className="text-gray-600 mb-4">{data.deliveryDate ?? "________________________"}</div>
              <div className="border-t border-gray-500 pt-1">Date / Time</div>
            </div>
          </div>
        )}


        {/* ── SIGNATURE BLOCK (non-quotation) + FOOTER — pinned together at bottom */}
        {!isQuotation && settings.showSignature && (
          <div className="print-sig-block mt-auto" style={{ paddingBottom: "50px" }}>
            {data.type === "delivery_note" ? (
              /* Delivery note: stamp above our company, signature above client company */
              <div className="flex items-end justify-between text-xs pt-3 pb-3 px-4">
                {/* Left — signature + stamp together above For & on behalf of our company */}
                <div>
                  <div data-html2canvas-ignore="true" style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                    {data.preparedBySignatureUrl && (
                      <img
                        src={data.preparedBySignatureUrl}
                        alt="Signature"
                        style={{ maxHeight: 56, maxWidth: 140, objectFit: "contain", opacity: 0.85 }}
                      />
                    )}
                    {data.stampUrl && settings.showStamp && (
                      <img
                        src={data.stampUrl}
                        alt="Stamp"
                        style={{ maxHeight: 150, maxWidth: 150, objectFit: "contain", opacity: 0.85 }}
                      />
                    )}
                  </div>
                  <div className="font-bold mb-0.5">For &amp; on behalf of</div>
                  <div className="font-bold text-[13px]">{coName}</div>
                </div>
                {/* Right — For & on behalf of client (no image) */}
                {data.clientName && (
                  <div className="text-right">
                    <div className="font-bold mb-0.5">For &amp; on behalf of</div>
                    <div className="font-bold text-[13px]">{data.clientName}</div>
                  </div>
                )}
              </div>
            ) : (
              /* All other documents: Prepared by on left, For & on behalf on right */
              <div className="grid grid-cols-2 gap-8 text-xs border-t border-gray-400 pt-3 pb-3 px-4">
                <div>
                  <div className="font-bold mb-0.5">Prepared by:</div>
                  <div className="text-gray-700">{data.preparedByName ?? co.contact}</div>
                  {data.preparedBySignatureUrl && (
                    <div data-html2canvas-ignore="true" style={{ marginTop: 46, display: "flex", justifyContent: "flex-start" }}>
                      <img
                        src={data.preparedBySignatureUrl}
                        alt="Signature"
                        style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", opacity: 0.85 }}
                      />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold mb-0.5">For &amp; on behalf of</div>
                  <div className="font-bold text-[13px]">{coName}</div>
                  {data.stampUrl && settings.showStamp && (
                    <div data-html2canvas-ignore="true" style={{ marginTop: 6 }}>
                      <img
                        src={data.stampUrl}
                        alt="Stamp"
                        style={{ maxHeight: 160, maxWidth: 360, objectFit: "contain", opacity: 0.85, display: "block", marginLeft: "auto" }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            <PageFooter
              left={<>{"PRIME ERP SYSTEM"}{data.projectRef ? `\u00a0\u00a0|\u00a0\u00a0PROJECT ID: ${data.projectRef}` : ""}{`\u00a0\u00a0|\u00a0\u00a0DATE: ${printDate}\u00a0\u00a0|\u00a0\u00a0TIME: ${printTime}\u00a0\u00a0|\u00a0\u00a0DOCUMENT #: ${data.docNumber}`}</>}
              page="1-1"
              showPageNumbers={settings.showPageNumbers}
              footerText={settings.footerText || undefined}
            />
          </div>
        )}

        {isQuotation && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-8 text-xs border-t border-gray-400 pt-3">
              <div>
                <div className="font-bold mb-1">Prepared by:</div>
                <div className="text-gray-700">{data.preparedByName ?? co.contact}</div>
                {data.preparedBySignatureUrl && (
                  <div data-html2canvas-ignore="true" style={{ marginTop: 46, display: "flex", justifyContent: "flex-start" }}>
                    <img
                      src={data.preparedBySignatureUrl}
                      alt="Signature"
                      style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", opacity: 0.85 }}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="font-bold mb-1">For &amp; on behalf of</div>
                <div className="font-bold text-[13px]">{coName}</div>
                {data.stampUrl && settings.showStamp && (
                  <div data-html2canvas-ignore="true" style={{ marginTop: 6 }}>
                    <img
                      src={data.stampUrl}
                      alt="Stamp"
                      style={{ maxHeight: 160, maxWidth: 360, objectFit: "contain", opacity: 0.85, display: "block" }}
                    />
                  </div>
                )}
              </div>
            </div>
            <PageFooter
              left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
              page="1-3"
              showPageNumbers={settings.showPageNumbers}
              footerText={settings.footerText || undefined}
            />
          </>
        )}
        {/* ══════════════════════════════════════════════════════════════
            PAGE 2 — TECHNICAL SPECIFICATIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && settings.showTechSpecs && (
          <div className="print-page-break mt-8" style={{ display: "flex", flexDirection: "column" }}>
            {/* Page 2 Letterhead */}
            <div style={{ overflow: "hidden", marginBottom: 2 }}>
              <div style={{ backgroundColor: theme.headerBg, color: "white", padding: "8px 16px", display: "flex", alignItems: "center", gap: 16, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" style={{ maxHeight: 60, maxWidth: 130, height: "auto", objectFit: "contain", borderRadius: 4, background: "white", padding: 4, flexShrink: 0 }} />
                )}
                <div style={{ lineHeight: 1.2, flex: 1, textAlign: companyLogo ? "left" : "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", lineHeight: 1 }}>{coName}</div>
                  <div style={{ fontSize: 11, marginTop: 3, opacity: 0.9 }}>{co.address}</div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div style={{ background: theme.titleGradient ?? theme.titleBg, color: "white", textAlign: "center", padding: "4px 0", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>TECHNICAL SPECIFICATION</span>
              </div>
            </div>

            {(() => {
              const specSections = parseTechSpecs(data.techSpecs ?? "");
              const printStyle = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;
              const navyBg = { ...printStyle, backgroundColor: theme.tableHeaderBg };
              return (
                <table className="print-spec-table w-full mb-3" style={{ borderCollapse: "collapse", border: "1.5px solid #666", flex: 1, height: "100%" }}>
                  <thead>
                    <tr style={navyBg}>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "center", fontSize: "13pt", fontWeight: 700, padding: "6px 4px", width: 100 }}>
                        Section
                      </th>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "center", fontSize: "13pt", fontWeight: 700, padding: "6px 2px", width: 36 }}>
                        Pt.
                      </th>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "left", fontSize: "13pt", fontWeight: 700, padding: "6px 10px" }}>
                        DESCRIPTION
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {specSections.flatMap((section, si) => {
                      const pts = section.points.filter(p => p.trim() !== "");
                      if (pts.length === 0) return [];
                      return pts.map((pt, pi) => (
                        <tr key={`${si}-${pi}`} style={{ backgroundColor: pi % 2 === 0 ? "#ffffff" : theme.specOddBg, ...printStyle }}>
                          {pi === 0 && (
                            <td
                              rowSpan={pts.length}
                              style={{
                                ...navyBg,
                                border: "1px solid #888",
                                color: "white",
                                textAlign: "center",
                                fontWeight: 800,
                                fontSize: "12pt",
                                verticalAlign: "middle",
                                padding: "6px 4px",
                                lineHeight: 1.35,
                                width: 100,
                              }}
                            >
                              {section.title.split(/\s+/).map((word, wi) => (
                                <div key={wi}>{word}</div>
                              ))}
                            </td>
                          )}
                          <td style={{ border: "1px solid #bbb", textAlign: "center", fontSize: "13pt", fontWeight: 600, padding: "10px 2px", verticalAlign: "top", color: "#333", width: 36 }}>
                            {String.fromCharCode(97 + pi)}
                          </td>
                          <td style={{ border: "1px solid #bbb", fontSize: "13pt", padding: "10px 10px", verticalAlign: "top", lineHeight: 1.65 }}>
                            {pt.split("\n").map((line, li) => (
                              <React.Fragment key={li}>
                                {line}
                                {li < pt.split("\n").length - 1 && <br />}
                              </React.Fragment>
                            ))}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              );
            })()}

            <PageFooter
              left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
              page="2-3"
              showPageNumbers={settings.showPageNumbers}
              footerText={settings.footerText || undefined}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 3 — TERMS & CONDITIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && settings.showTC && (
          <div className="print-page-break mt-8">
            {/* Page 3 Letterhead */}
            <div style={{ overflow: "hidden", marginBottom: 2 }}>
              <div style={{ backgroundColor: theme.headerBg, color: "white", padding: "8px 16px", display: "flex", alignItems: "center", gap: 16, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" style={{ maxHeight: 60, maxWidth: 130, height: "auto", objectFit: "contain", borderRadius: 4, background: "white", padding: 4, flexShrink: 0 }} />
                )}
                <div style={{ lineHeight: 1.2, flex: 1, textAlign: companyLogo ? "left" : "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", lineHeight: 1 }}>{coName}</div>
                  <div style={{ fontSize: 11, marginTop: 3, opacity: 0.9 }}>{co.address}</div>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div style={{ background: theme.titleGradient ?? theme.titleBg, color: "white", textAlign: "center", padding: "4px 0", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>TERMS &amp; CONDITIONS</span>
              </div>
            </div>

            {(() => {
              const printStyle = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;
              const tcLines = (data.termsConditions ?? STANDARD_TC).split("\n").map(l => l.trim()).filter(l => l);
              const sections: { title: string; num: string; items: { num: string; body: string }[] }[] = [];
              let current: { title: string; num: string; items: { num: string; body: string }[] } | null = null;
              for (const line of tcLines) {
                const isHeader = /^\d+\.\s+[A-Z][A-Z0-9\s&]+$/.test(line);
                if (isHeader) {
                  if (current) sections.push(current);
                  const hm = line.match(/^(\d+)\.\s+(.*)/);
                  current = { num: hm ? hm[1] + "." : "", title: hm ? hm[2] : line, items: [] };
                } else if (current) {
                  const im = line.match(/^(\d+)\.\s+(.*)/);
                  current.items.push({ num: im ? im[1] + "." : "", body: im ? im[2] : line });
                }
              }
              if (current) sections.push(current);
              return (
                <div style={{ marginBottom: 16 }}>
                  {sections.map((sec, si) => (
                    <div key={si} style={{ marginBottom: 5 }}>
                      {/* Section header — 3D extruded slab */}
                      <div style={{ overflow: "hidden", ...printStyle }}>
                        {/* Top highlight — light hitting the top face */}
                        <div style={{ height: 2, background: "rgba(255,255,255,0.30)", ...printStyle }} />
                        {/* Face — light-source gradient top-bright → bottom-dark */}
                        <div style={{
                          background: theme.tcSectionHeaderGradient ?? theme.tcSectionHeaderBg,
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 12px",
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.35)",
                          ...printStyle,
                        }}>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "white", flexShrink: 0, textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 2px 3px rgba(0,0,0,0.4)" }}>{sec.num}</span>
                          <span style={{ fontSize: "11px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.12em", textShadow: "0 1px 0 rgba(0,0,0,0.5), 1px 2px 3px rgba(0,0,0,0.4)" }}>{sec.title}</span>
                        </div>
                        {/* Bottom edge — the visible "thickness" / side of the 3D slab */}
                        <div style={{ height: 5, background: theme.tcSectionHeaderEdge ?? "rgba(0,0,0,0.6)", ...printStyle }} />
                      </div>
                      {/* Items */}
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {sec.items.map((item, ii) => {
                            const isCheque = /cheque(s)?\s+shall\s+be\s+prepared\s+in\s+fav/i.test(item.body);
                            return (
                              <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? theme.tcOddBg : "#ffffff", ...printStyle }}>
                                <td
                                  style={{ border: "1px solid #d1d5db", padding: "4px 8px", fontSize: "10.5px", fontWeight: 600, color: "#4b5563", textAlign: "center", verticalAlign: "top", width: 28 }}
                                >
                                  {item.num}
                                </td>
                                <td
                                  style={{ border: "1px solid #d1d5db", padding: "4px 12px", fontSize: "10.5px", lineHeight: 1.4, verticalAlign: "top", fontWeight: isCheque ? 700 : 400, color: isCheque ? theme.tcHighlightColor : "#1f2937" }}
                                >
                                  {item.body}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })()}

            <PageFooter
              left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
              page="3-3"
              showPageNumbers={settings.showPageNumbers}
              footerText={settings.footerText || undefined}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CUSTOM SECTIONS — one page-break section per entry (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && (data.customSections ?? []).map((sec, si) => (
          <div key={si} className="print-page-break mt-8">
            <div className="overflow-hidden mb-[2px]" style={{ borderRadius: theme.accentStripe ? "4px 4px 0 0" : 0 }}>
              {theme.accentStripe && <div style={{ height: 3, background: "#2878C8", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />}
              <div style={{ background: theme.accentStripe ? "linear-gradient(160deg,#42A5F5 0%,#1565C0 20%,#0D2E6E 55%,#0A1628 100%)" : (theme.headerGradient ?? theme.headerBg), padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: theme.accentStripe ? "inset 0 2px 6px rgba(255,255,255,0.12),inset 0 -3px 8px rgba(0,0,0,0.5)" : undefined, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <div style={{ background: "linear-gradient(145deg,#ffffff 0%,#f0f0f0 100%)", borderRadius: 7, padding: "6px 8px", flexShrink: 0, border: theme.accentStripe ? "2px solid" : "1px solid #ccc", borderColor: theme.accentStripe ? "rgba(255,255,255,0.6)" : "#ccc", boxShadow: theme.accentStripe ? "5px 5px 12px rgba(0,0,0,0.55),-2px -2px 5px rgba(255,255,255,0.15),inset 1px 1px 3px rgba(255,255,255,0.5)" : "0 2px 6px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <img src={companyLogo} alt="Logo" style={{ maxHeight: 65, maxWidth: 135, height: "auto", display: "block" }} />
                  </div>
                )}
                <div style={{ flex: 1, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 23, fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", lineHeight: 1.1, color: "#FFFFFF", textShadow: theme.accentStripe ? "0 1px 3px rgba(0,0,0,0.5)" : "1px 1px 0 rgba(0,0,0,0.4),2px 2px 0 rgba(0,0,0,0.3),3px 3px 5px rgba(0,0,0,0.5)" }}>{coName}</div>
                  {theme.accentStripe && <div style={{ height: 2, width: 200, background: "linear-gradient(90deg,#2878C8,rgba(40,120,200,0))", margin: "5px 0 3px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />}
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginTop: theme.accentStripe ? 0 : 4 }}>{co.address}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              {theme.accentStripe && <div style={{ height: 5, background: "#1B3A6B", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />}
              <div style={{ background: theme.titleGradient ?? theme.titleBg, textAlign: "center", padding: "6px 0 5px", boxShadow: theme.accentStripe ? "inset 0 2px 4px rgba(255,255,255,0.1),inset 0 -2px 4px rgba(0,0,0,0.3)" : undefined, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#fff", textShadow: theme.accentStripe ? "0 1px 0 rgba(0,0,0,0.4),0 2px 4px rgba(0,0,0,0.5)" : "none" }}>{sec.title || "ADDITIONAL SECTION"}</span>
              </div>
            </div>

            <div className="border border-gray-400 p-4 text-[11px] bg-gray-50 mb-4" style={{ lineHeight: "1.7", whiteSpace: "pre-line", minHeight: 160 }}>
              {sec.content || <span className="text-gray-400 italic">No content provided.</span>}
            </div>

            <PageFooter
              left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
              page={`${si + 4}-${3 + (data.customSections?.length ?? 0)}`}
              showPageNumbers={settings.showPageNumbers}
              footerText={settings.footerText || undefined}
            />
          </div>
        ))}
      </div>
    </DocThemeContext.Provider>
  );
}
