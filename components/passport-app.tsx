"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorldMap } from "@/components/world-map";
import { buildDashboardSummary, buildPassportEntries, filterAndSortPassportEntries, formatDate, formatDistance, formatDuration, sportLabel } from "@/lib/domain";
import type { PassportSort } from "@/lib/domain";
import { createDemoState } from "@/lib/demo";
import type { ActivitySummary, AppState, Country, PassportEntry, PrivacySettings, SyncJob } from "@/lib/types";

type RouteName = "dashboard" | "passport" | "map" | "activities" | "privacy" | "public" | "settings";

const routes = new Set<RouteName>(["dashboard", "passport", "map", "activities", "privacy", "public", "settings"]);

export function PassportApp() {
  const [state, setState] = useState<AppState>(() => createDemoState());
  const [route, setRoute] = useState<RouteName>("dashboard");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    setState((await response.json()) as AppState);
  }, []);

  useEffect(() => {
    const readRoute = () => {
      const candidate = window.location.hash.replace("#", "") as RouteName;
      setRoute(routes.has(candidate) ? candidate : "dashboard");
    };
    readRoute();
    window.addEventListener("hashchange", readRoute);
    const loadTimer = window.setTimeout(() => void loadState(), 0);
    const theme = window.localStorage.getItem("strava-passport-theme");
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener("hashchange", readRoute);
    };
  }, [loadState]);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3600);
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    window.localStorage.setItem("strava-passport-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  };

  const runJob = useCallback(async (initialJob: SyncJob) => {
    setBusy(true);
    let job = initialJob;
    try {
      while (job.status === "pending" || job.status === "running" || (job.status === "rate_limited" && job.retryAfterSeconds === 0)) {
        const next = await fetch(`/api/sync/${job.id}/next`, { method: "POST" });
        if (!next.ok) throw new Error(await responseMessage(next));
        job = (await next.json()) as SyncJob;
        setState((current) => ({ ...current, syncJob: job }));
      }
      await loadState();
      setNotice(job.status === "completed" ? "Strava synchronization completed." : job.error ?? "Synchronization paused.");
      window.setTimeout(() => setNotice(null), 3600);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Synchronization failed.");
    } finally {
      setBusy(false);
    }
  }, [loadState]);

  useEffect(() => {
    if (!state.authenticated || state.syncJob.status !== "pending" || busy) return;
    const syncTimer = window.setTimeout(() => void runJob(state.syncJob), 0);
    return () => window.clearTimeout(syncTimer);
  }, [busy, runJob, state.authenticated, state.syncJob]);

  const sync = async () => {
    if (!state.authenticated) {
      window.location.assign("/api/auth/strava");
      return;
    }
    setBusy(true);
    try {
      const start = await fetch("/api/sync/start", { method: "POST" });
      if (!start.ok) throw new Error(await responseMessage(start));
      const job = (await start.json()) as SyncJob;
      setState((current) => ({ ...current, syncJob: job }));
      await runJob(job);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Synchronization failed.");
    } finally {
      setBusy(false);
    }
  };

  const updatePrivacy = async (next: PrivacySettings) => {
    if (!state.authenticated) return;
    setState((current) => ({ ...current, privacySettings: next }));
    const response = await fetch("/api/privacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      await loadState();
      toast(await responseMessage(response));
      return;
    }
    toast("Privacy settings saved.");
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Strava? Imported activity summaries will remain available.")) return;
    setBusy(true);
    const response = await fetch("/api/disconnect", { method: "POST" });
    await loadState();
    setBusy(false);
    toast(response.ok ? "Strava disconnected." : await responseMessage(response));
  };

  const deleteAccount = async () => {
    if (!window.confirm("Delete the private beta account and all imported activity summaries?")) return;
    setBusy(true);
    const response = await fetch("/api/account", { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      toast(await responseMessage(response));
      return;
    }
    setState(createDemoState());
    window.location.hash = "dashboard";
    toast("Account data deleted.");
  };

  const summary = useMemo(() => buildDashboardSummary(state), [state]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#dashboard" aria-label="STRAVA Passport dashboard">
            <span className="brand-mark" aria-hidden="true">SP</span>
            <span><strong>STRAVA Passport</strong><small>Private athletic travel journal</small></span>
          </a>
          <Nav className="desktop-nav" route={route} />
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle color theme">◐</button>
        </header>

        <aside className="sidebar" aria-label="Passport summary">
          <div className="profile-block">
            <div className="avatar" aria-hidden="true">{initials(state.user.displayName)}</div>
            <div><strong>{state.user.displayName}</strong><span>{summary.countriesVisited} countries unlocked</span></div>
          </div>
          <div className="sync-block">
            <span className={`status-dot ${state.providerConnected ? "good" : "muted"}`} />
            <div>
              <strong>{state.providerConnected ? "Strava connected" : state.mode === "demo" ? "Demo Mode" : "Strava disconnected"}</strong>
              <span>{syncLabel(state.syncJob)}</span>
            </div>
          </div>
          <nav className="side-nav" aria-label="Sections">
            <NavLinks route={route} includePublic />
          </nav>
        </aside>

        <main id="main" className="main" tabIndex={-1}>
          {route === "dashboard" && <Dashboard state={state} busy={busy} onSync={sync} />}
          {route === "passport" && <Passport state={state} />}
          {route === "map" && <MapView state={state} />}
          {route === "activities" && <Activities state={state} />}
          {route === "privacy" && <Privacy state={state} onChange={updatePrivacy} />}
          {route === "public" && <PrivateBetaNotice />}
          {route === "settings" && (
            <Settings
              state={state}
              busy={busy}
              onSync={sync}
              onDisconnect={disconnect}
              onDelete={deleteAccount}
            />
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary mobile">
          <a href="#dashboard" aria-current={route === "dashboard" ? "page" : undefined}>Home</a>
          <a href="#passport" aria-current={route === "passport" ? "page" : undefined}>Passport</a>
          <a href="#map" aria-current={route === "map" ? "page" : undefined}>Map</a>
          <a href="#activities" aria-current={route === "activities" ? "page" : undefined}>Log</a>
          <a href="#privacy" aria-current={route === "privacy" ? "page" : undefined}>Privacy</a>
        </nav>
      </div>
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && <div className="toast">{notice}</div>}
      </div>
    </>
  );
}

function Dashboard({ state, busy, onSync }: { state: AppState; busy: boolean; onSync: () => void }) {
  const summary = buildDashboardSummary(state);
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">{state.mode === "live" ? "Private Beta" : "Demo Mode"}</span>
          <h1>This shows where sport has taken you.</h1>
          <p>A private-by-default passport for runs, rides, swims, hikes, and race weekends.</p>
          <div className="action-row">
            {state.authenticated ? (
              <button className="button primary" type="button" disabled={busy || !state.providerConnected} onClick={onSync}>
                {busy ? "Syncing..." : "Manual Sync"}
              </button>
            ) : (
              <a className="button primary" href="/api/auth/strava">Connect Strava</a>
            )}
            <a className="button secondary" href="#privacy">Privacy Center</a>
          </div>
          <SyncProgress job={state.syncJob} />
        </div>
        <div className="passport-preview" aria-hidden="true">
          <span>Republic of Miles</span>
          <strong>ATHLETE PASSPORT</strong>
          <div className="preview-stamps">
            {(summary.passportEntries.length ? summary.passportEntries.slice(0, 4).map((entry) => entry.country.code) : ["KR", "US", "FR", "JP"]).map((code) => <i key={code}>{code}</i>)}
          </div>
        </div>
      </section>
      <section className="metric-grid" aria-label="Passport summary">
        <Metric label="Countries" value={summary.countriesVisited} detail="Unlocked destinations" />
        <Metric label="Continents" value={summary.continentsVisited} detail="Across your activities" />
        <Metric label="Activities" value={summary.activityCount} detail={`${summary.unresolvedActivityCount} awaiting a country`} />
        <Metric label="Distance" value={formatDistance(summary.totalDistanceMeters)} detail="No GPS stored" />
      </section>
      <section className="two-column">
        <div>
          <SectionHeading title="Recent unlocks" href="#passport" label="View passport" />
          <div className="country-list">{summary.recentCountries.map((entry) => <CountryRow key={entry.country.code} entry={entry} />)}</div>
        </div>
        <div>
          <SectionHeading title="Recent activities" href="#activities" label="View all" />
          <div className="activity-list">{summary.recentActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} countries={state.countries} />)}</div>
        </div>
      </section>
      <section className="privacy-band">
        <div><h2>Privacy is part of the product.</h2><p>Real activity data is available only inside your signed-in beta. Precise coordinates are never stored.</p></div>
        <a className="button outline" href="#privacy">Open Privacy Center</a>
      </section>
    </>
  );
}

function Passport({ state }: { state: AppState }) {
  const entries = buildPassportEntries(state);
  const [scope, setScope] = useState<"unlocked" | "all">("unlocked");
  const [sportFilter, setSportFilter] = useState("all");
  const [sortBy, setSortBy] = useState<PassportSort>("latest");
  const sportTypes = [...new Set(entries.flatMap((entry) => entry.sportTypes))].sort((a, b) => sportLabel(a).localeCompare(sportLabel(b)));
  const visibleEntries = filterAndSortPassportEntries(entries, sportFilter, sortBy);
  const unlocked = new Set(entries.map((entry) => entry.country.code));
  const locked = scope === "all" && sportFilter === "all"
    ? state.countries.filter((country) => !unlocked.has(country.code)).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const hasResults = visibleEntries.length > 0 || locked.length > 0;
  return (
    <>
      <PageTitle title="Passport" copy="Collected country stamps from your endurance activity history." />
      <div className="toolbar" role="toolbar" aria-label="Passport filters">
        <select className="chip" aria-label="Country status" value={scope} onChange={(event) => setScope(event.target.value as "unlocked" | "all")}>
          <option value="unlocked">Unlocked</option>
          <option value="all">All countries</option>
        </select>
        <select className="chip" aria-label="Sport type" value={sportFilter} onChange={(event) => setSportFilter(event.target.value)}>
          <option value="all">All sports</option>
          {sportTypes.map((sport) => <option value={sport} key={sport}>{sportLabel(sport)}</option>)}
        </select>
        <select className="chip" aria-label="Passport order" value={sortBy} onChange={(event) => setSortBy(event.target.value as PassportSort)}>
          <option value="latest">Latest visit</option>
          <option value="earliest">Earliest visit</option>
          <option value="country">Country A-Z</option>
          <option value="activities">Most activities</option>
        </select>
      </div>
      {hasResults ? (
        <section className="stamp-grid" aria-label={scope === "unlocked" ? "Unlocked passport stamps" : "All passport countries"}>
          {visibleEntries.map((entry) => <StampCard key={entry.country.code} entry={entry} />)}
          {locked.map((country) => <LockedStampCard key={country.code} country={country} />)}
        </section>
      ) : (
        <section className="empty-state passport-empty"><h2>No matching stamps</h2><p>Choose another sport to see countries from those activities.</p></section>
      )}
    </>
  );
}

function MapView({ state }: { state: AppState }) {
  const entries = buildPassportEntries(state);
  return (
    <>
      <PageTitle title="Map" copy="A generalized country map for exploration. Exact activity coordinates are not retained." />
      <section className="map-layout">
        <WorldMap entries={entries} />
        <div className="map-panel"><h2>Visited countries</h2><p>Country summaries are derived server-side and contain no activity coordinates.</p><div className="country-list compact">{entries.map((entry) => <CountryRow key={entry.country.code} entry={entry} />)}</div></div>
      </section>
    </>
  );
}

function Activities({ state }: { state: AppState }) {
  const rows = [...state.activities].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  const countries = new Map(state.countries.map((country) => [country.code, country]));
  return (
    <>
      <PageTitle title="Activities" copy="Private summaries used to build your passport." />
      <section className="table-wrap" aria-label="Activity summaries">
        <table><thead><tr><th>Activity</th><th>Country</th><th>Sport</th><th>Date</th><th>Distance</th><th>Time</th></tr></thead>
          <tbody>{rows.map((activity) => {
            const country = activity.countryCode ? countries.get(activity.countryCode) : null;
            return <tr key={activity.id}><td>{activity.name}</td><td>{country ? `${country.flag} ${country.name}` : <span className="unresolved">Unresolved</span>}</td><td>{sportLabel(activity.sportType)}</td><td>{formatDate(activity.startTime)}</td><td>{formatDistance(activity.distanceMeters)}</td><td>{formatDuration(activity.movingTimeSeconds)}</td></tr>;
          })}</tbody>
        </table>
      </section>
    </>
  );
}

function Privacy({ state, onChange }: { state: AppState; onChange: (settings: PrivacySettings) => void }) {
  const settings = state.privacySettings;
  const changeVisibility = (key: keyof PrivacySettings["visibility"], value: boolean) => {
    onChange({ ...settings, visibility: { ...settings.visibility, [key]: value }, updatedAt: new Date().toISOString() });
  };
  return (
    <>
      <PageTitle title="Privacy Center" copy="Your real-data beta remains private while you review imported results." />
      <section className="settings-grid">
        <div className="settings-panel"><h2>Public passport</h2><Toggle label="Enable public passport" checked={false} disabled /><p className="helper">Public sharing is disabled for this beta at both the UI and API layers.</p></div>
        <div className="settings-panel"><h2>Future public fields</h2>{Object.entries(settings.visibility).map(([key, value]) => <Toggle key={key} label={privacyLabel(key)} checked={value} disabled={!state.authenticated} onChange={(checked) => changeVisibility(key as keyof PrivacySettings["visibility"], checked)} />)}</div>
        <div className="settings-panel"><h2>Discovery</h2><Toggle label="Discoverable inside app" checked={false} disabled /><Toggle label="Allow search indexing" checked={false} disabled /></div>
        <div className="settings-panel accent"><h2>Current public projection</h2><pre>{JSON.stringify({ disabled: true, reason: "private_beta" }, null, 2)}</pre></div>
      </section>
    </>
  );
}

function PrivateBetaNotice() {
  return <><PageTitle title="Public Passport" copy="Public sharing is unavailable during the private beta." /><section className="empty-state"><h2>No real data is public</h2><p>Review country resolution and imported totals before a public projection is introduced.</p><a className="button primary" href="#privacy">Open Privacy Center</a></section></>;
}

function Settings({ state, busy, onSync, onDisconnect, onDelete }: { state: AppState; busy: boolean; onSync: () => void; onDisconnect: () => void; onDelete: () => void }) {
  return (
    <>
      <PageTitle title="Settings" copy="Manage the private connection, export, disconnect, and account deletion controls." />
      <section className="settings-grid">
        <div className="settings-panel"><h2>Connected app</h2><p>{state.providerConnected ? "Strava connection is active." : "Connect Strava to import your account."}</p><button className="button primary" type="button" onClick={onSync} disabled={busy || (state.authenticated && !state.providerConnected)}>{state.authenticated ? "Manual Sync" : "Connect Strava"}</button><SyncProgress job={state.syncJob} /></div>
        <div className="settings-panel"><h2>Export</h2><p>Download profile, passport, summaries, privacy settings, and safe connection metadata.</p><a className="button secondary" href={state.authenticated ? "/api/export" : undefined} aria-disabled={!state.authenticated}>Export Data</a></div>
        <div className="settings-panel danger"><h2>Disconnect Strava</h2><p>Revoke provider access while retaining imported summaries.</p><button className="button destructive" type="button" disabled={!state.providerConnected || busy} onClick={onDisconnect}>Disconnect</button></div>
        <div className="settings-panel danger"><h2>Delete account</h2><p>Revoke access and permanently delete all private-beta records.</p><button className="button destructive" type="button" disabled={!state.authenticated || busy} onClick={onDelete}>Delete Account</button></div>
      </section>
    </>
  );
}

function Nav({ className, route }: { className: string; route: RouteName }) {
  return <nav className={className} aria-label="Primary"><NavLinks route={route} /></nav>;
}

function NavLinks({ route, includePublic = false }: { route: RouteName; includePublic?: boolean }) {
  const items: Array<[RouteName, string]> = [["dashboard", "Dashboard"], ["passport", "Passport"], ["map", "Map"], ["activities", "Activities"], ["privacy", "Privacy Center"], ...(includePublic ? [["public", "Public Passport"] as [RouteName, string]] : []), ["settings", "Settings"]];
  return <>{items.map(([key, label]) => <a key={key} href={`#${key}`} aria-current={route === key ? "page" : undefined}>{label}</a>)}</>;
}

function PageTitle({ title, copy }: { title: string; copy: string }) { return <section className="page-title"><span className="eyebrow">STRAVA Passport</span><h1>{title}</h1><p>{copy}</p></section>; }
function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function SectionHeading({ title, href, label }: { title: string; href: string; label: string }) { return <div className="section-heading"><h2>{title}</h2><a className="text-link" href={href}>{label}</a></div>; }
function CountryRow({ entry }: { entry: PassportEntry }) { return <article className="row-card"><span className="flag">{entry.country.flag}</span><div><strong>{entry.country.name}</strong><small>{entry.activityCount} activities · {formatDistance(entry.totalDistanceMeters)}</small></div><span>{formatDate(entry.lastVisitedAt)}</span></article>; }
function ActivityRow({ activity, countries }: { activity: ActivitySummary; countries: Country[] }) { const country = activity.countryCode ? countries.find((item) => item.code === activity.countryCode) : null; return <article className="row-card"><span className="sport">{sportLabel(activity.sportType).slice(0, 2)}</span><div><strong>{activity.name}</strong><small>{country ? `${country.flag} ${country.name}` : "Country unresolved"} · {sportLabel(activity.sportType)}</small></div><span>{formatDistance(activity.distanceMeters)}</span></article>; }
function StampCard({ entry }: { entry: PassportEntry }) { return <article className="stamp-card"><div className={`stamp ${entry.stamp.variant}`}><span>{entry.country.flag}</span><strong>{entry.country.code}</strong><small>{formatDate(entry.firstVisitedAt)}</small></div><h2>{entry.country.name}</h2><p>{entry.activityCount} activities · {formatDistance(entry.totalDistanceMeters)}</p><div className="badge-row">{entry.sportTypes.map((sport) => <span className="badge" key={sport}>{sportLabel(sport)}</span>)}</div></article>; }
function LockedStampCard({ country }: { country: Country }) { return <article className="stamp-card locked"><div className="stamp locked-stamp"><span>{country.flag}</span><strong>{country.code}</strong><small>Locked</small></div><h2>{country.name}</h2><p>No activities imported yet.</p></article>; }
function Toggle({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void }) { return <label className="toggle"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} /></label>; }
function SyncProgress({ job }: { job: SyncJob }) { if (!["pending", "running", "rate_limited"].includes(job.status)) return null; return <div className="sync-progress"><progress max={Math.max(job.processed + 200, 200)} value={job.processed} /><small>{job.status === "rate_limited" ? `Paused for ${job.retryAfterSeconds ?? "a few"} seconds` : `${job.processed} activities processed`}</small></div>; }

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function privacyLabel(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
function syncLabel(job: SyncJob) { if (job.status === "completed") return "Last sync complete"; if (job.status === "running" || job.status === "pending") return `${job.processed} activities processed`; if (job.status === "rate_limited") return "Sync paused by rate limit"; if (job.status === "failed") return "Last sync failed"; return "Sync ready"; }
async function responseMessage(response: Response) { try { const body = await response.json() as { error?: string }; return body.error ?? `Request failed (${response.status})`; } catch { return `Request failed (${response.status})`; } }
