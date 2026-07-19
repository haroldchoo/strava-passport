import { NextResponse } from "next/server";
import { buildExport } from "@/lib/domain";
import { loadAppState } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const body = JSON.stringify(buildExport(await loadAppState(auth.session.athleteId)), null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="strava-passport-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
