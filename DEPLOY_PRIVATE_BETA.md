# Deploy The Private Beta

Do not paste the Strava client secret, tokens, Supabase service-role key, or generated encryption keys into chat, Git, issue trackers, or browser-visible variables.

## 1. Create Supabase

1. Create a Supabase account and a new project.
2. Choose the Northeast Asia (Tokyo) region.
3. Open the SQL Editor and run `supabase/migrations/0001_private_beta.sql`.
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
| `STRAVA_ALLOWED_ATHLETE_ID` | Numeric athlete ID from the owner's Strava profile URL |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-only service-role key |
| `SESSION_SECRET` | First generated value; must be at least 32 characters |
| `TOKEN_ENCRYPTION_KEY` | Second generated value; must decode to exactly 32 bytes |

Never prefix a secret with `NEXT_PUBLIC_`. Redeploy after adding the variables.

## 4. Configure Strava OAuth

1. Open the existing Strava API application's settings.
2. Set **Authorization Callback Domain** to the Vercel hostname only, without a protocol or path.
3. The application uses this full callback URL:

   `https://YOUR-VERCEL-HOST/api/auth/strava/callback`

4. For local testing, set the callback domain temporarily to `localhost`; Strava permits `localhost` and `127.0.0.1`.

The app requests `read,activity:read_all`. Declining `activity:read_all` aborts connection and revokes the newly issued token.

## 5. Live acceptance test

1. Open the Vercel app in a private browser window and select **Connect Strava**.
2. Confirm Strava shows the expected application and private-activity permission.
3. Complete authorization with the allow-listed athlete account.
4. Watch the first import advance in 200-activity pages until complete.
5. Check known activities in South Korea and at least two travel countries.
6. Confirm indoor or coordinate-free activities appear as **Unresolved** and do not create a country stamp.
7. Refresh the browser and verify the account and imported summaries persist.
8. Run Manual Sync again and verify totals remain stable.
9. Export the account and search the JSON for `token`, `secret`, `latlng`, `polyline`, and `coordinates`; none should appear.
10. Test Disconnect only after reviewing the imported data. It revokes Strava access but retains imported summaries.

## Operational notes

- Public passport output remains disabled regardless of saved future field preferences.
- A full manual sync reconciles deleted activities by removing rows not seen by the completed job.
- If Strava returns a rate limit, the job records the retry time and can resume after the window resets.
- The database stores activity names and summaries, so treat the Supabase service-role key and Vercel project access as sensitive.
