import { NextResponse } from "next/server";
import { createDemoState } from "@/lib/demo";
import { loadAppState } from "@/lib/repository";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(createDemoState());
  try {
    return NextResponse.json(await loadAppState(session.athleteId));
  } catch {
    return NextResponse.json({ error: "Unable to load private account state" }, { status: 500 });
  }
}
