import { prisma } from "@/lib/db";
import type { GateOpp } from "@/lib/pipeline";

export const oppInclude = {
  org: { select: { id: true, name: true, state: true, orgType: true } },
  leadCompany: true,
  supportCompanies: { orderBy: { sortOrder: "asc" } },
  owner: { select: { id: true, name: true, email: true } },
  checklist: { select: { itemKey: true, doneAt: true } },
} as const;

type WithRels = {
  stage: number; deliveryMethod: GateOpp["deliveryMethod"]; goNoGo: GateOpp["goNoGo"]; outcome: GateOpp["outcome"];
  lossReason: string | null; helpedWriteSpecs: boolean | null; procIndependenceAt: Date | null;
  disclosureDecision: GateOpp["disclosureDecision"]; aeNoConflictCertAt: Date | null;
  leadCompany: { code: string }; supportCompanies: { code: string }[]; org: { state: string; orgType: string };
};

export function toGate(o: WithRels): GateOpp {
  return {
    stage: o.stage, deliveryMethod: o.deliveryMethod, goNoGo: o.goNoGo, outcome: o.outcome, lossReason: o.lossReason,
    helpedWriteSpecs: o.helpedWriteSpecs, procIndependenceAt: o.procIndependenceAt, disclosureDecision: o.disclosureDecision,
    aeNoConflictCertAt: o.aeNoConflictCertAt,
    companyCodes: [o.leadCompany.code, ...o.supportCompanies.map((c) => c.code)],
    org: { state: o.org.state, orgType: o.org.orgType },
  };
}

export async function loadOpp(id: string) {
  return prisma.opportunity.findUnique({ where: { id }, include: oppInclude });
}
