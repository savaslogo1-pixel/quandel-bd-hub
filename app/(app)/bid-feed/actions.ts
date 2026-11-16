"use server";

import { revalidatePath } from "next/cache";
import { approveBidFeedItem, setBidFeedStatus, type OpenBidStatus } from "@/lib/bidFeed/store";
import { requireUser } from "@/lib/session";

function refresh(extra?: { opportunityId?: string; orgId?: string }) {
  revalidatePath("/bid-feed");
  revalidatePath("/");
  revalidatePath("/pipeline");
  if (extra?.opportunityId) revalidatePath(`/opportunities/${extra.opportunityId}`);
  if (extra?.orgId) revalidatePath(`/organizations/${extra.orgId}`);
}

export async function approveBid(id: string, _prev: { error?: string }, _fd: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const result = await approveBidFeedItem(id, user);
  if (!result.ok) return { error: result.error };
  refresh(result);
  return {};
}

export async function setBidStatus(id: string, _prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const status = String(fd.get("status") ?? "") as OpenBidStatus;
  if (status !== "NEW" && status !== "DISMISSED" && status !== "ON_HOLD") return { error: "Unknown status." };
  const result = await setBidFeedStatus(id, status, user.role);
  if (!result.ok) return { error: result.error };
  refresh();
  return {};
}
