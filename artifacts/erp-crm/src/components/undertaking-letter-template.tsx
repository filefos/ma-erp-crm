import { forwardRef } from "react";

export interface UndertakingLetterDoc {
  ulNumber: string;
  letterDate?: string | null;
  clientName: string;
  lpoNumber?: string | null;
  projectRef?: string | null;
  scope?: string | null;
  commitmentText?: string | null;
  signedByName?: string | null;
  signedDate?: string | null;
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
    trn: "100345678900001",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    website: "www.eliteprefab.ae",
    contact: "General Manager",
  },
};

const DEFAULT_MATERIALS = [
  "MS Steel: Fire-rated mild steel for structural components.",
  "GI Framing: Fire-rated galvanized iron framing for support structures.",
  "Gypsum Board 12.5 mm thick — 01 Hour Fire Rated.",
  "Cement Board 06 mm thick — 01 Hour Fire Rated.",
];

function fmtDate(d?: string | null) {
  if (!d) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const p = new Date(d);
  return isNaN(p.getTime()) ? d : p.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={`border border-gray-400 px-2 py-[2px] text-xs text-left ${bold ? "font-bold font-mono" : ""}`}>
      {children}
    </td>
  );
}

function MaterialLines({ text }: { text?: string | null }) {
  const lines = text?.trim()
    ? text.split("\n").map(l => l.trim()).filter(Boolean)
    : DEFAULT_MATERIALS;
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} className="text-xs leading-snug mb-1">{l}</p>
      ))}
    </>
  );
}

export const UndertakingLetterTemplate = forwardRef<HTMLDivElement, { doc: UndertakingLetterDoc }>(
  ({ doc }, ref) => {
    const co = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const logoSrc = doc.companyId !== 2 ? "/prime-max-logo.png" : "/elite-prefab-logo.svg";
    const dateFmt = fmtDate(doc.letterDate);
    const projectDesc = doc.scope?.trim() || "Prefabricated Construction Works";

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
            .ul-page-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: white;
            }
            .print-sig-block {
              position: fixed;
              bottom: 50px;
              left: 50px;
              background: white;
            }
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
            <span className="text-[15px] font-black tracking-widest uppercase">Undertaking Letter</span>
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
              <tr><LabelTdHalf>UL Ref. No.</LabelTdHalf><Td bold>{doc.ulNumber}</Td></tr>
              <tr><LabelTdHalf>Date</LabelTdHalf><Td>{dateFmt}</Td></tr>
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
              <tr><LabelTdHalf>Contact Person</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>Contact #</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>Email</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>Designation</LabelTdHalf><Td>{""}</Td></tr>
              <tr><LabelTdHalf>LPO Reference</LabelTdHalf><Td>{doc.lpoNumber || "—"}</Td></tr>
              <tr><LabelTdHalf>Project Ref</LabelTdHalf><Td>{doc.projectRef || "—"}</Td></tr>
              <tr><LabelTdHalf>Project / Scope</LabelTdHalf><Td>{projectDesc}</Td></tr>
            </tbody>
          </table>
        </div>

        {/* ── SUBJECT BAR ── */}
        <div
          className="mx-0 mb-[2px] px-3 py-1 border border-gray-300"
          style={{ backgroundColor: "#edf2f9" }}
        >
          <span className="text-[11px] font-bold text-[#0f2d5a]">Subject: </span>
          <span className="text-[11px] font-bold text-black">Undertaking Letter for Use of Fire-Rated Materials</span>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 px-4 pt-3 pb-10 text-xs leading-relaxed text-black">
          <p className="mb-2">
            To,<br />
            <strong className="uppercase">{doc.clientName}</strong>
          </p>

          <p className="mb-2">Dear Team,</p>

          <p className="mb-2 text-justify">
            We, <strong>{co.name}</strong>, located at {co.address}, hereby provide this undertaking
            in reference to the use of fire-rated materials for{" "}
            <strong>{projectDesc}</strong>
            {doc.lpoNumber ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
          </p>

          <p className="mb-2">We solemnly affirm and undertake that:</p>

          <p className="mb-1 font-bold">Commitment to using the following fire-rated materials:</p>

          <div className="mb-3 pl-2">
            <MaterialLines text={doc.commitmentText} />
          </div>

          <p className="mb-2 text-justify">
            <strong>Responsibility:</strong>{" "}
            {co.name} accepts full responsibility for the quality and performance of the fire-rated materials
            specified above. We will ensure that these materials are sourced from reputable suppliers and are
            installed according to manufacturer guidelines and industry best practices.
          </p>

          <p className="mb-2 text-justify">
            We trust that this undertaking satisfies the requirements and provides the necessary assurance
            regarding our commitment to fire safety and the use of fire-rated materials. Should there be any
            additional requirements or modifications needed, please do not hesitate to inform us.
          </p>

          {doc.notes?.trim() && (
            <p className="mb-2 text-gray-600 italic">{doc.notes}</p>
          )}

          <p className="mb-4">Thank you for your cooperation and understanding.</p>


        </div>

        {/* ── SIGNATURE BLOCK — fixed above footer in print ── */}
        <div className="print-sig-block px-4 pb-1">
          <div className="flex items-end justify-between">
            {/* LEFT: signature + stamp + "For & on behalf of [our company]" */}
            <div>
              {doc.stampUrl && (
                <div data-html2canvas-ignore="true" style={{ marginBottom: 4 }}>
                  <img
                    src={doc.stampUrl}
                    alt="Stamp"
                    style={{ maxHeight: 150, maxWidth: 150, objectFit: "contain", opacity: 0.85 }}
                  />
                </div>
              )}
              {doc.signatureUrl && (
                <div data-html2canvas-ignore="true" style={{ marginBottom: 4 }}>
                  <img
                    src={doc.signatureUrl}
                    alt="Signature"
                    style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", opacity: 0.85 }}
                  />
                </div>
              )}
              <div className="text-[10px] text-gray-600">For &amp; on behalf of</div>
              <div className="text-[11px] font-black uppercase">{co.name}</div>
            </div>

          </div>

          {/* Disclaimer */}
          <div className="text-center text-[8px] text-gray-400 italic pt-1">
            This is a computer generated document. No signature or stamp required.
          </div>
        </div>

        {/* ── FOOTER — fixed to bottom in print ── */}
        <div
          className="ul-page-footer border-t-2 border-[#0f2d5a] px-4 py-1 text-center text-[9px] text-[#0f2d5a]"
          style={{ backgroundColor: "#1e6ab015", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
        >
          <div>{co.address} | Tel: {co.phone} | Email: {co.email} | {co.website}</div>
        </div>
      </div>
    );
  }
);
UndertakingLetterTemplate.displayName = "UndertakingLetterTemplate";
