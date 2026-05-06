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

const COMPANIES: Record<number, { name: string; address: string; trn: string; phone: string; email: string; website: string }> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
    trn: "105383255400003",
    phone: "056 616 3555",
    email: "sales@primemaxprefab.com",
    website: "www.primemaxprefab.com",
  },
  2: {
    name: "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC",
    address: "Sajja Industrial Area, Sharjah, UAE",
    trn: "100345678900001",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    website: "www.eliteprefab.ae",
  },
};

const NAVY = "#0f2d5a";
const SKY = "#1e6ab0";

function fmtDate(d?: string | null) {
  if (!d) return new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
  const p = new Date(d);
  return isNaN(p.getTime()) ? d : p.toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
}

function parseItems(raw: HandoverItem[] | string | null | undefined): HandoverItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string) as HandoverItem[]; } catch { return []; }
}

export const HandoverNoteTemplate = forwardRef<HTMLDivElement, { doc: HandoverNoteDoc }>(
  ({ doc }, ref) => {
    const co = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const isElite = doc.companyId === 2;
    const logoSrc = isElite ? null : "/erp-crm/prime-max-logo.png";
    const handoverDateFmt = fmtDate(doc.handoverDate);
    const items = parseItems(doc.itemsHandedOver).filter(i => i.description?.trim());

    const cellStyle: React.CSSProperties = {
      border: `1px solid #c8d8ec`,
      padding: "5px 10px",
      fontSize: 11,
      color: "#1a1a1a",
      verticalAlign: "top" as const,
    };
    const hdrCellStyle: React.CSSProperties = {
      ...cellStyle,
      background: NAVY,
      color: "white",
      fontWeight: 700,
      fontSize: 11,
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact",
    };
    const metaCellLabelStyle: React.CSSProperties = {
      border: `1px solid #c8d8ec`,
      padding: "5px 10px",
      fontSize: 10.5,
      fontWeight: 700,
      color: "white",
      background: "#1e3a6e",
      width: "28%",
      whiteSpace: "nowrap",
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact",
    };
    const metaCellValueStyle: React.CSSProperties = {
      border: `1px solid #c8d8ec`,
      padding: "5px 10px",
      fontSize: 10.5,
      color: "#1a1a1a",
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black mx-auto"
        style={{
          width: 794,
          fontFamily: "Georgia, 'Times New Roman', serif",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          position: "relative",
          boxShadow: "inset 0 0 0 1px #e8eef7",
        }}
      >
        {/* Top accent ribbons */}
        <div style={{ height: 6, background: NAVY }} />
        <div style={{ height: 2, background: SKY }} />

        {/* ── HEADER ── */}
        <div style={{ padding: "16px 44px 10px", borderBottom: `2px solid ${NAVY}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={co.name}
                  style={{ height: 48, width: "auto", objectFit: "contain", flexShrink: 0 }}
                />
              )}
              <div>
                <div style={{ color: NAVY, fontSize: 16, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.5 }}>
                  {co.name}
                </div>
                <div style={{ color: SKY, fontSize: 10, fontStyle: "italic", marginTop: 2 }}>
                  Excellence in Prefabricated Construction
                </div>
                <div style={{ color: "#444", fontSize: 9.5, marginTop: 1 }}>{co.address}</div>
                <div style={{ color: "#444", fontSize: 9.5 }}>
                  Tel: {co.phone} &nbsp;·&nbsp; Email: {co.email} &nbsp;·&nbsp; Web: {co.website}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10.5, color: NAVY, whiteSpace: "nowrap", minWidth: 180 }}>
              <div><strong>HON Ref.:</strong> {doc.honNumber}</div>
              <div style={{ marginTop: 3 }}><strong>Date:</strong> {handoverDateFmt}</div>
              {doc.lpoNumber && <div style={{ marginTop: 3 }}><strong>LPO Ref.:</strong> {doc.lpoNumber}</div>}
              {doc.projectRef && <div style={{ marginTop: 3 }}><strong>Project:</strong> {doc.projectRef}</div>}
            </div>
          </div>
        </div>

        {/* Document title bar */}
        <div
          style={{
            background: NAVY,
            color: "white",
            textAlign: "center",
            padding: "6px 0",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          } as React.CSSProperties}
        >
          Handover Note / Certificate
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, padding: "18px 44px 0" }}>

          {/* Addressee */}
          <div style={{ marginBottom: 14, fontSize: 11.5, lineHeight: 1.6, color: "#1a1a1a" }}>
            <div>To,</div>
            <div style={{ fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{doc.clientName}</div>
            {doc.clientRepresentative && (
              <div style={{ color: "#444", marginTop: 1 }}>{doc.clientRepresentative}</div>
            )}
          </div>

          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 14px", color: "#1a1a1a" }}>Dear Sir / Madam,</p>

          {/* Opening paragraph */}
          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 16px", color: "#1a1a1a" }}>
            We, <strong>{co.name}</strong>, hereby certify that the following works, materials, and items have
            been duly completed and formally handed over to <strong>{doc.clientName}</strong>
            {doc.lpoNumber ? `, as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}. This Handover Note serves as
            the official record of project completion and delivery.
          </p>

          {/* Reference meta table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 10.5 }}>
            <tbody>
              <tr>
                <td style={metaCellLabelStyle}>Project Reference</td>
                <td style={metaCellValueStyle}>{doc.projectRef || "—"}</td>
                <td style={metaCellLabelStyle}>LPO Reference</td>
                <td style={metaCellValueStyle}>{doc.lpoNumber || "—"}</td>
              </tr>
              <tr>
                <td style={metaCellLabelStyle}>Date of Handover</td>
                <td style={metaCellValueStyle}>{handoverDateFmt}</td>
                <td style={metaCellLabelStyle}>Handover Note No.</td>
                <td style={metaCellValueStyle}>{doc.honNumber}</td>
              </tr>
              {doc.projectDescription && (
                <tr>
                  <td style={metaCellLabelStyle}>Project Description</td>
                  <td style={{ ...metaCellValueStyle, borderLeft: `1px solid #c8d8ec` }} colSpan={3}>
                    {doc.projectDescription}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Items table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
              Items / Works Handed Over:
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...hdrCellStyle, width: 36, textAlign: "center" }}>S#</th>
                  <th style={{ ...hdrCellStyle, textAlign: "left" }}>Description of Works / Materials</th>
                  <th style={{ ...hdrCellStyle, width: 60, textAlign: "center" }}>Qty.</th>
                  <th style={{ ...hdrCellStyle, width: 60, textAlign: "center" }}>Unit</th>
                  <th style={{ ...hdrCellStyle, width: 100, textAlign: "center" }}>Condition</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: "#888", fontStyle: "italic" }}>
                      — To be completed upon project handover —
                    </td>
                  </tr>
                ) : items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#edf2f9" }}>
                    <td style={{ ...cellStyle, textAlign: "center", fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={cellStyle}>{item.description}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>{item.unit}</td>
                    <td style={{ ...cellStyle, textAlign: "center" }}>Good Condition</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirmation paragraph */}
          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 12px", color: "#1a1a1a" }}>
            We confirm that all works listed above have been completed in accordance with the agreed specifications,
            applicable industry standards, and quality requirements. We hereby request your formal acknowledgement
            of this handover by signing below.
          </p>

          {doc.notes?.trim() && (
            <p style={{ fontSize: 11, lineHeight: 1.7, margin: "0 0 12px", color: "#444", fontStyle: "italic" }}>
              <strong>Note:</strong> {doc.notes}
            </p>
          )}

          {/* Signature block */}
          <div style={{ display: "table", width: "100%", marginTop: 16, marginBottom: 16, fontSize: 11.5 }}>
            <div style={{ display: "table-row" }}>
              <div style={{ display: "table-cell", width: "50%", paddingRight: 24, verticalAlign: "top" }}>
                <div style={{ color: "#444" }}>Handed over by</div>
                <div style={{ fontWeight: 700, color: NAVY, marginTop: 2, letterSpacing: 0.3 }}>{co.name}</div>
                <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 46, color: NAVY, fontWeight: 600 }}>
                  {doc.receivedByName ? "Authorised Representative" : "Authorised Signatory"}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Name: _______________</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Date: _______________</div>
              </div>
              <div style={{ display: "table-cell", width: "50%", paddingLeft: 24, verticalAlign: "top" }}>
                <div style={{ color: "#444" }}>Received &amp; Accepted by</div>
                <div style={{ fontWeight: 700, color: NAVY, marginTop: 2 }}>{doc.clientName}</div>
                <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 46, color: NAVY, fontWeight: 600 }}>
                  {doc.receivedByName || "Authorised Signatory / Stamp"}
                </div>
                {doc.receivedByDesignation && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Designation: {doc.receivedByDesignation}</div>
                )}
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Date: _______________</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: `2px solid ${NAVY}`,
            paddingTop: 6,
            paddingBottom: 8,
            paddingLeft: 44,
            paddingRight: 44,
            fontSize: 9.5,
            color: NAVY,
            textAlign: "center",
            lineHeight: 1.5,
            background: `${SKY}10`,
          }}
        >
          <div>{co.address}</div>
          <div>Tel: {co.phone} &nbsp;·&nbsp; Email: {co.email} &nbsp;·&nbsp; TRN: {co.trn} &nbsp;·&nbsp; {co.website}</div>
        </div>
        <div style={{ height: 2, background: SKY }} />
        <div style={{ height: 6, background: NAVY }} />
      </div>
    );
  }
);
HandoverNoteTemplate.displayName = "HandoverNoteTemplate";
