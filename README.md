# Quandel BD Hub

Shared business-development CRM and training system for Quandel Enterprises
(QCG, QES, PCS, JVS, PYR and the ENT parent). Built phase by phase from `SPEC.md`.

| Path | What it is |
|---|---|
| `SPEC.md` | Full build outline: data model, screens, rules engine, training, phases |
| `CLAUDE.md` | Working rules for Claude Code |
| `app/`, `components/`, `lib/` | The Next.js app |
| `prisma/schema.prisma` | Database schema |
| `data/` | Reference data people can edit without code: companies, picklists, state rules, funding programs |
| `prototype/bd-hub.html` | Clickable team prototype (published at https://claude.ai/artifact/UFYEMekqpSiJC7joYGes5r) |

## Run it locally

Needs Node 20+.

```bash
npm install
cp .env.example .env        # then set NEXTAUTH_SECRET (openssl rand -base64 32)
npm run db:migrate          # creates prisma/dev.db and loads companies + picklists
npm run dev                 # http://localhost:3000
```

With `DEV_LOGIN="true"` you can sign in locally with any email and no password.
**The first person to sign in becomes Admin.** Everyone after starts as Trainee
until an admin sets their role on the Admin page.

## Microsoft 365 sign-in

Ask Quandel IT for an Entra ID (Azure AD) app registration with redirect URI
`https://<your-host>/api/auth/callback/azure-ad`, then set `AZURE_AD_CLIENT_ID`,
`AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` and `ALLOWED_EMAIL_DOMAIN`.
Development sign-in is always off in production builds.

## Shared use (Postgres)

Change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, point
`DATABASE_URL` at the database, and run `npx prisma migrate deploy && npm run db:seed`.

## Roles (Phase 1)

| Role | Can |
|---|---|
| Admin | Everything, plus users, roles, company tags and dropdown lists |
| BD director / Enterprise BD | Add and edit everything; delete records |
| BD lead, QES project developer, Estimator | Add and edit organizations and contacts; log activities |
| Trainee | Read everything; log activities |
| Leadership, Compliance | Read everything |

Anyone can edit or delete an activity they logged.
