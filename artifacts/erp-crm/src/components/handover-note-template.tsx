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
  signatureUrl?: string | null;
  stampUrl?: string | null;
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
    trn: "104200550200003",
    phone: "054 777 7862",
    email: "asif@eliteprefab.com",
    website: "www.eliteprefab.ae",
    contact: "Asif Latif",
  },
};

interface DocColors {
  headerBg: string;
  titleBg: string;
  titleGradient?: string;
  sectionHeaderBg: string;
  labelHalfBg: string;
  tableHeaderBg: string;
  oddRowBg: string;
  footerColor: string;
  footerBorderColor: string;
  footerBg: string;
  accentColor: string;
  sigBorderColor: string;
  sigTextColor: string;
}

const PRIME_COLORS: DocColors = {
  headerBg: "#0f2d5a",
  titleBg: "#1e6ab0",
  sectionHeaderBg: "#0f2d5a",
  labelHalfBg: "#1e3a6e",
  tableHeaderBg: "#0f2d5a",
  oddRowBg: "#dce6f1",
  footerColor: "#0f2d5a",
  footerBorderColor: "#0f2d5a",
  footerBg: "#1e6ab015",
  accentColor: "#0f2d5a",
  sigBorderColor: "#0f2d5a",
  sigTextColor: "#0f2d5a",
};

const ELITE_COLORS: DocColors = {
  headerBg: "#0D0D0D",
  titleBg: "#8B0000",
  titleGradient: "linear-gradient(90deg, #8B0000 0%, #C00000 50%, #8B0000 100%)",
  sectionHeaderBg: "#0D0D0D",
  labelHalfBg: "#1E1E1E",
  tableHeaderBg: "#0D0D0D",
  oddRowBg: "#F3F3F3",
  footerColor: "#0D0D0D",
  footerBorderColor: "#8B0000",
  footerBg: "#8B000010",
  accentColor: "#8B0000",
  sigBorderColor: "#8B0000",
  sigTextColor: "#8B0000",
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

function LabelTdHalf({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <td
      className="border border-gray-400 px-2 py-[2px] text-[11px] font-semibold text-white whitespace-nowrap"
      style={{ width: "38%", backgroundColor: bg, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
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
    const theme = doc.companyId === 2 ? ELITE_COLORS : PRIME_COLORS;
    const logoSrc = doc.companyId !== 2 ? "/prime-max-logo.png" : "/elite-prefab-logo.png";
    const dateFmt = fmtDate(doc.handoverDate);
    const items = parseItems(doc.itemsHandedOver).filter(i => i.description?.trim());
    const projDesc = doc.projectDescription?.trim() || "Prefabricated Construction Works";
    const ps = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

    return (
      <div
        ref={ref}
        className="print-doc bg-white text-black font-sans text-[13px] leading-snug max-w-[850px] mx-auto shadow-lg rounded-lg overflow-hidden flex flex-col"
        style={{ minHeight: 1123 }}
      >
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            html, body { background: white !important; }
            body * { visibility: hidden; }
            .print-doc, .print-doc * { visibility: visible; }
            .print-doc { position: absolute; left: 0; top: 0; width: 100%; max-width: 100% !important;
              box-shadow: none !important; border: none !important; padding: 0 !important;
              margin: 0 !important; border-radius: 0 !important;
              min-height: 0 !important; height: auto !important; overflow: visible !important; }
            .hon-page-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: white;
            }
            .print-sig-block {
              position: fixed;
              bottom: 28px;
              left: 0;
              right: 0;
              background: white;
            }
          }
        `}</style>

        {/* ── LETTERHEAD ── */}
        <div className="overflow-hidden mb-[2px]">
          <div
            className="text-white py-2 px-4 flex items-center gap-4"
            style={{ backgroundColor: theme.headerBg, ...ps }}
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
            className="text-white text-center py-1"
            style={{ background: theme.titleGradient ?? theme.titleBg, ...ps }}
          >
            <span className="text-[15px] font-black tracking-widest uppercase">Handover Note / Certificate</span>
          </div>
        </div>

        {/* ── COMPANY DETAIL | CLIENT DETAIL ── */}
        <div className="flex gap-2 mb-[2px]">
          <table className="flex-1 border-collapse border border-gray-400">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left"
                  style={{ backgroundColor: theme.sectionHeaderBg, ...ps }}
                >
                  Company Detail
                </th>
              </tr>
            </thead>
            <tbody>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Company</LabelTdHalf><Td>{co.name}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Contact Person</LabelTdHalf><Td>{co.contact}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Contact #</LabelTdHalf><Td>{co.phone}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Email</LabelTdHalf><Td>{co.email}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Designation</LabelTdHalf><Td>{co.contact}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>HON Ref. No.</LabelTdHalf><Td bold>{doc.honNumber}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Date of Handover</LabelTdHalf><Td>{dateFmt}</Td></tr>
            </tbody>
          </table>

          <table className="flex-1 border-collapse border border-gray-400">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left"
                  style={{ backgroundColor: theme.sectionHeaderBg, ...ps }}
                >
                  Client DETAIL
                </th>
              </tr>
            </thead>
            <tbody>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Company</LabelTdHalf><Td>{doc.clientName}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Contact Person</LabelTdHalf><Td>{doc.clientRepresentative || ""}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Contact #</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Email</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Designation</LabelTdHalf><Td>{doc.receivedByDesignation || ""}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>LPO Reference</LabelTdHalf><Td>{doc.lpoNumber || "—"}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Project Ref</LabelTdHalf><Td>{doc.projectRef || "—"}</Td></tr>
              <tr><LabelTdHalf bg={theme.labelHalfBg}>Project / Site</LabelTdHalf><Td>{""}</Td></tr>
            </tbody>
          </table>
        </div>

        {/* ── ITEMS TABLE ── */}
        <table className="w-full border-collapse border border-gray-400 mb-0">
          <thead>
            <tr style={{ backgroundColor: theme.tableHeaderBg, ...ps }}>
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
                <td colSpan={5} className="border border-gray-400 px-2 py-[2px] text-xs text-center text-gray-400 italic">
                  — To be completed upon project handover —
                </td>
              </tr>
            ) : items.map((item, i) => (
              <tr
                key={i}
                style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : theme.oddRowBg, ...ps }}
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
        <div className="flex-1 px-4 pt-3 pb-2 text-xs leading-relaxed text-black">
          <p className="mb-2 text-justify">
            We, <strong>{co.name}</strong>, hereby certify that the above-mentioned works, materials, and items
            have been duly completed and formally handed over to{" "}
            <strong className="uppercase">{doc.clientName}</strong>
            {doc.lpoNumber ? `, as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, under the project reference ${doc.projectRef}` : doc.projectDescription ? `, under the project reference ${projDesc}` : ""}.{" "}
            This Handover Note shall serve as the official record of project completion, delivery, and handover.
          </p>

          <p className="mb-2 text-justify">
            We confirm that all works listed above have been completed in accordance with the agreed specifications,
            approved requirements, applicable industry standards, and quality expectations. The supplied items have
            been inspected and handed over in good condition, and the project is considered completed from our side
            as per the agreed scope of work.
          </p>

          <p className="mb-2 text-justify">
            We kindly request your formal acknowledgement of this handover by signing below. Upon signing, it shall
            be understood that the materials/items have been received and accepted by your authorized representative,
            unless any written comments or observations are mentioned at the time of handover.
          </p>

          <p className="mb-3 text-justify">
            We appreciate your cooperation and thank you for choosing <strong>{co.name}</strong>. We look forward
            to supporting your future project requirements.
          </p>

          {doc.notes?.trim() && (
            <p className="mb-2 text-gray-600 italic"><strong>Note:</strong> {doc.notes}</p>
          )}

          {/* ── SIGNATURE BLOCK ── */}
          <div className="flex gap-0 w-full mb-4 border border-gray-300">
            <div className="flex-1 p-3 border-r border-gray-300">
              <div className="text-[10px] text-gray-500">Handed over by:</div>
              <div className="mt-6 pt-2" style={{ borderTop: `1px solid ${theme.sigBorderColor}` }}>
                <div className="text-[11px] font-semibold" style={{ color: theme.sigTextColor }}>Name &amp; Signature</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  For &amp; on behalf of <strong>{co.name}</strong>
                </div>
              </div>
            </div>
            <div className="flex-1 p-3 border-r border-gray-300">
              <div className="text-[10px] text-gray-500">Received &amp; Accepted by:</div>
              <div className="mt-6 pt-2" style={{ borderTop: `1px solid ${theme.sigBorderColor}` }}>
                <div className="text-[11px] font-semibold" style={{ color: theme.sigTextColor }}>
                  {doc.receivedByName || "Name, Signature & Stamp"}
                </div>
                <div className="text-[10px] text-gray-500 mt-1 uppercase">{doc.clientName}</div>
              </div>
            </div>
            <div className="flex-1 p-3">
              <div className="text-[10px] text-gray-500">Handover Date &amp; Time:</div>
              <div className="mt-2 text-[11px]" style={{ color: theme.sigTextColor }}>{dateFmt}</div>
              <div className="mt-4 pt-2" style={{ borderTop: `1px solid ${theme.sigBorderColor}` }}>
                <div className="text-[10px] text-gray-500">Date / Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOR & ON BEHALF — signature + stamp ── */}
        <div className="print-sig-block flex items-end justify-between text-xs pt-3 pb-3 px-4">
          <div>
            <div data-html2canvas-ignore="true" style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
              {doc.signatureUrl && (
                <img
                  src={doc.signatureUrl}
                  alt="Signature"
                  style={{ maxHeight: 56, maxWidth: 140, objectFit: "contain", opacity: 0.85 }}
                />
              )}
              {doc.stampUrl && (
                <img
                  src={doc.stampUrl}
                  alt="Stamp"
                  style={{ maxHeight: 150, maxWidth: 150, objectFit: "contain", opacity: 0.85 }}
                />
              )}
            </div>
            <div className="font-bold mb-0.5">For &amp; on behalf of</div>
            <div className="font-bold text-[13px]">{co.name}</div>
          </div>
          <div className="text-right">
            <div className="font-bold mb-0.5">For &amp; on behalf of</div>
            <div className="font-bold text-[13px]">{doc.clientName}</div>
          </div>
        </div>

        {/* ── DISCLAIMER ── */}
        <div className="px-4 pt-1 pb-1 text-center text-[8px] text-gray-400 italic">
          This is a computer generated document. No signature or stamp required.
        </div>

        {/* ── FOOTER ── */}
        <div
          className="hon-page-footer px-4 py-1 text-center text-[9px]"
          style={{ borderTop: `2px solid ${theme.footerBorderColor}`, color: theme.footerColor, backgroundColor: theme.footerBg, ...ps }}
        >
          <div>{co.address} | Tel: {co.phone} | Email: {co.email} | {co.website}</div>
        </div>
      </div>
    );
  }
);
HandoverNoteTemplate.displayName = "HandoverNoteTemplate";
