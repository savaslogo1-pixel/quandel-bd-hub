# Changelog

## Phase 5 — 2026-11-02
- Organization imports (SPEC §8) under Organizations → Import (admins and BD directors):
  upload .xlsx or .csv (up to 15 MB, 5,000 rows) → pick the sheet and header row (detected
  automatically) → map columns (best guess from header names, adjustable) and set defaults →
  preview → import. Nothing is written before the final click.
- Saved column setups in `data/import_presets.json`, applied automatically when a file matches:
  GESA eligible public owners (PA), Owners tab; and Quandel target lists, QES Targets tab
  (tier + QES tag, per SPEC §8).
- Cleaning: stray leading symbols removed from names; state names or codes; type from the
  type column, or from the name when the column is missing or vague ("College",
  "Municipality"); money ("$1.2M"), counts, years (from text), building age → year built;
  Y/N flags; ESCO names pulled from free text; footnote rows skipped; chosen columns
  appended to Notes as "Header: value".
- Duplicates: matched on name + state + type + **county**. Pennsylvania has many same-named
  townships and boroughs in different counties (225 repeated names in the GESA list, e.g. six
  Allegheny Townships), so county is part of the key in the importer and in the database.
  Similar names in the same county ("Schuylkill IU 29" / "Schuylkill Intermediate Unit 29",
  "Harrisburg City School District" / "Harrisburg School District") count as the same
  organization; similar names in a different county are flagged for a person to decide.
  Existing records: fill blanks only (default), replace, or skip.
- Undo an import: removes the organizations it created unless people have added contacts,
  activities, opportunities or member organizations; updates are not reversed.
- Organizations gain Notes and "In Quandel territory" (with a filter).
- Tested with the real files: GESA list loads 3,199 owners with no errors; the QES Targets tab
  then updates 151, adds 5, skips its footnote row and flags Capital Area IU 15 (Cumberland in
  the GESA list, Dauphin in the target list).
- Not yet: the target lists' Bridge List tab (Phase 7 bridge module), the SitelogIQ project
  list (Phase 7 competitors), and the NY OSC local-government list (file not provided yet).

## Phase 4 — 2026-11-01
- State rules engine (SPEC §7): 27 rules seeded from `data/state_rules.json` into a
  StateRule table (key, jurisdiction, topic, value, unit, source, last verified). Seeding
  never overwrites rules already in the database. State rules page grouped by state with
  yellow badges for unverified or 12-month-old rules; compliance, BD directors and admins
  edit values and mark them verified (a source is required to verify) or add rules for new states.
- Multiple-prime check on opportunities: NY Wicks threshold by region (NYC, Nassau/Suffolk/
  Westchester, or upstate, from the owner's county) and PA Separations Act (value [confirm]).
- Approvals timeline (SPEC §4.7) as an Approvals tab on each opportunity: steps with body,
  document, board-meeting flag, waiting period (fixed days or a state rule), date, agenda
  deadline, owner contact, status and notes. Load the PA or NY template from
  `data/approval_templates.json`; add, edit, reorder, delete steps; mark on the agenda / done.
- Backward scheduler: pick the deadline and buffer days; each step gets the latest date that
  still meets the deadline, board steps land on the owner's regular meetings, agenda
  deadlines come from the owner's agenda lead time, and the NY bond resolution waits the
  permissive-referendum period from State rules. Done steps keep their dates. Warnings for a
  missing meeting pattern, steps that would fall in the past, or a rule with no value.
  The spec's test case passes: a July 31, 2027 deadline produces dated NY steps
  (`tests/scheduler.test.ts`).
- Calendar (SPEC §6): grant deadlines, bid and key dates, board meetings (Tier A and
  organizations with open opportunities), approval steps with agenda deadlines, and next
  steps in one list, colored by type; filter by type, company, mine, 3/6/12 months.
  Training sessions join in Phase 6.

## Phase 3 — 2026-11-01
- Funding program library (SPEC §4.5): 52 PA, NY and Federal programs seeded by name from
  `data/programs.json`. Every other field is blank and shows [confirm] until someone fills
  it from current guidelines. Seeding only creates missing programs, so edits made in the
  app are never overwritten.
- Library list with search and filters (state, type, deadline within 30/90 days,
  verification), program detail, add/edit/delete (delete blocked while a program is on a stack).
- Verification (SPEC §7): "Last verified" date and person; yellow badge when never verified
  or older than 12 months; "Mark verified today"; banner counting programs that need checking.
- "Match to opportunity" on each program adds it to that opportunity's capital stack;
  owners in the program's state are listed first.
- Capital stack tab on each opportunity (SPEC §4.6): library programs and other sources
  (bond, note, capital reserve, GESA financing, private equity, owner cash, other) with
  amount, status, application and award dates, and reimbursement lag.
  Shows project cost, total sources (denied excluded), committed (awarded + closed), gap or
  over-funding, cash to front for reimbursement programs, a stacked bar by status, and a
  match check per program (met / short by $X / no rule yet).
  Match rule: other non-denied sources must cover the program's % of project cost or of
  its award. Programs that restrict which funds count as match need a manual check.
- Illustrative template adds placeholder rows with no amounts (the course's worked
  examples aren't loaded into the app).
- Deadline alerts: 90, 60, 30 and 14 days before a program's next deadline, for the owner of
  each open opportunity whose stack uses it (rows not yet awarded, denied or closed).
  Each band alerts once. Shown in the header, on Home and on the Alerts page.
  `POST /api/alerts/run` with `CRON_SECRET` runs them on a schedule. Email delivery is not
  set up yet. [confirm]
- `npm test` runs checks on the stack math and alert bands.

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
