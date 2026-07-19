import { NextResponse } from "next/server";
import { savePrivacySettings } from "@/lib/repository";
import { requireSession } from "@/lib/request-auth";
import type { PrivacySettings } from "@/lib/types";

export async function PATCH(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  let input: PrivacySettings;
  try {
    input = (await request.json()) as PrivacySettings;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return NextResponse.json(await savePrivacySettings(auth.session.athleteId, input));
}
