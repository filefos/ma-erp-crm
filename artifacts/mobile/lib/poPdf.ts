import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { fmtAed, fmtDate } from "@/lib/format";

interface POLike {
  poNumber?: string | null;
  status?: string | null;
  supplierName?: string | null;
  supplierAddress?: string | null;
  supplierTrn?: string | null;
  paymentTerms?: string | null;
  deliveryDate?: string | null;
  createdAt?: string | null;
  notes?: string | null;
  subtotal?: number | string | null;
  vatRate?: number | string | null;
  vatAmount?: number | string | null;
  total?: number | string | null;
  items?: Array<{
    itemName?: string | null;
    quantity?: number | string | null;
    unit?: string | null;
    unitPrice?: number | string | null;
    amount?: number | string | null;
  }> | null;
}

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildHtml(po: POLike, companyName?: string | null): string {
  const rows = (po.items ?? []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.itemName)}</td>
      <td class="num">${esc(it.quantity)} ${esc(it.unit ?? "")}</td>
      <td class="num">${fmtAed(it.unitPrice)}</td>
      <td class="num">${fmtAed(it.amount)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    @page { margin: 24px; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #0b3d91; }
    .muted { color: #64748b; font-size: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; margin: 16px 0; }
    .col { flex: 1; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 12px; width: 280px; margin-left: auto; font-size: 13px; }
    .totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { border-top: 2px solid #0b3d91; padding-top: 8px; margin-top: 4px; font-weight: 700; color: #0b3d91; font-size: 15px; }
    .notes { margin-top: 16px; padding: 10px; background: #f8fafc; border-radius: 6px; font-size: 12px; }
  </style></head><body>
    <div class="row">
      <div class="col">
        <h1>Purchase Order</h1>
        <div class="muted">${esc(companyName ?? "")}</div>
      </div>
      <div class="col" style="text-align:right">
        <div style="font-size:18px;font-weight:700">${esc(po.poNumber ?? "")}</div>
        <div class="pill">${esc(po.status ?? "draft")}</div>
        ${po.createdAt ? `<div class="muted">Issued ${esc(fmtDate(po.createdAt))}</div>` : ""}
      </div>
    </div>

    <div class="row">
      <div class="col">
        <div class="muted">Supplier</div>
        <div style="font-weight:600">${esc(po.supplierName ?? "")}</div>
        ${po.supplierAddress ? `<div class="muted">${esc(po.supplierAddress)}</div>` : ""}
        ${po.supplierTrn ? `<div class="muted">TRN ${esc(po.supplierTrn)}</div>` : ""}
      </div>
      <div class="col">
        <div class="muted">Delivery</div>
        <div>${esc(po.deliveryDate ? fmtDate(po.deliveryDate) : "—")}</div>
        <div class="muted" style="margin-top:8px">Payment terms</div>
        <div>${esc(po.paymentTerms ?? "—")}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th style="width:32px">#</th><th>Item</th>
        <th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">No items</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div class="line"><span>Subtotal</span><span>${fmtAed(po.subtotal)}</span></div>
      <div class="line"><span>VAT${po.vatRate ? ` (${esc(po.vatRate)}%)` : ""}</span><span>${fmtAed(po.vatAmount)}</span></div>
      <div class="line grand"><span>Total</span><span>${fmtAed(po.total)}</span></div>
    </div>

    ${po.notes ? `<div class="notes"><div class="muted">Notes</div>${esc(po.notes)}</div>` : ""}
  </body></html>`;
}

export async function generatePoPdf(po: POLike, companyName?: string | null): Promise<string> {
  const html = buildHtml(po, companyName);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function sharePoPdf(po: POLike, companyName?: string | null): Promise<void> {
  const uri = await generatePoPdf(po, companyName);
  if (Platform.OS === "ios" || Platform.OS === "android") {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Share ${po.poNumber ?? "Purchase Order"}`,
        UTI: "com.adobe.pdf",
      });
      return;
    }
  }
  await Print.printAsync({ html: buildHtml(po, companyName) });
}

export async function previewPoPdf(po: POLike, companyName?: string | null): Promise<void> {
  await Print.printAsync({ html: buildHtml(po, companyName) });
}
