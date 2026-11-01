# Quandel BD Hub

CRM and training system for Quandel Enterprises' five companies:
QCG (Quandel Construction Group), QES (Quandel Energy Solutions),
PCS (Performance Construction Services), JVS (J. Vinton Schafer & Sons),
PYR (Pyramid Construction), plus ENT (Enterprises parent).

The full spec is in SPEC.md. Follow its build phases in order.

## Rules
- Every account, opportunity, activity and project carries company tags.
- State-specific rules and funding programs live in /data as JSON/CSV with
  `source` and `last_verified` fields. Never hard-code a threshold.
- Public-sector language: "owner", "board", "resolution", "delivery method".
- Compliance features (municipal-advisor flag, procurement independence,
  disclosure banner for QES + construction joint pursuits) are required, not optional.
- Training content links to the existing "Projects, Partners, Programs" decks;
  do not copy deck content into the code.
- Write seed data from the spec only. Mark unknowns as [confirm]; never invent
  programs, dollar amounts or contacts.
- Keep a CHANGELOG.md entry for each phase.
