import ExcelJS from "exceljs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EXPORTS, safeCell, toCsv } from "@/lib/export";

export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!me?.active) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const def = EXPORTS[table];
  if (!def) return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  if (def.allowed && !def.allowed(me.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const rows = await def.rows();
  const stamp = new Date().toISOString().slice(0, 10);
  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const base = `bd-hub-${table}-${stamp}`;
  if (format === "csv") {
    return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(def.title.slice(0, 31));
  const cols = rows.length ? Object.keys(rows[0]) : ["(no rows)"];
  ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(50, Math.max(10, c.length + 2)) }));
  for (const r of rows) ws.addRow(Object.fromEntries(cols.map((c) => [c, safeCell(r[c])])));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
}
