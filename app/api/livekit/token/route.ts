import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROOM_NAME = "warroom-main";

export async function POST(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      {
        error:
          "LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in .env.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { identity?: string; name?: string };
  const identity = body.identity?.trim() || "ej";
  const name = body.name?.trim() || identity;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "6h",
  });
  at.addGrant({
    roomJoin: true,
    room: ROOM_NAME,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({
    token,
    url: livekitUrl,
    room: ROOM_NAME,
    identity,
  });
}

export async function GET() {
  const ok = !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
  return NextResponse.json({ configured: ok, room: ROOM_NAME });
}
