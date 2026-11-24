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

  it("lets the optimizer fetch from addresses Next counts as private only on localhost", () => {
    const config = readFileSync("next.config.ts", "utf8");

    // NAT64 networks resolve the Blob host to 64:ff9b::/96; production must keep the check.
    expect(config).toContain('dangerouslyAllowLocalIP: process.env.NODE_ENV === "development"');
    expect(config).not.toMatch(/dangerouslyAllowLocalIP:\s*true/);
  });
});
