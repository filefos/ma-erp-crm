import React from "react";
import { numberToWords, formatAED } from "@/lib/number-to-words";

export interface DocumentItem {
  description: string;
  sizeStatus?: string;
  unitPrice?: number;
  quantity: number;
  unit?: string;
  total?: number;
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
    name: "PRIME MAX PREFAB HOUSES IND. LLC.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
    trn: "105383255400003",
    phone: "056 616 3555",
    email: "sales@primemaxprefab.com",
    contact: "ASIF LATIF",
    website: "www.primemaxprefab.com",
    bank: {
      bankName: "Abu Dhabi Commercial Bank (ADCB)",
      accountTitle: "PRIME MAX PREFAB HOUSES IND LLC",
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

const TECH_SPECS = [
  {
    title: "BASE FRAME",
    points: [
      "The steel base & top frame shall be constructed from MS I-BEAM 120X64, full perimeter beams with central runner and cross members.",
      "Lifting eyes are provided at intermediate points at the Base of the cabin welded and painted in 01 coat of red oxide primer and 01 coat with matt enamel paint.",
      "Base frame shall be painted with 02 coat paint, one with red oxide, one with rust free enamel paint.",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "Floor Frame: The Floor frame shall be constructed from MS angle 50X50X2.7MM welded into the base & top frame, making the floor assembly one integral frame. (400mm joists spacing). Grit blasted to SA2.5 and painted with 02 coat system of epoxy paint.",
      "Floor Decking: One layer of 18mm thick cement board, fixed to the base frame and floor frame. Bottom of the cement board is painted with bitumen paint.",
      "Floor Finish in Dry Area: 1.5mm PVC vinyl sheet from a good brand.",
      "Floor Finish in Wet Area: PVC vinyl sheet 1.5mm thick.",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "External Finish: 06mm thick cement board finish with heavy texture paint (approved color). External wall joints covered by 6mm thick CFB joint strips.",
      "Internal Finish in Dry Area: 12.5mm thick gypsum board finish with emulsion paint. Floor skirting MDF 50mm / PVC 75MM SKIRTING.",
      "Internal Finish in Wet Area: 12mm thick MR GYPSUM board fixed to cold formed steel wall framing. Joints covered with MDF 5cm skirting.",
      "Wall Framing: LGS profile framing GI studs 70x35x0.45 fixed together by screws at spacing of 610mm vertically & 1200mm horizontally.",
      "Wall Insulation: 50mm thick glass-wool insulation 12kg/m3 density.",
      "Dry Area: Emulsion paint (off-white color) applied to gypsum board. (National). Wet Area: Enamel paint (white color) applied to cement fiber board. (National).",
    ],
  },
  {
    title: "ROOFING",
    points: [
      "Roof Covering: 0.5mm thick GI Corrugated steel fixed on furry channel 0.5mm purlins as per drawing.",
      "Trusses: Truss made of MS Angle 40x40x2.7mm.",
    ],
  },
  {
    title: "CEILING",
    points: [
      "Ceiling in Dry Area: 12mm gypsum board finish with fine texture paint.",
      "Ceiling in Wet Areas: 12mm gypsum board finish with fine texture paint.",
    ],
  },
  {
    title: "DOORS",
    points: [
      "External Door: Supply and installation of Aluminum/PVC Door 900x2100mm. Door Lock: Mortice lockset with cylinder and SS door handles for all internal doors; Single cylinder with thumb turn latch for internal toilet doors.",
      "Internal / Toilet Door: 900/700x2100mm PVC DOOR. Door Lock: Mortice lockset with cylinder and SS door handles for internal doors; Single cylinder with thumb turn latch for toilet doors.",
    ],
  },
  {
    title: "WINDOWS",
    points: [
      "External Windows: Powder coated aluminum frame (non-thermal break), 6mm thick clear glass, externally Hinged window (One shutter hinged & other fixed). 900x900mm.",
      "Exhaust Window: Powder coated aluminum frame (non-thermal break), fixed Exhaust window with 6mm thick Single obscure glass. Size: 400x400mm.",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "Electrical Supply: Conduits and wiring by National / Du-cab / RR.",
      "Tube light 36W ceiling light by MAX.",
    ],
  },
];

const STANDARD_TC = `1. COMMERCIAL BASIS

1. Prices are quoted in accordance with the attached specification and the received project requirements. Any revision, deviation, or additional requirement shall be treated as a variation and priced separately.

2. Unless specifically included in the quotation, the customer shall provide crane support, foundation, safe offloading access, and all site arrangements required for unloading and installation.

3. Commercial basis: Ex-factory.

4. All cheques shall be prepared in favor of "PRIME MAX PREFAB HOUSES IND. LLC."


2. EXCLUSIONS

1. Offloading, excavation, foundation works, and any on-site civil works unless specifically included in the quotation.

2. Expenses related to third-party inspections, testing, statutory approvals, and authority clearances.

3. Window blinds, fire extinguishers, firefighting systems, smoke detectors, fire alarm panel systems, and similar items unless expressly included.

4. Additional third-party certification or testing costs related to welding, painting, lifting eyes, and comparable specialized requirements.

5. Charges for third-party design calculations and certifications, including live load, dead load, wind load, and related engineering assessments.

6. Replaceable items and components subject to normal wear and tear, including ceiling lights, wash basin and shower mixers, shattaf, cistern seat covers, door handles, and locks.


3. PAYMENT TERMS

1. 75% advance payment upon receipt of the LPO and approved drawings.

2. 25% balance payment before delivery.

3. Cheque shall be prepared in favor of "PRIME MAX PREFAB HOUSES IND. LLC."

4. Production and delivery shall proceed in accordance with the approved drawing set, agreed commercial terms, and payment milestone compliance.


4. TECHNICAL & GENERAL NOTES

1. All drawings and designs remain subject to client approval. The attached technical specification shall be considered the governing reference for manufacturing and installation.

2. As part of our quality-control procedures, we reserve the right to introduce, upgrade, or modify materials with equivalent or better performance where required.

3. For any queries or clarifications, please contact our sales team. We shall be pleased to assist you.`;

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
      className={`border border-gray-400 px-2 py-1.5 text-xs font-bold bg-gray-100 ${right ? "text-right" : center ? "text-center" : "text-left"}`}
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
      className={`border border-gray-400 px-2 py-1.5 text-xs ${right ? "text-right" : center ? "text-center" : "text-left"} ${bold ? "font-bold" : ""} ${green ? "text-green-700 font-bold" : ""} ${red ? "text-red-600 font-bold" : ""}`}
    >
      {children}
    </td>
  );
}

function LabelTd({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-gray-400 px-2 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap w-[18%]"
      style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
      {children}
    </td>
  );
}

export function DocumentPrint({ data }: { data: DocumentData }) {
  const co = COMPANIES[data.companyId] ?? COMPANIES[1];
  const coName = data.companyRef ?? co.name;
  const defaultLogo = data.companyId === 1 ? "/prime-max-logo.png" : undefined;
  const companyLogo = data.companyLogo ?? defaultLogo;
  const isDelivery = data.type === "delivery_note";
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
          @page { size: A4 portrait; margin: 8mm; }
          body * { visibility: hidden; }
          .print-doc, .print-doc * { visibility: visible; }
          .print-doc { position: absolute; left: 0; top: 0; width: 100%; max-width: 100% !important;
            box-shadow: none !important; border: none !important; padding: 4mm !important;
            margin: 0 !important; border-radius: 0 !important; }
          .print-page-break {
            page-break-before: always !important; break-before: page !important;
            page-break-inside: avoid !important; break-inside: avoid !important;
          }
          .print-spec-table td, .print-spec-table th {
            font-size: 7.5pt !important; padding: 1.5pt 4pt !important; line-height: 1.25 !important;
          }
          .print-tc-text {
            font-size: 8pt !important; line-height: 1.4 !important; padding: 6pt 8pt !important;
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
        }
      `}</style>

      <div className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[850px] mx-auto p-6 shadow-lg rounded-lg">

        {/* ── LETTERHEAD ─────────────────────────────────────────────── */}
        <div className="border-2 border-gray-700 mb-3">
          <div className="bg-[#0f2d5a] text-white py-3 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Company Logo"
                className="object-contain rounded bg-white p-1 flex-shrink-0"
                style={{ maxHeight: 64, maxWidth: 140, height: "auto" }}
              />
            )}
            <div className={companyLogo ? "flex-1" : "flex-1 text-center"}>
              <div className="text-[22px] font-black tracking-wider uppercase">{coName}</div>
              <div className="text-[11px] mt-0.5 opacity-90">{co.address} | TRN: {co.trn}</div>
              <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
            </div>
          </div>
          <div className="bg-[#1e6ab0] text-white text-center py-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
            <span className="text-[15px] font-black tracking-widest uppercase">{DOC_TITLES[data.type]}</span>
          </div>
        </div>

        {/* ── COMPANY / CLIENT + REFERENCE (4-column) ─────────────────── */}
        {isPO ? (
          <>
            <table className="w-full border-collapse border border-gray-400 mb-3">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-gray-400 px-2 py-1.5 text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Buyer (Our Company)</th>
                  <th colSpan={2} className="border border-gray-400 px-2 py-1.5 text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Supplier Detail</th>
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
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <thead>
              <tr>
                <th colSpan={2} className="border border-gray-400 px-2 py-1.5 text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Company Detail</th>
                <th colSpan={2} className="border border-gray-400 px-2 py-1.5 text-[11px] font-bold text-white text-left" style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Client &amp; Project Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr><LabelTd>Company</LabelTd><Td>{coName}</Td><LabelTd>Company</LabelTd><Td>{data.clientName}</Td></tr>
              <tr><LabelTd>Contact Person</LabelTd><Td>{co.contact}</Td><LabelTd>Contact Person</LabelTd><Td>{clientContact !== "—" ? clientContact : ""}</Td></tr>
              <tr><LabelTd>Contact #</LabelTd><Td>{co.phone}</Td><LabelTd>Contact #</LabelTd><Td>{data.clientPhone ?? ""}</Td></tr>
              <tr><LabelTd>Email</LabelTd><Td>{co.email}</Td><LabelTd>Email</LabelTd><Td>{data.clientEmail ?? ""}</Td></tr>
              <tr>
                <LabelTd>Project Ref</LabelTd><Td>{data.projectRef ?? data.projectName ?? ""}</Td>
                <LabelTd>{REF_LABELS[data.type]}</LabelTd><Td><span className="font-bold font-mono">{data.docNumber}</span></Td>
              </tr>
              <tr>
                <LabelTd>Project / Site</LabelTd><Td>{data.projectLocation ?? data.deliveryLocation ?? ""}</Td>
                {isTax ? (
                  <><LabelTd>Invoice Date</LabelTd><Td>{docDate}{data.supplyDate ? ` | Supply: ${data.supplyDate}` : ""}</Td></>
                ) : (
                  <><LabelTd>Date</LabelTd><Td>{docDate}{data.validity ? ` | Valid: ${data.validity}` : ""}</Td></>
                )}
              </tr>
              <tr><LabelTd>Customer TRN</LabelTd><Td>{co.trn}</Td><LabelTd>Customer TRN</LabelTd><Td>{customerTrn !== "—" ? customerTrn : ""}</Td></tr>
            </tbody>
          </table>
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
            <tr className="bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <Th center>S#</Th>
              <Th>Description</Th>
              <Th center>Size / Status</Th>
              {!isDelivery && <Th right>Price (AED)</Th>}
              <Th right>Qty.</Th>
              {!isDelivery && <Th right>Total (AED)</Th>}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <Td colSpan={isDelivery ? 3 : 6} center>
                  <span className="text-gray-400 italic">No items</span>
                </Td>
              </tr>
            )}
            {data.items.map((item, i) => (
              <tr key={i}>
                <Td center bold>{String(i + 1).padStart(2, "0")}</Td>
                <Td style={{ whiteSpace: "pre-line" }}>{item.description}</Td>
                <Td center>{item.sizeStatus ?? item.unit ?? "—"}</Td>
                {!isDelivery && <Td right>{item.unitPrice != null ? formatAED(item.unitPrice) : "—"}</Td>}
                <Td right>{item.quantity}</Td>
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
            {/* Project Items Subtotal row */}
            <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
              <tbody>
                <tr className="bg-gray-50">
                  <Td bold colSpan={4}>TOTAL AMOUNT IN WORDS = EXCLUDING VAT (PROJECT ITEMS)</Td>
                  <Td right bold>{formatAED(subtotal)}</Td>
                </tr>
                <tr>
                  <Td colSpan={5}>
                    <span className="font-semibold">In Words: </span>
                    <span className="italic">{numberToWords(subtotal)}</span>
                  </Td>
                </tr>
              </tbody>
            </table>

            {/* Additional Commercial Items (quotation + proforma) */}
            {(isQuotation || data.type === "proforma") && (
              <table className="w-full border-collapse border border-gray-400 mb-0 mt-0">
                <thead>
                  <tr className="bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <Th>Item</Th>
                    <Th right>Price (AED)</Th>
                    <Th right>Qty</Th>
                    <Th center>Status</Th>
                    <Th right>Total (AED)</Th>
                  </tr>
                </thead>
                <tbody>
                  {additionalItems.map((row, idx) => {
                    const rowTotal = (row.price ?? 0) * (row.quantity ?? 1);
                    return (
                      <tr key={idx}>
                        <Td>{row.description}</Td>
                        <Td right>
                          {row.status === "Included" && (row.price ?? 0) > 0
                            ? formatAED(row.price!)
                            : "—"}
                        </Td>
                        <Td right>
                          {row.status === "Included" ? (row.quantity ?? 1) : "—"}
                        </Td>
                        <Td center>
                          <span className={row.status === "Included" ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                            {row.status}
                          </span>
                        </Td>
                        <Td right>
                          {row.status === "Included"
                            ? (rowTotal > 0 ? formatAED(rowTotal) : "Included")
                            : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Grand Total block */}
            <table className="w-full border-collapse border border-gray-400 mt-0" style={{ marginBottom: 0 }}>
              <tbody>
                <tr className="bg-gray-50" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <Td bold colSpan={4}>TOTAL AMOUNT IN WORDS = EXCLUDING VAT</Td>
                  <Td right bold>{formatAED(subtotal)}</Td>
                </tr>
                <tr>
                  <Td colSpan={5}>
                    <span className="font-semibold">In Words: </span>
                    <span className="italic">{numberToWords(subtotal)}</span>
                  </Td>
                </tr>
              </tbody>
            </table>

            {/* Bank Details (left, invoices only) + Totals (right) side-by-side.
                Bank details are intentionally hidden on quotations and shown only
                on proforma / tax invoices. */}
            <div className="flex border-l border-r border-b border-gray-400 mb-0">
              {/* Bank Details — hidden on quotations */}
              {!isQuotation && (
                <div className="flex-1 border-r border-gray-400 p-2 bg-gray-50" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  {co.bank ? (
                    <>
                      <div className="font-black text-[11px] uppercase mb-1 text-[#0f2d5a]">Bank Details</div>
                      <div className="text-[10px] font-semibold mb-1 text-[#0f2d5a]">
                        All cheques shall be prepared in favor of "{co.name}".
                      </div>
                      <table className="text-[10px] w-full">
                        <tbody>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">Bank Name</td><td className="font-semibold">{co.bank.bankName}</td></tr>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">Account Title</td><td className="font-semibold">{co.bank.accountTitle}</td></tr>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">Account Number</td><td className="font-semibold">{co.bank.accountNumber}</td></tr>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">IBAN</td><td className="font-semibold">{co.bank.iban}</td></tr>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">Swift Code</td><td className="font-semibold">{co.bank.swift}</td></tr>
                          <tr><td className="pr-2 text-gray-500 whitespace-nowrap py-0.5">Currency</td><td className="font-semibold">{co.bank.currency}</td></tr>
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="text-[10px] text-gray-400 italic">No bank details configured</div>
                  )}
                </div>
              )}

              {/* Totals — full width on quotations, right column otherwise */}
              <div className={isQuotation ? "ml-auto w-72 flex-shrink-0" : "w-72 flex-shrink-0"}>
                <table className="w-full border-collapse text-[12px]">
                  <tbody>
                    {(data.discount ?? 0) > 0 && (
                      <tr>
                        <td className="border-b border-gray-300 px-2 py-1">Discount ({data.discount}%)</td>
                        <td className="border-b border-gray-300 px-2 py-1 text-right">— {formatAED((subtotal * (data.discount ?? 0)) / 100)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="border-b border-gray-300 px-2 py-1">VAT {vat}%</td>
                      <td className="border-b border-gray-300 px-2 py-1 text-right">{formatAED(vatAmt)}</td>
                    </tr>
                    <tr className="bg-[#0f2d5a] text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <td className="px-2 py-2 font-black">GRAND TOTAL (AED)</td>
                      <td className="px-2 py-2 font-black text-right">{formatAED(grand)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grand Total in Words */}
            <table className="w-full border-collapse border border-gray-400 mb-3 mt-0">
              <tbody>
                <tr>
                  <Td colSpan={5}>
                    <span className="font-semibold">Grand Total in Words: </span>
                    <span className="italic">{numberToWords(grand)}</span>
                  </Td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* ── PAYMENT TERMS ───────────────────────────────────────────── */}
        {data.paymentTerms && !isDelivery && (
          <div className="border border-gray-400 p-2 mb-3 bg-gray-50">
            <span className="font-bold">Payment Terms: </span>{data.paymentTerms}
          </div>
        )}

        {/* ── NOTES ───────────────────────────────────────────────────── */}
        {data.notes && (
          <div className="border border-gray-400 p-2 mb-3 bg-gray-50">
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
          <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 border-t pt-2">
            <span>MA ERP-CRM</span>
            <span className="font-semibold text-gray-500">Page 1 of 3</span>
          </div>
        )}
        {!isQuotation && (
          <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 border-t pt-2">
            <span>MA ERP-CRM</span>
            <span className="font-semibold text-gray-500">Page 1 of 1</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 2 — TECHNICAL SPECIFICATIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && (
          <div className="print-page-break mt-8">
            {/* Page 2 Letterhead */}
            <div className="border-2 border-gray-700 mb-3">
              <div className="bg-[#0f2d5a] text-white py-3 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 64, maxWidth: 140, height: "auto" }} />
                )}
                <div className={companyLogo ? "flex-1" : "flex-1 text-center"}>
                  <div className="text-[22px] font-black tracking-wider uppercase">{coName}</div>
                  <div className="text-[11px] mt-0.5 opacity-90">{co.address} | TRN: {co.trn}</div>
                  <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div className="bg-[#1e6ab0] text-white text-center py-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span className="text-[15px] font-black tracking-widest uppercase">TECHNICAL SPECIFICATION</span>
              </div>
            </div>

            <table className="print-spec-table w-full border-collapse border border-gray-400 mb-3">
              <thead>
                <tr className="bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <th className="border border-gray-400 px-2 py-1.5 text-xs font-bold text-center w-8">Pt.</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-xs font-bold text-left" colSpan={2}>
                    TECHNICAL SPECIFICATION DETAIL
                  </th>
                </tr>
              </thead>
              <tbody>
                {TECH_SPECS.map((section, si) => (
                  <React.Fragment key={si}>
                    <tr className="bg-gray-200" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <td className="border border-gray-400 px-2 py-1 font-bold text-xs text-center">
                        {si + 1}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 font-bold text-xs uppercase" colSpan={2}>
                        {section.title}
                      </td>
                    </tr>
                    {section.points.map((pt, pi) => (
                      <tr key={pi}>
                        <td className="border border-gray-400 px-2 py-1 text-xs text-center align-top font-semibold text-gray-500">
                          {String.fromCharCode(97 + pi)}.
                        </td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs" colSpan={2}>{pt}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 border-t pt-2">
              <span>MA ERP-CRM</span>
              <span className="font-semibold text-gray-500">Page 2 of 3</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 3 — TERMS & CONDITIONS (Quotation only)
        ══════════════════════════════════════════════════════════════ */}
        {isQuotation && (
          <div className="print-page-break mt-8">
            {/* Page 3 Letterhead */}
            <div className="border-2 border-gray-700 mb-3">
              <div className="bg-[#0f2d5a] text-white py-3 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {companyLogo && (
                  <img src={companyLogo} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 64, maxWidth: 140, height: "auto" }} />
                )}
                <div className={companyLogo ? "flex-1" : "flex-1 text-center"}>
                  <div className="text-[22px] font-black tracking-wider uppercase">{coName}</div>
                  <div className="text-[11px] mt-0.5 opacity-90">{co.address} | TRN: {co.trn}</div>
                  <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                </div>
              </div>
              <div className="bg-[#1e6ab0] text-white text-center py-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                <span className="text-[15px] font-black tracking-widest uppercase">TERMS &amp; CONDITIONS</span>
              </div>
            </div>

            <div className="print-tc-text border border-gray-400 p-4 text-[11px] whitespace-pre-line bg-gray-50 mb-4" style={{ lineHeight: "1.7" }}>
              {data.termsConditions ?? STANDARD_TC}
            </div>

            {/* Signature */}
            <div className="mt-6 grid grid-cols-2 gap-8 text-xs border-t border-gray-400 pt-4">
              <div>
                <div className="font-bold mb-1">Prepared by:</div>
                <div className="text-gray-700 font-semibold">{data.preparedByName ?? `"${coName}"`}</div>
                {data.preparedBySignatureUrl ? (
                  <img src={data.preparedBySignatureUrl} alt="Signature" className="h-12 mt-2 mb-1 object-contain" style={{ maxWidth: 160 }} />
                ) : (
                  <div className="h-10 mt-2 mb-1" />
                )}
                <div className="border-t border-gray-500 pt-1 text-gray-500">Signature: ____________________</div>
              </div>
              <div className="text-right">
                <div className="font-bold mb-1">For &amp; on behalf of</div>
                <div className="font-bold text-[13px]">{coName}</div>
                <div className="h-10 mt-2 mb-1" />
                <div className="border-t border-gray-500 pt-1 text-gray-500">Authorised Signatory</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 border-t pt-2">
              <span>MA ERP-CRM</span>
              <span className="font-semibold text-gray-500">Page 3 of 3</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
