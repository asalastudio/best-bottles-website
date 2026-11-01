import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import approval from "../docs/reviews/cylinder9-components-2026-10-31/approval.json";
import { CYLINDER9_OVERCAP_MASTER } from "@/lib/register/detached-overcaps";

it("retains Jordan's approved shared overcap without silently replacing its pixels", () => {
    expect(CYLINDER9_OVERCAP_MASTER).toBe(approval.overcap.path.replace(/^public/, ""));
    expect(createHash("sha256").update(readFileSync(approval.overcap.path)).digest("hex")).toBe(approval.overcap.sha256);
});
