import ExcelJS from "exceljs";

function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function sanitizeCsvCell(cell: string | number | null | undefined): string {
  const v = cell == null ? "" : String(cell);
  const sanitized = /^[=+\-@\t\r]/.test(v) ? "\t" + v : v;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map(row => row.map(cell => sanitizeCsvCell(cell)).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function tableToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { header: string; key: keyof T; format?: (v: unknown) => string }[]
): (string | number | null | undefined)[][] {
  const header = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(c => {
      const v = row[c.key];
      return c.format ? c.format(v) : (v as string | number | null | undefined);
    })
  );
  return [header, ...rows];
}

export async function downloadExcel(
  filename: string,
  rows: (string | number | null | undefined)[][],
  sheetName = "Sheet1"
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  const colWidths = rows[0]?.map((_, colIdx) => {
    const max = rows.reduce((m, row) => {
      const len = row[colIdx] == null ? 0 : String(row[colIdx]).length;
      return Math.max(m, len);
    }, 10);
    return Math.min(max + 2, 50);
  }) ?? [];

  ws.columns = colWidths.map(width => ({ width }));

  for (const row of rows) {
    ws.addRow(row.map(cell => cell ?? ""));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadWord(
  filename: string,
  title: string,
  rows: (string | number | null | undefined)[][]
) {
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const headerCells = header.map(h =>
    `<th style="background:#0f2d5a;color:#fff;padding:8px 10px;border:1px solid #ccc;text-align:left;font-weight:bold;">${escapeHtml(h)}</th>`
  ).join("");

  const bodyRows = body.map(row => {
    const cells = row.map(cell =>
      `<td style="padding:7px 10px;border:1px solid #ccc;">${escapeHtml(cell)}</td>`
    ).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 24px; }
    h2 { color: #0f2d5a; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; }
    th { background: #0f2d5a; color: #fff; }
  </style>
</head>
<body>
  <h2>${escapeHtml(title)}</h2>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".doc") ? filename : filename + ".doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function printTable(
  title: string,
  rows: (string | number | null | undefined)[][],
  landscape = true
) {
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const printDate = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const headerCells = header.map(h =>
    `<th>${escapeHtml(h)}</th>`
  ).join("");

  const bodyRows = body.map((row, i) => {
    const cells = row.map(cell =>
      `<td>${escapeHtml(cell)}</td>`
    ).join("");
    const cls = i % 2 === 0 ? "" : ' class="alt"';
    return `<tr${cls}>${cells}</tr>`;
  }).join("");

  const win = window.open("", "_blank", "width=1050,height=750");
  if (!win) { window.print(); return; }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 12mm 10mm; size: A4 ${landscape ? "landscape" : "portrait"}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #222; background: #fff; }

    /* ── LETTERHEAD ── */
    .letterhead {
      background: #0f2d5a;
      color: #fff;
      padding: 10px 16px 8px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .letterhead .co-name { font-size: 17pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; line-height: 1.2; }
    .letterhead .co-sub  { font-size: 8pt; opacity: 0.88; margin-top: 2px; }
    .letterhead .co-div  { display: inline-block; width: 1px; background: rgba(255,255,255,0.35); height: 10px; margin: 0 8px; vertical-align: middle; }

    /* ── TITLE STRIP ── */
    .doc-title {
      background: #1e6ab0;
      color: #fff;
      text-align: center;
      padding: 5px 16px;
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── META ROW ── */
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 4px;
      font-size: 8.5pt;
      border-bottom: 1px solid #ccc;
      margin-bottom: 8px;
      color: #444;
    }
    .meta .rec-count { font-weight: bold; color: #0f2d5a; }

    /* ── DATA TABLE ── */
    table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
    th {
      background: #0f2d5a !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 7px 8px;
      border: 1px solid #999;
      text-align: left;
      font-weight: bold;
      white-space: nowrap;
    }
    td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: top; }
    tr.alt td { background: #f3f7fc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* ── FOOTER ── */
    .footer {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #888;
    }
    .footer .left  { text-align: left; }
    .footer .right { text-align: right; }
    .footer strong { color: #0f2d5a; }
  </style>
</head>
<body>

  <div class="letterhead">
    <div class="co-name">Prime Max Prefab Houses Ind. LLC <span class="co-div"></span> Elite Prefab Industries LLC</div>
    <div class="co-sub">
      Industrial Area 12, Sharjah, UAE &nbsp;|&nbsp; TRN: 100234567890001
      &nbsp;&nbsp;&bull;&nbsp;&nbsp;
      Industrial Area, Dubai, UAE &nbsp;|&nbsp; TRN: 100345678900001
    </div>
    <div class="co-sub">
      Tel: +971 50 2940 131 &nbsp;|&nbsp; info@primemaxprefab.com
      &nbsp;&nbsp;&bull;&nbsp;&nbsp;
      Tel: +971 55 100 2000 &nbsp;|&nbsp; info@eliteprefab.ae
    </div>
  </div>

  <div class="doc-title">${escapeHtml(title)}</div>

  <div class="meta">
    <span class="rec-count">${body.length} record${body.length !== 1 ? "s" : ""}</span>
    <span>Printed: ${printDate}</span>
  </div>

  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="footer">
    <div class="left"><strong>PRIME ERP SYSTEMS</strong> — Confidential</div>
    <div class="right">Generated: ${printDate}</div>
  </div>

</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}
