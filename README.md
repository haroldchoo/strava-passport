# STRAVA Passport

STRAVA Passport is a private-by-default athletic travel journal. This repository contains two independently hosted surfaces:

- The dependency-free demo in `index.html` and `src/`, published through GitHub Pages.
- The invite-only Strava beta in `app/`, `components/`, and `lib/`, deployed as a Next.js application on Vercel.

The beta signs in invited Strava athletes, imports activity summaries through a server-side sync worker, resolves each activity's start point to an ISO country code locally on the server, and immediately discards the coordinates. Access and refresh tokens are encrypted before storage. Real-data public sharing is disabled.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without configured server variables, the visual demo builds and renders, but OAuth and authenticated APIs are unavailable.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm audit
```

## Architecture

- Next.js App Router serves the beta UI and same-origin API routes.
- Supabase Postgres stores the athlete, encrypted Strava connection, normalized activity summaries, sync jobs, and privacy settings.
- Browser access to Supabase tables is revoked; only server routes use the service-role key.
- OAuth sessions use a signed, HTTP-only, same-site cookie.
- Activity sync is queued by the browser and processed by a protected server worker in bounded Strava pages.
- Dashboard state returns cached passport summaries and recent activities; the Activity Log is paginated.
- Country lookup runs locally from packaged GeoJSON boundaries. Coordinates and polylines are never persisted or returned.
- The current public demo remains private-data-free and continues to work as a static site.

See [DEPLOY_PRIVATE_BETA.md](DEPLOY_PRIVATE_BETA.md) for account creation and production setup.
