// Minimal print-ready HTML renderers for documents shown in WebView.
// Mirrors the brand of the web artifact's DocumentPrint component.

import type { Quotation, ProformaInvoice, Lpo } from "@workspace/api-client-react";

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0a1f3d; background: #ffffff; padding: 24px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px 0; color: #0f2d5a; }
  h2 { font-size: 14px; margin: 24px 0 8px 0; color: #0f2d5a; text-transform: uppercase; letter-spacing: 0.5px; }
  .muted { color: #64748b; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .col { flex: 1; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #eef3fb; color: #1e6ab0; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #dbe5f1; }
  th { background: #eef3fb; color: #0f2d5a; font-weight: 600; font-size: 12px; }
  td.num, th.num { text-align: right; }
  .totals { width: 320px; margin-left: auto; margin-top: 16px; }
  .totals td { border: none; padding: 4px 0; }
  .totals tr.grand td { border-top: 2px solid #0f2d5a; padding-top: 8px; font-weight: 700; font-size: 15px; color: #0f2d5a; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-top: 8px; }
  .meta-grid div span { color: #64748b; }
`;

function esc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[s] as string));
}

function aed(n: number | string | undefined | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "AED 0.00";
  return `AED ${v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// Quotation
// ---------------------------------------------------------------------------
export function quotationHtml(q: Quotation): string {
  const items = q.items ?? [];
  const rows = items.map((it, idx) => {
    const subtotal = Number(it.quantity) * Number(it.rate);
    const disc = Number(it.discount ?? 0);
    const after = subtotal * (1 - disc / 100);
    return `<tr>
      <td>${idx + 1}</td>
      <td>${esc(it.description)}</td>
      <td class="num">${esc(it.quantity)} ${esc(it.unit)}</td>
      <td class="num">${aed(it.rate)}</td>
      <td class="num">${disc ? `${disc.toFixed(1)}%` : "—"}</td>
      <td class="num">${aed(after)}</td>
    </tr>`;
  }).join("");

  const sub = Number(q.subtotal ?? 0);
  const docDisc = Number(q.discount ?? 0);
  const vat = Number(q.vatAmount ?? 0);
  const grand = Number(q.grandTotal ?? 0);

  const body = `
    <div class="row">
      <div class="col">
        <h1>Quotation</h1>
        <div class="muted">${esc(q.quotationNumber)}</div>
        <span class="badge">${esc(q.status)}</span>
      </div>
      <div class="col" style="text-align:right;">
        <div class="muted">${esc(q.companyRef ?? "")}</div>
        <div class="muted">Created ${fmtDate(q.createdAt)}</div>
        ${q.validity ? `<div class="muted">Valid till ${fmtDate(q.validity)}</div>` : ""}
      </div>
    </div>

    <h2>Client</h2>
    <div class="meta-grid">
      <div><span>Name:</span> ${esc(q.clientName)}</div>
      <div><span>Contact:</span> ${esc(q.clientContactPerson ?? "—")}</div>
      <div><span>Email:</span> ${esc(q.clientEmail ?? "—")}</div>
      <div><span>Phone:</span> ${esc(q.clientPhone ?? "—")}</div>
      <div><span>TRN:</span> ${esc(q.customerTrn ?? "—")}</div>
      <div><span>Project:</span> ${esc(q.projectName ?? "—")}</div>
      <div><span>Location:</span> ${esc(q.projectLocation ?? "—")}</div>
    </div>

    <h2>Items</h2>
    <table>
      <thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Disc</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">No line items.</td></tr>`}</tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${aed(sub)}</td></tr>
      ${docDisc ? `<tr><td>Discount (${docDisc}%)</td><td class="num">-${aed(sub * docDisc / 100)}</td></tr>` : ""}
      <tr><td>VAT (${q.vatPercent ?? 0}%)</td><td class="num">${aed(vat)}</td></tr>
      <tr class="grand"><td>Grand total</td><td class="num">${aed(grand)}</td></tr>
    </table>

    ${q.paymentTerms ? `<h2>Payment terms</h2><div>${esc(q.paymentTerms)}</div>` : ""}
    ${q.deliveryTerms ? `<h2>Delivery terms</h2><div>${esc(q.deliveryTerms)}</div>` : ""}
    ${q.termsConditions ? `<h2>Terms &amp; conditions</h2><div>${esc(q.termsConditions)}</div>` : ""}
  `;
  return shell(`Quotation ${q.quotationNumber}`, body);
}

// ---------------------------------------------------------------------------
// Proforma Invoice
// ---------------------------------------------------------------------------
export function proformaHtml(p: ProformaInvoice): string {
  const sub = Number(p.subtotal ?? 0);
  const vat = Number(p.vatAmount ?? 0);
  const total = Number(p.total ?? 0);
  const body = `
    <div class="row">
      <div class="col">
        <h1>Proforma Invoice</h1>
        <div class="muted">${esc(p.piNumber)}</div>
        <span class="badge">${esc(p.status)}</span>
      </div>
      <div class="col" style="text-align:right;">
        <div class="muted">${esc(p.companyRef ?? "")}</div>
        <div class="muted">Created ${fmtDate(p.createdAt)}</div>
        ${p.validityDate ? `<div class="muted">Valid till ${fmtDate(p.validityDate)}</div>` : ""}
      </div>
    </div>

    <h2>Client</h2>
    <div class="meta-grid">
      <div><span>Name:</span> ${esc(p.clientName)}</div>
      <div><span>Project:</span> ${esc(p.projectName ?? "—")}</div>
      <div><span>Quotation:</span> ${esc(p.quotationNumber ?? "—")}</div>
    </div>

    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${aed(sub)}</td></tr>
      <tr><td>VAT</td><td class="num">${aed(vat)}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${aed(total)}</td></tr>
    </table>

    ${p.paymentTerms ? `<h2>Payment terms</h2><div>${esc(p.paymentTerms)}</div>` : ""}
  `;
  return shell(`Proforma ${p.piNumber}`, body);
}

// ---------------------------------------------------------------------------
// LPO
// ---------------------------------------------------------------------------
export function lpoHtml(l: Lpo): string {
  const body = `
    <div class="row">
      <div class="col">
        <h1>Local Purchase Order</h1>
        <div class="muted">${esc(l.lpoNumber)}</div>
        <span class="badge">${esc(l.status)}</span>
      </div>
      <div class="col" style="text-align:right;">
        <div class="muted">${esc(l.companyRef ?? "")}</div>
        ${l.lpoDate ? `<div class="muted">Issued ${fmtDate(l.lpoDate)}</div>` : ""}
      </div>
    </div>

    <h2>Client</h2>
    <div class="meta-grid">
      <div><span>Name:</span> ${esc(l.clientName)}</div>
      <div><span>Project ref:</span> ${esc(l.projectRef ?? "—")}</div>
    </div>

    <table class="totals">
      <tr class="grand"><td>LPO value</td><td class="num">${aed(l.lpoValue)}</td></tr>
    </table>

    ${l.scope ? `<h2>Scope</h2><div>${esc(l.scope)}</div>` : ""}
    ${l.deliverySchedule ? `<h2>Delivery schedule</h2><div>${esc(l.deliverySchedule)}</div>` : ""}
    ${l.paymentTerms ? `<h2>Payment terms</h2><div>${esc(l.paymentTerms)}</div>` : ""}
    ${l.notes ? `<h2>Notes</h2><div>${esc(l.notes)}</div>` : ""}
    ${(l.attachments ?? []).length ? `<h2>Attachments</h2><ul>${(l.attachments ?? []).map(a => `<li>${esc(a.filename ?? "file")}</li>`).join("")}</ul>` : ""}
  `;
  return shell(`LPO ${l.lpoNumber}`, body);
}
