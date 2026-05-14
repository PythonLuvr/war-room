import { NextResponse } from "next/server";
import { recentActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ items: recentActivity(30) });
}
