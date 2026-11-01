import { NextResponse } from "next/server";
import { generateDeadlineAlerts } from "@/lib/alerts";

/**
 * For a scheduled job (e.g. daily): POST with header `Authorization: Bearer $CRON_SECRET`.
 * Creates any due deadline alerts for everyone. Alerts are also generated when people open the app.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const created = await generateDeadlineAlerts();
  return NextResponse.json({ created });
}
