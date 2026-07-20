"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type InviteResponse = {
  email: string | null;
  code: string;
  expiresAt: string;
  inviteUrl: string;
};

export function AdminInvitePanel() {
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setInvite(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() || undefined, expiresInDays }),
      });
      const body = await response.json() as InviteResponse | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : `Request failed (${response.status})`);
      setInvite(body as InviteResponse);
      setNotice("Invite created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create invite.");
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.inviteUrl);
    setNotice("Invite link copied.");
  };

  const shareInvite = async () => {
    if (!invite) return;
    if (navigator.share) {
      await navigator.share({ title: "STRAVA Passport invite", url: invite.inviteUrl });
      return;
    }
    await copyInvite();
  };

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <Link className="brand admin-brand" href="/" aria-label="STRAVA Passport dashboard">
          <span className="brand-mark" aria-hidden="true">SP</span>
          <span><strong>STRAVA Passport</strong><small>Invite admin</small></span>
        </Link>

        <div className="admin-heading">
          <span className="eyebrow">Invite Console</span>
          <h1>Create a friend invite.</h1>
          <p>Generate a one-time Strava connection link and send it directly to your friend.</p>
        </div>

        <form className="admin-form" onSubmit={createInvite}>
          <label>
            <span>Admin secret</span>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            <span>Friend email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="friend@example.com"
            />
          </label>
          <label>
            <span>Expires in days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              required
            />
          </label>
          <button className="button primary" type="submit" disabled={busy || !secret.trim()}>
            {busy ? "Creating..." : "Create Invite"}
          </button>
        </form>

        {invite && (
          <section className="admin-result" aria-label="Created invite">
            <div>
              <span>Invite link</span>
              <code>{invite.inviteUrl}</code>
            </div>
            <div className="action-row">
              <button className="button secondary" type="button" onClick={copyInvite}>Copy Link</button>
              <button className="button outline" type="button" onClick={() => void shareInvite()}>Share</button>
            </div>
            <small>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(invite.expiresAt))}</small>
          </section>
        )}

        {notice && <div className={`notice ${invite ? "" : "error-notice"}`} role="status">{notice}</div>}
      </section>
    </main>
  );
}
