import type { ApprovalDocument } from "@prisma/client";
import templates from "@/data/approval_templates.json";

export type TemplateStep = { label: string; body: string; document: ApprovalDocument; needsMeeting: boolean; waitRuleKey?: string };
export const APPROVAL_TEMPLATES = templates.templates as Record<string, { title: string; steps: TemplateStep[] }>;

export const DOCUMENT_LABELS: Record<ApprovalDocument, string> = {
  RESOLUTION: "Resolution",
  CONSISTENCY_LETTER: "Consistency letter",
  SUPPORT_LETTER: "Support letter",
  SEQR_DETERMINATION: "SEQR determination",
  BOND_ORDINANCE_RESOLUTION: "Bond ordinance / resolution",
  MOU_IMA: "MOU / IMA",
  CONTRACT_AWARD: "Contract award",
  OTHER: "Other",
};
