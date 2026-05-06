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
  letterhead?: "prime" | "elite";
  companyLogoUrl?: string | null;
  issuedAt?: string | null;
  notes?: string | null;
}

const PRIME_LEGAL = "PRIME MAX PREFAB HOUSES IND. LLC. SP.";
const ELITE_LEGAL = "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC";

const OL_COMPANIES: Record<number, { name: string; address: string; phone: string; email: string; website: string; trn?: string }> = {
  1: {
    name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE",
    phone: "056 616 3555",
    email: "sales@primemaxprefab.com",
    website: "www.primemaxprefab.com",
  },
  2: {
    name: "ELITE PRE-FABRICATED HOUSES TRADING CO. LLC",
    address: "Sajja Industrial Area, Sharjah, UAE",
    phone: "+971 55 100 2000",
    email: "info@eliteprefab.ae",
    website: "www.eliteprefab.ae",
  },
};

export const OfferLetterTemplate = forwardRef<HTMLDivElement, { doc: OfferLetterDoc }>(({ doc }, ref) => {
  const co = OL_COMPANIES[doc.companyId] ?? OL_COMPANIES[1];
  const logoSrc = doc.companyId !== 2 ? "/prime-max-logo.png" : null;

  const lower = (doc.companyName ?? "").toLowerCase();
  const isPrime = doc.letterhead
    ? doc.letterhead === "prime"
    : lower.includes("prime") || (!lower.includes("elite") && lower.length > 0);
  const legalName = isPrime ? PRIME_LEGAL : ELITE_LEGAL;

  const totalSalary = (doc.basicSalary ?? 0) + (doc.allowances ?? 0);
  const isLabour = doc.templateType === "labour";

  const NAVY = "#0f2d5a";
  const SKY = "#1e6ab0";

  const issuedDate = doc.issuedAt
    ? new Date(doc.issuedAt).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

  const joiningDateFmt = doc.joiningDate
    ? new Date(doc.joiningDate).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })
    : "To be confirmed";

  const tdLabel: React.CSSProperties = {
    padding: "5px 10px",
    fontWeight: 600,
    color: NAVY,
    border: `1px solid #d1d9e6`,
    background: "#f0f4f9",
    width: "38%",
    fontSize: 10.5,
    verticalAlign: "top",
  };
  const tdValue: React.CSSProperties = {
    padding: "5px 10px",
    border: `1px solid #d1d9e6`,
    color: "#1a1a1a",
    fontSize: 10.5,
    verticalAlign: "top",
  };
  const sectionHead: React.CSSProperties = {
    background: NAVY,
    color: "#fff",
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    padding: "4px 10px",
    marginTop: 10,
    marginBottom: 0,
  };
  const smallClause: React.CSSProperties = {
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.45,
  };

  return (
    <div
      ref={ref}
      className="print-doc bg-white text-black font-sans max-w-[850px] mx-auto shadow-lg rounded-lg overflow-hidden flex flex-col"
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
        }
      `}</style>

      {/* ── LETTERHEAD ── */}
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
          <span className="text-[15px] font-black tracking-widest uppercase">Offer of Employment</span>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 flex flex-col px-4 pt-2" style={{ paddingBottom: 10 }}>

        {/* Ref + Date row */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
          <span><strong style={{ color: NAVY }}>Ref:</strong> {doc.letterNumber}</span>
          <span><strong style={{ color: NAVY }}>Date:</strong> {issuedDate}</span>
        </div>

        {/* Salutation */}
        <p style={{ fontSize: 11, color: "#1a1a1a", margin: "0 0 4px" }}>
          Dear <strong>{doc.candidateName}</strong>,
        </p>
        <p style={{ fontSize: 10.5, color: "#1a1a1a", lineHeight: 1.4, margin: "0 0 6px" }}>
          We are pleased to offer you employment with <strong style={{ color: NAVY }}>{legalName}</strong> on the following terms and conditions, in accordance with <strong>UAE Federal Decree-Law No. 33 of 2021</strong> on the Regulation of Labour Relations and its Executive Regulations.
        </p>

        {/* ── SECTION 1: Employee Details ── */}
        <div style={sectionHead}>1. Employee Details</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdLabel}>Full Name</td>
              <td style={tdValue}>{doc.candidateName}</td>
              <td style={tdLabel}>Nationality</td>
              <td style={tdValue}>{doc.candidateNationality || "—"}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Passport No.</td>
              <td style={tdValue}>{doc.candidatePassportNo || "—"}</td>
              <td style={tdLabel}>Designation</td>
              <td style={{ ...tdValue, fontWeight: 700, color: NAVY }}>{doc.designation || "—"}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Employment Type</td>
              <td style={tdValue}>{isLabour ? "Labour / Site Worker" : "Staff"}</td>
              <td style={tdLabel}>Work Location</td>
              <td style={tdValue}>{co.address}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Joining Date</td>
              <td style={tdValue}>{joiningDateFmt}</td>
              <td style={tdLabel}>Contract Type</td>
              <td style={tdValue}>Limited-Term (Renewable)</td>
            </tr>
          </tbody>
        </table>

        {/* ── SECTION 2: Compensation ── */}
        <div style={sectionHead}>2. Compensation Package (Monthly — AED)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdLabel}>Basic Salary</td>
              <td style={{ ...tdValue, textAlign: "right" }}>AED {(doc.basicSalary ?? 0).toLocaleString()}</td>
              <td style={tdLabel}>Allowances</td>
              <td style={{ ...tdValue, textAlign: "right" }}>AED {(doc.allowances ?? 0).toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...tdLabel, background: "#0f2d5a", color: "#fff", fontWeight: 700 }}>
                Total Gross Monthly Salary
              </td>
              <td colSpan={2} style={{ ...tdValue, background: "#e8eff8", fontWeight: 700, color: NAVY, textAlign: "right", fontSize: 11 }}>
                AED {totalSalary.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 0" }}>
          * Salary is paid monthly between the 1st and 10th of the following month via the UAE Wages Protection System (WPS).
        </p>

        {/* ── SECTION 3: Working Conditions ── */}
        <div style={sectionHead}>3. Working Conditions</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdLabel}>Working Days</td>
              <td style={tdValue}>6 days per week (1 day off)</td>
              <td style={tdLabel}>Working Hours</td>
              <td style={tdValue}>{isLabour ? "07:00 AM – 07:00 PM (9 hrs net + 2 hrs breaks)" : "08:00 AM – 06:00 PM"}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Probation Period</td>
              <td style={tdValue}>6 months (Art. 9, Decree-Law 33/2021)</td>
              <td style={tdLabel}>Notice Period</td>
              <td style={tdValue}>30 days (post-probation)</td>
            </tr>
            <tr>
              <td style={tdLabel}>Annual Leave</td>
              <td style={tdValue}>30 calendar days/year after 1 year of service (Art. 29)</td>
              <td style={tdLabel}>Air Ticket</td>
              <td style={tdValue}>One economy-class ticket to home country after 2 continuous years</td>
            </tr>
            <tr>
              <td style={tdLabel}>Medical Insurance</td>
              <td style={tdValue}>Provided by employer as per UAE law</td>
              <td style={tdLabel}>Accommodation</td>
              <td style={tdValue}>{isLabour ? "Company-provided accommodation and cooking facility" : "Not provided"}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Commission (conditional) ── */}
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
              <div style={sectionHead}>4. Sales Target &amp; Commission</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>Monthly Target</td>
                    <td style={tdValue}>{cur} {target.toLocaleString()}</td>
                    <td style={tdLabel}>Base Commission Rate</td>
                    <td style={tdValue}>{baseRate}% of total sales ({cur} {baseAtTarget.toLocaleString()} at target)</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>Bonus (per step above target)</td>
                    <td style={tdValue}>{cur} {bonus.toLocaleString()} per additional {cur} {step.toLocaleString()}</td>
                    <td style={tdLabel}>Shortfall Deductions</td>
                    <td style={tdValue}>Below {t1}%: -{t1Ded}% | Below {t2}%: -{t2Ded}%</td>
                  </tr>
                  {doc.commissionNotes && (
                    <tr>
                      <td style={tdLabel}>Notes</td>
                      <td colSpan={3} style={{ ...tdValue, fontStyle: "italic" }}>{doc.commissionNotes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          );
        })()}

        {/* ── SECTION: Statutory Terms ── */}
        <div style={sectionHead}>{doc.commissionEnabled ? "5" : "4"}. Statutory Terms — UAE Federal Decree-Law No. 33 of 2021</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Sick Leave", "90 days per year (15 days full pay, 30 days half pay, 45 days unpaid) — Art. 31."],
              ["Maternity Leave", "60 calendar days (45 days full pay, 15 days half pay) — Art. 30."],
              ["Public Holidays", "Granted per UAE Official Gazette each year — Art. 28."],
              ["End-of-Service Gratuity", "21 days' basic salary per year for the first 5 years; 30 days thereafter — Art. 51."],
              ["Overtime", "Compensated at basic hourly rate + 25% (50% for night/Friday work) — Art. 19."],
              ["Non-Discrimination", "Employment is based solely on merit; no discrimination on any protected ground — Art. 4."],
              ["Governing Law", "UAE Federal Decree-Law No. 33 of 2021 and its Executive Regulations; disputes before competent UAE Labour Courts."],
            ].map(([label, text], i) => (
              <tr key={i}>
                <td style={{ ...tdLabel, width: "28%" }}>{label}</td>
                <td style={{ ...tdValue, ...smallClause }}>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── SECTION: Company Rules ── */}
        <div style={sectionHead}>{doc.commissionEnabled ? "6" : "5"}. Code of Conduct &amp; Company Policies</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Absence Without Leave", "Absence without prior written approval will result in a deduction of 3 days' salary per occurrence."],
              ["Property &amp; Assets", "Any damage or loss of company property is fully recoverable from the employee's salary."],
              ["Misconduct", "Verbal abuse or physical altercation with any colleague will result in disciplinary action up to termination and police referral."],
              ["Theft", "Any attempt to misappropriate company assets will result in immediate termination and a police case."],
              ["Performance", "Unsatisfactory performance is grounds for written warning, salary deduction, or termination at management's discretion."],
              ["Confidentiality", "The employee must maintain strict confidentiality of all company data, client information, and trade secrets during and after employment."],
            ].map(([label, text], i) => (
              <tr key={i}>
                <td style={{ ...tdLabel, width: "28%" }} dangerouslySetInnerHTML={{ __html: label }} />
                <td style={{ ...tdValue, ...smallClause }}>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {doc.notes && (
          <>
            <div style={sectionHead}>{doc.commissionEnabled ? "7" : "6"}. Additional Notes</div>
            <div style={{ ...smallClause, padding: "5px 10px", border: `1px solid #d1d9e6` }}>{doc.notes}</div>
          </>
        )}

        {/* Acceptance notice */}
        <p style={{ fontSize: 10, color: NAVY, fontStyle: "italic", margin: "8px 0 4px", textAlign: "center", fontWeight: 600 }}>
          Please sign and return a copy of this letter within seven (7) days to confirm your acceptance of the above terms.
        </p>

        <div style={{ flex: 1, minHeight: 6 }} />

        {/* Signature block */}
        <div style={{ display: "flex", gap: 24, width: "100%", marginTop: 4, marginBottom: 8, fontSize: 10 }}>
          <div style={{ flex: 1, border: `1px solid #d1d9e6`, padding: "8px 12px", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 2 }}>For &amp; on behalf of Employer</div>
            <div style={{ color: "#374151", marginBottom: 24 }}>{legalName}</div>
            <div style={{ borderTop: `1px solid #6b7280`, paddingTop: 4 }}>
              <div style={{ color: "#6b7280" }}>Name: __________________________</div>
              <div style={{ color: "#6b7280", marginTop: 2 }}>Date: ___________________________</div>
            </div>
          </div>
          <div style={{ flex: 1, border: `1px solid #d1d9e6`, padding: "8px 12px", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 2 }}>Accepted by Employee</div>
            <div style={{ color: "#374151", marginBottom: 24 }}>{doc.candidateName}{doc.candidateNationality ? ` (${doc.candidateNationality})` : ""}</div>
            <div style={{ borderTop: `1px solid #6b7280`, paddingTop: 4 }}>
              <div style={{ color: "#6b7280" }}>Name: __________________________</div>
              <div style={{ color: "#6b7280", marginTop: 2 }}>Date: ___________________________</div>
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
});
OfferLetterTemplate.displayName = "OfferLetterTemplate";
