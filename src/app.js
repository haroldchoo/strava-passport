const storageKey = "strava-passport-state-v1";
const routes = new Map([
  ["", renderHome],
  ["dashboard", renderDashboard],
  ["passport", renderPassport],
  ["map", renderMap],
  ["activities", renderActivities],
  ["privacy", renderPrivacy],
  ["public", renderPublicPassport],
  ["settings", renderSettings],
]);

let state = loadState();

window.addEventListener("hashchange", renderRoute);
document.addEventListener("click", handleActions);
document.addEventListener("change", handleChanges);
document.addEventListener("DOMContentLoaded", () => {
  restoreTheme();
  renderShell();
  renderRoute();
});

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return createInitialState();
  try {
    return { ...createInitialState(), ...JSON.parse(saved) };
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  renderShell();
}

function renderShell() {
  const summary = buildDashboardSummary(state);
  document.querySelector("#profile-block").innerHTML = `
    <div class="avatar" aria-hidden="true">${initials(state.user.displayName)}</div>
    <div>
      <strong>${escapeHtml(state.user.displayName)}</strong>
      <span>${summary.countriesVisited} countries unlocked</span>
    </div>
  `;
  document.querySelector("#sync-block").innerHTML = `
    <span class="status-dot ${state.providerConnected ? "good" : "muted"}"></span>
    <div>
      <strong>${state.providerConnected ? "Demo Strava connected" : "Strava disconnected"}</strong>
      <span>${state.syncJob.status === "completed" ? "Last sync complete" : "Sync unavailable"}</span>
    </div>
  `;
  setActiveNavigation();
}

function renderRoute() {
  const route = location.hash.replace("#", "") || "dashboard";
  const renderer = routes.get(route) || renderDashboard;
  renderer();
  setActiveNavigation();
  document.querySelector("#main").focus({ preventScroll: true });
}

function renderHome() {
  renderDashboard();
}

function renderDashboard() {
  const summary = buildDashboardSummary(state);
  setMain(`
    ${hero("This shows where sport has taken you.", "A private-by-default passport for runs, rides, swims, hikes, and race weekends.", [
      button("Connect Strava", "primary", "connect-strava"),
      button("Refresh Demo", "secondary", "sync-demo"),
    ])}
    <section class="metric-grid" aria-label="Passport summary">
      ${metric("Countries", summary.countriesVisited, "Unlocked destinations")}
      ${metric("Continents", summary.continentsVisited, "Across your activities")}
      ${metric("Activities", summary.activityCount, "Imported summaries")}
      ${metric("Distance", formatDistance(summary.totalDistanceMeters), "No full GPS stored")}
    </section>
    <section class="two-column">
      <div>
        <div class="section-heading">
          <h2>Recent unlocks</h2>
          <a class="text-link" href="#passport">View passport</a>
        </div>
        <div class="country-list">
          ${summary.recentCountries.map(countryRow).join("")}
        </div>
      </div>
      <div>
        <div class="section-heading">
          <h2>Recent activities</h2>
          <a class="text-link" href="#activities">View all</a>
        </div>
        <div class="activity-list">
          ${summary.recentActivities.map(activityRow).join("")}
        </div>
      </div>
    </section>
    <section class="privacy-band">
      <div>
        <h2>Privacy is part of the product.</h2>
        <p>Your public passport is off until you turn it on. Activity names and precise locations stay private.</p>
      </div>
      ${button("Open Privacy Center", "outline", "go-privacy")}
    </section>
  `);
}

function renderPassport() {
  const entries = buildPassportEntries(state.activities, state.countries);
  const unlockedCodes = new Set(entries.map((entry) => entry.country.code));
  const locked = state.countries.filter((country) => !unlockedCodes.has(country.code));
  setMain(`
    ${pageTitle("Passport", "Collected country stamps from your endurance activity history.")}
    <div class="toolbar" role="toolbar" aria-label="Passport filters">
      <button class="chip active" type="button">Unlocked</button>
      <button class="chip" type="button">All sports</button>
      <button class="chip" type="button">Latest visit</button>
    </div>
    <section class="stamp-grid" aria-label="Unlocked passport stamps">
      ${entries.map(stampCard).join("")}
      ${locked.map(lockedStampCard).join("")}
    </section>
  `);
}

function renderMap() {
  const entries = buildPassportEntries(state.activities, state.countries);
  const unlocked = new Map(entries.map((entry) => [entry.country.code, entry]));
  setMain(`
    ${pageTitle("Map", "A generalized country map for exploration. Exact activity coordinates are private.")}
    <section class="map-layout">
      <div class="world-map" role="img" aria-label="Visited countries highlighted on a simplified world map">
        <div class="map-ocean"></div>
        ${state.countries.map((country) => mapMarker(country, unlocked.get(country.code))).join("")}
      </div>
      <div class="map-panel">
        <h2>Visited countries</h2>
        <p>This view uses country-level summaries. Public mode never includes activity locations.</p>
        <div class="country-list compact">
          ${entries.map(countryRow).join("")}
        </div>
      </div>
    </section>
  `);
}

function renderActivities() {
  const rows = [...state.activities].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  setMain(`
    ${pageTitle("Activities", "Private activity summaries used to build your passport.")}
    <section class="table-wrap" aria-label="Activity summaries">
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Country</th>
            <th>Sport</th>
            <th>Date</th>
            <th>Distance</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>${rows.map(activityTableRow).join("")}</tbody>
      </table>
    </section>
  `);
}

function renderPrivacy() {
  const settings = state.privacySettings;
  const publicPassport = buildPublicPassport(state);
  setMain(`
    ${pageTitle("Privacy Center", "Choose exactly what can become public. Everything starts private.")}
    <section class="settings-grid">
      <div class="settings-panel">
        <h2>Public passport</h2>
        ${toggle("publicPassportEnabled", "Enable public passport", settings.publicPassportEnabled)}
        <p class="helper">Disabled public passports return no public profile.</p>
        ${settings.publicPassportEnabled ? `<p class="public-url">Public URL: <a href="#public">${settings.publicUrl}</a></p>` : ""}
      </div>
      <div class="settings-panel">
        <h2>Public fields</h2>
        ${Object.entries(settings.visibility).map(([key, value]) => toggle(`visibility.${key}`, labelForPrivacy(key), value)).join("")}
      </div>
      <div class="settings-panel">
        <h2>Discovery</h2>
        ${toggle("discoverableWithinApp", "Discoverable inside app", settings.discoverableWithinApp)}
        ${toggle("allowSearchEngineIndexing", "Allow search indexing", settings.allowSearchEngineIndexing)}
      </div>
      <div class="settings-panel accent">
        <h2>Current public projection</h2>
        <pre>${escapeHtml(JSON.stringify(publicPassport || { disabled: true }, null, 2))}</pre>
      </div>
    </section>
  `);
}

function renderPublicPassport() {
  const publicPassport = buildPublicPassport(state);
  if (!publicPassport) {
    setMain(`
      ${pageTitle("Public Passport", "Your public passport is currently disabled.")}
      <section class="empty-state">
        <h2>No public page is visible</h2>
        <p>Turn on public sharing in the Privacy Center when you are ready. Private activity names and coordinates will still stay out of public responses.</p>
        ${button("Open Privacy Center", "primary", "go-privacy")}
      </section>
    `);
    return;
  }

  setMain(`
    ${pageTitle(publicPassport.profile.displayName || "Athlete Passport", "A privacy-controlled view built from approved fields only.")}
    <section class="metric-grid">
      ${Object.entries(publicPassport.summary).map(([key, value]) => metric(labelForPrivacy(key), metricValue(key, value), "Public")).join("")}
    </section>
    <section class="stamp-grid">
      ${publicPassport.countries.map(publicStampCard).join("")}
    </section>
  `);
}

function renderSettings() {
  setMain(`
    ${pageTitle("Settings", "Manage connection, export, disconnect, and account deletion controls.")}
    <section class="settings-grid">
      <div class="settings-panel">
        <h2>Connected app</h2>
        <p>${state.providerConnected ? "Demo Strava connection is active." : "Strava is disconnected. Imported history is retained."}</p>
        ${button("Manual Sync", "primary", "sync-demo")}
      </div>
      <div class="settings-panel">
        <h2>Export</h2>
        <p>Download profile, passport, activity summaries, privacy settings, and safe connection metadata.</p>
        ${button("Export Data", "secondary", "export-data")}
      </div>
      <div class="settings-panel danger">
        <h2>Disconnect Strava</h2>
        <p>Disconnecting removes provider access. You can keep imported history or clear it after export.</p>
        ${button("Disconnect", "destructive", "disconnect")}
      </div>
      <div class="settings-panel danger">
        <h2>Delete account</h2>
        <p>This clears the local demo account, activities, passport, privacy settings, and connection state.</p>
        ${button("Delete Account", "destructive", "delete-account")}
      </div>
    </section>
  `);
}

function handleActions(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "toggle-theme") toggleTheme();
  if (action === "connect-strava") toast("Strava OAuth is represented by demo mode in this local build.");
  if (action === "sync-demo") {
    state.syncJob = { ...state.syncJob, status: "completed", completedAt: new Date().toISOString() };
    state.providerConnected = true;
    saveState();
    renderRoute();
    toast("Demo synchronization completed.");
  }
  if (action === "go-privacy") location.hash = "privacy";
  if (action === "export-data") exportData();
  if (action === "disconnect") confirmAction("Disconnect Strava?", "Provider access will be removed. Imported demo history stays available.", () => {
    state.providerConnected = false;
    saveState();
    renderRoute();
    toast("Strava disconnected. Imported history retained.");
  });
  if (action === "delete-account") confirmAction("Delete local demo account?", "This resets the app to a fresh private demo account.", () => {
    state = createInitialState();
    localStorage.removeItem(storageKey);
    renderShell();
    renderRoute();
    toast("Local demo account reset.");
  });
}

function handleChanges(event) {
  const target = event.target;
  if (!target.matches("[data-setting]")) return;
  const key = target.dataset.setting;
  const value = target.checked;

  if (key.startsWith("visibility.")) {
    state.privacySettings.visibility[key.replace("visibility.", "")] = value;
  } else {
    state.privacySettings[key] = value;
  }

  if (state.privacySettings.publicPassportEnabled && !state.privacySettings.publicUrl) {
    state.privacySettings.publicUrl = `${location.origin}${location.pathname}#public`;
  }
  if (!state.privacySettings.publicPassportEnabled) {
    state.privacySettings.allowSearchEngineIndexing = false;
    state.privacySettings.visibility.publicMap = false;
  }
  state.privacySettings.updatedAt = new Date().toISOString();
  saveState();
  renderPrivacy();
  toast("Privacy settings saved.");
}

function exportData() {
  const data = JSON.stringify(buildExport(state), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `strava-passport-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Export created without tokens or secrets.");
}

function confirmAction(title, copy, onConfirm) {
  const dialog = document.querySelector("#confirm-dialog");
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-copy").textContent = copy;
  dialog.showModal();
  dialog.addEventListener("close", function onClose() {
    dialog.removeEventListener("close", onClose);
    if (dialog.returnValue === "confirm") onConfirm();
  });
}

function setMain(markup) {
  document.querySelector("#main").innerHTML = markup;
}

function hero(title, copy, actions) {
  return `
    <section class="hero">
      <div>
        <span class="eyebrow">Demo Mode</span>
        <h1>${title}</h1>
        <p>${copy}</p>
        <div class="action-row">${actions.join("")}</div>
      </div>
      <div class="passport-preview" aria-hidden="true">
        <span>Republic of Miles</span>
        <strong>ATHLETE PASSPORT</strong>
        <div class="preview-stamps">
          <i>KR</i><i>US</i><i>FR</i><i>JP</i>
        </div>
      </div>
    </section>
  `;
}

function pageTitle(title, copy) {
  return `<section class="page-title"><span class="eyebrow">STRAVA Passport</span><h1>${title}</h1><p>${copy}</p></section>`;
}

function metric(label, value, detail) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function countryRow(entry) {
  return `
    <article class="row-card">
      <span class="flag">${entry.country.flag}</span>
      <div>
        <strong>${entry.country.name}</strong>
        <small>${entry.activityCount} activities · ${formatDistance(entry.totalDistanceMeters)}</small>
      </div>
      <span>${formatDate(entry.lastVisitedAt)}</span>
    </article>
  `;
}

function activityRow(activity) {
  const country = state.countries.find((item) => item.code === activity.countryCode);
  return `
    <article class="row-card">
      <span class="sport">${sportLabel(activity.sportType).slice(0, 2)}</span>
      <div>
        <strong>${escapeHtml(activity.name)}</strong>
        <small>${country.flag} ${country.name} · ${sportLabel(activity.sportType)}</small>
      </div>
      <span>${formatDistance(activity.distanceMeters)}</span>
    </article>
  `;
}

function stampCard(entry) {
  return `
    <article class="stamp-card">
      <div class="stamp ${entry.stamp.variant}">
        <span>${entry.country.flag}</span>
        <strong>${entry.country.code}</strong>
        <small>${formatDate(entry.firstVisitedAt)}</small>
      </div>
      <h2>${entry.country.name}</h2>
      <p>${entry.activityCount} activities · ${formatDistance(entry.totalDistanceMeters)}</p>
      <div class="badge-row">${entry.sportTypes.map((sport) => `<span class="badge">${sportLabel(sport)}</span>`).join("")}</div>
    </article>
  `;
}

function lockedStampCard(country) {
  return `
    <article class="stamp-card locked">
      <div class="stamp locked-stamp"><span>${country.flag}</span><strong>${country.code}</strong><small>Locked</small></div>
      <h2>${country.name}</h2>
      <p>No activities imported yet.</p>
    </article>
  `;
}

function publicStampCard(entry) {
  return `
    <article class="stamp-card">
      ${entry.stamp ? `<div class="stamp ${entry.stamp.variant}"><span>${entry.country.flag}</span><strong>${entry.country.code}</strong><small>Public</small></div>` : ""}
      <h2>${entry.country.name}</h2>
      <p>${[
        entry.activityCount ? `${entry.activityCount} activities` : "",
        entry.totalDistanceMeters ? formatDistance(entry.totalDistanceMeters) : "",
      ].filter(Boolean).join(" · ") || "Country unlocked"}</p>
      ${entry.sportTypes ? `<div class="badge-row">${entry.sportTypes.map((sport) => `<span class="badge">${sportLabel(sport)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

function mapMarker(country, entry) {
  const label = entry ? `${country.name}: ${entry.activityCount} activities` : `${country.name}: locked`;
  return `
    <button class="map-marker ${entry ? "visited" : ""}" style="left:${country.x}%; top:${country.y}%;" title="${label}" aria-label="${label}">
      <span>${country.code}</span>
    </button>
  `;
}

function activityTableRow(activity) {
  const country = state.countries.find((item) => item.code === activity.countryCode);
  return `
    <tr>
      <td>${escapeHtml(activity.name)}</td>
      <td>${country.flag} ${country.name}</td>
      <td>${sportLabel(activity.sportType)}</td>
      <td>${formatDate(activity.startTime)}</td>
      <td>${formatDistance(activity.distanceMeters)}</td>
      <td>${formatDuration(activity.movingTimeSeconds)}</td>
    </tr>
  `;
}

function button(label, variant, action) {
  return `<button class="button ${variant}" type="button" data-action="${action}">${label}</button>`;
}

function toggle(key, label, checked) {
  return `
    <label class="toggle">
      <span>${label}</span>
      <input type="checkbox" data-setting="${key}" ${checked ? "checked" : ""}>
    </label>
  `;
}

function labelForPrivacy(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace("Url", "URL");
}

function metricValue(key, value) {
  if (key === "totalDistanceMeters") return formatDistance(value);
  if (key === "totalMovingTimeSeconds") return formatDuration(value);
  return value;
}

function setActiveNavigation() {
  const route = location.hash || "#dashboard";
  document.querySelectorAll("nav a").forEach((link) => {
    link.toggleAttribute("aria-current", link.getAttribute("href") === route);
  });
}

function restoreTheme() {
  const theme = localStorage.getItem("strava-passport-theme");
  if (theme === "dark") document.documentElement.classList.add("dark");
}

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("strava-passport-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
}

function toast(message) {
  const region = document.querySelector(".toast-region");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3200);
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
