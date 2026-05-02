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

export type DocumentType = "quotation" | "proforma" | "tax_invoice" | "delivery_note" | "purchase_order";

export interface DocumentData {
  type: DocumentType;
  docNumber: string;
  companyId: number;
  companyRef?: string;
  clientName: string;
  clientContact?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientTrn?: string;
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
}

const COMPANIES: Record<number, CompanyInfo> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC",
    address: "Industrial Area 12, Sharjah, UAE",
    trn: "100234567890001",
    phone: "+971 50 2940 131",
    email: "info@primemaxprefab.com",
    contact: "ASIF LATIF",
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

const STANDARD_INCLUSIONS = [
  { label: "Transportation including RTA Permit", status: "Included" },
  { label: "Brand New SUPER GENERAL SPLIT AC UNIT", status: "Excluded" },
  { label: "Foundation Detail", status: "Excluded" },
  { label: "Staircase", status: "Excluded" },
  { label: "Additional Commercial Item", status: "Excluded" },
];

const TECH_SPECS = [
  {
    title: "BASE FRAME",
    points: [
      "Steel base & top frame: MS I-BEAM 120×64, full perimeter beams with central runner and cross members.",
      "Lifting eyes at intermediate points at base of cabin; painted with 01 coat red oxide primer and 01 coat matt enamel paint.",
      "Base frame painted with 02 coats: one red oxide, one rust-free enamel paint.",
    ],
  },
  {
    title: "FLOOR SYSTEM",
    points: [
      "Floor Frame: MS angle 50×50×2.7mm welded into base/top frame (400mm joist spacing). Grit blasted SA2.5 + 02 coat epoxy paint.",
      "Floor Decking: 18mm thick cement board, bottom painted with bitumen paint.",
      "Floor Finish – Dry Area: 1.5mm PVC vinyl sheet.",
      "Floor Finish – Wet Area: 1.5mm PVC vinyl sheet.",
    ],
  },
  {
    title: "WALL SYSTEM",
    points: [
      "External Finish: 6mm cement board with heavy texture paint (approved colour); joints covered by 6mm CFB strips.",
      "Internal Finish (Dry): 12.5mm gypsum board + emulsion paint (off-white). MDF 50mm / PVC 75mm skirting.",
      "Internal Finish (Wet): 12mm MR gypsum board on LGS framing + MDF 5cm skirting.",
      "Wall Framing: LGS GI studs 70×35×0.45mm at 610mm vertical / 1200mm horizontal spacing.",
      "Wall Insulation: 50mm glass-wool, 12 kg/m³ density.",
    ],
  },
  {
    title: "ROOFING & CEILING",
    points: [
      "Roof: 0.5mm GI corrugated steel on furry-channel purlins; trusses from MS Angle 40×40×2.7mm.",
      "Ceiling (Dry & Wet): 12mm gypsum board with fine texture paint.",
    ],
  },
  {
    title: "DOORS",
    points: [
      "External Door: Aluminium/PVC, 900×2100mm. Mortice lockset with cylinder and SS handles.",
      "Internal / Toilet Door: 900/700×2100mm PVC door. Single cylinder with thumb-turn latch for toilet doors.",
    ],
  },
  {
    title: "WINDOWS",
    points: [
      "External: Powder-coated aluminium (non-thermal break), 6mm clear glass, hinged, 900×900mm.",
      "Exhaust: Powder-coated aluminium, fixed, obscure glass, 400×400mm.",
    ],
  },
  {
    title: "ELECTRICAL",
    points: [
      "Conduits and wiring: National / Du-Cab / RR brands.",
      "Ceiling lights: 36W tube light by MAX.",
    ],
  },
];

const STANDARD_TC = `1. COMMERCIAL BASIS
• Prices are quoted per the attached specification. Any revision or additional requirement is a variation priced separately.
• Unless included, the customer shall provide crane support, foundation, safe offloading access, and all site arrangements.
• Commercial basis: Ex-factory. All cheques in favour of the company name above.

2. EXCLUSIONS
• Offloading, excavation, foundation works, and on-site civil works (unless included).
• Third-party inspections, testing, statutory approvals, and authority clearances.
• Window blinds, fire extinguishers, smoke detectors, fire alarm systems, and similar items unless expressly included.
• Third-party certification costs for welding, painting, and lifting eye inspections.
• Design calculations and certifications (live load, dead load, wind load).
• Replaceable wear items: lights, wash-basin/shower mixers, cistern covers, door handles.

3. PAYMENT TERMS
• 75% advance upon receipt of LPO and approved drawings.
• 25% balance before delivery.
• All cheques in favour of the company name above.

4. TECHNICAL & GENERAL NOTES
• Drawings remain subject to client approval. The attached specification is the governing manufacturing reference.
• We reserve the right to upgrade or substitute materials with equal or better performance.
• For queries, contact our sales team.`;

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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`border border-gray-400 px-2 py-1.5 text-xs font-bold bg-gray-100 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right, center, bold, colSpan }: { children: React.ReactNode; right?: boolean; center?: boolean; bold?: boolean; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-gray-400 px-2 py-1.5 text-xs ${right ? "text-right" : center ? "text-center" : "text-left"} ${bold ? "font-bold" : ""}`}
    >
      {children}
    </td>
  );
}

export function DocumentPrint({ data }: { data: DocumentData }) {
  const co = COMPANIES[data.companyId] ?? COMPANIES[1];
  const coName = data.companyRef ?? co.name;
  const isDelivery = data.type === "delivery_note";
  const isQuotation = data.type === "quotation";
  const isTax = data.type === "tax_invoice";
  const isPO = data.type === "purchase_order";
  const vat = data.vatPercent ?? 5;
  const subtotal = data.subtotal ?? data.items.reduce((s, i) => s + (i.total ?? (i.unitPrice ?? 0) * i.quantity), 0);
  const vatAmt = data.vatAmount ?? (subtotal * vat / 100);
  const grand = data.grandTotal;
  const docDate = data.invoiceDate ?? data.date ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; color-adjust: exact; }
          .print-doc { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      <div className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[850px] mx-auto p-6 shadow-lg rounded-lg">

        {/* ── LETTERHEAD ─────────────────────────────────────────────── */}
        <div className="border-2 border-gray-700 mb-3">
          <div className="bg-[#0f2d5a] text-white text-center py-3 px-4">
            <div className="text-[22px] font-black tracking-wider uppercase">{coName}</div>
            <div className="text-[11px] mt-0.5 opacity-90">{co.address} | TRN: {co.trn}</div>
            <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}</div>
          </div>

          {/* Document title strip */}
          <div className="bg-[#1e6ab0] text-white text-center py-2">
            <span className="text-[15px] font-black tracking-widest uppercase">{DOC_TITLES[data.type]}</span>
          </div>
        </div>

        {/* ── COMPANY / CLIENT HEADER ─────────────────────────────────── */}
        {isPO ? (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <thead>
              <tr>
                <Th>Buyer (Our Company)</Th>
                <Th>Supplier Detail</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td><span className="font-semibold">Company: </span>{coName}</Td>
                <Td><span className="font-semibold">Supplier: </span>{data.supplierName ?? data.clientName}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Contact Person: </span>{co.contact}</Td>
                <Td><span className="font-semibold">Contact Person: </span>{data.supplierContact ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Contact #: </span>{co.phone}</Td>
                <Td><span className="font-semibold">Contact #: </span>{data.supplierPhone ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Email: </span>{co.email}</Td>
                <Td><span className="font-semibold">Email: </span>{data.supplierEmail ?? "—"}</Td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <thead>
              <tr>
                <Th>Company Detail</Th>
                <Th>Client &amp; Project Detail</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td><span className="font-semibold">Company: </span>{coName}</Td>
                <Td><span className="font-semibold">Company: </span>{data.clientName}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Contact Person: </span>{co.contact}</Td>
                <Td><span className="font-semibold">Contact Person: </span>{data.clientContact ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Contact #: </span>{co.phone}</Td>
                <Td><span className="font-semibold">Contact #: </span>{data.clientPhone ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Email: </span>{co.email}</Td>
                <Td><span className="font-semibold">Email: </span>{data.clientEmail ?? "—"}</Td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── REFERENCE ROW ───────────────────────────────────────────── */}
        {isPO ? (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <tbody>
              <tr>
                <Td><span className="font-semibold">PO Number: </span><span className="font-bold font-mono">{data.docNumber}</span></Td>
                <Td><span className="font-semibold">Date: </span>{docDate}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Delivery Date: </span>{data.deliveryDate ?? "—"}</Td>
                <Td><span className="font-semibold">Payment Terms: </span>{data.paymentTerms ?? "—"}</Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Delivery Address: </span>{data.deliveryAddress ?? data.deliveryLocation ?? "—"}</Td>
                <Td><span className="font-semibold">Our TRN: </span>{co.trn}</Td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse border border-gray-400 mb-3">
            <tbody>
              <tr>
                <Td><span className="font-semibold">Project Ref.: </span>{data.projectRef ?? data.projectName ?? "—"}</Td>
                <Td><span className="font-semibold">{REF_LABELS[data.type]}: </span><span className="font-bold font-mono">{data.docNumber}</span></Td>
              </tr>
              <tr>
                <Td><span className="font-semibold">Project / Site: </span>{data.projectLocation ?? data.deliveryLocation ?? "—"}</Td>
                {isTax ? (
                  <Td><span className="font-semibold">Invoice Date: </span>{docDate}
                    {data.supplyDate ? <> &nbsp;|&nbsp; <span className="font-semibold">Supply Date: </span>{data.supplyDate}</> : null}
                  </Td>
                ) : (
                  <Td><span className="font-semibold">Date: </span>{docDate}
                    {data.validity ? <> &nbsp;|&nbsp; <span className="font-semibold">Valid Until: </span>{data.validity}</> : null}
                  </Td>
                )}
              </tr>
              <tr>
                <Td><span className="font-semibold">Our TRN: </span>{co.trn}</Td>
                <Td><span className="font-semibold">Customer TRN: </span>{data.clientTrn ?? "—"}</Td>
              </tr>
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
        <table className="w-full border-collapse border border-gray-400 mb-1">
          <thead>
            <tr className="bg-gray-100">
              <Th>S#</Th>
              <Th>Description</Th>
              <Th>Size / Specification</Th>
              {!isDelivery && <Th right>Unit Price (AED)</Th>}
              <Th right>Qty.</Th>
              {!isDelivery && <Th right>Total (AED)</Th>}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <Td colSpan={isDelivery ? 3 : 5} center><span className="text-gray-400 italic">No items</span></Td>
              </tr>
            )}
            {data.items.map((item, i) => (
              <tr key={i}>
                <Td center bold>{String(i + 1).padStart(2, "0")}</Td>
                <Td>{item.description}</Td>
                <Td>{item.sizeStatus ?? item.unit ?? "—"}</Td>
                {!isDelivery && <Td right>{item.unitPrice != null ? formatAED(item.unitPrice) : "—"}</Td>}
                <Td right>{item.quantity}</Td>
                {!isDelivery && <Td right bold>{item.total != null ? formatAED(item.total) : "—"}</Td>}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ───────────────────────────────────────────────────── */}
        {isPO && (
          <table className="w-full border-collapse border border-gray-400 mb-3">
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

        {/* ── TOTAL EXCL VAT (in words) ────────────────────────────────── */}
        {!isDelivery && !isPO && (
          <>
            <table className="w-full border-collapse border border-gray-400 mb-1">
              <tbody>
                <tr className="bg-gray-50">
                  <Td bold>TOTAL AMOUNT (EXCLUDING VAT)</Td>
                  <Td right bold>{formatAED(subtotal)}</Td>
                </tr>
                <tr>
                  <Td><span className="font-semibold">In Words: </span><span className="italic">{numberToWords(subtotal)}</span></Td>
                  <Td right>{" "}</Td>
                </tr>
              </tbody>
            </table>

            {/* ── INCLUSIONS / EXCLUSIONS (quotation + proforma only) ─── */}
            {(isQuotation || data.type === "proforma") && (
              <table className="w-full border-collapse border border-gray-400 mb-1">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {STANDARD_INCLUSIONS.map((row) => (
                    <tr key={row.label}>
                      <Td>{row.label}</Td>
                      <Td>
                        <span className={`font-bold ${row.status === "Included" ? "text-green-700" : "text-red-600"}`}>
                          {row.status}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ── GRAND TOTAL BLOCK ────────────────────────────────────── */}
            <table className="w-full border-collapse border border-gray-400 mb-3">
              <tbody>
                {(data.discount ?? 0) > 0 && (
                  <tr>
                    <Td>Discount ({data.discount}%)</Td>
                    <Td right>— AED {formatAED((subtotal * (data.discount ?? 0)) / 100)}</Td>
                  </tr>
                )}
                <tr>
                  <Td>VAT {vat}%</Td>
                  <Td right>{formatAED(vatAmt)}</Td>
                </tr>
                <tr className="bg-[#0f2d5a] text-white">
                  <td className="border border-gray-400 px-2 py-2 text-sm font-black">GRAND TOTAL (AED)</td>
                  <td className="border border-gray-400 px-2 py-2 text-sm font-black text-right">{formatAED(grand)}</td>
                </tr>
                <tr>
                  <Td colSpan={2}>
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

        {/* ── TECHNICAL SPECIFICATIONS (Quotation only) ───────────────── */}
        {isQuotation && (
          <div className="mt-4">
            <div className="bg-[#0f2d5a] text-white px-3 py-1.5 font-black text-[13px] uppercase tracking-wide mb-0">
              Technical Specifications
            </div>
            {data.techSpecs ? (
              <div className="border border-gray-400 p-3 text-[11px] whitespace-pre-line bg-gray-50">
                {data.techSpecs}
              </div>
            ) : (
              <table className="w-full border-collapse border border-gray-400 mb-3">
                <tbody>
                  {TECH_SPECS.map((section, si) => (
                    <React.Fragment key={si}>
                      <tr className="bg-gray-200">
                        <td className="border border-gray-400 px-2 py-1 font-bold text-xs uppercase" colSpan={2}>
                          {String.fromCharCode(65 + si)}. {section.title}
                        </td>
                      </tr>
                      {section.points.map((pt, pi) => (
                        <tr key={pi}>
                          <td className="border border-gray-400 px-2 py-1 text-xs w-6 text-center align-top font-semibold">
                            {String.fromCharCode(97 + pi)}.
                          </td>
                          <td className="border border-gray-400 px-2 py-1 text-xs">{pt}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TERMS & CONDITIONS ───────────────────────────────────────── */}
        {(isQuotation || data.termsConditions) && (
          <div className="mt-2">
            <div className="bg-[#0f2d5a] text-white px-3 py-1.5 font-black text-[13px] uppercase tracking-wide mb-0">
              Terms &amp; Conditions
            </div>
            <div className="border border-gray-400 p-3 text-[11px] whitespace-pre-line bg-gray-50">
              {data.termsConditions ?? STANDARD_TC}
            </div>
          </div>
        )}

        {/* ── SIGNATURE BLOCK ─────────────────────────────────────────── */}
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

        <div className="mt-4 text-center text-[10px] text-gray-400 border-t pt-2">
          This document was generated by Prime Max &amp; Elite Prefab Smart ERP CRM System
        </div>
      </div>
    </>
  );
}
