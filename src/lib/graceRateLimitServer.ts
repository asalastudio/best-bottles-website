import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export interface GraceRateLimitConfig {
  route: string;
  limit: number;
  windowMs: number;
}

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ownerKey = req.headers.get("x-grace-owner-key")?.trim();
  return ownerKey || forwarded || realIp || "unknown";
}

export async function enforceGraceRateLimit(
  req: NextRequest,
  config: GraceRateLimitConfig,
): Promise<NextResponse | null> {
  try {
    const result = await getConvex().mutation(api.graceRateLimits.check, {
      route: config.route,
      identifier: getClientIdentifier(req),
      limit: config.limit,
      windowMs: config.windowMs,
    });
    if (result.allowed) return null;
    return NextResponse.json(
      { error: "Too many Grace requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  } catch (err) {
    console.error("[Grace rate limit] Failed open:", err);
    return null;
  }
}
