import type { Role } from "@prisma/client";

/** Plain-language labels for SPEC §1 roles. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BD_DIRECTOR: "BD director / Enterprise BD",
  BD_LEAD: "BD lead",
  LEADERSHIP: "Company president / leadership",
  ESTIMATOR: "Estimator / preconstruction",
  QES_DEVELOPER: "QES project developer",
  COMPLIANCE: "Compliance",
  TRAINEE: "Trainee",
};

// Phase 1 rules. Everyone signed in can read the whole CRM (it is shared).
const ACCOUNT_EDITORS: Role[] = ["ADMIN", "BD_DIRECTOR", "BD_LEAD", "QES_DEVELOPER", "ESTIMATOR"];
const ACTIVITY_LOGGERS: Role[] = [...ACCOUNT_EDITORS, "TRAINEE"];
const DELETERS: Role[] = ["ADMIN", "BD_DIRECTOR"];

/** Add or edit organizations and contacts. */
export const canEditAccounts = (r: Role) => ACCOUNT_EDITORS.includes(r);
/** Log activities (trainees log too, for "apply it" tasks). */
export const canLogActivity = (r: Role) => ACTIVITY_LOGGERS.includes(r);
/** Delete organizations, contacts and others' activities. */
export const canDelete = (r: Role) => DELETERS.includes(r);
/** Manage users, roles, company tags and picklists. */
export const isAdmin = (r: Role) => r === "ADMIN";

/** Add and edit opportunities, tick checklists, move stages, log compliance confirmations. */
export const canEditOpportunities = (r: Role) => ACCOUNT_EDITORS.includes(r);
/** Record go/no-go decisions (SPEC §1: leadership approves go/no-go). */
const GO_NO_GO: Role[] = ["ADMIN", "BD_DIRECTOR", "LEADERSHIP"];
export const canDecideGoNoGo = (r: Role) => GO_NO_GO.includes(r);

/** Edit the funding program library and capital stacks. */
export const canEditPrograms = (r: Role) => ACCOUNT_EDITORS.includes(r);
