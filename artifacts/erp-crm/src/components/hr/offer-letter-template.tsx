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
  const lower = (doc.companyName ?? "").toLowerCase();
  const isPrime = lower.includes("prime");
  const legalName = isPrime ? PRIME_LEGAL : ELITE_LEGAL;
  const totalSalary = (doc.basicSalary ?? 0) + (doc.allowances ?? 0);
  const dutyLine = doc.templateType === "labour" ? LABOUR_DUTY : STAFF_DUTY;

  return (
    <div ref={ref} className="bg-white text-black mx-auto" style={{ width: "794px", minHeight: "1123px", padding: "48px 56px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Letterhead */}
      <div className="flex items-center gap-4 pb-4 border-b-4" style={{ borderColor: "#0f2d5a" }}>
        {isPrime ? (
          <img src="/erp-crm/prime-max-logo.png" alt="Prime Max" className="h-20 w-auto" crossOrigin="anonymous" />
        ) : (
          <div className="h-20 w-20 flex items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#0f2d5a,#1e6ab0)", color: "white", fontWeight: 800, fontSize: 18, textAlign: "center", lineHeight: 1.1 }}>
            ELITE<br />LOGO
          </div>
        )}
        <div className="flex-1">
          <div style={{ color: "#0f2d5a", fontSize: 20, fontWeight: 800, lineHeight: 1.1, letterSpacing: 0.5 }}>{legalName}</div>
          <div style={{ color: "#1e6ab0", fontSize: 12, marginTop: 4 }}>Industrial Area · Sharjah · United Arab Emirates</div>
          <div style={{ color: "#1e6ab0", fontSize: 12 }}>P.O. Box · Tel · Email · TRN</div>
        </div>
        <div className="text-right" style={{ fontSize: 11 }}>
          <div><strong>Ref:</strong> {doc.letterNumber}</div>
          <div><strong>Date:</strong> {(doc.issuedAt ? new Date(doc.issuedAt) : new Date()).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      {/* Subject */}
      <h1 className="text-center mt-8 mb-4" style={{ color: "#0f2d5a", fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>OFFER OF EMPLOYMENT</h1>

      {/* Addressee */}
      <div style={{ fontSize: 13 }} className="space-y-1">
        <div><strong>To:</strong> {doc.candidateName}</div>
        {doc.candidateNationality && <div><strong>Nationality:</strong> {doc.candidateNationality}</div>}
        {doc.candidatePassportNo && <div><strong>Passport No:</strong> {doc.candidatePassportNo}</div>}
      </div>

      <p className="mt-4" style={{ fontSize: 13, lineHeight: 1.6 }}>Dear {doc.candidateName.split(" ")[0]},</p>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        We are pleased to offer you the position of <strong>{doc.designation ?? "—"}</strong> with{" "}
        <strong>{legalName}</strong>, on the terms and conditions set out below.
      </p>

      {/* Compensation */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>1. Compensation</h2>
      <table className="w-full mt-2" style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: "6px 8px", border: "1px solid #ccd" }}>Basic Salary</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.basicSalary ?? 0).toLocaleString()}</td></tr>
          <tr><td style={{ padding: "6px 8px", border: "1px solid #ccd" }}>Allowances</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.allowances ?? 0).toLocaleString()}</td></tr>
          <tr style={{ background: "#f1f5fa" }}><td style={{ padding: "6px 8px", border: "1px solid #ccd", fontWeight: 700 }}>Gross Monthly Salary</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right", fontWeight: 700 }}>AED {totalSalary.toLocaleString()}</td></tr>
        </tbody>
      </table>

      {/* Joining + duty timing */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>2. Joining Date & Duty Timing</h2>
      <p style={{ fontSize: 12, lineHeight: 1.6 }}><strong>Joining Date:</strong> {doc.joiningDate ? new Date(doc.joiningDate).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" }) : "To be agreed"}</p>
      <p style={{ fontSize: 12, lineHeight: 1.6 }}>{dutyLine}</p>

      {/* Rules */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>3. Company Rules & Code of Conduct</h2>
      <p style={{ fontSize: 12, lineHeight: 1.55 }}>The following rules form part of this agreement and the employee is required to read, understand and sign them as a condition of employment:</p>
      <ol style={{ fontSize: 12, lineHeight: 1.55, paddingLeft: 18, marginTop: 6 }}>
        {COMPANY_RULES.map((r, i) => (
          <li key={i} className="mb-1.5"><span style={{ fontWeight: 600 }}>{i + 1}.</span> {r}</li>
        ))}
      </ol>

      {doc.notes && (
        <>
          <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>4. Additional Notes</h2>
          <p style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{doc.notes}</p>
        </>
      )}

      {/* Acceptance */}
      <p className="mt-6" style={{ fontSize: 12, lineHeight: 1.55 }}>
        Kindly sign and return a copy of this letter within seven (7) days of receipt to confirm your acceptance of this offer and the Company Rules & Code of Conduct above.
      </p>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-10" style={{ fontSize: 12 }}>
        <div>
          <div style={{ borderTop: "1px solid #555", paddingTop: 6 }}>For and on behalf of</div>
          <div style={{ fontWeight: 700, color: "#0f2d5a" }}>{legalName}</div>
          <div className="mt-12" style={{ borderTop: "1px solid #555", paddingTop: 6 }}>Authorised Signatory</div>
        </div>
        <div>
          <div style={{ borderTop: "1px solid #555", paddingTop: 6 }}>Accepted by</div>
          <div style={{ fontWeight: 700 }}>{doc.candidateName}</div>
          <div className="mt-12" style={{ borderTop: "1px solid #555", paddingTop: 6 }}>Signature & Date</div>
        </div>
      </div>
    </div>
  );
});
OfferLetterTemplate.displayName = "OfferLetterTemplate";
