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

const NAVY = "#0f2d5a";
const SKY  = "#1e6ab0";
const LABEL_BG = "#1e3a6e";

const DEFAULT_MATERIALS = [
  "MS Steel: Fire-rated mild steel for structural components.",
  "GI Framing: Fire-rated galvanized iron framing for support structures.",
  "Gypsum Board 12.5 mm thick — 01 Hour Fire Rated.",
  "Cement Board 06 mm thick — 01 Hour Fire Rated.",
];

function fmtDate(d?: string | null) {
  if (!d) return new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
  const p = new Date(d);
  return isNaN(p.getTime()) ? d : p.toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
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

function MaterialLines({ text }: { text?: string | null }) {
  const lines = text?.trim()
    ? text.split("\n").map(l => l.trim()).filter(Boolean)
    : DEFAULT_MATERIALS;
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 11, lineHeight: 1.55, margin: "0 0 5px", color: "#1a1a1a" }}>{l}</p>
      ))}
    </>
  );
}

export const UndertakingLetterTemplate = forwardRef<HTMLDivElement, { doc: UndertakingLetterDoc }>(
  ({ doc }, ref) => {
    const co      = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const isElite = doc.companyId === 2;
    const logoSrc = isElite ? null : "/erp-crm/prime-max-logo.png";
    const dateFmt = fmtDate(doc.letterDate);
    const projectDesc = doc.scope?.trim() || "Prefabricated Construction Works";

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
        {/* ── NAVY HEADER BAR (matches delivery note) ── */}
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

        {/* ── SKY BLUE TITLE BAR (matches delivery note) ── */}
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
          Undertaking Letter
        </div>

        {/* ── COMPANY DETAIL | CLIENT DETAIL (two-column table, delivery note style) ── */}
        <div style={{ display: "flex", gap: 0, margin: "6px 20px 0" }}>

          {/* Company Detail */}
          <table style={{ flex: 1, borderCollapse: "collapse", border: "1px solid #c8d8ec", marginRight: 6 }}>
            <thead>
              <tr>
                <th colSpan={2} style={tableHeadCell(NAVY)}>Company Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={labelCell}>Company</td><td style={valueCell}>{co.name}</td></tr>
              <tr><td style={labelCell}>Address</td><td style={valueCell}>{co.address}</td></tr>
              <tr><td style={labelCell}>Contact #</td><td style={valueCell}>{co.phone}</td></tr>
              <tr><td style={labelCell}>Email</td><td style={valueCell}>{co.email}</td></tr>
              <tr><td style={labelCell}>TRN</td><td style={valueCell}>{co.trn}</td></tr>
              <tr><td style={labelCell}>UL Ref. No.</td><td style={{ ...valueCell, fontWeight: 700, fontFamily: "monospace" }}>{doc.ulNumber}</td></tr>
              <tr><td style={labelCell}>Date</td><td style={valueCell}>{dateFmt}</td></tr>
            </tbody>
          </table>

          {/* Client Detail */}
          <table style={{ flex: 1, borderCollapse: "collapse", border: "1px solid #c8d8ec", marginLeft: 6 }}>
            <thead>
              <tr>
                <th colSpan={2} style={tableHeadCell(NAVY)}>Client Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={labelCell}>Client / Company</td><td style={valueCell}>{doc.clientName}</td></tr>
              <tr><td style={labelCell}>LPO Reference</td><td style={valueCell}>{doc.lpoNumber || "—"}</td></tr>
              <tr><td style={labelCell}>Project Reference</td><td style={valueCell}>{doc.projectRef || "—"}</td></tr>
              <tr><td style={labelCell}>Project / Scope</td><td style={valueCell}>{projectDesc}</td></tr>
              <tr><td style={labelCell}>Contact Person</td><td style={valueCell}>&nbsp;</td></tr>
              <tr><td style={labelCell}>Contact #</td><td style={valueCell}>&nbsp;</td></tr>
              <tr><td style={labelCell}>Email</td><td style={valueCell}>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── SUBJECT HEADING BAR ── */}
        <div style={{ margin: "10px 20px 0", backgroundColor: "#edf2f9", border: `1px solid #c8d8ec`, padding: "5px 10px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>Subject: </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>
            Undertaking Letter for Use of Fire-Rated Materials
          </span>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, padding: "10px 20px 0", fontSize: 11, lineHeight: 1.6, color: "#1a1a1a" }}>

          <p style={{ margin: "0 0 7px" }}>
            To,<br />
            <strong style={{ textTransform: "uppercase" }}>{doc.clientName}</strong>
          </p>

          <p style={{ margin: "0 0 7px" }}>Dear Team,</p>

          <p style={{ margin: "0 0 7px", textAlign: "justify" }}>
            We, <strong>{co.name}</strong>, located at {co.address}, hereby provide this undertaking
            in reference to the use of fire-rated materials for{" "}
            <strong>{projectDesc}</strong>
            {doc.lpoNumber  ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
          </p>

          <p style={{ margin: "0 0 7px" }}>We solemnly affirm and undertake that:</p>

          <p style={{ margin: "0 0 6px", fontWeight: 700 }}>
            Commitment to using the following fire-rated materials:
          </p>

          <div style={{ marginBottom: 9, paddingLeft: 6 }}>
            <MaterialLines text={doc.commitmentText} />
          </div>

          <p style={{ margin: "0 0 7px", textAlign: "justify" }}>
            <strong>Responsibility:</strong>{" "}
            {co.name} accepts full responsibility for the quality and performance of the fire-rated materials
            specified above. We will ensure that these materials are sourced from reputable suppliers and are
            installed according to manufacturer guidelines and industry best practices.
          </p>

          <p style={{ margin: "0 0 7px", textAlign: "justify" }}>
            We trust that this undertaking satisfies the requirements and provides the necessary assurance
            regarding our commitment to fire safety and the use of fire-rated materials. Should there be any
            additional requirements or modifications needed, please do not hesitate to inform us.
          </p>

          {doc.notes?.trim() && (
            <p style={{ margin: "0 0 7px", color: "#444", fontStyle: "italic" }}>
              {doc.notes}
            </p>
          )}

          <p style={{ margin: "0 0 14px" }}>Thank you for your cooperation and understanding.</p>

          {/* ── SIGNATURE BLOCK ── */}
          <div style={{ display: "flex", gap: 0, width: "100%", marginBottom: 10 }}>

            {/* Sender */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: 10, color: "#555" }}>For and on behalf of</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 1, lineHeight: 1.3 }}>{co.name}</div>
              <div style={{ marginTop: 36, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{doc.signedByName || "Authorised Signatory"}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Designation: ___________________________</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                  Date: {doc.signedDate ? fmtDate(doc.signedDate) : "___________________________"}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: "#cdd8e8", margin: "0 20px", alignSelf: "stretch" }} />

            {/* Client */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#555" }}>Acknowledged &amp; Accepted by</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 1, textTransform: "uppercase", lineHeight: 1.3 }}>{doc.clientName}</div>
              <div style={{ marginTop: 36, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>Authorised Signatory &amp; Company Stamp</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>Name: ___________________________</div>
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
UndertakingLetterTemplate.displayName = "UndertakingLetterTemplate";
