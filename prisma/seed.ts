// Seeds reference data only: the five companies + parent, picklists, the funding program library and state rules.
// Source files live in /data so non-developers can edit them. Never seeds people or records.
import { PrismaClient } from "@prisma/client";
import companies from "../data/companies.json";
import picklists from "../data/picklists.json";
import programs from "../data/programs.json";
import stateRules from "../data/state_rules.json";
import training from "../data/training.json";
import competitors from "../data/competitors.json";
import { linkCompetitorProjects } from "../lib/competitors";

const prisma = new PrismaClient();

async function main() {
  for (const c of companies.companies) {
    await prisma.company.upsert({ where: { code: c.code }, update: c, create: c });
  }
  for (const [list, values] of Object.entries(picklists.lists)) {
    for (const [i, value] of (values as string[]).entries()) {
      await prisma.picklistValue.upsert({
        where: { list_value: { list, value } },
        update: {},
        create: { list, value, label: value, sortOrder: i },
      });
    }
  }
  // Programs: create missing ones only, so edits made in the app are never overwritten.
  for (const p of programs.programs) {
    const { last_verified, nextDeadline, ...rest } = p as typeof p & { last_verified: string | null; nextDeadline: string | null };
    await prisma.fundingProgram.upsert({
      where: { key: p.key },
      update: {},
      create: {
        ...(rest as Record<string, unknown> as { key: string; name: string; jurisdiction: string }),
        nextDeadline: nextDeadline ? new Date(nextDeadline + "T00:00:00Z") : null,
        lastVerifiedAt: last_verified ? new Date(last_verified + "T00:00:00Z") : null,
      },
    });
  }
  // State rules: create missing ones only (edits and verification in the app are kept).
  for (const r of stateRules.rules) {
    await prisma.stateRule.upsert({
      where: { key: r.key },
      update: {},
      create: {
        key: r.key, jurisdiction: r.jurisdiction, topic: r.topic, text: r.text, unit: r.unit, source: r.source,
        value: r.value == null ? null : String(r.value),
        lastVerifiedAt: r.last_verified ? new Date(r.last_verified + "T00:00:00Z") : null,
      },
    });
  }
  // Training editions and sessions: create missing ones only (facilitator edits are kept).
  for (const e of training.editions) {
    const ed = await prisma.trainingEdition.upsert({
      where: { code: e.code },
      update: {},
      create: { code: e.code, title: e.title, status: e.status as "COMPLETE" | "PLANNED", sortOrder: e.sortOrder },
    });
    for (const s of e.sessions) {
      await prisma.trainingSession.upsert({
        where: { editionId_code: { editionId: ed.id, code: s.code } },
        update: {},
        create: {
          editionId: ed.id, code: s.code, title: s.title, sortOrder: s.sortOrder, deckUrl: s.deckUrl,
          deliverableTitle: s.deliverableTitle, deliverableKind: s.deliverableKind as "LINK" | "CAPITAL_STACK" | "APPROVALS" | "CAPSTONE" | null,
          applyIt: s.applyIt, applyItHref: s.applyItHref,
        },
      });
    }
  }
  // Competitors: create missing ones (with their published projects); never overwrite edits.
  for (const c of competitors.competitors) {
    if (await prisma.competitor.findUnique({ where: { key: c.key } })) continue;
    const { projects = [], competesWith, ...rest } = c as typeof c & { projects?: Record<string, unknown>[] };
    await prisma.competitor.create({
      data: {
        ...(rest as { key: string; name: string }),
        competesWith: { connect: competesWith.map((code) => ({ code })) },
        projects: { create: projects.map((p) => ({ ...(p as { ownerName: string; category: string; description: string }), value: p.value == null ? null : String(p.value) })) },
      },
    });
  }
  const link = await linkCompetitorProjects();
  const counts = {
    companies: await prisma.company.count(),
    picklistValues: await prisma.picklistValue.count(),
    programs: await prisma.fundingProgram.count(),
    stateRules: await prisma.stateRule.count(),
    trainingSessions: await prisma.trainingSession.count(),
    competitors: await prisma.competitor.count(),
    competitorProjects: await prisma.competitorProject.count(),
    competitorProjectsLinkedNow: link.linked,
  };
  console.log("Seeded", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
