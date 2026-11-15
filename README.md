# Kampit: Vercel + Supabase variant

This is a separate, runnable Next.js application using the current Kampit v3 UI and core logic. Its production database is PostgreSQL on Supabase. It does not use Cloudflare Workers, D1, Vinext or ChatGPT authentication. The existing native deployment is unchanged.

## Business Cup submission — Team Alias

Ali Qazybai (captain) and Dias Saqyp.

- [Public product](https://kampit-skills.vercel.app)
- [PDF presentation](docs/Kampit_Alias_Business_Cup.pdf)
- [Pitch and demo](docs/pitch.md)
- [Primary sources and business assumptions](docs/business-sources.md)
- [Jury questions](docs/jury-qa.md)

## Published release — November 15, 2026 (Asia/Almaty)

The public application is available at **https://kampit-skills.vercel.app**, on Vercel Hobby and Supabase Free in `iad1`. The current deployment is `https://kampit-skills.vercel.app`. The application uses the native managed database environment and server-verified Supabase Auth sessions.

The owner explicitly selected email/password registration **without a confirmation email** for the hackathon. Confirm Email is OFF, signups are ON, anonymous Supabase sign-ins are OFF. A valid Auth session does not prove email ownership. Keep using your own email address. The fictional guest demo remains separate from accounts.

Live acceptance completed: 34 public demo HTTP requests on the preceding JSONB-fixed deployment; 31 product Auth HTTP requests on the current deployment with two synthetic QA accounts; public fictional-demo desktop/mobile UI, persisted 3/3 plan at 65/100, next-week level and own saved history. These are test fixtures, not customers. See the packaged `reports/` and `RELEASE-MANIFEST.json` for evidence and exact scope; repository reports are under `../../work/`.

Old private Sites data has not been imported; new public accounts start empty. SMTP delivery, email ownership, password reset, browser account login, real-time hosted week rollover and independent hosted PostgreSQL-session concurrency are not verified. Prime has no live billing and writing checks do not certify skill quality. The setup instructions below are for reproducing the deployment; **do not rerun the one-shot bootstrap against the existing live database**.

## What has been verified

`npm test` runs 21 workflow groups against real PostgreSQL embedded in PGlite. It exercises persistence, demo separation, quiz scoring, writing validation, ownership, friend invites, Prime gates, level scheduling, weekly history, tied rank quotas, rollback, daily cap and streak awards. The test harness simulates an already verified account identity; it does not claim to test Supabase email delivery or Auth servers. PGlite serializes database sessions, so it is not evidence of multi-connection concurrency.

`npm run build` produces a real Next.js production build. `npm run typecheck` checks the complete portable app. No deployment, Supabase project, SMTP account or paid resource has been created by these scripts.

After building, `npm run test:http` starts an actual Next production process bound to `0.0.0.0` and checks 12 HTTP cases with localhost/127 request origins, canonical redirects, rejected cross-origin/forged hosts, ignored forwarded headers, safe invite returns and missing setup. It uses no live service credentials and stops its process afterward.

`./node_modules/.bin/tsx tests/auth-actions.test.ts` checks the real signup handler source with local SDK/cookie fixtures: an immediate session still requires authoritative `getUser()`, a missing session follows the email-confirmation path, and failures never redirect as a successful login. It also checks safe invitation returns and CSRF rejection. This unit test does not claim live Auth verification or email delivery.

## Install and run

From this directory, with Node 22.13 or newer:

```sh
npm ci
npm test
npm run typecheck
npm run build
cp .env.example .env.local
```

Set these values privately in `.env.local` and the Vercel project environment:

| Variable | Source | Exposure |
| --- | --- | --- |
| `DATABASE_URL` or managed `POSTGRES_URL` | Supabase transaction-pooler URI, using the schema owner account; nonempty `DATABASE_URL` takes precedence | Server only; includes database password |
| `APP_ORIGIN` | Public HTTPS origin, e.g. `https://your-project.vercel.app`; required in production | Public site origin; server validates redirects/CSRF against it |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public project identifier |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Public key; no game-data table access |

The server uses `postgres.js` with `max: 1`, `prepare: false`, and `ssl: 'require'`. A private shared resolver reads nonempty `DATABASE_URL` first, otherwise the Vercel Native Supabase integration's `POSTGRES_URL`, directly from server environment. There is no secret copy or manual password alias needed for native mode. It validates PostgreSQL schemes and rejects missing/placeholder/malformed configuration with a generic error that does not contain the URI. Only known provider attribution query keys `supa` and `workaround` are removed; TLS settings, encoded credentials and other options are preserved. It does not infer pooler mode from an env name: check the selected native resource really provides the transaction-pooler endpoint. `POSTGRES_URL_NON_POOLING` and `POSTGRES_PRISMA_URL` are not fallback aliases. The server, generated API guard and all four database scripts use the same resolver.

SQL statements use the private `kampit` schema explicitly. Transaction-local timeouts are applied per transaction, so transaction-pooler session state is not assumed. Never expose either database URL, a service-role key or a database export in browser code. `APP_ORIGIN` must match the current production or preview URL. Redirects and mutation checks do not trust forwarded headers or Next's internal bind address. For local production testing set `APP_ORIGIN=http://localhost:3000`; only `localhost`, `127.0.0.1` and `::1` at that same port are allowed as local aliases. Without `APP_ORIGIN`, development allows only loopback request hosts; production mutations fail clearly with 503.

The target database must be new/empty. Bootstrap is deliberately one-shot and refuses an existing Kampit schema:

```sh
npm run db:migrate
# If migrating existing data, import it now, before serving traffic; see below.
npm run dev
```

`npm start` serves the built production app. Missing or invalid configuration of both database URL aliases produces a 503 response; no live request falls back to an ephemeral or demonstration database. Demo data is persisted in the same PostgreSQL database but isolated by random demo workspace and HttpOnly cookie. Missing Auth settings leave only guest/demo use available; email sign-in reports that the account service is unavailable.

## Configure Supabase Auth and Vercel

1. Connect the user's Vercel and Supabase accounts. Use an existing authorized project or obtain authorization for creating resources. No project is selected automatically here.
2. Configure email/password Auth according to the explicitly chosen project settings. When email confirmation is enabled, public signup needs a real SMTP provider: Supabase's default email service is restricted to approved team addresses and is intended for testing. If Supabase returns a session immediately, Kampit verifies it through `auth.getUser()` and opens the account; otherwise it shows the confirmation-email next step. A returned/verified session alone is not a claim that the person proved ownership of an email address. This handler does not change the project's confirmation settings. Configure abuse/rate controls in Supabase for public launch.
3. Set the production Site URL and an allow-listed callback URL such as `https://YOUR-DOMAIN/auth/callback`. The generated signup callback includes a validated local `return_to`; preserve its query parameters in the allowed callback configuration. For development also allow `http://localhost:3000/auth/callback`.
4. In Vercel choose the project root `migration/vercel` when deploying the full repository. For the standalone ZIP, choose the extracted application directory containing `package.json` instead. Select framework Next.js and `npm run build`. Set the four environment settings for the correct production/preview environment, including its `APP_ORIGIN`. With the native Supabase integration, leave `DATABASE_URL` unset and use its managed `POSTGRES_URL` plus the two matching `NEXT_PUBLIC_SUPABASE_*` values; the public origin is still configured separately. The checked-in generated files make this directory independently deployable; the build does not depend on the parent `kampit` folder.
5. Migrate an empty target, transfer verified data if required, then publish and open the resulting public URL. Supabase login email/password never goes through a custom password database. The server authorizes using `auth.getUser()` and refreshes HttpOnly, SameSite=Lax, Secure-in-production cookies in Route Handlers.
6. For each new deployment, smoke-test with two separately authenticated test accounts under its selected Auth settings: signup and any required confirmation, sign-in, task completion, private invite through login, persistence, ownership denial, sign-out, demo and return to account. The published release's actual HTTP and browser-demo checks and remaining limits are listed above; its account browser-login flow was not tested. Run the optional two-session cap check below only against a dedicated test database.

There is no payment processor. Prime remains a clearly marked, no-charge demo entitlement. Writing length/diversity checks are not AI grading or proof of skill. There is no required AI provider.

## Keep the portable source current

When the coordinator finishes edits in `../../kampit`, run:

```sh
npm run sync:core
npm test
npm run typecheck
npm run build
```

The generator copies current UI, CSS, public favicon, catalog, types, API and backend, changes only the hosting/auth imports and labels, and derives an isolated PostgreSQL bootstrap from the immutable D1 migrations. `core-source.json` records original file hashes. It never rewrites the original app or deployed D1 migration. The SQL adapter intentionally supports only the versioned Kampit query set; every future core SQL change needs PostgreSQL tests. `sync:core` requires the full repository layout; a standalone ZIP already includes the generated core and needs only the normal install/test/build commands.

## Preserve existing Sites data

No existing data has been exported, deleted or transferred. Obtain an authorized consistent D1 backup first. Keep the native site available for rollback. Pause its writes during the final export/cutover so activity cannot be lost between snapshots. Restore the D1 SQL export to an offline SQLite file using the standard SQLite tooling, then:

```sh
python3 scripts/export-sqlite.py /private/kampit.sqlite /private/kampit-export.json
npm run data:import -- /private/kampit-export.json
```

The export contains personal writing, private groups and demo bearer tokens. Store it privately; do not commit or upload it to public artifacts. The exporter opens SQLite read-only, creates the JSON with mode 0600 and prints only counts/hash. The importer permits only the 11 known tables and their actual destination columns, requires an empty target, locks the target tables, preserves **all IDs and historical awarded points**, disables the award trigger only within its locked import transaction, and verifies counts before commit. A failure rolls back the whole import. D1 v2 rows with missing new nullable v3 fields remain valid and get honest legacy history labels. Original migrations remain unchanged.

Legacy Sites profiles have IDs like `user:OLD-SITES-ID` and do not store verified email. A Supabase UUID cannot safely be inferred from a display name or email typed into a form. Imported profiles stay intact but are not automatically claimable. New accounts use the separate namespace `supabase:UUID`.

Before the first Kampit request for a migrated user, an operator must independently verify both the old Sites account and the new confirmed Supabase email account. Prepare a private JSON mapping:

```json
{
  "supabaseUserId": "CONFIRMED-SUPABASE-UUID",
  "legacyProfileId": "user:VERIFIED-OLD-SITES-ID",
  "verificationNote": "Record how ownership of both accounts was verified, with the relevant reference."
}
```

Then run `npm run data:link -- /private/verified-mapping.json`. The script confirms that the Auth account exists and its email is confirmed, requires an existing live legacy profile, refuses an existing new Kampit profile or duplicate mapping, and records the audited link. It cannot independently prove ownership of an old Sites identity; the operator's verification is mandatory. Goals, private memberships, writing and ranks retain their original foreign keys. If the new user already created Kampit data, reconcile explicitly; there is no automatic overwrite/merge. Supabase sessions and cross-domain demo cookies are not migrated.

Compare export counts/hash, actual totals by user/week, private memberships and history before changing the shared URL. Retain the backup and previous native deployment until the user accepts the external deployment.

## Independent PostgreSQL concurrency check

After a dedicated test Supabase database is configured and migrated:

```sh
KAMPIT_ALLOW_INTEGRATION_TESTS=1 npm run test:concurrency
```

This opens two independent PostgreSQL connections. The first locks a random fixture profile; the second waits for that row lock in a separate statement before inserting. Two simultaneous 70-point requests must award 70 and 30. Only its random fixture is removed afterward. This command was not run without a real PostgreSQL server. Runtime follows the same lock-before-insert sequence; the score trigger rejects unwrapped scoring writes.

## Official references

- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Native Marketplace environment](https://supabase.com/docs/guides/integrations/vercel-marketplace)
- [Supabase serverless guide: provider workaround parameter](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
- [Vercel Labs: preserving pooled URLs and stripping provider supa attribution](https://github.com/vercel-labs/notebook-factory/blob/main/lat.md/deployment.md)
- [Postgres.js with Supabase](https://supabase.com/docs/guides/database/postgres-js)
- [Supabase SSR clients and verified users](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Email/password Auth](https://supabase.com/docs/guides/auth/passwords)
- [Email delivery restrictions and custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Auth callback allow list](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PGlite is embedded PostgreSQL](https://pglite.dev/docs/)
