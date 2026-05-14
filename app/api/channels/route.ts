import { NextRequest, NextResponse } from "next/server";
import { getChannelTree } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const serverId = Number(req.nextUrl.searchParams.get("serverId") ?? 1);
  const tree = await getChannelTree(serverId);
  return NextResponse.json(tree);
}
