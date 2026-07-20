import { NextRequest, NextResponse } from "next/server";
import { listActivitiesPage } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  return NextResponse.json(await listActivitiesPage(auth.session.athleteId, cursor, limit));
}
