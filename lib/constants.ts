import type { DecisionRole, OrgStatus, StateCode, Tier } from "@prisma/client";

export const STATES: StateCode[] = ["PA", "NY", "MD", "NJ", "DE", "OH", "WV", "VA", "DC"];
export const TIERS: Tier[] = ["A", "B", "C"];

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  TARGET: "Target",
  ACTIVE: "Active",
  CLIENT: "Client",
  DORMANT: "Dormant",
  DO_NOT_PURSUE: "Do not pursue",
};

export const DECISION_ROLE_LABELS: Record<DecisionRole, string> = {
  DECIDER: "Decider",
  ADVISOR: "Advisor",
  INFLUENCER: "Influencer",
  GATEKEEPER: "Gatekeeper",
  USER: "User",
};
export const DECISION_ROLES = Object.keys(DECISION_ROLE_LABELS) as DecisionRole[];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "last" };

/** Picklist names used in Phase 1 (rows live in PicklistValue). */
export const PICKLISTS = {
  orgType: "org_type",
  contactFunction: "contact_function",
  activityType: "activity_type",
  preferredChannel: "preferred_channel",
  projectType: "project_type",
} as const;

export const BOARD_MEETING_TYPE = "board meeting attended";
