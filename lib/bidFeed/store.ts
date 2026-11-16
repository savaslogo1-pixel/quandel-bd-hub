// Bid-feed writes: upsert a batch, approve into a stage-1 opportunity, dismiss or restore.
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canEditOpportunities } from "@/lib/permissions";
import {
  cleanCounty,
  cleanOwnerName,
  creationNote,
  inferOrgType,
  inferPursuit,
  namesMatch,
  normCounty,
  type BidFeedInput,
  type ItemError,
} from "@/lib/bidFeed/parse";

export type UpsertResult = { created: number; updated: number; errors: ItemError[] };

function scalars(item: BidFeedInput) {
  return {
    title: item.title,
    ownerName: item.ownerName,
    county: item.county,
    location: item.location,
    state: item.state,
    kind: item.kind,
    typeLabel: item.typeLabel,
    estimatedValue: item.estimatedValue == null ? null : item.estimatedValue.toFixed(2),
    valueText: item.valueText,
    dueAt: item.dueAt,
    preBidAt: item.preBidAt,
    preBidText: item.preBidText,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    priority: item.priority,
    notes: item.notes,
    why: item.why,
  };
}

function isUnique(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function companyIds(codes: string[]): Promise<{ ids: string[]; leadId: string | null } | { error: string }> {
  if (!codes.length) return { ids: [], leadId: null };
  const rows = await prisma.company.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const byCode = new Map(rows.map((r) => [r.code, r.id]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) return { error: `Company ${missing.join(", ")} is not in the database. Seed companies first.` };
  const ids = codes.map((c) => byCode.get(c)!);
  return { ids, leadId: ids[0] ?? null };
}

/**
 * Insert or update by externalKey. A re-post refreshes the published fields and company
 * tags. Status, first-seen time and any linked opportunity are left as they are.
 */
export async function upsertBidFeedItems(items: BidFeedInput[], createdById?: string): Promise<UpsertResult> {
  let created = 0;
  let updated = 0;
  const errors: ItemError[] = [];
  for (const [index, item] of items.entries()) {
    const companies = await companyIds(item.companyCodes);
    if ("error" in companies) {
      errors.push({ index, externalKey: item.externalKey, message: companies.error });
      continue;
    }
    const data = scalars(item);
    const links = {
      leadCompany: companies.leadId ? { connect: { id: companies.leadId } } : undefined,
      companies: { connect: companies.ids.map((id) => ({ id })) },
    };
    try {
      const existing = await prisma.bidFeedItem.findUnique({ where: { externalKey: item.externalKey }, select: { id: true } });
      if (existing) {
        await prisma.bidFeedItem.update({
          where: { id: existing.id },
          data: {
            ...data,
            leadCompany: companies.leadId ? { connect: { id: companies.leadId } } : { disconnect: true },
            companies: { set: companies.ids.map((id) => ({ id })) },
          },
        });
        updated++;
      } else {
        await prisma.bidFeedItem.create({
          data: {
            ...data,
            externalKey: item.externalKey,
            status: "NEW",
            firstSeenAt: new Date(),
            ...links,
            ...(createdById ? { createdBy: { connect: { id: createdById } } } : {}),
          },
        });
        created++;
      }
    } catch (e) {
      if (!isUnique(e)) {
        errors.push({ index, externalKey: item.externalKey, message: "Could not save this item." });
        continue;
      }
      // Another request inserted the same key between the read and the write.
      try {
        await prisma.bidFeedItem.update({
          where: { externalKey: item.externalKey },
          data: {
            ...data,
            leadCompany: companies.leadId ? { connect: { id: companies.leadId } } : { disconnect: true },
            companies: { set: companies.ids.map((id) => ({ id })) },
          },
        });
        updated++;
      } catch {
        errors.push({ index, externalKey: item.externalKey, message: "Could not save this item." });
      }
    }
  }
  return { created, updated, errors };
}

export type ApproveResult =
  | { ok: true; opportunityId: string; orgId: string; createdOrg: boolean }
  | { ok: false; error: string };

/**
 * Match an organization by normalized name (or create one), then open a stage 1 (Target)
 * opportunity. The first matched company is the lead; the rest support it.
 */
export async function approveBidFeedItem(id: string, user: { id: string; role: Role }): Promise<ApproveResult> {
  if (!canEditOpportunities(user.role)) return { ok: false, error: "Your role can view the bid feed but not approve items." };
  const item = await prisma.bidFeedItem.findUnique({
    where: { id },
    include: { companies: true, leadCompany: true },
  });
  if (!item) return { ok: false, error: "That item is no longer in the feed." };
  if (item.opportunityId) return { ok: false, error: "Already approved. Open the linked opportunity." };

  const lead = item.leadCompany ?? item.companies[0];
  if (!lead) return { ok: false, error: "Tag at least one Quandel company before approving." };
  const support = item.companies.filter((c) => c.id !== lead.id);
  const companyIds = [lead.id, ...support.map((c) => c.id)];

  const ownerName = cleanOwnerName(item.ownerName);
  const county = cleanCounty(item.county);
  const inferred = inferOrgType(ownerName);
  const pursuit = inferPursuit(item);
  const note = creationNote({
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    valueText: item.valueText,
    why: item.why,
    preBidText: item.preBidText,
  });

  const candidates = await prisma.organization.findMany({
    where: { state: item.state },
    select: { id: true, name: true, county: true, orgType: true },
    orderBy: { createdAt: "asc" },
  });
  let matches = candidates.filter((o) => namesMatch(o.name, ownerName));
  const countyKey = normCounty(county);
  if (matches.length > 1 && countyKey) {
    const sameCounty = matches.filter((o) => normCounty(o.county) === countyKey);
    if (sameCounty.length) matches = sameCounty;
  }
  if (matches.length > 1) {
    const sameType = matches.filter((o) => o.orgType === inferred.value);
    if (sameType.length === 1) matches = sameType;
  }
  if (matches.length > 1) {
    const names = [...new Set(matches.map((o) => o.name))].join("; ");
    return { ok: false, error: `Several organizations match "${ownerName}" (${names}). Merge the duplicates, then approve again.` };
  }

  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      let orgId: string;
      let createdOrg = false;
      if (matches.length === 1) {
        orgId = matches[0].id;
        await tx.organization.update({ where: { id: orgId }, data: { companies: { connect: companyIds.map((cid) => ({ id: cid })) } } });
      } else {
        const exact = await tx.organization.findFirst({
          where: { name: ownerName, state: item.state, orgType: inferred.value, county },
          select: { id: true },
        });
        if (exact) {
          orgId = exact.id;
          await tx.organization.update({ where: { id: orgId }, data: { companies: { connect: companyIds.map((cid) => ({ id: cid })) } } });
        } else {
          const org = await tx.organization.create({
            data: {
              name: ownerName,
              orgType: inferred.value,
              state: item.state,
              county,
              status: "TARGET",
              source: "Bid feed",
              notes: inferred.confirm
                ? "Created from the bid feed. Organization type [confirm]."
                : "Created from the bid feed.",
              companies: { connect: companyIds.map((cid) => ({ id: cid })) },
              createdBy: { connect: { id: user.id } },
            },
          });
          orgId = org.id;
          createdOrg = true;
        }
      }

      const opp = await tx.opportunity.create({
        data: {
          name: item.title,
          org: { connect: { id: orgId } },
          leadCompany: { connect: { id: lead.id } },
          supportCompanies: { connect: support.map((c) => ({ id: c.id })) },
          projectType: pursuit.projectType,
          deliveryMethod: pursuit.deliveryMethod,
          estimatedValue: item.estimatedValue == null ? null : item.estimatedValue.toFixed(2),
          dueDate: item.dueAt,
          preBidDate: item.preBidAt,
          stage: 1,
          stageEnteredAt: now,
          owner: { connect: { id: user.id } },
          createdBy: { connect: { id: user.id } },
          stageChanges: { create: { toStage: 1, note, changedById: user.id } },
        },
      });

      const claimed = await tx.bidFeedItem.updateMany({
        where: { id: item.id, opportunityId: null },
        data: { status: "APPROVED", opportunityId: opp.id },
      });
      if (claimed.count !== 1) throw new Error("ALREADY_APPROVED");
      return { ok: true as const, opportunityId: opp.id, orgId, createdOrg };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_APPROVED") return { ok: false, error: "Already approved. Open the linked opportunity." };
    if (isUnique(e)) return { ok: false, error: "That record conflicted with one that already exists. Refresh and try again." };
    throw e;
  }
}

const OPEN_STATUSES = ["NEW", "DISMISSED", "ON_HOLD"] as const;
export type OpenBidStatus = (typeof OPEN_STATUSES)[number];

/** Dismiss, hold, or restore. An approved item stays linked to its opportunity. */
export async function setBidFeedStatus(id: string, status: OpenBidStatus, role: Role): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canEditOpportunities(role)) return { ok: false, error: "Your role can view the bid feed but not change items." };
  if (!OPEN_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const item = await prisma.bidFeedItem.findUnique({ where: { id }, select: { status: true, opportunityId: true } });
  if (!item) return { ok: false, error: "That item is no longer in the feed." };
  if (item.opportunityId || item.status === "APPROVED") return { ok: false, error: "This item is already an opportunity. Change the pursuit on its page." };
  if (item.status !== status) await prisma.bidFeedItem.update({ where: { id }, data: { status } });
  return { ok: true };
}
