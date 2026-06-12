import type { ProductCard } from "@/components/GraceContext";

export type GraceToolStatus = "ok" | "no_match" | "error";

export interface GraceToolResult {
  status: GraceToolStatus;
  message: string;
  products?: ProductCard[];
  warnings?: string[];
  suggestedQueries?: string[];
  requested?: {
    searchTerm?: string;
    familyLimit?: string;
    applicatorFilter?: string;
  };
}

export function isGraceToolResult(value: unknown): value is GraceToolResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "status" in value &&
      "message" in value,
  );
}

export function noMatchGraceToolResult(args: {
  message: string;
  requested?: GraceToolResult["requested"];
  suggestedQueries?: string[];
  warnings?: string[];
}): GraceToolResult {
  return {
    status: "no_match",
    message: args.message,
    requested: args.requested,
    suggestedQueries: args.suggestedQueries,
    warnings: args.warnings,
  };
}
