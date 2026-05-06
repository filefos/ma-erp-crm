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

function CommitmentBody({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: 0, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>{text}</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11.5, lineHeight: 1.7, color: "#1a1a1a" }}>
      {lines.map((l, i) => <li key={i} style={{ marginBottom: 3 }}>{l}</li>)}
    </ul>
  );
}

export const UndertakingLetterTemplate = forwardRef<HTMLDivElement, { doc: UndertakingLetterDoc }>(
  ({ doc }, ref) => {
    const co = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const isElite = doc.companyId === 2;
    const logoSrc = isElite ? null : "/erp-crm/prime-max-logo.png";
    const letterDateFmt = fmtDate(doc.letterDate);

    const scopeText = doc.scope?.trim() || "the contracted prefabricated construction scope";
    const subjectText = doc.scope?.trim()
      ? `Undertaking Letter — ${doc.scope.split("\n")[0].slice(0, 80)}`
      : "Undertaking Letter for Contracted Scope of Work";

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
                <div style={{ color: "#444", fontSize: 9.5, marginTop: 1 }}>
                  {co.address}
                </div>
                <div style={{ color: "#444", fontSize: 9.5 }}>
                  Tel: {co.phone} &nbsp;·&nbsp; Email: {co.email} &nbsp;·&nbsp; Web: {co.website}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10.5, color: NAVY, whiteSpace: "nowrap", minWidth: 180 }}>
              <div><strong>Ref No.:</strong> {doc.ulNumber}</div>
              <div style={{ marginTop: 3 }}><strong>Date:</strong> {letterDateFmt}</div>
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
          Undertaking Letter
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, padding: "20px 44px 0" }}>

          {/* Subject */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1a1a1a" }}>Subject: </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: NAVY }}>{subjectText}</span>
          </div>

          {/* Addressee */}
          <div style={{ marginBottom: 12, fontSize: 11.5, lineHeight: 1.6, color: "#1a1a1a" }}>
            <div>To,</div>
            <div style={{ fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{doc.clientName}</div>
          </div>

          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 12px", color: "#1a1a1a" }}>Dear Team,</p>

          {/* Opening paragraph */}
          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 14px", color: "#1a1a1a" }}>
            We, <strong>{co.name}</strong>, located at {co.address}, hereby provide this formal undertaking
            in reference to{" "}
            <strong>{scopeText}</strong>
            {doc.lpoNumber ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
          </p>

          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 10px", color: "#1a1a1a" }}>
            We solemnly affirm and undertake that:
          </p>

          {/* Commitment / materials section */}
          {doc.commitmentText?.trim() ? (
            <div style={{ marginBottom: 14, paddingLeft: 8, borderLeft: `3px solid ${SKY}`, paddingRight: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
                Commitment to the Following Scope and Materials:
              </div>
              <CommitmentBody text={doc.commitmentText} />
            </div>
          ) : (
            <div style={{ marginBottom: 14, paddingLeft: 8, borderLeft: `3px solid ${SKY}`, paddingRight: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
                Commitment to the Following Scope and Materials:
              </div>
              <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: 0, color: "#555", fontStyle: "italic" }}>
                — Details to be confirmed upon finalisation of scope —
              </p>
            </div>
          )}

          {/* Responsibility */}
          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 12px", color: "#1a1a1a" }}>
            <strong>Responsibility:</strong> {co.name} accepts full responsibility for the quality and performance
            of the works and materials specified above. We will ensure that all works are sourced from reputable
            suppliers, executed by qualified personnel, and carried out in strict accordance with the applicable
            standards, manufacturer guidelines, and industry best practices.
          </p>

          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 12px", color: "#1a1a1a" }}>
            We trust that this undertaking satisfies the requirements and provides the necessary assurance regarding
            our commitment to the project. Should there be any additional requirements or modifications needed,
            please do not hesitate to inform us and we shall respond promptly.
          </p>

          {doc.notes?.trim() && (
            <p style={{ fontSize: 11, lineHeight: 1.7, margin: "0 0 12px", color: "#444", fontStyle: "italic" }}>
              {doc.notes}
            </p>
          )}

          <p style={{ fontSize: 11.5, lineHeight: 1.7, margin: "0 0 20px", color: "#1a1a1a" }}>
            Thank you for your cooperation and understanding.
          </p>

          {/* Signature block */}
          <div style={{ display: "table", width: "100%", marginTop: 10, marginBottom: 16, fontSize: 11.5 }}>
            <div style={{ display: "table-row" }}>
              <div style={{ display: "table-cell", width: "50%", paddingRight: 24, verticalAlign: "top" }}>
                <div style={{ color: "#444" }}>For and on behalf of</div>
                <div style={{ fontWeight: 700, color: NAVY, marginTop: 2, letterSpacing: 0.3 }}>{co.name}</div>
                <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 46, color: NAVY, fontWeight: 600 }}>
                  {doc.signedByName || "Authorised Signatory"}
                </div>
                {doc.signedDate && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Date: {fmtDate(doc.signedDate)}</div>
                )}
              </div>
              <div style={{ display: "table-cell", width: "50%", paddingLeft: 24, verticalAlign: "top" }}>
                <div style={{ color: "#444" }}>Acknowledged by</div>
                <div style={{ fontWeight: 700, color: NAVY, marginTop: 2 }}>{doc.clientName}</div>
                <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 46, color: NAVY, fontWeight: 600 }}>
                  Authorised Signatory &amp; Stamp
                </div>
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
UndertakingLetterTemplate.displayName = "UndertakingLetterTemplate";
