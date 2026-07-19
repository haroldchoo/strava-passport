# STRAVA Passport

STRAVA Passport is a private-by-default digital travel passport for endurance athletes.

This first local build is dependency-free so it can run directly from the workspace. It implements the core demo journey from the specification files:

- Demo Strava connection and synchronization status
- Dashboard summaries
- Passport stamp aggregation from activity summaries
- Generalized country map
- Private activity list
- Privacy Center with public projection preview
- Public Passport view
- Export, disconnect, and account deletion controls

## Open the app

Open `index.html` in a browser.

No Strava credentials are required for Demo Mode.

## Architecture notes

The app keeps business logic in `src/domain.js` and rendering/event handling in `src/app.js`. This mirrors the future production architecture in the Markdown specs: provider-specific integration should remain behind adapters, passport entries are derived and rebuildable, and public output is created through an allow-listed projection rather than by exposing private objects.

## Next production steps

1. Replace local demo persistence with a Next.js application server and secure session cookie.
2. Add Strava OAuth through a server-side adapter.
3. Add Supabase Postgres migrations using the schema in `database.md`.
4. Move synchronization into durable background jobs.
5. Add unit, API, and end-to-end tests once the runtime dependency issue is fixed.
