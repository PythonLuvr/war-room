import { NextRequest, NextResponse } from "next/server";
import { getMessages, getSession } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  if (!projectPath) return NextResponse.json({ error: "projectPath required" }, { status: 400 });
  const session = getSession(projectPath);
  if (!session) return NextResponse.json({ session: null, messages: [] });
  const messages = getMessages(session.id);
  return NextResponse.json({ session, messages });
}
