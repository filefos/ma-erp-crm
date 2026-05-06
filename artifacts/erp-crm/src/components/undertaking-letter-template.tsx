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
  shortName: string;
  address: string;
  poBox?: string;
  trn: string;
  phone: string;
  email: string;
  website: string;
}> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    shortName: "Prime Max Prefab Houses Ind. LLC. SP.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, United Arab Emirates",
    poBox: "P.O. Box 00000",
    trn: "105383255400003",
    phone: "+971 56 616 3555",
    email: "sales@primemaxprefab.com",
    website: "www.primemaxprefab.com",
  },
  2: {
    name: "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC",
    shortName: "Elite Pre-Fabricated Houses Trading Co. LLC",
    address: "Sajja Industrial Area, Sharjah, United Arab Emirates",
    poBox: "P.O. Box 00000",
    trn: "100345678900001",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    website: "www.eliteprefab.ae",
  },
};

const NAVY = "#0f2d5a";
const SKY  = "#1e6ab0";

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
    const co        = COMPANIES[doc.companyId] ?? COMPANIES[1];
    const isElite   = doc.companyId === 2;
    const logoSrc   = isElite ? null : "/erp-crm/prime-max-logo.png";
    const dateFmt   = fmtDate(doc.letterDate);
    const projectDesc = doc.scope?.trim() || "the contracted prefabricated construction works";

    return (
      <div
        ref={ref}
        className="bg-white text-black mx-auto"
        style={{
          width: 794,
          minHeight: 1123,
          fontFamily: "'Times New Roman', Georgia, serif",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* ── TOP ACCENT RIBBONS ── */}
        <div style={{ height: 7, background: NAVY }} />
        <div style={{ height: 3, background: SKY }} />

        {/* ── LETTERHEAD ── */}
        <div style={{ padding: "12px 44px 10px", borderBottom: `2px solid ${NAVY}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {/* Left — logo + company info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={co.name}
                  style={{ height: 52, width: "auto", objectFit: "contain", flexShrink: 0 }}
                />
              )}
              <div>
                <div style={{ color: NAVY, fontSize: 15, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.4 }}>
                  {co.name}
                </div>
                <div style={{ color: SKY, fontSize: 9.5, fontStyle: "italic", marginTop: 2 }}>
                  Excellence in Prefabricated Construction
                </div>
                <div style={{ color: "#444", fontSize: 9, marginTop: 2 }}>
                  {co.address}
                </div>
                <div style={{ color: "#444", fontSize: 9 }}>
                  Tel: {co.phone}&nbsp;&nbsp;|&nbsp;&nbsp;Email: {co.email}&nbsp;&nbsp;|&nbsp;&nbsp;{co.website}
                </div>
                <div style={{ color: "#444", fontSize: 9 }}>
                  TRN: {co.trn}
                </div>
              </div>
            </div>

            {/* Right — document reference */}
            <div style={{
              textAlign: "right",
              fontSize: 10,
              color: NAVY,
              whiteSpace: "nowrap",
              minWidth: 175,
              borderLeft: `1px solid #cdd8e8`,
              paddingLeft: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: NAVY }}>UNDERTAKING LETTER</div>
              <div><strong>Ref No.:</strong>&nbsp;{doc.ulNumber}</div>
              <div style={{ marginTop: 2 }}><strong>Date:</strong>&nbsp;{dateFmt}</div>
              {doc.lpoNumber  && <div style={{ marginTop: 2 }}><strong>LPO Ref.:</strong>&nbsp;{doc.lpoNumber}</div>}
              {doc.projectRef && <div style={{ marginTop: 2 }}><strong>Project:</strong>&nbsp;{doc.projectRef}</div>}
            </div>
          </div>
        </div>

        {/* ── TITLE BAR ── */}
        <div style={{
          background: NAVY,
          color: "white",
          textAlign: "center",
          padding: "5px 0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        } as React.CSSProperties}>
          Undertaking Letter for Use of Fire-Rated Materials
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, padding: "16px 44px 0" }}>

          {/* Subject */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>Subject:&nbsp;</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>
              Undertaking Letter for Use of Fire-Rated Materials
            </span>
          </div>

          {/* Addressee — CLIENT NAME AUTO-FILLED FROM LPO */}
          <div style={{ marginBottom: 10, fontSize: 11, lineHeight: 1.55, color: "#1a1a1a" }}>
            <div>To,</div>
            <div style={{ fontWeight: 700, textTransform: "uppercase", marginTop: 2, letterSpacing: 0.3 }}>
              {doc.clientName}
            </div>
          </div>

          {/* Salutation */}
          <p style={{ fontSize: 11, lineHeight: 1.55, margin: "0 0 9px", color: "#1a1a1a" }}>
            Dear Team,
          </p>

          {/* Opening */}
          <p style={{ fontSize: 11, lineHeight: 1.6, margin: "0 0 9px", color: "#1a1a1a", textAlign: "justify" }}>
            We, <strong>{co.name}</strong>, located at {co.address}, hereby provide this undertaking
            in reference to the use of fire-rated materials for <strong>{projectDesc}</strong>
            {doc.lpoNumber  ? ` as per LPO No. ${doc.lpoNumber}` : ""}
            {doc.projectRef ? `, Project Reference: ${doc.projectRef}` : ""}.
          </p>

          {/* Affirm */}
          <p style={{ fontSize: 11, lineHeight: 1.55, margin: "0 0 7px", color: "#1a1a1a" }}>
            We solemnly affirm and undertake that:
          </p>

          {/* Commitment heading */}
          <p style={{ fontSize: 11, fontWeight: 700, margin: "0 0 7px", color: "#1a1a1a" }}>
            Commitment to using the following fire-rated materials:
          </p>

          {/* Material lines */}
          <div style={{ marginBottom: 10, paddingLeft: 4 }}>
            <MaterialLines text={doc.commitmentText} />
          </div>

          {/* Responsibility */}
          <p style={{ fontSize: 11, lineHeight: 1.6, margin: "0 0 9px", color: "#1a1a1a", textAlign: "justify" }}>
            <strong>Responsibility:</strong>&nbsp;
            {co.name} accepts full responsibility for the quality and performance of the fire-rated
            materials specified above. We will ensure that these materials are sourced from reputable
            suppliers and are installed according to manufacturer guidelines and industry best practices.
          </p>

          {/* Closing */}
          <p style={{ fontSize: 11, lineHeight: 1.6, margin: "0 0 9px", color: "#1a1a1a", textAlign: "justify" }}>
            We trust that this undertaking satisfies the requirements and provides the necessary assurance
            regarding our commitment to fire safety and the use of fire-rated materials. Should there be
            any additional requirements or modifications needed, please do not hesitate to inform us.
          </p>

          {/* Notes (optional) */}
          {doc.notes?.trim() && (
            <p style={{ fontSize: 10.5, lineHeight: 1.55, margin: "0 0 9px", color: "#444", fontStyle: "italic" }}>
              {doc.notes}
            </p>
          )}

          {/* Thank you */}
          <p style={{ fontSize: 11, lineHeight: 1.55, margin: "0 0 16px", color: "#1a1a1a" }}>
            Thank you for your cooperation and understanding.
          </p>

          {/* ── SIGNATURE BLOCK ── */}
          <div style={{ display: "flex", gap: 0, width: "100%", marginBottom: 14 }}>

            {/* Sender */}
            <div style={{ flex: 1, paddingRight: 24 }}>
              <div style={{ fontSize: 10, color: "#555" }}>For and on behalf of</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 2, lineHeight: 1.3 }}>
                {co.name}
              </div>
              <div style={{ marginTop: 32, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>
                  {doc.signedByName || "Authorised Signatory"}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                  Designation: ___________________________
                </div>
                {doc.signedDate && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                    Date: {fmtDate(doc.signedDate)}
                  </div>
                )}
                {!doc.signedDate && (
                  <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                    Date: ___________________________
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: "#cdd8e8", margin: "0 24px", alignSelf: "stretch" }} />

            {/* Client */}
            <div style={{ flex: 1, paddingLeft: 0 }}>
              <div style={{ fontSize: 10, color: "#555" }}>Acknowledged &amp; Accepted by</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 2, lineHeight: 1.3, textTransform: "uppercase" }}>
                {doc.clientName}
              </div>
              <div style={{ marginTop: 32, borderTop: `1.5px solid ${NAVY}`, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>
                  Authorised Signatory &amp; Company Stamp
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                  Name: ___________________________
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                  Date: ___________________________
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          borderTop: `2px solid ${NAVY}`,
          background: `${SKY}12`,
          padding: "5px 44px 6px",
          fontSize: 9,
          color: NAVY,
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600 }}>{co.name}</div>
          <div>{co.address}</div>
          <div>
            Tel: {co.phone}&nbsp;&nbsp;|&nbsp;&nbsp;Email: {co.email}&nbsp;&nbsp;|&nbsp;&nbsp;TRN: {co.trn}&nbsp;&nbsp;|&nbsp;&nbsp;{co.website}
          </div>
        </div>

        {/* ── BOTTOM ACCENT RIBBONS ── */}
        <div style={{ height: 3, background: SKY }} />
        <div style={{ height: 7, background: NAVY }} />
      </div>
    );
  }
);
UndertakingLetterTemplate.displayName = "UndertakingLetterTemplate";
