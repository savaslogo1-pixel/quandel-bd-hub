import type { DeliveryMethod, DisclosureDecision, GoNoGo, Outcome } from "@prisma/client";
import pipeline from "@/data/pipeline.json";

export type Stage = { n: number; name: string; exit: string };
export type ChecklistItem = { key: string; label: string };

export const STAGES: Stage[] = pipeline.stages;
export const STAGE_COUNT = STAGES.length;
export const stageName = (n: number) => STAGES.find((s) => s.n === n)?.name ?? `Stage ${n}`;

const DM = pipeline.deliveryMethods as Record<DeliveryMethod, { label: string; checklist: string | null }>;
const CL = pipeline.checklists as Record<string, { title: string; items: ChecklistItem[] }>;

export const DELIVERY_METHODS = Object.keys(DM) as DeliveryMethod[];
export const deliveryLabel = (m: DeliveryMethod | null | undefined) => (m ? DM[m].label : "—");
export function checklistFor(m: DeliveryMethod | null | undefined): { title: string; items: ChecklistItem[] } | null {
  const key = m ? DM[m]?.checklist : null;
  return key ? CL[key] : null;
}

export const GO_NO_GO_LABELS: Record<GoNoGo, string> = { GO: "Go", NO_GO: "No-go", PENDING: "Pending" };
export const OUTCOME_LABELS: Record<Outcome, string> = { WON: "Won", LOST: "Lost", NO_BID: "No-bid" };
export const DISCLOSURE_LABELS: Record<DisclosureDecision, string> = {
  ONE_TEAM_ACCEPTED: "Owner accepts one Quandel team",
  SEPARATE_PROCUREMENT_REQUIRED: "Owner requires separate procurement",
  PENDING: "Disclosed; owner decision pending",
};

/** Companies other than QES that build things. */
export const CONSTRUCTION_CODES = ["QCG", "PCS", "JVS", "PYR"];
const ENERGY_METHODS: DeliveryMethod[] = ["GESA_EPC", "HUD_EPC"];

/** The fields gating and flags need. */
export type GateOpp = {
  stage: number;
  deliveryMethod: DeliveryMethod | null;
  goNoGo: GoNoGo | null;
  outcome: Outcome | null;
  lossReason: string | null;
  helpedWriteSpecs: boolean | null;
  procIndependenceAt: Date | null;
  disclosureDecision: DisclosureDecision | null;
  aeNoConflictCertAt: Date | null;
  companyCodes: string[]; // lead + support
  org: { state: string; orgType: string };
};

export const involvesQES = (o: Pick<GateOpp, "companyCodes">) => o.companyCodes.includes("QES");
/** SPEC §9: QES and a construction company both on one owner → disclosure required. */
export const isJointQES = (o: Pick<GateOpp, "companyCodes">) => involvesQES(o) && o.companyCodes.some((c) => CONSTRUCTION_CODES.includes(c));
export const needsProcIndependence = (o: Pick<GateOpp, "companyCodes" | "deliveryMethod">) =>
  involvesQES(o) && !!o.deliveryMethod && ENERGY_METHODS.includes(o.deliveryMethod);
export const isNySchool = (o: Pick<GateOpp, "org">) => o.org.state === "NY" && o.org.orgType === "school district";

/**
 * Reasons a move to `to` is blocked. Moving backward is always allowed.
 * Pursuit (6) and beyond requires the compliance and go/no-go steps from SPEC §5 and §9.
 */
export function stageBlockers(o: GateOpp, to: number): string[] {
  const b: string[] = [];
  if (to <= o.stage) return b;
  if (to >= 6) {
    if (o.goNoGo !== "GO") b.push("Record a Go decision first (stage 5 exit: go/no-go decided).");
    if (o.helpedWriteSpecs !== false) b.push('Answer "Did we help write specs or scoring?" It must be No to pursue.');
    if (needsProcIndependence(o) && !o.procIndependenceAt) b.push("Log the procurement-independence confirmation: QES did not write the owner's GESA/EPC RFP or scoring.");
    if (isJointQES(o)) {
      if (!o.disclosureDecision || o.disclosureDecision === "PENDING") b.push("Record the owner's decision on the related-company disclosure (QES + construction).");
      else if (o.disclosureDecision === "SEPARATE_PROCUREMENT_REQUIRED") b.push("The owner requires separate procurement. Change the team so QES and the construction company aren't on one pursuit.");
    }
    if (isNySchool(o) && !o.aeNoConflictCertAt) b.push("Record the architect/engineer of record's no-conflict certification (8 NYCRR § 155.20).");
  }
  if (to >= 9 && !o.outcome) b.push("Record the outcome (Won, Lost or No-bid).");
  if (to >= 9 && (o.outcome === "LOST" || o.outcome === "NO_BID") && !o.lossReason) b.push("Give the reason for a Lost or No-bid result.");
  if (to >= 10 && o.outcome !== "WON") b.push("Only Won opportunities move to Contracted.");
  return b;
}

/** Open compliance flags shown on cards and the opportunity page. */
export function complianceFlags(o: GateOpp): { level: "bad" | "warn"; text: string }[] {
  const f: { level: "bad" | "warn"; text: string }[] = [];
  if (o.helpedWriteSpecs === true) f.push({ level: "bad", text: "We helped write specs or scoring" });
  if (isJointQES(o) && (!o.disclosureDecision || o.disclosureDecision === "PENDING")) f.push({ level: "warn", text: "Disclosure decision not recorded" });
  if (o.disclosureDecision === "SEPARATE_PROCUREMENT_REQUIRED" && isJointQES(o)) f.push({ level: "bad", text: "Owner requires separate procurement" });
  if (needsProcIndependence(o) && o.stage >= 5 && !o.procIndependenceAt) f.push({ level: "warn", text: "Procurement independence not logged" });
  if (isNySchool(o) && o.stage >= 5 && !o.aeNoConflictCertAt) f.push({ level: "warn", text: "A/E no-conflict certification missing" });
  if (o.stage >= 6 && o.goNoGo !== "GO") f.push({ level: "warn", text: "No Go decision on record" });
  return f;
}

export function weightedValue(o: { estimatedValue: unknown; quandelScopeValue: unknown; probability: number | null }): number {
  const base = o.quandelScopeValue != null ? Number(o.quandelScopeValue) : o.estimatedValue != null ? Number(o.estimatedValue) : 0;
  return base * ((o.probability ?? 0) / 100);
}
