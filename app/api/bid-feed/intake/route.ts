import { NextResponse } from "next/server";
import { bidFeedAuthorized, parseBidFeedBatch } from "@/lib/bidFeed/parse";
import { upsertBidFeedItems } from "@/lib/bidFeed/store";

/**
 * For the daily sweep: POST a JSON batch with header `Authorization: Bearer $BID_FEED_SECRET`.
 * Items are upserted by externalKey. Re-posting updates the published fields and does not
 * reset status or unlink an opportunity. See README for the request body.
 */
export async function POST(req: Request) {
  if (!bidFeedAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = parseBidFeedBatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const saved = await upsertBidFeedItems(parsed.items);
  return NextResponse.json({
    created: saved.created,
    updated: saved.updated,
    errors: [...parsed.errors, ...saved.errors],
  });
}
