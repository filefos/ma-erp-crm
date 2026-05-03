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

  // Compact spacing tokens — the goal is to fit a full offer letter
  // (compensation + commission + 11 company rules + signatures) into a
  // single A4 page. All vertical rhythm flows through these constants.
  const FS_BODY = 10.5;
  const FS_SMALL = 9.5;
  const FS_H2 = 12;
  const LH = 1.35;
  const headingStyle = { color: "#0f2d5a", fontSize: FS_H2, fontWeight: 700 as const, marginTop: 10, marginBottom: 4 };
  const paraStyle = { fontSize: FS_BODY, lineHeight: LH, margin: 0 };

  return (
    <div
      ref={ref}
      className="bg-white text-black mx-auto"
      style={{
        width: "794px",
        height: "1123px", // strict A4 — single page
        padding: "28px 44px 0",
        fontFamily: "Georgia, 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Compact letterhead — small logo on the left, legal company name in
          navy, Ref + Date right-aligned. Address / contact details live in
          the footer. The whole header is intentionally short (~58px tall)
          so the body has the maximum possible space. */}
      <div style={{ borderBottom: "2px solid #0f2d5a", paddingBottom: 6 }}>
        <div style={{ display: "table", width: "100%" }}>
          <div style={{ display: "table-row" }}>
            <div style={{ display: "table-cell", verticalAlign: "middle", width: 56, paddingRight: 12 }}>
              <img
                src="/erp-crm/prime-max-logo.png"
                alt={legalName}
                style={{ display: "block", height: 48, width: "auto" }}
                crossOrigin="anonymous"
              />
            </div>
            <div style={{ display: "table-cell", verticalAlign: "middle" }}>
              <div style={{ color: "#0f2d5a", fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>
                PRIME MAX PREFAB
              </div>
              <div style={{ color: "#1e6ab0", fontSize: FS_SMALL, marginTop: 1 }}>
                {legalName}
              </div>
            </div>
            <div style={{ display: "table-cell", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap", fontSize: FS_SMALL, width: 200 }}>
              <div><strong>Ref:</strong> {doc.letterNumber}</div>
              <div><strong>Date:</strong> {(doc.issuedAt ? new Date(doc.issuedAt) : new Date()).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body wrapper — flex-1 pushes the footer to the bottom of the A4 page. */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 8 }}>
        {/* Subject */}
        <h1 style={{ textAlign: "center", color: "#0f2d5a", fontWeight: 700, fontSize: 14, margin: "4px 0 6px" }}>OFFER OF EMPLOYMENT</h1>

        {/* Addressee — collapsed onto one line to save vertical space */}
        <div style={{ fontSize: FS_BODY, lineHeight: LH }}>
          <strong>To:</strong> {doc.candidateName}
          {doc.candidateNationality && <> &nbsp;·&nbsp; <strong>Nationality:</strong> {doc.candidateNationality}</>}
          {doc.candidatePassportNo && <> &nbsp;·&nbsp; <strong>Passport No:</strong> {doc.candidatePassportNo}</>}
        </div>

        <p style={{ ...paraStyle, marginTop: 6 }}>Dear {doc.candidateName.split(" ")[0]},</p>
        <p style={{ ...paraStyle, marginTop: 2 }}>
          We are pleased to offer you the position of <strong>{doc.designation ?? "—"}</strong> with{" "}
          <strong>{legalName}</strong>, on the terms and conditions set out below.
        </p>

        {/* Compensation */}
        <h2 style={headingStyle}>1. Compensation</h2>
        <table style={{ width: "100%", fontSize: FS_BODY, borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={{ padding: "3px 6px", border: "1px solid #ccd" }}>Basic Salary</td><td style={{ padding: "3px 6px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.basicSalary ?? 0).toLocaleString()}</td></tr>
            <tr><td style={{ padding: "3px 6px", border: "1px solid #ccd" }}>Allowances</td><td style={{ padding: "3px 6px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.allowances ?? 0).toLocaleString()}</td></tr>
            <tr style={{ background: "#f1f5fa" }}><td style={{ padding: "3px 6px", border: "1px solid #ccd", fontWeight: 700 }}>Gross Monthly Salary</td><td style={{ padding: "3px 6px", border: "1px solid #ccd", textAlign: "right", fontWeight: 700 }}>AED {totalSalary.toLocaleString()}</td></tr>
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

        {/* Rules — compressed list */}
        <h2 style={headingStyle}>{doc.commissionEnabled ? 4 : 3}. Company Rules &amp; Code of Conduct</h2>
        <ol style={{ fontSize: FS_SMALL, lineHeight: LH, paddingLeft: 16, margin: 0 }}>
          {COMPANY_RULES.map((r, i) => (
            <li key={i} style={{ marginBottom: 1 }}>{r}</li>
          ))}
        </ol>

        {doc.notes && (
          <>
            <h2 style={headingStyle}>{doc.commissionEnabled ? 5 : 4}. Additional Notes</h2>
            <p style={{ ...paraStyle, whiteSpace: "pre-wrap" }}>{doc.notes}</p>
          </>
        )}

        {/* Acceptance + Signatures */}
        <p style={{ ...paraStyle, marginTop: 8 }}>
          Kindly sign and return a copy of this letter within seven (7) days of receipt to confirm your acceptance of this offer and the Company Rules above.
        </p>

        <div style={{ display: "table", width: "100%", marginTop: 14, fontSize: FS_BODY }}>
          <div style={{ display: "table-row" }}>
            <div style={{ display: "table-cell", width: "50%", paddingRight: 24, verticalAlign: "top" }}>
              <div style={{ borderTop: "1px solid #555", paddingTop: 4 }}>For and on behalf of</div>
              <div style={{ fontWeight: 700, color: "#0f2d5a" }}>{legalName}</div>
              <div style={{ borderTop: "1px solid #555", paddingTop: 4, marginTop: 28 }}>Authorised Signatory</div>
            </div>
            <div style={{ display: "table-cell", width: "50%", paddingLeft: 24, verticalAlign: "top" }}>
              <div style={{ borderTop: "1px solid #555", paddingTop: 4 }}>Accepted by</div>
              <div style={{ fontWeight: 700 }}>{doc.candidateName}</div>
              <div style={{ borderTop: "1px solid #555", paddingTop: 4, marginTop: 28 }}>Signature &amp; Date</div>
            </div>
          </div>
        </div>

        {/* Spacer pushes footer to the bottom of the page */}
        <div style={{ flex: 1, minHeight: 8 }} />
      </div>

      {/* Footer — official address and contact details. Dark navy top
          border to match the header. No TRN, no P.O. Box per request. */}
      <div style={{ borderTop: "2px solid #0f2d5a", paddingTop: 6, paddingBottom: 8, fontSize: FS_SMALL, color: "#0f2d5a", textAlign: "center", lineHeight: 1.35 }}>
        <div>Plot # 2040, Sajja Industrial Area, Sharjah, UAE</div>
        <div>Tel: 0566163555 &nbsp;·&nbsp; Email: hr@primemaxprefab.com &nbsp;·&nbsp; Web: www.primemaxprefab.com</div>
      </div>
    </div>
  );
});
OfferLetterTemplate.displayName = "OfferLetterTemplate";
