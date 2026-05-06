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
  name: string;
  address: string;
  trn: string;
  phone: string;
  email: string;
  website: string;
  contact: string;
}> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
    trn: "105383255400003",
    phone: "+971 56 616 3555",
    email: "sales@primemaxprefab.com",
    website: "www.primemaxprefab.com",
    contact: "General Manager",
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

const NAVY     = "#0f2d5a";
const SKY      = "#1e6ab0";
const LABEL_BG = "#1e3a6e";

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

const labelCell: React.CSSProperties = {
  backgroundColor: LABEL_BG,
  color: "white",
  fontWeight: 700,
  fontSize: 10,
  padding: "3px 8px",
  border: "1px solid #c8d8ec",
  whiteSpace: "nowrap",
  width: "38%",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

const valueCell: React.CSSProperties = {
  fontSize: 10,
  padding: "3px 8px",
  border: "1px solid #c8d8ec",
  color: "#1a1a1a",
};

const tableHeadCell = (bg: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: "white",
  fontWeight: 700,
  fontSize: 11,
  padding: "4px 8px",
  border: "1px solid #c8d8ec",
  textAlign: "left",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
});

const itemHdrCell: React.CSSProperties = {
  backgroundColor: NAVY,
  color: "white",
  fontWeight: 700,
  fontSize: 10,
  padding: "4px 8px",
  border: "1px solid #c8d8ec",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

const itemCell: React.CSSProperties = {
  fontSize: 10,
  padding: "3px 8px",
  border: "1px solid #c8d8ec",
  color: "#1a1a1a",
};

export const HandoverNoteTemplate = forwardRef<HTMLDivElement, { doc: HandoverNoteDoc }>(
  ({ doc }, ref) => {
    const co      = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const isElite = doc.companyId === 2;
    const logoSrc = isElite ? null : "/erp-crm/prime-max-logo.png";
    const dateFmt = fmtDate(doc.handoverDate);
    const items   = parseItems(doc.itemsHandedOver).filter(i => i.description?.trim());
    const projDesc = doc.projectDescription?.trim() || doc.projectRef || "Prefabricated Construction Works";

    return (
      <div
        ref={ref}
        className="bg-white text-black mx-auto"
        style={{
          width: 794,
          minHeight: 1123,
          fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* ── NAVY HEADER BAR ── */}
        <div
          style={{
            backgroundColor: NAVY,
            color: "white",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          } as React.CSSProperties}
        >
          {logoSrc && (
            <img
              src={logoSrc}
              alt={co.name}
              style={{ maxHeight: 60, maxWidth: 130, objectFit: "contain", background: "white", padding: 4, borderRadius: 2, flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, lineHeight: 1.3 }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>{co.name}</div>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.9 }}>{co.address} | TRN: {co.trn}</div>
            <div style={{ fontSize: 10, opacity: 0.9 }}>Tel: {co.phone} | Email: {co.email} | Web: {co.website}</div>
          </div>
        </div>

        {/* ── SKY BLUE TITLE BAR ── */}
        <div
          style={{
            backgroundColor: SKY,
            color: "white",
            textAlign: "center",
            padding: "5px 0",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: "uppercase",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          } as React.CSSProperties}
        >
          Handover Note / Certificate
        </div>

        {/* ── COMPANY DETAIL | CLIENT DETAIL ── */}
        <div style={{ display: "flex", gap: 0, margin: "6px 20px 0" }}>

          {/* Company Detail */}
          <table style={{ flex: 1, borderCollapse: "collapse", border: "1px solid #c8d8ec", marginRight: 6 }}>
            <thead>
              <tr><th colSpan={2} style={tableHeadCell(NAVY)}>Company Detail</th></tr>
            </thead>
            <tbody>
              <tr><td style={labelCell}>Company</td><td style={valueCell}>{co.name}</td></tr>
              <tr><td style={labelCell}>Address</td><td style={valueCell}>{co.address}</td></tr>
              <tr><td style={labelCell}>Contact #</td><td style={valueCell}>{co.phone}</td></tr>
              <tr><td style={labelCell}>Email</td><td style={valueCell}>{co.email}</td></tr>
              <tr><td style={labelCell}>TRN</td><td style={valueCell}>{co.trn}</td></tr>
              <tr><td style={labelCell}>HON Ref. No.</td><td style={{ ...valueCell, fontWeight: 700, fontFamily: "monospace" }}>{doc.honNumber}</td></tr>
              <tr><td style={labelCell}>Date of Handover</td><td style={valueCell}>{dateFmt}</td></tr>
            </tbody>
          </table>

          {/* Client Detail */}
          <table style={{ flex: 1, borderCollapse: "collapse", border: "1px solid #c8d8ec", marginLeft: 6 }}>
            <thead>
              <tr><th colSpan={2} style={tableHeadCell(NAVY)}>Client Detail</th></tr>
            </thead>
            <tbody>
              <tr><td style={labelCell}>Client / Company</td><td style={valueCell}>{doc.clientName}</td></tr>
              <tr><td style={labelCell}>Contact Person</td><td style={valueCell}>{doc.clientRepresentative || "—"}</td></tr>
              <tr><td style={labelCell}>LPO Reference</td><td style={valueCell}>{doc.lpoNumber || "—"}</td></tr>
              <tr><td style={labelCell}>Project Reference</td><td style={valueCell}>{doc.projectRef || "—"}</td></tr>
              <tr><td style={labelCell}>Project Description</td><td style={valueCell}>{projDesc}</td></tr>
              <tr><td style={labelCell}>Contact #</td><td style={valueCell}>&nbsp;</td></tr>
              <tr><td style={labelCell}>Email</td><td style={valueCell}>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, padding: "10px 20px 0", fontSize: 11, lineHeight: 1.55, color: "#1a1a1a" }}>

          <p style={{ margin: "0 0 7px", textAlign: "justify" }}>
            We, <strong>{co.name}</strong>, hereby certify that the following works, materials, and items have been
            duly completed and formally handed over to <strong style={{ textTransform: "uppercase" }}>{doc.clientName}</strong>
            {doc.lpoNumber  ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
            This Handover Note serves as the official record of project completion and delivery.
          </p>

          {/* ── ITEMS TABLE ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
              Items / Works Handed Over:
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...itemHdrCell, width: 34, textAlign: "center" }}>S#</th>
                  <th style={{ ...itemHdrCell, textAlign: "left" }}>Description of Works / Materials</th>
                  <th style={{ ...itemHdrCell, width: 54, textAlign: "center" }}>Qty.</th>
                  <th style={{ ...itemHdrCell, width: 54, textAlign: "center" }}>Unit</th>
                  <th style={{ ...itemHdrCell, width: 90, textAlign: "center" }}>Condition</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...itemCell, textAlign: "center", color: "#888", fontStyle: "italic" }}>
                      — To be completed upon project handover —
                    </td>
                  </tr>
                ) : items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#edf2f9" }}>
                    <td style={{ ...itemCell, textAlign: "center", fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={itemCell}>{item.description}</td>
                    <td style={{ ...itemCell, textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ ...itemCell, textAlign: "center" }}>{item.unit}</td>
                    <td style={{ ...itemCell, textAlign: "center" }}>Good Condition</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirmation */}
          <p style={{ margin: "0 0 7px", textAlign: "justify" }}>
            We confirm that all works listed above have been completed in accordance with the agreed specifications,
            applicable industry standards, and quality requirements. We hereby request your formal acknowledgement
            of this handover by signing below.
          </p>

          {doc.notes?.trim() && (
            <p style={{ margin: "0 0 7px", color: "#444", fontStyle: "italic" }}>
              <strong>Note:</strong> {doc.notes}
            </p>
          )}

          {/* ── SIGNATURE BLOCK ── */}
          <div style={{ display: "flex", gap: 0, width: "100%", marginTop: 10, marginBottom: 10 }}>

            {/* Handed over by */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: 10, color: "#555" }}>Handed over by</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 1, lineHeight: 1.3 }}>{co.name}</div>
              <div style={{ marginTop: 36, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>
                  {doc.receivedByName ? "Authorised Representative" : "Authorised Signatory"}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Name: ___________________________</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Designation: ___________________________</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Date: ___________________________</div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: "#cdd8e8", margin: "0 20px", alignSelf: "stretch" }} />

            {/* Received by */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#555" }}>Received &amp; Accepted by</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 1, textTransform: "uppercase", lineHeight: 1.3 }}>{doc.clientName}</div>
              <div style={{ marginTop: 36, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>
                  {doc.receivedByName || "Authorised Signatory / Stamp"}
                </div>
                {doc.receivedByDesignation && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Designation: {doc.receivedByDesignation}</div>
                )}
                {!doc.receivedByDesignation && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Designation: ___________________________</div>
                )}
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Date: ___________________________</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: `2px solid ${NAVY}`,
            backgroundColor: `${SKY}15`,
            padding: "5px 20px 6px",
            fontSize: 9,
            color: NAVY,
            textAlign: "center",
            lineHeight: 1.5,
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          } as React.CSSProperties}
        >
          <div style={{ fontWeight: 700 }}>{co.name}</div>
          <div>{co.address} | Tel: {co.phone} | Email: {co.email} | TRN: {co.trn} | {co.website}</div>
        </div>
      </div>
    );
  }
);
HandoverNoteTemplate.displayName = "HandoverNoteTemplate";
