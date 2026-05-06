import { forwardRef } from "react";

export interface HandoverItem {
  description: string;
  quantity: number;
  unit: string;
}

export interface HandoverNoteDoc {
  honNumber: string;
  handoverDate?: string | null;
  clientName: string;
  lpoNumber?: string | null;
  projectRef?: string | null;
  projectDescription?: string | null;
  itemsHandedOver?: HandoverItem[] | string | null;
  receivedByName?: string | null;
  receivedByDesignation?: string | null;
  clientRepresentative?: string | null;
  notes?: string | null;
  companyId: number;
}

const COMPANIES: Record<number, {
  name: string; address: string; trn: string; phone: string;
  email: string; website: string; contact: string;
}> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
    trn: "105383255400003",
    phone: "056 616 3555",
    email: "sales@primemaxprefab.com",
    website: "www.primemaxprefab.com",
    contact: "ASIF LATIF",
  },
  2: {
    name: "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC",
    address: "Sajja Industrial Area, Sharjah, UAE",
    trn: "100345678900001",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    website: "www.eliteprefab.ae",
    contact: "General Manager",
  },
};

function fmtDate(d?: string | null) {
  if (!d) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const p = new Date(d);
  return isNaN(p.getTime()) ? d : p.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function parseItems(raw: HandoverItem[] | string | null | undefined): HandoverItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string) as HandoverItem[]; } catch { return []; }
}

function LabelTdHalf({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="border border-gray-400 px-2 py-[2px] text-[11px] font-semibold text-white whitespace-nowrap"
      style={{ width: "38%", backgroundColor: "#1e3a6e", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      {children}
    </td>
  );
}

function Td({ children, bold, center }: { children: React.ReactNode; bold?: boolean; center?: boolean }) {
  return (
    <td className={`border border-gray-400 px-2 py-[2px] text-xs ${center ? "text-center" : "text-left"} ${bold ? "font-bold font-mono" : ""}`}>
      {children}
    </td>
  );
}

export const HandoverNoteTemplate = forwardRef<HTMLDivElement, { doc: HandoverNoteDoc }>(
  ({ doc }, ref) => {
    const co = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const logoSrc = doc.companyId !== 2 ? "/prime-max-logo.png" : null;
    const dateFmt = fmtDate(doc.handoverDate);
    const items = parseItems(doc.itemsHandedOver).filter(i => i.description?.trim());
    const projDesc = doc.projectDescription?.trim() || "Prefabricated Construction Works";

    return (
      <div
        ref={ref}
        className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[794px] mx-auto shadow-lg rounded-lg overflow-hidden flex flex-col"
        style={{ minHeight: 1123 }}
      >
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            html, body { background: white !important; height: 297mm !important; overflow: hidden !important; }
            body * { visibility: hidden; }
            .print-doc, .print-doc * { visibility: visible; }
            .print-doc {
              position: absolute; left: 0; top: 0;
              width: 210mm !important; max-width: 210mm !important;
              height: 297mm !important; max-height: 297mm !important;
              box-shadow: none !important; border: none !important;
              padding: 0 !important; margin: 0 !important; border-radius: 0 !important;
              overflow: hidden !important;
              display: flex !important; flex-direction: column !important;
            }
            /* Compress header */
            .print-doc .py-2 { padding-top: 4pt !important; padding-bottom: 4pt !important; }
            .print-doc .text-\\[22px\\] { font-size: 15pt !important; }
            .print-doc .text-\\[15px\\] { font-size: 10pt !important; }
            .print-doc .text-\\[11px\\] { font-size: 7.5pt !important; }
            .print-doc .text-\\[10px\\] { font-size: 7pt !important; }
            .print-doc .text-\\[9px\\]  { font-size: 6.5pt !important; }
            .print-doc .text-xs        { font-size: 7.5pt !important; }
            /* Compress table cells */
            .print-doc td, .print-doc th { padding: 1pt 4pt !important; font-size: 7.5pt !important; }
            /* Compress body spacing */
            .print-doc .mb-1 { margin-bottom: 2pt !important; }
            .print-doc .mb-2 { margin-bottom: 3pt !important; }
            .print-doc .mb-3 { margin-bottom: 4pt !important; }
            .print-doc .mb-4 { margin-bottom: 5pt !important; }
            .print-doc .mt-1 { margin-top: 2pt !important; }
            .print-doc .mt-2 { margin-top: 3pt !important; }
            .print-doc .mt-4 { margin-top: 5pt !important; }
            .print-doc .mt-6 { margin-top: 8pt !important; }
            .print-doc .pt-3 { padding-top: 4pt !important; }
            .print-doc .px-4 { padding-left: 8pt !important; padding-right: 8pt !important; }
            .print-doc .p-3  { padding: 4pt !important; }
            .print-doc .leading-relaxed { line-height: 1.35 !important; }
            .print-doc .gap-4 { gap: 4pt !important; }
          }
        `}</style>

        {/* ── LETTERHEAD (identical to DocumentPrint) ── */}
        <div className="overflow-hidden mb-[2px]">
          <div
            className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4"
            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
          >
            {logoSrc && (
              <img
                src={logoSrc}
                alt="Company Logo"
                className="object-contain rounded bg-white p-1 flex-shrink-0"
                style={{ maxHeight: 60, maxWidth: 130, height: "auto" }}
              />
            )}
            <div className={`leading-tight ${logoSrc ? "flex-1" : "flex-1 text-center"}`}>
              <div className="text-[22px] font-black tracking-wider uppercase leading-none">{co.name}</div>
              <div className="text-[11px] mt-[3px] opacity-90">{co.address}</div>
              <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email} | Web: {co.website}</div>
            </div>
          </div>
          <div
            className="bg-[#1e6ab0] text-white text-center py-1"
            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
          >
            <span className="text-[15px] font-black tracking-widest uppercase">Handover Note / Certificate</span>
          </div>
        </div>

        {/* ── COMPANY DETAIL | CLIENT DETAIL (same as DocumentPrint) ── */}
        <div className="flex gap-2 mb-[2px]">
          <table className="flex-1 border-collapse border border-gray-400">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left"
                  style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                >
                  Company Detail
                </th>
              </tr>
            </thead>
            <tbody>
              <tr><LabelTdHalf>Company</LabelTdHalf><Td>{co.name}</Td></tr>
              <tr><LabelTdHalf>Contact Person</LabelTdHalf><Td>{co.contact}</Td></tr>
              <tr><LabelTdHalf>Contact #</LabelTdHalf><Td>{co.phone}</Td></tr>
              <tr><LabelTdHalf>Email</LabelTdHalf><Td>{co.email}</Td></tr>
              <tr><LabelTdHalf>Designation</LabelTdHalf><Td>{co.contact}</Td></tr>
              <tr><LabelTdHalf>HON Ref. No.</LabelTdHalf><Td bold>{doc.honNumber}</Td></tr>
              <tr><LabelTdHalf>Date of Handover</LabelTdHalf><Td>{dateFmt}</Td></tr>
            </tbody>
          </table>

          <table className="flex-1 border-collapse border border-gray-400">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left"
                  style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                >
                  Client DETAIL
                </th>
              </tr>
            </thead>
            <tbody>
              <tr><LabelTdHalf>Company</LabelTdHalf><Td>{doc.clientName}</Td></tr>
              <tr><LabelTdHalf>Contact Person</LabelTdHalf><Td>{doc.clientRepresentative || ""}</Td></tr>
              <tr><LabelTdHalf>Contact #</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>Email</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>Designation</LabelTdHalf><Td>{doc.receivedByDesignation || ""}</Td></tr>
              <tr><LabelTdHalf>LPO Reference</LabelTdHalf><Td>{doc.lpoNumber || "—"}</Td></tr>
              <tr><LabelTdHalf>Project Ref</LabelTdHalf><Td>{doc.projectRef || "—"}</Td></tr>
              <tr><LabelTdHalf>Project / Site</LabelTdHalf><Td>{""}</Td></tr>
            </tbody>
          </table>
        </div>

        {/* ── ITEMS TABLE (same navy header style as DocumentPrint line items) ── */}
        <table
          className="w-full border-collapse border border-gray-400 mb-0"
        >
          <thead>
            <tr
              style={{ backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
            >
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-8">S#</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-left">Description of Works / Materials</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-16">Qty.</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-16">Unit</th>
              <th className="border border-gray-400 px-2 py-[2px] text-xs font-bold text-white text-center w-24">Condition</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="border border-gray-400 px-2 py-[2px] text-xs text-center text-gray-400 italic"
                >
                  — To be completed upon project handover —
                </td>
              </tr>
            ) : items.map((item, i) => (
              <tr
                key={i}
                style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#dce6f1", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
              >
                <Td center bold>{String(i + 1).padStart(2, "0")}</Td>
                <td className="border border-gray-400 px-2 py-[2px] text-xs text-left">{item.description}</td>
                <Td center>{String(item.quantity)}</Td>
                <Td center>{item.unit}</Td>
                <Td center>Good Condition</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── BODY TEXT ── */}
        <div className="flex-1 flex flex-col px-4 pt-3 text-xs leading-relaxed text-black" style={{ paddingBottom: 12 }}>
          <p className="mb-2 text-justify">
            We, <strong>{co.name}</strong>, hereby certify that the above works, materials, and items have been
            duly completed and formally handed over to <strong className="uppercase">{doc.clientName}</strong>
            {doc.lpoNumber ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
            This Handover Note serves as the official record of project completion and delivery.
          </p>

          <p className="mb-3 text-justify">
            We confirm that all works listed above have been completed in accordance with the agreed specifications,
            applicable industry standards, and quality requirements. We hereby request your formal acknowledgement
            of this handover by signing below.
          </p>

          {doc.notes?.trim() && (
            <p className="mb-2 text-gray-600 italic"><strong>Note:</strong> {doc.notes}</p>
          )}

          {/* ── PREPARED BY / AUTHORISED SIGNATORY ── */}
          <div className="flex gap-8" style={{ marginTop: "auto" }}>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-black">Prepared by:</div>
              <div className="text-[11px] text-black">{co.contact}</div>
              <div className="border-t border-gray-500 mt-6 pt-1">
                <span className="text-[10px] text-gray-500">Signature: </span>
                <span className="text-[10px] text-gray-400">_______________</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-black">For &amp; on behalf of</div>
              <div className="text-[11px] font-black uppercase text-black">{co.name}</div>
              <div className="border-t border-gray-500 mt-6 pt-1">
                <span className="text-[10px] text-gray-500">Authorised Signatory</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="border-t-2 border-[#0f2d5a] px-4 py-1 text-center text-[9px] text-[#0f2d5a]"
          style={{ backgroundColor: "#1e6ab015", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
        >
          <div>{co.address} | Tel: {co.phone} | Email: {co.email} | {co.website}</div>
        </div>
      </div>
    );
  }
);
HandoverNoteTemplate.displayName = "HandoverNoteTemplate";
