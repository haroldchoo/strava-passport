import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function requireSession() {
  const session = await getSession();
  if (!session) return { session: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { session, response: null };
}
