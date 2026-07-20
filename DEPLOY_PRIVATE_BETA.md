# Deploy The Private Beta

Do not paste the Strava client secret, tokens, Supabase service-role key, or generated encryption keys into chat, Git, issue trackers, or browser-visible variables.

## 1. Create Supabase

1. Create a Supabase account and a new project.
2. Choose the Northeast Asia (Tokyo) region.
3. Open the SQL Editor and run `supabase/migrations/0001_private_beta.sql`, then `supabase/migrations/0002_invite_worker_scale.sql`.
4. From Project Settings, record the project URL and server-side `service_role` key in a password manager.
5. Confirm the five tables have row-level security enabled and no policies for `anon` or `authenticated`.

## 2. Create Vercel

1. Create a Vercel account using the GitHub account that owns `haroldchoo/strava-passport`.
2. Import the repository as a new project. Vercel will detect Next.js from `package.json`.
3. Keep the GitHub Pages deployment enabled; Vercel and Pages can deploy different entrypoints from the same branch.
4. Complete the first deployment and note its stable `*.vercel.app` hostname.

## 3. Configure protected variables

Generate two unrelated secrets locally:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Add these Vercel variables for Production and Preview where appropriate:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | The production Vercel origin, such as `https://strava-passport.vercel.app` |
| `STRAVA_CLIENT_ID` | Client ID from the existing Strava API application |
| `STRAVA_CLIENT_SECRET` | Client secret from the Strava API application |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-only service-role key |
| `SESSION_SECRET` | First generated value; must be at least 32 characters |
| `TOKEN_ENCRYPTION_KEY` | Second generated value; must decode to exactly 32 bytes |
| `SYNC_WORKER_SECRET` | Third generated value used as a bearer token for `/api/cron/sync` |
| `CRON_SECRET` | Same value as `SYNC_WORKER_SECRET` when using Vercel Cron |
| `INVITE_ADMIN_SECRET` | Separate generated value used to create invite links through `/api/admin/invites` |
| `SYNC_BATCH_SIZE` | Optional number of jobs claimed per worker run; default `4` |
| `SYNC_MAX_PAGES_PER_RUN` | Optional Strava pages processed per worker run; default `8` |

Never prefix a secret with `NEXT_PUBLIC_`. Redeploy after adding the variables.

## 4. Configure Strava OAuth

1. Open the existing Strava API application's settings.
2. Set **Authorization Callback Domain** to the Vercel hostname only, without a protocol or path.
3. The application uses this full callback URL:

   `https://YOUR-VERCEL-HOST/api/auth/strava/callback`

4. For local testing, set the callback domain temporarily to `localhost`; Strava permits `localhost` and `127.0.0.1`.

The app requests `read,activity:read_all`. Declining `activity:read_all` aborts connection and revokes the newly issued token.

## 5. Create invites

Invite codes are stored only as salted SHA-256 hashes using `SESSION_SECRET` as the salt. The easiest path is the protected admin API:

```bash
curl -X POST https://YOUR-VERCEL-HOST/api/admin/invites \
  -H "Authorization: Bearer $INVITE_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"athlete@example.com","expiresInDays":30}'
```

The response includes a one-time `code` and `inviteUrl`. Send the user the `inviteUrl`; they do not need Supabase, Vercel, or a terminal.

If the admin API is unavailable, manually generate a code/hash using the production `SESSION_SECRET`, then insert the hash:

```bash
node -e 'const {createHash,randomBytes}=require("node:crypto"); const code=randomBytes(8).toString("base64url").toUpperCase(); const hash=createHash("sha256").update(`${process.env.SESSION_SECRET}:${code}`).digest("hex"); console.log({code,hash});'
```

## 6. Configure sync worker

The repository includes `vercel.json`, which registers `/api/cron/sync` to run every minute on production deployments. Vercel sends `CRON_SECRET` as the bearer token when that environment variable is configured.

For manual testing or Supabase Scheduler, call:

```bash
curl -X POST https://YOUR-VERCEL-HOST/api/cron/sync \
  -H "Authorization: Bearer $SYNC_WORKER_SECRET"
```

A one-minute cadence is appropriate for a 100-300 person beta. The worker claims ready jobs, respects global Strava rate-limit pauses, and exits after the configured page budget.

## 7. Live acceptance test

1. Open the Vercel app in a private browser window and select **Connect Strava**.
2. Enter an unused invite code.
3. Confirm Strava shows the expected application and private-activity permission.
4. Complete authorization with the invited athlete account.
5. Confirm the first import shows as queued, then advances as the worker runs.
6. Check known activities in South Korea and at least two travel countries.
7. Confirm indoor or coordinate-free activities appear as **Unresolved** and do not create a country stamp.
8. Refresh the browser and verify the account and imported summaries persist.
9. Run Manual Sync again and verify totals remain stable.
10. Export the account and search the JSON for `token`, `secret`, `latlng`, `polyline`, and `coordinates`; none should appear.
11. Test Disconnect only after reviewing the imported data. It revokes Strava access but retains imported summaries.

## Operational notes

- Public passport output remains disabled regardless of saved future field preferences.
- A full manual sync reconciles deleted activities by removing rows not seen by the completed job.
- If Strava returns a rate limit, the job and global provider throttle record the retry time and can resume after the window resets.
- If a worker dies mid-job, `claim_sync_jobs` can recover stale locks after ten minutes.
- The database stores activity names and summaries, so treat the Supabase service-role key and Vercel project access as sensitive.
