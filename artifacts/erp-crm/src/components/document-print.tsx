import React from "react";
import { numberToWords, formatAED } from "@/lib/number-to-words";
import { parseTechSpecs } from "@/lib/tech-spec-templates";
import { STANDARD_TC } from "@/lib/tc-templates";

export interface DocumentItem {
  description: string;
  sizeStatus?: string;
  unitPrice?: number;
  quantity: number;
  unit?: string;
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
  approvedByName?: string;
  vehicleNumber?: string;
  driverName?: string;
  receiverName?: string;
  deliveryLocation?: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  notes?: string;
  supplierName?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  printedByUniqueId?: string;
  clientCode?: string;
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
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
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
    name: "ELITE PREFAB INDUSTRIES LLC",
    address: "Industrial Area, Dubai, UAE",
    trn: "100345678900001",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    contact: "Sales Team",
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
  return (
    <td className="border border-gray-400 px-2 py-[2px] text-[11px] font-semibold text-white whitespace-nowrap w-[18%]"
      style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      {children}
    </td>
  );
}

function LabelTdHalf({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-gray-400 px-2 py-[2px] text-[11px] font-semibold text-white whitespace-nowrap"
      style={{ width: "38%", backgroundColor: "#1e3a6e", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      {children}
    </td>
  );
}

function NavyBar({ children, amount }: { children: React.ReactNode; amount?: string }) {
  return (
    <tr style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      <td
        className="border border-gray-400 px-2 py-[2px] text-[11px] font-black uppercase text-white"
        style={{ backgroundColor: "#0f2d5a" } as React.CSSProperties}
      >
        {children}
      </td>
      {amount !== undefined && (
        <td
          className="border border-gray-400 px-2 py-[2px] text-[11px] font-black text-right text-white whitespace-nowrap"
          style={{ width: 130, backgroundColor: "#1e5a9e" } as React.CSSProperties}
        >
          {amount}
        </td>
      )}
    </tr>
  );
}

function PageFooter({ left, page, hideDisclaimer }: { left: React.ReactNode; page: string; hideDisclaimer?: boolean }) {
  return (
    <div className="doc-page-footer">
      {!hideDisclaimer && (
        <div className="text-center text-[10px] italic text-[#0f2d5a] mb-1">
          This is a computer generated document. No signature or stamp required.
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-[#0f2d5a] border-t border-[#0f2d5a] pt-1">
        <span className="font-mono tracking-wide">{left}</span>
        <span className="font-semibold">{page}</span>
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
  const co = COMPANIES[data.companyId] ?? COMPANIES[1];
  const coName = data.companyRef ?? co.name;
  const defaultLogo = data.companyId === 1 ? "/prime-max-logo.png" : undefined;
  const companyLogo = data.companyLogo ?? defaultLogo;
  const isDelivery = data.type === "delivery_note";
  const _now = new Date();
  const printDate = _now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const printTime = _now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const isQuotation = data.type === "quotation";
  const isTax = data.type === "tax_invoice";
  const isPO = data.type === "purchase_order";
  const vat = data.vatPercent ?? 5;
  const subtotal = data.subtotal ?? data.items.reduce((s, i) => s + (i.total ?? (i.unitPrice ?? 0) * i.quantity), 0);
  const vatAmt = data.vatAmount ?? (subtotal * vat / 100);
  const grand = data.grandTotal;
  const docDate = data.invoiceDate ?? data.date ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const clientContact = data.clientContactPerson ?? data.clientContact ?? "—";
  const customerTrn = data.customerTrn ?? data.clientTrn ?? "—";

  const additionalItems = data.additionalItems ?? DEFAULT_ADDITIONAL_ITEMS;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm 10mm; }
          html, body { background: white !important; }
          body * { visibility: hidden; }
          .print-doc, .print-doc * { visibility: visible; }
          .print-doc { position: absolute; left: 0; top: 0; width: 100%; max-width: 100% !important;
            box-shadow: none !important; border: none !important; padding: 0 !important;
            margin: 0 !important; border-radius: 0 !important; }
          .print-doc { orphans: 3; widows: 3; }
          /* Forced section break only between the three quotation pages */
          .print-page-break {
            page-break-before: always !important; break-before: page !important;
          }
          /* Keep critical blocks together so they never split awkwardly */
          table { page-break-inside: avoid !important; break-inside: avoid !important; }
          tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
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
            left: 10mm;
            right: 10mm;
            background: white;
            padding-top: 4pt;
          }
        }
      `}</style>

      <div className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[850px] mx-auto p-4 shadow-lg rounded-lg">

        {/* ── LETTERHEAD ─────────────────────────────────────────────── */}
        <div className="overflow-hidden mb-[2px]">
          <div className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Company Logo"
                className="object-contain rounded bg-white p-1 flex-shrink-0"
                style={{ maxHeight: 60, maxWidth: 130, height: "auto" }}
              />
            )}
            <div className={`leading-tight ${companyLogo ? "flex-1" : "flex-1 text-center"}`}>
              <div className="text-[22px] font-black tracking-wider uppercase leading-none">{coName}</div>
              <div className="text-[11px] mt-[3px] opacity-90">{co.address} | TRN: {co.trn}</div>
              <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
            </div>
          </div>
          <div className="bg-[#1e6ab0] text-white text-center py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
            <span className="text-[15px] font-black tracking-widest uppercase">{DOC_TITLES[data.type]}</span>
          </div>
        </div>

        {/* ── COMPANY / CLIENT + REFERENCE (4-column) ─────────────────── */}
        {isPO ? (
          <>
            <table className="w-full border-collapse border border-gray-400 mb-3">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Buyer (Our Company)</th>
                  <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Supplier Detail</th>
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
                  <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Company Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr><LabelTdHalf>Company</LabelTdHalf><Td>{coName}</Td></tr>
                <tr><LabelTdHalf>Contact Person</LabelTdHalf><Td>{co.contact}</Td></tr>
                <tr><LabelTdHalf>Contact #</LabelTdHalf><Td>{co.phone}</Td></tr>
                <tr><LabelTdHalf>Email</LabelTdHalf><Td>{co.email}</Td></tr>
                <tr><LabelTdHalf>Sales Person ID</LabelTdHalf><Td>{data.printedByUniqueId ?? "—"}</Td></tr>
                <tr><LabelTdHalf>Designation</LabelTdHalf><Td>{data.preparedByName ?? co.contact}</Td></tr>
                <tr><LabelTdHalf>{REF_LABELS[data.type]}</LabelTdHalf><Td><span className="font-bold font-mono">{data.docNumber}</span></Td></tr>
                <tr>
                  <LabelTdHalf>{isTax ? "Invoice Date" : "Date"}</LabelTdHalf>
                  <Td>{docDate}{data.validity ? ` | Valid: ${data.validity}` : ""}{data.supplyDate ? ` | Supply: ${data.supplyDate}` : ""}</Td>
                </tr>
                {(isTax || data.type === "proforma") && (
                  <tr><LabelTdHalf>Company TRN</LabelTdHalf><Td>{data.companyTrn ?? co.trn}</Td></tr>
                )}
              </tbody>
            </table>

            {/* ── Client DETAIL (right) ── */}
            <table className="flex-1 border-collapse border border-gray-400">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Client DETAIL</th>
                </tr>
              </thead>
              <tbody>
                <tr><LabelTdHalf>Company</LabelTdHalf><Td>{data.clientName}</Td></tr>
                <tr><LabelTdHalf>Contact Person</LabelTdHalf><Td>{clientContact !== "—" ? clientContact : ""}</Td></tr>
                <tr><LabelTdHalf>Contact #</LabelTdHalf><Td>{data.clientPhone ?? ""}</Td></tr>
                <tr><LabelTdHalf>Email</LabelTdHalf><Td>{data.clientEmail ?? ""}</Td></tr>
                <tr><LabelTdHalf>Designation</LabelTdHalf><Td>{""}</Td></tr>
                <tr><LabelTdHalf>CLIENT ID</LabelTdHalf><Td>{data.clientCode ?? "—"}</Td></tr>
                <tr><LabelTdHalf>Project Ref</LabelTdHalf><Td>{data.projectRef ?? data.projectName ?? ""}</Td></tr>
                <tr><LabelTdHalf>Project / Site</LabelTdHalf><Td>{data.projectLocation ?? data.deliveryLocation ?? ""}</Td></tr>
                {(isTax || data.type === "proforma") && (
                  <tr><LabelTdHalf>Customer TRN</LabelTdHalf><Td>{customerTrn !== "—" ? customerTrn : ""}</Td></tr>
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
                <Td><span className="font-semibold">Driver Name: </span>{data.driverName ?? "—"}</Td>
                <Td><span className="font-semibold">Vehicle No.: </span>{data.vehicleNumber ?? "—"}</Td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── LINE ITEMS TABLE ─────────────────────────────────────────── */}
        <table className="w-full border-collapse border border-gray-400 mb-0">
          <thead>
            <tr style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-8">S#</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-left">Description</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center">Size / Status</th>
              {!isDelivery && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Price</th>}
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Qty.</th>
              {isTax && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center">VAT %</th>}
              {!isDelivery && <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-right">Total</th>}
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
            {data.items.map((item, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#dce6f1", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <Td center bold>{String(i + 1).padStart(2, "0")}</Td>
                <Td style={{ whiteSpace: "pre-line" }}>{item.description}</Td>
                <Td center>{item.sizeStatus ?? item.unit ?? "—"}</Td>
                {!isDelivery && <Td right>{item.unitPrice != null ? formatAED(item.unitPrice) : "—"}</Td>}
                <Td right>{item.quantity}</Td>
                {isTax && <Td center>{item.vatPercent ?? vat}%</Td>}
                {!isDelivery && <Td right bold>{item.total != null ? formatAED(item.total) : "—"}</Td>}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS / ADDITIONAL ITEMS BLOCK ─────────────────────────── */}
        {isPO && (
          <table className="w-full border-collapse border border-gray-400 mb-3 mt-0">
            <tbody>
              <tr className="bg-[#0f2d5a] text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
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
            {(isQuotation || data.type === "proforma") && (
              <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
                <tbody>
                  {additionalItems.map((row, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#eaf0f8" : "#ffffff", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ── BAR 2: TOTAL AMOUNT IN WORDS = EXCLUDING VAT ─────────────── */}
            <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
              <tbody>
                <NavyBar amount={formatAED(subtotal)}>
                  Total Amount in Words = Excluding VAT
                </NavyBar>
                <WordsRow words={numberToWords(subtotal)} />
              </tbody>
            </table>

            {/* ── BANK DETAILS + VAT + GRAND TOTAL ─────────────────────────── */}
            <div className={`flex gap-0 border border-gray-400 mb-0 mt-0${isQuotation ? " justify-end" : ""}`}>
              {/* Bank Details — hidden on quotations */}
              {co.bank && !isQuotation && (
                <div className="flex-1 border-r border-gray-400" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <table className="text-[10px] w-full border-collapse">
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
                </div>
              )}

              {/* VAT + Grand Total */}
              <div className="flex-shrink-0" style={{ width: co.bank ? 200 : "100%" }}>
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
                    <tr style={{ backgroundColor: "#bdd7ee", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold">VAT {vat}%</td>
                      <td className="border border-gray-300 px-2 py-[2px] text-xs font-semibold text-right">{formatAED(vatAmt)}</td>
                    </tr>
                    <tr style={{ backgroundColor: "#70ad47", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
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
          </>
        )}

        {/* ── PAYMENT TERMS ───────────────────────────────────────────── */}
        {data.paymentTerms && !isDelivery && (
          <div className="border border-gray-400 p-1.5 mb-2 bg-gray-50">
            <span className="font-bold">Payment Terms: </span>{data.paymentTerms}
          </div>
        )}

        {/* ── NOTES ───────────────────────────────────────────────────── */}
        {data.notes && (
          <div className="border border-gray-400 p-1.5 mb-2 bg-gray-50">
            <span className="font-bold">Notes: </span>{data.notes}
          </div>
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

        {/* ── CHEQUE FAVOR NOTE (quotation page 1, subtle, left-aligned) */}
        {isQuotation && (
          <div className="mb-3 text-[10px] text-[#0f2d5a] font-semibold text-left">
            All cheques shall be prepared in favor of "{co.name}".
          </div>
        )}

        {/* ── SIGNATURE BLOCK (non-quotation, or quotation page 1 footer) */}
        {!isQuotation && (
          <div className="mt-6 grid grid-cols-2 gap-8 text-xs border-t border-gray-400 pt-4">
            <div>
              <div className="font-bold mb-1">Prepared by:</div>
              <div className="text-gray-700">{data.preparedByName ?? co.contact}</div>
              {data.preparedBySignatureUrl ? (
                <img src={data.preparedBySignatureUrl} alt="Signature" className="h-12 mt-2 mb-1 object-contain" style={{ maxWidth: 160 }} />
              ) : (
                <div className="h-10 mt-2 mb-1" />
              )}
              <div className="border-t border-gray-500 pt-1 text-gray-500">Signature</div>
            </div>
            <div className="text-right">
              <div className="font-bold mb-1">For &amp; on behalf of</div>
              <div className="font-bold text-[13px]">{coName}</div>
              <div className="h-10 mt-2 mb-1" />
              <div className="border-t border-gray-500 pt-1 text-gray-500">Authorised Signatory</div>
            </div>
          </div>
        )}

        {isQuotation && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-8 text-xs border-t border-gray-400 pt-3">
              <div>
                <div className="font-bold mb-1">Prepared by:</div>
                <div className="text-gray-700">{data.preparedByName ?? co.contact}</div>
                {data.preparedBySignatureUrl ? (
                  <img src={data.preparedBySignatureUrl} alt="Signature" className="h-12 mt-2 mb-1 object-contain" style={{ maxWidth: 160 }} />
                ) : (
                  <div className="h-10 mt-2 mb-1" />
                )}
                <div className="border-t border-gray-500 pt-1 text-gray-500">Signature: ____________________</div>
              </div>
              <div>
                <div className="font-bold mb-1">For &amp; on behalf of</div>
                <div className="font-bold text-[13px]">{coName}</div>
                <div className="h-10 mt-2 mb-1" />
                <div className="border-t border-gray-500 pt-1 text-gray-500">Authorised Signatory</div>
              </div>
            </div>
            <PageFooter
              left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
              page="Page 1 of 3"
            />
          </>
        )}
        {!isQuotation && (
          <PageFooter
            left={<>{"PRIME ERP SYSTEM"}{data.projectRef ? `\u00a0\u00a0|\u00a0\u00a0PROJECT ID: ${data.projectRef}` : ""}{`\u00a0\u00a0|\u00a0\u00a0DATE: ${printDate}\u00a0\u00a0|\u00a0\u00a0TIME: ${printTime}\u00a0\u00a0|\u00a0\u00a0DOCUMENT #: ${data.docNumber}`}</>}
            page="Page 1 of 1"
          />
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 2 — TECHNICAL SPECIFICATIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && (
          <div className="print-page-break mt-8">
            {/* Page 2 Letterhead */}
            <div className="overflow-hidden mb-[2px]">
              <div className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 60, maxWidth: 130, height: "auto" }} />
                )}
                <div className={`leading-tight ${companyLogo ? "flex-1" : "flex-1 text-center"}`}>
                  <div className="text-[22px] font-black tracking-wider uppercase leading-none">{coName}</div>
                  <div className="text-[11px] mt-[3px] opacity-90">{co.address} | TRN: {co.trn}</div>
                  <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div className="bg-[#1e6ab0] text-white text-center py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span className="text-[15px] font-black tracking-widest uppercase">TECHNICAL SPECIFICATION</span>
              </div>
            </div>

            {(() => {
              const specSections = parseTechSpecs(data.techSpecs ?? "");
              const printStyle = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;
              const navyBg = { ...printStyle, backgroundColor: "#0f2d5a" };
              return (
                <table className="print-spec-table w-full mb-3" style={{ borderCollapse: "collapse", border: "1.5px solid #666" }}>
                  <thead>
                    <tr style={navyBg}>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, padding: "5px 4px", width: 84 }}>
                        Section
                      </th>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, padding: "5px 2px", width: 28 }}>
                        Pt.
                      </th>
                      <th style={{ ...navyBg, border: "1px solid #888", color: "white", textAlign: "left", fontSize: "8.5pt", fontWeight: 700, padding: "5px 8px" }}>
                        TECHNICAL SPECIFICATION DETAIL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {specSections.flatMap((section, si) => {
                      const pts = section.points.length > 0 ? section.points : [""];
                      return pts.map((pt, pi) => (
                        <tr key={`${si}-${pi}`} style={{ backgroundColor: pi % 2 === 0 ? "#ffffff" : "#f4f7fb", ...printStyle }}>
                          {pi === 0 && (
                            <td
                              rowSpan={pts.length}
                              style={{
                                ...navyBg,
                                border: "1px solid #888",
                                color: "white",
                                textAlign: "center",
                                fontWeight: 800,
                                fontSize: "8pt",
                                verticalAlign: "middle",
                                padding: "4px 3px",
                                lineHeight: 1.25,
                                width: 84,
                              }}
                            >
                              {section.title.split(/\s+/).map((word, wi) => (
                                <div key={wi}>{word}</div>
                              ))}
                            </td>
                          )}
                          <td style={{ border: "1px solid #bbb", textAlign: "center", fontSize: "8.5pt", fontWeight: 600, padding: "3px 2px", verticalAlign: "top", color: "#333", width: 28 }}>
                            {pt || pt === "" ? String.fromCharCode(97 + pi) : ""}
                          </td>
                          <td style={{ border: "1px solid #bbb", fontSize: "8.5pt", padding: "3px 8px", verticalAlign: "top", lineHeight: 1.45 }}>
                            {pt
                              ? pt.split("\n").map((line, li) => (
                                  <React.Fragment key={li}>
                                    {line}
                                    {li < pt.split("\n").length - 1 && <br />}
                                  </React.Fragment>
                                ))
                              : "\u00a0"}
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
              page="Page 2 of 3"
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 3 — TERMS & CONDITIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && (
          <div className="print-page-break mt-8">
            {/* Page 3 Letterhead */}
            <div className="overflow-hidden mb-[2px]">
              <div className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 60, maxWidth: 130, height: "auto" }} />
                )}
                <div className={`leading-tight ${companyLogo ? "flex-1" : "flex-1 text-center"}`}>
                  <div className="text-[22px] font-black tracking-wider uppercase leading-none">{coName}</div>
                  <div className="text-[11px] mt-[3px] opacity-90">{co.address} | TRN: {co.trn}</div>
                  <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div className="bg-[#1e6ab0] text-white text-center py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span className="text-[15px] font-black tracking-widest uppercase">TERMS &amp; CONDITIONS</span>
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
                <div className="mb-4">
                  {sections.map((sec, si) => (
                    <div key={si} className="mb-[5px]">
                      {/* Section header */}
                      <div
                        className="flex items-center gap-2 px-3 py-[5px]"
                        style={{ backgroundColor: "#1e3a6e", ...printStyle }}
                      >
                        <span className="text-[11px] font-black text-white shrink-0">{sec.num}</span>
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">{sec.title}</span>
                      </div>
                      {/* Items */}
                      <table className="w-full border-collapse">
                        <tbody>
                          {sec.items.map((item, ii) => {
                            const isCheque = /cheque(s)?\s+shall\s+be\s+prepared\s+in\s+fav/i.test(item.body);
                            return (
                              <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? "#f0f4f9" : "#ffffff", ...printStyle }}>
                                <td
                                  className="border border-gray-300 px-2 py-[4px] text-[10.5px] font-semibold text-gray-600 text-center align-top"
                                  style={{ width: 28 }}
                                >
                                  {item.num}
                                </td>
                                <td
                                  className={`border border-gray-300 px-3 py-[4px] text-[10.5px] leading-snug align-top ${isCheque ? "font-bold text-[#0f2d5a]" : "text-gray-800"}`}
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
              page="Page 3 of 3"
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CUSTOM SECTIONS — one page-break section per entry (Quotation only)
      ══════════════════════════════════════════════════════════════ */}
      {isQuotation && (data.customSections ?? []).map((sec, si) => (
        <div key={si} className="print-page-break mt-8">
          <div className="overflow-hidden mb-[2px]">
            <div className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              {companyLogo && (
                <img src={companyLogo} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 60, maxWidth: 130, height: "auto" }} />
              )}
              <div className={`leading-tight ${companyLogo ? "flex-1" : "flex-1 text-center"}`}>
                <div className="text-[22px] font-black tracking-wider uppercase leading-none">{coName}</div>
                <div className="text-[11px] mt-[3px] opacity-90">{co.address} | TRN: {co.trn}</div>
                <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
              </div>
            </div>
            <div className="bg-[#1e6ab0] text-white text-center py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <span className="text-[15px] font-black tracking-widest uppercase">{sec.title || "ADDITIONAL SECTION"}</span>
            </div>
          </div>

          <div className="border border-gray-400 p-4 text-[11px] bg-gray-50 mb-4" style={{ lineHeight: "1.7", whiteSpace: "pre-line", minHeight: 160 }}>
            {sec.content || <span className="text-gray-400 italic">No content provided.</span>}
          </div>

          <PageFooter
            left={<>PRIME ERP SYSTEM{data.printedByUniqueId ? `\u00a0\u00a0\u00a0\u00a0UNIQUE ID: ${data.printedByUniqueId}` : ""}{data.clientCode ? `\u00a0\u00a0\u00a0\u00a0CLIENT CODE: ${data.clientCode}` : ""}</>}
            page={`Additional Page ${si + 1}`}
          />
        </div>
      ))}
    </>
  );
}
