import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Next image host configuration", () => {
  it("allows regenerated product images only from our Supabase project", () => {
    const config = readFileSync("next.config.ts", "utf8");

    expect(config).toContain('hostname: "likkskifwsrvszxdvufw.supabase.co"');
    expect(config).toContain('pathname: "/storage/v1/object/public/**"');
    // A wildcard host would let any Supabase bucket use /_next/image as a proxy.
    expect(config).not.toContain("**.supabase.co");
  });
});
