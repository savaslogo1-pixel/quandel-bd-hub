# Changelog

## Phase 2 — 2026-11-01
- Opportunities (SPEC §4.4): owner, lead company + support companies (joint pursuit),
  project type, delivery method, estimated and Quandel scope values, probability,
  weighted value (scope or estimated × probability, computed), key dates, competitors,
  win themes, pursuit owner. Add, edit, delete.
- Cross-sell routing (SPEC §2): leave the lead company blank and the rules pick it;
  the opportunity page suggests missing companies with one-click "add as support".
  JVS routing covers MD, DC and VA only until BD confirms whether DE and WV count. [confirm]
- Pipeline board with the 10 stages from `data/pipeline.json`: drag cards between stages,
  filter by company, state, delivery method or my pursuits, weighted totals per stage,
  checklist progress and compliance flags on each card.
- Delivery-method checklists (SPEC §5) for public bid, GESA/EPC, CM agency, CM at risk,
  P3 bundle and HUD EPC; ticks record who and when. Labels live in `data/pipeline.json`.
- Stage rules: moving into Pursuit (6) or later requires a Go decision, "Did we help write
  specs or scoring?" = No, the procurement-independence confirmation for QES GESA/HUD
  pursuits, the owner's disclosure decision for QES + construction pursuits, and the A/E
  no-conflict certification for NY school districts. Stage 9 needs an outcome (and a reason
  for Lost / No-bid); stage 10 needs Won. Moving backward is always allowed.
- Go/no-go recorded by leadership, BD directors or admins (with approver and date).
- Disclosure banner on every QES + construction pursuit; the decision needs a note.
- Stage history: every move with who and when.
- Activities can link to an opportunity; logging from an opportunity pre-selects its companies.
- Organization page gains an Opportunities tab; Home shows "My open pursuits".
- Project types added as an admin-editable picklist (run `npm run db:seed` on existing databases).

## Phase 1 — 2026-11-01
- Next.js 15 + Prisma 6 (SQLite locally, Postgres-ready) + Tailwind 4 + NextAuth.
- Sign-in: Microsoft 365 (Entra ID) when configured; email-only development sign-in locally.
  First user becomes Admin; new users start as Trainee. Optional email-domain restriction.
- Roles from SPEC §1 plus Admin, with permissions in `lib/permissions.ts`.
- Company tags (QCG, QES, PCS, JVS, PYR, ENT) seeded from `data/companies.json`;
  PYR details stay [confirm].
- Admin-editable picklists seeded from `data/picklists.json`: 26 org types, 12 contact
  functions, 9 activity types (all from the spec) and 5 preferred channels (starter set).
- Organizations: list with filters (state, type, company, tier, status, flags, last energy
  project before a year, mine), detail page (profile, contacts, decision map with the
  board's next meetings and agenda deadlines, activities), add/edit/delete.
  Name + state + type must be unique (the SPEC §8 de-duplication key).
- Contacts: list (search, decision role, function, overdue touch, at orgs I own), detail,
  add (with "add another"), edit, delete; who-influences-whom links for the decision map.
- Activities: log from an organization or contact, board-meeting log fields, next steps
  (shown on Home with a Done button), company tags, last-touch updates on contacts.
  Municipal-advisor flag: an activity marked "financing discussed" cannot be saved
  without linking the owner's financial advisor.
- Home: my next steps, overdue touches, counts, recent activity.
- Not in Phase 1: opportunities (Phase 2); the activity → opportunity link is an empty
  column until then. Energy baseline fields wait for Phase 7.

## Prototype — 2026-11-01
- Clickable single-page prototype covering accounts, decision maps, pipeline (10 stages,
  delivery-method checklists, cross-sell routing), program library, capital stack,
  approvals templates with backward scheduler, calendar, state rules, training,
  compliance log and enterprise dashboard.
- Seeded 27 state rules (values from SPEC.md §7, all unverified) and 52 program names
  (PA, NY, Federal; details marked [confirm]).
- Not production: Phase 1 of the Next.js build has not started.
