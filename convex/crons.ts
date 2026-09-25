import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Keep the Platform Health panel truthful even if a Sentry webhook is missed.
// No-op until SENTRY_API_TOKEN and SENTRY_ORG_SLUG exist in the Convex env.
crons.interval("sentry issue sync", { minutes: 15 }, internal.observability.syncFromSentry, {});

// Search-box counters are kept for 90 days (convex/catalogSearchLog.ts).
crons.daily("catalog search log retention", { hourUTC: 9, minuteUTC: 15 }, internal.catalogSearchLog.deleteExpired, {});

export default crons;
