# Changelog

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
