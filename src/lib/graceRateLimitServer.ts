import { NextRequest, NextResponse } from "next/server";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { isValidGraceOwnerKey } from "@/lib/graceOwnerKeyFormat";
import { reportError } from "@/lib/observability/report";

export interface GraceRateLimitConfig {
  route: string;
  limit: number;
  windowMs: number;
  /**
   * When the caller identifies itself with a valid owner key, the limit applies
   * per owner so an office behind one IP does not share one bucket. The IP
   * still gets a ceiling of `limit × ipCeilingMultiplier` so rotating owner
   * keys cannot buy unlimited requests. Default 5.
   */
  ipCeilingMultiplier?: number;
}

export const GRACE_RATE_LIMIT_IP_CEILING_MULTIPLIER = 5;

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    _convex = createResilientConvexHttpClient(url);
  }
  return _convex;
}

export interface GraceRateLimitIdentifiers {
  /** A well-formed `x-grace-owner-key` (anon-… or a UUID); anything else is ignored. */
  owner: string | null;
  /** First hop of x-forwarded-for, else x-real-ip, else "unknown". */
  ip: string;
}

/**
 * Who a request counts against. Until 2026-09-26 any string in the owner
 * header became its own bucket, so junk values escaped the limit entirely.
 */
export function resolveGraceRateLimitIdentifiers(req: NextRequest): GraceRateLimitIdentifiers {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ownerHeader = req.headers.get("x-grace-owner-key")?.trim() ?? "";
  return {
    owner: isValidGraceOwnerKey(ownerHeader) ? ownerHeader : null,
    ip: forwarded || realIp || "unknown",
  };
}

type RateLimitCheck = { allowed: boolean; resetAt: number };

export async function enforceGraceRateLimit(
  req: NextRequest,
  config: GraceRateLimitConfig,
): Promise<NextResponse | null> {
  try {
    const { owner, ip } = resolveGraceRateLimitIdentifiers(req);
    const convex = getConvex();
    const checks: Promise<RateLimitCheck>[] = owner
      ? [
        convex.mutation(api.graceRateLimits.check, {
          route: config.route,
          identifier: owner,
          limit: config.limit,
          windowMs: config.windowMs,
        }),
        convex.mutation(api.graceRateLimits.check, {
          route: `${config.route}:ip`,
          identifier: ip,
          limit: config.limit * (config.ipCeilingMultiplier ?? GRACE_RATE_LIMIT_IP_CEILING_MULTIPLIER),
          windowMs: config.windowMs,
        }),
      ]
      : [
        convex.mutation(api.graceRateLimits.check, {
          route: config.route,
          identifier: ip,
          limit: config.limit,
          windowMs: config.windowMs,
        }),
      ];
    const results = await Promise.all(checks);
    const blocked = results.find((result) => !result.allowed);
    if (!blocked) return null;
    return NextResponse.json(
      { error: "Too many Grace requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  } catch (err) {
    // Fail open on purpose (a Convex blip must not take Grace down) — but a
    // silent fail-open means no rate limiting at all, so make it visible.
    reportError(err, { area: "grace-rate-limit", level: "warning", tags: { route: config.route, failOpen: true } });
    return null;
  }
}
