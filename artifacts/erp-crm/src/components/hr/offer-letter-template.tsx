import { forwardRef } from "react";

export interface OfferLetterDoc {
  letterNumber: string;
  candidateName: string;
  candidateNationality?: string | null;
  candidatePassportNo?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  basicSalary?: number | null;
  allowances?: number | null;
  templateType: string; // "staff" | "labour"
  workerType?: string | null;
  companyName?: string | null;
  companyId: number;
  commissionEnabled?: boolean | null;
  commissionTargetAmount?: number | null;
  commissionCurrency?: string | null;
  commissionBaseRatePct?: number | null;
  commissionBonusPerStepAmount?: number | null;
  commissionBonusStepSize?: number | null;
  commissionShortfallTier1Pct?: number | null;
  commissionShortfallTier1DeductionPct?: number | null;
  commissionShortfallTier2Pct?: number | null;
  commissionShortfallTier2DeductionPct?: number | null;
  commissionNotes?: string | null;
  // Explicit letterhead choice resolved by the caller from companyId — preferred
  // over name-based detection so historical letters render deterministically
  // even if a company is later renamed.
  letterhead?: "prime" | "elite";
  // Live-resolved company logo URL (data: URL or http(s) link). Preferred over
  // the hardcoded brand assets so any company configured by Admin renders with
  // its own letterhead.
  companyLogoUrl?: string | null;
  issuedAt?: string | null;
  notes?: string | null;
}

const COMPANY_RULES = [
  "Working week is six (6) days; one (1) day off per week.",
  "Salary is paid every month between the 1st and 10th of the following month.",
  "Taking leave / off without prior written permission will result in a deduction of three (3) days' salary per occurrence.",
  "Any damage or loss of company material is fully recoverable from the employee's salary.",
  "Emergency leave is allowed only after discussion with and approval from higher management.",
  "Unsatisfactory performance or lack of focus on assigned work is grounds for warning, deduction or termination at management's discretion.",
  "Verbal abuse or fighting with any colleague will result in salary deduction and disciplinary action.",
  "Any physical fight will be reported directly to the police and the employee handed over to the authorities.",
  "Any attempt to steal company material will result in an immediate police case against the employee.",
  "After completion of two (2) continuous years of service, the employee is entitled to annual leave with leave salary and a one-side economy class air ticket to home country.",
  "Cooking facility and company-provided residence are available.",
];

// UAE Federal Decree-Law No. 33 of 2021 — minimum statutory clauses to include
// in every offer letter for compliance with UAE Labour Law.
const UAE_LAW_CLAUSES = [
  "Probation Period: Six (6) months from the joining date as per Article 9 of UAE Federal Decree-Law No. 33 of 2021.",
  "Notice Period: Either party may terminate the contract by giving thirty (30) days' written notice after probation.",
  "Annual Leave: Thirty (30) calendar days per year after one (1) completed year of service, as per Article 29.",
  "Public Holidays, Sick Leave and Maternity Leave are granted in accordance with UAE Labour Law.",
  "End-of-Service Gratuity is payable as per Article 51 of UAE Federal Decree-Law No. 33 of 2021 upon eligible separation.",
  "Working hours and overtime shall comply with Articles 17 and 19 of UAE Labour Law.",
  "This contract is governed by the laws of the United Arab Emirates; any dispute shall be referred to the competent UAE labour courts.",
];

const STAFF_DUTY = "Duty Timing: 08:00 AM – 06:00 PM (Staff). One-side economy class air ticket to home country provided after completion of two (2) continuous years of service.";
const LABOUR_DUTY = "Duty Timing: 07:00 AM – 07:00 PM (Labour) — total 9 working hours with 2 hours of breaks (including 1 hour of mandatory lunch break). Annual leave with leave salary after completion of two (2) continuous years of service. Cooking facility and company-provided residence are included.";

const PRIME_LEGAL = "PRIME MAX PREFAB HOUSES IND. LLC.";
const ELITE_LEGAL = "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC";

export const OfferLetterTemplate = forwardRef<HTMLDivElement, { doc: OfferLetterDoc }>(({ doc }, ref) => {
  // Prefer the caller-provided explicit letterhead choice. Fall back to a
  // name-based check only when the caller did not resolve one.
  const lower = (doc.companyName ?? "").toLowerCase();
  const isPrime = doc.letterhead
    ? doc.letterhead === "prime"
    : lower.includes("prime") || (!lower.includes("elite") && lower.length > 0);
  const legalName = isPrime ? PRIME_LEGAL : ELITE_LEGAL;
  const totalSalary = (doc.basicSalary ?? 0) + (doc.allowances ?? 0);
  const dutyLine = doc.templateType === "labour" ? LABOUR_DUTY : STAFF_DUTY;

  // Slightly enlarged body type while still fitting an entire offer letter
  // — compensation, commission, company rules, UAE-law clauses and the
  // signature block — onto a single A4 page.
  const FS_BODY = 11.5;
  const FS_SMALL = 10.5;
  const FS_H2 = 13;
  const LH = 1.4;
  const NAVY = "#0f2d5a";
  const SKY = "#1e6ab0";
  const headingStyle = {
    color: NAVY,
    fontSize: FS_H2,
    fontWeight: 700 as const,
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottom: `1px solid ${SKY}33`,
    letterSpacing: 0.3,
  };
  const paraStyle = { fontSize: FS_BODY, lineHeight: LH, margin: 0, color: "#1a1a1a" };

  return (
    <div
      ref={ref}
      className="bg-white text-black mx-auto"
      style={{
        width: "794px",
        height: "1123px", // strict A4 — single page
        padding: "0",
        fontFamily: "Georgia, 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px #e8eef7",
      }}
    >
      {/* Premium accent — twin navy / sky-blue ribbons at the very top */}
      <div style={{ height: 6, background: NAVY }} />
      <div style={{ height: 2, background: SKY }} />

      {/* Header — logo (left) + legal name + Ref/Date (right) */}
      <div style={{ padding: "16px 44px 8px", borderBottom: `2px solid ${NAVY}` }}>
        <div style={{ display: "table", width: "100%" }}>
          <div style={{ display: "table-row" }}>
            <div style={{ display: "table-cell", verticalAlign: "middle" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {doc.companyLogoUrl && (
                  <img
                    src={doc.companyLogoUrl}
                    alt={legalName}
                    style={{ height: 42, width: "auto", objectFit: "contain", flexShrink: 0 }}
                  />
                )}
                <div>
                  <div style={{ color: NAVY, fontSize: 17, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.5 }}>
                    {legalName}
                  </div>
                  <div style={{ color: SKY, fontSize: FS_SMALL, fontStyle: "italic", marginTop: 2, letterSpacing: 0.2 }}>
                    Excellence in Prefabricated Construction
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "table-cell", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap", fontSize: FS_SMALL, width: 220, color: NAVY }}>
              <div><strong>Ref:</strong> {doc.letterNumber}</div>
              <div><strong>Date:</strong> {(doc.issuedAt ? new Date(doc.issuedAt) : new Date()).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body wrapper — flex-1 pushes the signature + footer to the bottom of the A4 page. */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 44px 0" }}>
        {/* Subject */}
        <h1 style={{ textAlign: "center", color: NAVY, fontWeight: 700, fontSize: 16, margin: "4px 0 8px", letterSpacing: 1.2, textTransform: "uppercase" }}>
          Offer of Employment
        </h1>

        {/* Addressee — collapsed onto one line to save vertical space */}
        <div style={{ fontSize: FS_BODY, lineHeight: LH, color: "#1a1a1a" }}>
          <strong>To:</strong> {doc.candidateName}
          {doc.candidateNationality && <> &nbsp;·&nbsp; <strong>Nationality:</strong> {doc.candidateNationality}</>}
          {doc.candidatePassportNo && <> &nbsp;·&nbsp; <strong>Passport No:</strong> {doc.candidatePassportNo}</>}
        </div>

        <p style={{ ...paraStyle, marginTop: 6 }}>Dear {doc.candidateName.split(" ")[0]},</p>
        <p style={{ ...paraStyle, marginTop: 2 }}>
          We are pleased to offer you the position of <strong style={{ color: NAVY }}>{doc.designation ?? "—"}</strong> with{" "}
          <strong style={{ color: NAVY }}>{legalName}</strong>, on the terms and conditions set out below.
        </p>

        {/* Compensation */}
        <h2 style={headingStyle}>1. Compensation</h2>
        <table style={{ width: "100%", fontSize: FS_BODY, borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={{ padding: "4px 8px", border: `1px solid ${SKY}55` }}>Basic Salary</td><td style={{ padding: "4px 8px", border: `1px solid ${SKY}55`, textAlign: "right" }}>AED {(doc.basicSalary ?? 0).toLocaleString()}</td></tr>
            <tr><td style={{ padding: "4px 8px", border: `1px solid ${SKY}55` }}>Allowances</td><td style={{ padding: "4px 8px", border: `1px solid ${SKY}55`, textAlign: "right" }}>AED {(doc.allowances ?? 0).toLocaleString()}</td></tr>
            <tr style={{ background: `${SKY}15` }}>
              <td style={{ padding: "4px 8px", border: `1px solid ${SKY}55`, fontWeight: 700, color: NAVY }}>Gross Monthly Salary</td>
              <td style={{ padding: "4px 8px", border: `1px solid ${SKY}55`, textAlign: "right", fontWeight: 700, color: NAVY }}>AED {totalSalary.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Joining + duty — single combined paragraph */}
        <h2 style={headingStyle}>2. Joining Date &amp; Duty Timing</h2>
        <p style={paraStyle}>
          <strong>Joining Date:</strong> {doc.joiningDate ? new Date(doc.joiningDate).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" }) : "To be agreed"}. {dutyLine}
        </p>

        {/* Commission */}
        {doc.commissionEnabled && (() => {
          const cur = doc.commissionCurrency || "AED";
          const target = doc.commissionTargetAmount ?? 0;
          const baseRate = doc.commissionBaseRatePct ?? 0;
          const bonus = doc.commissionBonusPerStepAmount ?? 0;
          const step = doc.commissionBonusStepSize ?? 0;
          const t1 = doc.commissionShortfallTier1Pct ?? 0;
          const t1Ded = doc.commissionShortfallTier1DeductionPct ?? 0;
          const t2 = doc.commissionShortfallTier2Pct ?? 0;
          const t2Ded = doc.commissionShortfallTier2DeductionPct ?? 0;
          const baseAtTarget = (target * baseRate) / 100;
          return (
            <>
              <h2 style={headingStyle}>3. Sales Target &amp; Commission</h2>
              <p style={paraStyle}>
                Monthly sales target of <strong>{cur} {target.toLocaleString()}</strong>. On achievement, base commission of <strong>{baseRate}%</strong> of total sales ({cur} {baseAtTarget.toLocaleString()} at target). For every additional <strong>{cur} {step.toLocaleString()}</strong> above target, a bonus of <strong>{cur} {bonus.toLocaleString()}</strong> is paid. Shortfall of <strong>{t1}%</strong> or more triggers a <strong>{t1Ded}%</strong> deduction; achievement of <strong>{t2}%</strong> or less triggers a <strong>{t2Ded}%</strong> deduction.
              </p>
              {doc.commissionNotes && (
                <p style={{ ...paraStyle, marginTop: 2, whiteSpace: "pre-wrap" }}><em>{doc.commissionNotes}</em></p>
              )}
            </>
          );
        })()}

        {/* Statutory UAE-law clauses */}
        <h2 style={headingStyle}>{doc.commissionEnabled ? 4 : 3}. Statutory Terms (UAE Labour Law)</h2>
        <ol style={{ fontSize: FS_SMALL, lineHeight: LH, paddingLeft: 18, margin: 0, color: "#1a1a1a" }}>
          {UAE_LAW_CLAUSES.map((r, i) => (
            <li key={i} style={{ marginBottom: 1 }}>{r}</li>
          ))}
        </ol>

        {/* Rules — compressed list */}
        <h2 style={headingStyle}>{doc.commissionEnabled ? 5 : 4}. Company Rules &amp; Code of Conduct</h2>
        <ol style={{ fontSize: FS_SMALL, lineHeight: LH, paddingLeft: 18, margin: 0, color: "#1a1a1a" }}>
          {COMPANY_RULES.map((r, i) => (
            <li key={i} style={{ marginBottom: 1 }}>{r}</li>
          ))}
        </ol>

        {doc.notes && (
          <>
            <h2 style={headingStyle}>{doc.commissionEnabled ? 6 : 5}. Additional Notes</h2>
            <p style={{ ...paraStyle, whiteSpace: "pre-wrap" }}>{doc.notes}</p>
          </>
        )}

        <p style={{ ...paraStyle, marginTop: 6, fontStyle: "italic", color: NAVY }}>
          Kindly sign and return a copy of this letter within seven (7) days of receipt to confirm your acceptance.
        </p>

        {/* Spacer pushes signature block + footer to the bottom of the page */}
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* Signature block — sits directly above the footer per spec */}
        <div style={{ display: "table", width: "100%", marginTop: 8, marginBottom: 10, fontSize: FS_BODY }}>
          <div style={{ display: "table-row" }}>
            <div style={{ display: "table-cell", width: "50%", paddingRight: 24, verticalAlign: "top" }}>
              <div style={{ color: "#444" }}>For and on behalf of</div>
              <div style={{ fontWeight: 700, color: NAVY, marginTop: 2, letterSpacing: 0.3 }}>{legalName}</div>
              <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 38, color: NAVY, fontWeight: 600 }}>Authorised Signatory</div>
            </div>
            <div style={{ display: "table-cell", width: "50%", paddingLeft: 24, verticalAlign: "top" }}>
              <div style={{ color: "#444" }}>Accepted by</div>
              <div style={{ fontWeight: 700, color: NAVY, marginTop: 2, letterSpacing: 0.3 }}>{doc.candidateName}</div>
              <div style={{ borderTop: `1px solid ${NAVY}`, paddingTop: 4, marginTop: 38, color: NAVY, fontWeight: 600 }}>Signature &amp; Date</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — official address, contact details, and computer-generated disclaimer. */}
      <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: 6, paddingBottom: 8, fontSize: FS_SMALL, color: NAVY, textAlign: "center", lineHeight: 1.4, background: `${SKY}10` }}>
        <div>Plot # 2040, Sajja Industrial Area, Sharjah, UAE</div>
        <div>Tel: 0566163555 &nbsp;·&nbsp; Email: hr@primemaxprefab.com &nbsp;·&nbsp; Web: www.primemaxprefab.com</div>
        <div style={{ marginTop: 3, fontSize: FS_SMALL - 0.5, color: "#555", fontStyle: "italic" }}>This is a computer generated document. No signature or stamp required.</div>
      </div>
      <div style={{ height: 2, background: SKY }} />
      <div style={{ height: 6, background: NAVY }} />
    </div>
  );
});
OfferLetterTemplate.displayName = "OfferLetterTemplate";
