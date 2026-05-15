import { NextRequest, NextResponse } from "next/server";
import { getProjectMessages, getSessionsForProject } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  if (!projectPath) return NextResponse.json({ error: "projectPath required" }, { status: 400 });

  // The channel timeline merges every adapter's session into a single
  // canonical thread so the UI can render one history view with per-bubble
  // agent attribution. Sessions are still per-(project, adapter) so each
  // agent keeps its own --resume token and private context server-side.
  const sessions = getSessionsForProject(projectPath);
  const messages = getProjectMessages(projectPath);
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      adapter_id: s.adapter_id,
      claude_session_id: s.claude_session_id,
      last_used_at: s.last_used_at,
    })),
    messages,
  });
}
