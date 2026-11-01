# Quandel Enterprises CRM: Build Outline for Claude Code

**Working name:** Quandel BD Hub
**Owner:** Business Development, Quandel Enterprises, LLC (Harrisburg, PA)
**Purpose:** One shared system for public-sector and institutional business development across all five Quandel companies. It tracks owners, decision-makers, funding programs, procurement paths and approvals, and it holds the BD training program ("Projects, Partners, Programs").

**How to use this file:** Put it in an empty project folder as SPEC.md. Copy section 13 into CLAUDE.md. Then give Claude Code the starter prompt in section 14. Build one phase at a time (section 12).

## 1. Who uses it

| Role | What they do in the CRM |
|---|---|
| BD lead (each company) | Owns accounts, logs activity, moves opportunities, builds capital stacks |
| BD director / Enterprise BD | Sees every company's pipeline; routes leads and cross-sells; runs training |
| Company president / leadership | Reads dashboards; approves go/no-go; plays the mock board in training |
| Estimator / preconstruction | Adds budget estimates and phasing to opportunities |
| QES project developer | Runs energy audits and savings models; owns energy opportunities |
| Compliance | Reviews the ethics log, gifts, lobbying registration and municipal-advisor flags |
| Trainee | Takes modules and quizzes, submits deliverables, gets coaching notes |

## 2. The five companies

Each record that matters (account, opportunity, activity, project) carries one or more company tags. The CRM is shared, but each company keeps its own pipeline view.

| Code | Company | Base | What it sells | Typical buyers | Usual procurement paths |
|---|---|---|---|---|---|
| QCG | Quandel Construction Group | Harrisburg, PA (plus regional offices) | General construction, construction management, design-build; P3 bridge bundling program | School districts, counties, municipalities, colleges, healthcare, housing | Multiple-prime public bid; CM agency; CM at risk / GMP (private); design-build; COSTARS; P3 |
| QES | Quandel Energy Solutions | Harrisburg, PA | ESCO: energy audits, guaranteed energy savings contracts, solar, HVAC, controls, geothermal | Any public owner, housing authorities, nonprofits | PA GESA (RFQ/RFP); NY Energy Law § 9-103 EPC (RFP); HUD EPC for housing authorities; COSTARS GESA contract |
| PCS | Performance Construction Services | Pottsville, PA (Williamsport team from the Susquehanna Supply acquisition) | Heavy concrete, bridges, dams, water and wastewater plants; PennDOT/NYSDOT work | DOTs, counties, municipal and water/sewer authorities | Low-bid public works; DOT lettings; bundled bridge contracts |
| JVS | J. Vinton Schafer & Sons | Abingdon, MD | Construction management, education and healthcare focus | MD, DC, VA and PA schools, hospitals, private owners | CM agency; CM at risk; public bid in MD/VA/DC |
| PYR | Pyramid Construction | [confirm location] | [confirm services and markets] | [confirm] | [confirm] |
| ENT | Quandel Enterprises (parent) | Harrisburg, PA | Shared BD, training and cross-company pursuits | — | — |

**Cross-sell routing rules.** These suggest a company when a lead comes in. A person makes the final decision.

- Bridge, culvert, dam, heavy concrete, water or wastewater plant → PCS (with QCG for P3 bundles)
- Energy, HVAC replacement, lighting, solar, utility costs, "no money in the budget" → QES
- Building in MD, DC or VA; or K-12 or healthcare CM south of PA → JVS
- Building, renovation or addition in PA or NY → QCG
- Energy project that also needs a roof, ADA or other non-energy work → QES + QCG (flag the disclosure step; see section 9)
- Any opportunity tagged to more than one company → create one joint pursuit with a lead company and support companies

## 3. Geography

- **States:** PA (home), NY, MD, NJ, DE, OH, WV, VA, DC. Each record has a state, which drives the rules engine (section 7) and the training edition (section 10).
- **Regions:** PA counties and regions; NY REDC regions (focus: Southern Tier, Mid-Hudson, Capital District); MD counties.
- **Flags:** ARC county, energy community, Opportunity Zone tract, disadvantaged community (NY), fiscal-stress status (NY FSMS; PA Act 47).

## 4. Data model

Build these as database tables. Every table gets `id`, `created_at`, `updated_at`, `created_by`.

### 4.1 Organizations (owners and partners)
- name, org_type: county · city · borough · township · town · village · school district · intermediate unit / BOCES · career-tech center · community college · state university · private college · municipal authority · housing authority · redevelopment authority · IDA · fire district · hospital / health system · nonprofit · state agency · DOT · private developer · A/E firm · financial advisor · bond counsel · competitor
- state, county, region, address, website, parent_org_id (e.g., a school's IU or BOCES)
- Public-owner profile: population or enrollment, annual budget, fiscal year start, debt outstanding and limit, recent bond issues, credit rating, fiscal-stress designation, tax-cap override history (NY)
- Facilities profile: building count, oldest building year, last major renovation, last energy project (year and ESCO), capital plan link and date, building condition survey date (NY schools)
- Governance: governing body name, regular meeting days (e.g., "2nd and 4th Tuesday"), agenda deadline, vote rules (e.g., two-thirds for bonds), permissive referendum (Y/N)
- relationship_owner (user), company_tags[], tier (A/B/C), status (target · active · client · dormant · do-not-pursue)
- source (e.g., "GESA eligible owners workbook", "QES targets list")

### 4.2 Contacts
- name, title, org_id, email, phone, LinkedIn
- decision_role: decider · advisor · influencer · gatekeeper · user
- function: elected official · manager / administrator · business manager / CFO · superintendent · facilities director · solicitor / attorney · engineer · architect · financial advisor · grant writer · legislator / staff · agency program officer
- relationship_strength (1–5), last_touch, next_touch, preferred_channel
- Opt-out and do-not-contact flags

### 4.3 Decision map (per organization)
- Visual map of contacts by decision_role, showing who influences whom (contact-to-contact links)
- Shows the board's meeting calendar next to it

### 4.4 Opportunities
- name, org_id, lead_company, support_companies[]
- project_type: new building · renovation · addition · energy · bridge · water/wastewater · road · site / industrial · housing · other
- delivery_method: multiple-prime public bid (PA Separations Act / NY Wicks) · single-prime bid · CM agency · CM at risk / GMP · design-build · GESA / EPC · HUD EPC · P3 bundle · cooperative purchase (COSTARS, etc.) · negotiated private
- estimated_value, quandel_scope_value, probability, weighted_value (computed)
- stage (see section 5), stage_entered_at, go_no_go (with reason and approver)
- Key dates: RFQ/RFP issue, pre-bid, due, interview, award, board vote, construction start, substantial completion
- competitors[], win_themes, loss_reason
- Links to its capital stack, approvals timeline and documents

### 4.5 Funding program library
One record per program, kept by state. This is a reference table that BD leads match against opportunities.

- name, agency, state (or Federal), program_type (grant · loan · tax credit · formula aid · rebate · elective pay)
- eligible_applicants[], eligible_uses, min_award, max_award, match_required (% and type), reimbursement (Y/N), cycle (rolling / annual), next_deadline, url, notes, last_verified (date and user)

Seed with the programs from the course:
- **PA:** RACP, LSA, CFA Multimodal, H2O PA, PA Small Water and Sewer, PENNVEST, PIB, liquid fuels, GTRP / DCNR, Solar for Schools, School Facility Improvement Grant, Act 129 utility rebates, PA SITES, Keystone Communities, NAP, KOZ, LGCPL, MAP, STMP, PHFA / PHARE
- **NY:** CFA programs, DRI, NY Forward, Restore NY, FAST NY, SAM, CHIPS, PAVE NY, BRIDGE NY, Marchiselli, WIIA / IMG, EFC revolving funds, NYSERDA Clean Green Schools, Clean Energy Communities, NYPA, Pro-Housing Supply Fund, NYS CDBG, Brownfield Cleanup credits, NY historic credit, LGE grants
- **Federal:** USDA Community Facilities and Water and Waste, ARC, EDA, BUILD/RAISE, CDBG / HOME / Section 108, LIHTC, federal historic credit, NMTC, elective pay, FEMA mitigation, HUD Capital Fund
- **MD / VA / DC:** [to be added when those training editions are built]

Deadline alerts: 90, 60, 30 and 14 days before next_deadline, sent to owners of matched opportunities.

### 4.6 Capital stack (per opportunity)
- Rows: program_id or other_source (bond, note, capital reserve, GESA financing, private equity), amount, status (idea · applied · awarded · denied · closed), application_date, award_date, reimbursement_lag_days
- Computed: total, gap to project cost, match met (Y/N against each program's rule), cash-flow gap from reimbursement programs
- Chart: stacked bar of sources
- Template: "illustrative stack" generator from the course examples

### 4.7 Approvals timeline (per opportunity)
- Steps with body, meeting_date, document (resolution, consistency letter, support letter, SEQR determination, bond ordinance/resolution, MOU/IMA, contract award), owner_contact, status
- Backward scheduler: pick a deadline and the tool proposes meeting dates from the org's calendar (section 7)
- State templates:
  - PA: planning commission letter → council resolution → match letter → legislator letters → MOUs → LGUDA debt ordinance → award
  - NY: SEQR → resolution → REDC/legislator letters → IMA → bond resolution (two-thirds) → permissive referendum (30 days) → award

### 4.8 Procurement events
- org_id, opportunity_id, type (RFQ · RFP · IFB · bid · DOT letting · cooperative), source (PennBid, BidNet, eMaryland Marketplace, NYS Contract Reporter, PennDOT ECMS, owner website), issue_date, questions_due, due_date, bond_required, prevailing_wage, MBE/WBE goals, addenda[], result (with bid tabulation)

### 4.9 Activities
- type: call · meeting · site walk · board meeting attended · email · presentation · proposal · interview · event
- org_id, contact_ids[], opportunity_id, company_tag, notes, next_step, next_step_date
- Board-meeting log: date, agenda items relevant to us, votes taken, minutes link

### 4.10 Energy module (QES)
- Per organization: utility accounts, annual kWh and therms, annual utility spend, EUI, baseline years
- Per opportunity: candidate measures (ECM, cost, savings, simple payback, elective-pay eligible), guarantee term, IPMVP option, financing rate, budget-neutral check (payments ≤ guaranteed savings)
- State rules applied:
  - PA GESA: 20-year cost test; 10-day public notice; 15% non-energy cap (§ 3754(d))
  - NY: 35-year limit; schools 18-year payback without building aid; SED approval; no set non-energy allowance
  - HUD (housing authorities): PIH 2024-27 rules
- M&V tracker after award: annual report due, guaranteed vs actual savings, shortfall

### 4.11 P3 / bridge module (QCG + PCS)
- Bridge inventory import (NBI data or a county list): bridge ID, owner, condition, year built, length, type, ADT
- Bundle builder: select bridges → group by type and area → estimate → funding (state bridge programs, federal aid, county bonds)
- State legal path flag: PA Act 88 P3 Board; NY design-build limits (state agencies, Westchester); others [research]

### 4.12 Projects (won work and references)
- Completed and active projects across all five companies: owner, value, delivery method, completion year, photos, reference contact, results (e.g., energy savings achieved)
- Used to build qualification packages and for reference matching ("show me K-12 GESA projects over $5M")

### 4.13 Competitors
- Name, companies they compete with (QES vs SitelogIQ, Ameresco, Veregy, Johnson Controls, Siemens, Trane, NORESCO, NYPA; construction GCs by region), wins and losses against them, pricing notes, public contract examples

### 4.14 Compliance log
- Gift and hospitality entries with value, recipient, approver (PA Ethics Act; NY GML § 805-a $75 rule; local codes)
- Lobbying tracker: hours and expenses by jurisdiction, with a registration threshold warning (NY: $5,000 a year; PA: [confirm current threshold])
- Municipal-advisor flags: a checkbox on any activity where financing was discussed; must link to the owner's financial advisor
- Procurement-fairness flags: "Did we help write specs or scoring?" (must be No to bid)
- Records reminder: emails and proposals may be public (PA Right-to-Know, NY FOIL); mark trade secrets on submission
- State procurement restricted periods (NY State Finance Law §§ 139-j/k): designated contacts only, from RFP to award

### 4.15 Documents
- Attach to org, opportunity or training item: RFPs, proposals, capital plans, minutes, resolutions, audit reports, award letters. Store files with doc_type and public_record_status.

## 5. Pipeline stages

One shared stage list, with a different checklist for each delivery method.

| # | Stage | Exit criteria (all paths) |
|---|---|---|
| 1 | Target | Org profiled; tier set |
| 2 | Engaged | First meeting held; decision map started |
| 3 | Need identified | Project and rough budget known; capital plan or survey reviewed |
| 4 | Funding path | Capital stack drafted; programs matched; deadlines in calendar |
| 5 | Pre-procurement | Owner approvals scheduled; procurement method known; go/no-go decided |
| 6 | Pursuit | RFQ/RFP/bid released; team and proposal underway |
| 7 | Submitted | Proposal or bid in |
| 8 | Shortlist / interview | Interview held |
| 9 | Won / Lost / No-bid | Board vote recorded; reason logged |
| 10 | Contracted → Project | Moves to the Projects table |

Path-specific checklists:
- **Public bid (multiple prime / Wicks):** prime contracts identified · plan room access · pre-bid · bonding confirmed · bid tab recorded
- **GESA / EPC (QES):** benchmark done · board education presentation · RFQ/RFP issued by owner (not us) · audit agreement and fee · investment-grade audit · contract and public notice · state review (NY SED for schools)
- **CM agency / CM at risk:** RFQ shortlist · fee proposal · interview · GMP (CMAR)
- **P3 bundle:** inventory → bundle concept → owner resolution → legal path confirmed → procurement
- **HUD EPC:** Capital Fund plan reviewed · HUD RFP approval · HUD contract approval (plan up to 60 business days)

## 6. Screens
- **Home:** my next steps, my overdue touches, upcoming deadlines (grants, bids, board meetings), training due
- **Accounts:** list with filters (state, type, company, tier, ARC, fiscal stress, last energy project before X); org page with tabs for profile, contacts, decision map, opportunities, activities, meetings, energy, documents
- **Pipeline:** board view by stage; toggle by company, state or delivery method; weighted value totals
- **Opportunity page:** summary · capital stack · approvals timeline · procurement · team · competitors · documents · compliance check
- **Program library:** searchable; "match to opportunity" button
- **Calendar:** grant deadlines, bid dates, board meetings, training sessions (one view, color by type)
- **Bridge bundler** (PCS/QCG) and **Energy model** (QES)
- **Projects and references**
- **Training** (section 10)
- **Admin:** users, roles, company tags, picklists, imports

## 7. Rules engine (state-aware helpers)

Store rules as data (a state_rules table, or a JSON file per state), not hard-coded, so new states can be added the same way the course adds editions.

- Bid thresholds and the multiple-prime trigger (PA Separations Act; NY Wicks: $500K upstate, $1.5M Nassau/Suffolk/Westchester, $3M NYC)
- Prevailing-wage thresholds
- Meeting-notice rules (PA Sunshine Act 24-hour agenda; NY OML 72-hour notice and 24-hour documents)
- Debt approvals (PA LGUDA; NY two-thirds vote plus permissive referendum, estoppel 20 days)
- Energy contract rules (GESA vs Energy Law § 9-103 vs HUD)
- Records-law response times (PA RTK 5 days; NY FOIL 5/20 days)
- Backward scheduler: given a deadline and an org's meeting pattern, list the latest dates for each approval step

Every rule has `source` and `last_verified` fields. Show a yellow badge if a rule is more than 12 months old.

## 8. Imports and seed data
- GESA_Eligible_Public_Owners_PA.xlsx → Organizations (PA), with building age, last energy project, bonds/capital plan
- Quandel target lists (QES targets tab, Tier A/B/C) → Organizations with tier and company tag QES
- SitelogIQ PA project list → Competitors and competitor wins
- NY local-government list (OSC) → Organizations (NY), starting with the Southern Tier, Mid-Hudson and Capital District
- Bridge inventory CSV (NBI or county) → Bridge module
- Program library seed (section 4.5), as a CSV with source URLs
- Training content (section 10) from the course deck links

Imports must: map columns, de-duplicate on name + state + type, and show a preview before writing.

## 9. Joint-pursuit and disclosure rules
- When QES and QCG/PCS both touch one owner, the opportunity shows a disclosure banner: the owner must know about the related-company role and decide whether one team is acceptable.
- QES never writes the owner's GESA/EPC RFP or scoring. Log a "procurement independence" confirmation at stage 5.
- For NY schools, record the architect/engineer of record's no-conflict certification (8 NYCRR § 155.20).

## 10. Training area ("Projects, Partners, Programs")

A section of the CRM that holds the course, tracks who has completed what, and links lessons to live CRM work.

### 10.1 Structure
- Course → Edition (state) → Session → Module
- Editions: Pennsylvania (complete), New York (complete), then MD, NJ, DE, OH, WV, VA as built
- Sessions (each edition): 1 Foundations · 1B Institutional buyers · 2 Who decides · 3 Procurement and delivery · 4 Positioning before the RFP · 5 Grant applications · 6 State capital · 7 Federal programs · 8 Tax credits · 9 Capital stacking · 10 P3 and bridges · 11 Energy savings contracts (QES) · 12 Approvals, governance and ethics · 13 Capstone
- Each session stores: deck link, speaker-notes link, glossary, the deliverable template, quiz, and "apply it" tasks

### 10.2 Learner features
- My learning: assigned sessions, due dates, progress bar per edition
- Quizzes: 5–10 questions per session, auto-graded, 80% to pass, retakes allowed
- Deliverables: upload or build in the CRM, then a facilitator reviews with a rubric:
  - S5: grant readiness checklist
  - S9: capital stack (built with the real capital-stack tool on a practice opportunity)
  - S10: bridge bundle screening memo
  - S11: energy opportunity brief
  - S12: approvals checklist and backward timeline (built with the real approvals tool)
  - S13: capstone plan, scored on the 100-point rubric (stack 25, approvals 20, delivery 15, need 15, answers 15, ethics 10; any ethics violation = 0)
- "Apply it" links: each lesson ends with a task in the live CRM (e.g., "Build the decision map for one Tier A target")
- Certificates: by edition, plus an annual ethics attestation (required before a user can log gifts or lobbying entries)

### 10.3 Reference library (searchable)
- Glossary (all acronyms from both editions; each tagged by state)
- Program cheat sheets by need, per state
- Playbooks: one per delivery method (section 5 checklists, in long form)
- Board-meeting reading guide and sample agendas
- "OK to say / not OK to say" municipal-advisor cards

### 10.4 Facilitator and admin
- Assign sessions to people or groups (by company)
- Gradebook: quiz scores, deliverable scores, completion by company
- Capstone scheduler: teams, mock-board roles (president/supervisor, finance chair, solicitor/attorney, manager/clerk, resident), timer, score entry
- First 90 days tracker for new BD leads: 10 targets, meeting calendars, two years of minutes read (30 days) → meetings and program matching (60 days) → two live pursuit plans and one grant package (90 days)

### 10.5 Training data model
course, edition (state), session, module, resource (deck, doc, link), quiz, question, attempt, assignment, deliverable_submission, rubric, score, certificate, attestation, ninety_day_plan

## 11. Dashboards and reports
- **Enterprise:** pipeline by company and stage; weighted value; win rate by delivery method; cross-sell count (joint pursuits)
- **By company:** QCG (bid calendar, CM interviews), QES (audits in progress, guaranteed savings under management, M&V due), PCS (DOT lettings, bridge bundles), JVS (MD/DC/VA pipeline), PYR [confirm metrics]
- **Funding:** dollars applied for, awarded and pending for clients; upcoming deadlines
- **Coverage:** % of Tier A targets with a decision map and a touch in the last 60 days
- **Training:** completion by company; quiz averages; deliverables awaiting review
- **Compliance:** open flags; lobbying hours vs threshold by jurisdiction
- Export any table to Excel/CSV

## 12. Build phases for Claude Code

| Phase | Scope | Done when |
|---|---|---|
| 1 | Project setup, auth, users/roles, company tags; Organizations, Contacts, Activities | Can add an org and log a call |
| 2 | Opportunities + pipeline board + stage checklists by delivery method | Can move a GESA opportunity through stages |
| 3 | Program library + capital stack + deadline alerts; seed PA, NY, federal programs | A stack shows gap and match status |
| 4 | Approvals timeline + state rules engine + backward scheduler; calendar | A July 31 deadline produces dated steps |
| 5 | Imports (workbooks, target lists, OSC list); de-dupe and preview | PA eligible-owners workbook loads cleanly |
| 6 | Training area: courses, sessions, quizzes, deliverables, gradebook, certificates | A trainee can pass Session 1 and submit a deliverable |
| 7 | QES energy module; bridge bundler; projects/references; competitors | Budget-neutral check and bundle estimate work |
| 8 | Compliance log, dashboards, exports | Enterprise dashboard shows all five companies |

Suggested stack (change it if Quandel IT has a standard): Next.js (TypeScript) + Prisma + SQLite for local development, Postgres for shared use; Tailwind for styling; NextAuth with Microsoft 365 sign-in (Quandel email). Keep state rules and program seeds in /data/*.json or CSV so non-developers can edit them.

## 13. CLAUDE.md
See CLAUDE.md in the project root.

## 14. Starter prompt for Claude Code

> Read SPEC.md and CLAUDE.md. Build Phase 1 only: set up the Next.js + Prisma project, the user and role model, company tags (QCG, QES, PCS, JVS, PYR, ENT), and the Organizations, Contacts and Activities tables with list and detail screens. Seed the five companies and the org-type picklist from section 4.1. Show me the schema before writing migrations, then stop and summarize what's done and what Phase 2 needs.
