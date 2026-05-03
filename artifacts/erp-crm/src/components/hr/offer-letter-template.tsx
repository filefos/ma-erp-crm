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
  "The employee shall comply with all UAE labour laws, immigration regulations and company policies in force from time to time.",
  "Probation period shall be six (6) months from the joining date during which either party may terminate this agreement with fourteen (14) days written notice.",
  "Working days are Monday to Saturday. Friday is the weekly off day. Public holidays are observed as per UAE Government calendar.",
  "Annual leave is thirty (30) calendar days after completing one (1) year of continuous service, accrued pro-rata.",
  "Sick leave entitlement is as per Article 31 of UAE Labour Law (15 days full pay, 30 days half pay, 45 days unpaid).",
  "Salary will be paid monthly through the WPS (Wage Protection System) on or before the 10th of every following month.",
  "Annual return air ticket to home country will be provided after completion of every two (2) years of continuous service.",
  "Medical insurance and accommodation/transport will be provided as per UAE law and company policy.",
  "End-of-service gratuity will be paid as per UAE Labour Law (21 days basic salary per year for the first 5 years, 30 days thereafter).",
  "The employee shall maintain confidentiality of all company, client, project and pricing information during and after employment.",
  "Any disputes arising from this agreement shall be resolved under the jurisdiction of the UAE labour courts and applicable UAE laws.",
];

const STAFF_HOURS = "Working hours: Monday to Saturday, 08:00 to 18:00, with a one (1) hour lunch break (total 9 working hours per day).";
const LABOUR_HOURS = "Working hours: Monday to Saturday, 07:00 to 19:00 — 9 working hours plus 2 hours of breaks (including 1 hour lunch).";

export const OfferLetterTemplate = forwardRef<HTMLDivElement, { doc: OfferLetterDoc }>(({ doc }, ref) => {
  const isPrime = (doc.companyName ?? "").toLowerCase().includes("prime max");
  const totalSalary = (doc.basicSalary ?? 0) + (doc.allowances ?? 0);
  const hoursLine = doc.templateType === "labour" ? LABOUR_HOURS : STAFF_HOURS;

  return (
    <div ref={ref} className="bg-white text-black mx-auto" style={{ width: "794px", minHeight: "1123px", padding: "48px 56px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Letterhead */}
      <div className="flex items-center gap-4 pb-4 border-b-4" style={{ borderColor: "#0f2d5a" }}>
        {isPrime ? (
          <img src="/erp-crm/prime-max-logo.png" alt="Prime Max" className="h-20 w-auto" crossOrigin="anonymous" />
        ) : (
          <div className="h-20 w-20 flex items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#0f2d5a,#1e6ab0)", color: "white", fontWeight: 800, fontSize: 28 }}>EP</div>
        )}
        <div className="flex-1">
          <div style={{ color: "#0f2d5a", fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{doc.companyName ?? (isPrime ? "Prime Max Prefab Houses Ind. LLC" : "Elite Prefab Industries LLC")}</div>
          <div style={{ color: "#1e6ab0", fontSize: 12 }}>Industrial Area · Sharjah · United Arab Emirates</div>
          <div style={{ color: "#1e6ab0", fontSize: 12 }}>P.O. Box · Tel · Email · TRN</div>
        </div>
        <div className="text-right" style={{ fontSize: 11 }}>
          <div><strong>Ref:</strong> {doc.letterNumber}</div>
          <div><strong>Date:</strong> {(doc.issuedAt ? new Date(doc.issuedAt) : new Date()).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      {/* Subject */}
      <h1 className="text-center mt-8 mb-4" style={{ color: "#0f2d5a", fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>OFFER OF EMPLOYMENT</h1>

      {/* Greeting + addressee */}
      <div style={{ fontSize: 13 }} className="space-y-2">
        <div><strong>To:</strong> {doc.candidateName}</div>
        {doc.candidateNationality && <div><strong>Nationality:</strong> {doc.candidateNationality}</div>}
        {doc.candidatePassportNo && <div><strong>Passport No:</strong> {doc.candidatePassportNo}</div>}
      </div>

      <p className="mt-4" style={{ fontSize: 13, lineHeight: 1.6 }}>Dear {doc.candidateName.split(" ")[0]},</p>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        We are pleased to offer you the position of <strong>{doc.designation ?? "—"}</strong> with{" "}
        <strong>{doc.companyName ?? (isPrime ? "Prime Max Prefab Houses Ind. LLC" : "Elite Prefab Industries LLC")}</strong>, based in the United Arab Emirates,
        on the terms and conditions set out below.
      </p>

      {/* Compensation */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>1. Compensation</h2>
      <table className="w-full mt-2" style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={{ padding: "6px 8px", border: "1px solid #ccd" }}>Basic Salary</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.basicSalary ?? 0).toLocaleString()}</td></tr>
          <tr><td style={{ padding: "6px 8px", border: "1px solid #ccd" }}>Allowances (housing, transport, etc.)</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right" }}>AED {(doc.allowances ?? 0).toLocaleString()}</td></tr>
          <tr style={{ background: "#f1f5fa" }}><td style={{ padding: "6px 8px", border: "1px solid #ccd", fontWeight: 700 }}>Gross Monthly Salary</td><td style={{ padding: "6px 8px", border: "1px solid #ccd", textAlign: "right", fontWeight: 700 }}>AED {totalSalary.toLocaleString()}</td></tr>
        </tbody>
      </table>

      {/* Joining + hours */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>2. Joining Date & Working Hours</h2>
      <p style={{ fontSize: 12, lineHeight: 1.6 }}><strong>Joining Date:</strong> {doc.joiningDate ? new Date(doc.joiningDate).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" }) : "To be agreed"}</p>
      <p style={{ fontSize: 12, lineHeight: 1.6 }}>{hoursLine}</p>

      {/* Rules */}
      <h2 className="mt-5" style={{ color: "#0f2d5a", fontSize: 14, fontWeight: 700 }}>3. Terms & Conditions</h2>
      <ol style={{ fontSize: 12, lineHeight: 1.55, paddingLeft: 18 }}>
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
        Kindly sign and return a copy of this letter within seven (7) days of receipt to confirm your acceptance of this offer.
      </p>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-10" style={{ fontSize: 12 }}>
        <div>
          <div style={{ borderTop: "1px solid #555", paddingTop: 6 }}>For and on behalf of</div>
          <div style={{ fontWeight: 700, color: "#0f2d5a" }}>{doc.companyName ?? "the Company"}</div>
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
