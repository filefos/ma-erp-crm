import * as XLSX from "xlsx";

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map(row => row.map(cell => {
      const v = cell == null ? "" : String(cell);
      return `"${v.replace(/"/g, '""')}"`;
    }).join(","))
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

export function downloadExcel(
  filename: string,
  rows: (string | number | null | undefined)[][],
  sheetName = "Sheet1"
) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  const colWidths = rows[0]?.map((_, colIdx) => {
    const max = rows.reduce((m, row) => {
      const len = row[colIdx] == null ? 0 : String(row[colIdx]).length;
      return Math.max(m, len);
    }, 10);
    return { wch: Math.min(max + 2, 50) };
  }) ?? [];
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : filename + ".xlsx");
}

export function downloadWord(
  filename: string,
  title: string,
  rows: (string | number | null | undefined)[][]
) {
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const headerCells = header.map(h =>
    `<th style="background:#0f2d5a;color:#fff;padding:8px 10px;border:1px solid #ccc;text-align:left;font-weight:bold;">${h ?? ""}</th>`
  ).join("");

  const bodyRows = body.map(row => {
    const cells = row.map(cell =>
      `<td style="padding:7px 10px;border:1px solid #ccc;">${cell ?? ""}</td>`
    ).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 24px; }
    h2 { color: #0f2d5a; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; }
    th { background: #0f2d5a; color: #fff; }
  </style>
</head>
<body>
  <h2>${title}</h2>
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
  rows: (string | number | null | undefined)[][]
) {
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const headerCells = header.map(h =>
    `<th style="background:#0f2d5a;color:#fff;padding:8px 10px;border:1px solid #ddd;text-align:left;">${h ?? ""}</th>`
  ).join("");

  const bodyRows = body.map((row, i) => {
    const cells = row.map(cell =>
      `<td style="padding:7px 10px;border:1px solid #ddd;">${cell ?? ""}</td>`
    ).join("");
    const bg = i % 2 === 0 ? "" : "background:#f7f9fc;";
    return `<tr style="${bg}">${cells}</tr>`;
  }).join("");

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { window.print(); return; }

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 15mm; size: A4 landscape; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; }
    h2 { color: #0f2d5a; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #0f2d5a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 8px 10px; border: 1px solid #ddd; text-align: left; font-weight: bold; }
    td { padding: 7px 10px; border: 1px solid #ddd; }
    .footer { margin-top: 24px; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">Prime Max &amp; Elite Prefab Smart ERP CRM — Printed on ${new Date().toLocaleString()}</div>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
