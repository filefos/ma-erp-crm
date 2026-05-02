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
