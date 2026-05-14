import { NextResponse } from "next/server";
import { getHealthReport } from "@/lib/services-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const report = await getHealthReport();
  return NextResponse.json(report);
}
