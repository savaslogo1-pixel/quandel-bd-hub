// Reads .xlsx and .csv uploads into plain text grids. Server-only.
import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_ROWS = 5000;

export type Grid = { headers: string[]; rows: string[][] };

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("hyperlink" in v) return String((v as { hyperlink: string }).hyperlink);
    if ("result" in v) return cellText((v as { result: ExcelJS.CellValue }).result ?? null); // formula
    if ("error" in v) return "";
    return "";
  }
  return String(v).trim();
}

export async function sheetNames(fileName: string, data: Buffer): Promise<string[]> {
  if (/\.csv$/i.test(fileName)) return ["CSV"];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  return wb.worksheets.filter((w) => w.state === "visible").map((w) => w.name);
}

/** Read one sheet. `headerRow` is 1-based; rows above it are ignored, blank rows are dropped. */
export async function readGrid(fileName: string, data: Buffer, sheet: string | null, headerRow = 1): Promise<Grid> {
  let raw: string[][];
  if (/\.csv$/i.test(fileName)) {
    const parsed = Papa.parse<string[]>(data.toString("utf8").replace(/^﻿/, ""), { skipEmptyLines: false });
    raw = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as unknown as ArrayBuffer);
    const ws = (sheet && wb.getWorksheet(sheet)) || wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    raw = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(cellText(row.getCell(c).value));
      raw[n - 1] = vals;
    });
    for (let i = 0; i < raw.length; i++) if (!raw[i]) raw[i] = [];
  }
  const h = Math.max(1, headerRow) - 1;
  const headers = (raw[h] ?? []).map((x, i) => x || `Column ${i + 1}`);
  const width = headers.length;
  const rows = raw
    .slice(h + 1)
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""))
    .filter((r) => r.some((c) => c !== ""))
    .slice(0, MAX_ROWS);
  return { headers, rows };
}

/** First row (of the first 15) with at least three filled cells: usually the header row. */
export async function detectHeaderRow(fileName: string, data: Buffer, sheet: string | null): Promise<number> {
  const g = await readGrid(fileName, data, sheet, 1);
  const all = [g.headers.map((h) => (/^Column \d+$/.test(h) ? "" : h)), ...g.rows].slice(0, 15);
  const i = all.findIndex((r) => r.filter((c) => c.trim()).length >= 3);
  return i < 0 ? 1 : i + 1;
}
