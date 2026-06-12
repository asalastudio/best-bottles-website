import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const provider = () => readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
const config = () => JSON.parse(readFileSync("scripts/grace_agent_config.json", "utf8"));

function implementedClientTools(): Set<string> {
  const source = provider();
  const start = source.indexOf("const clientTools = useMemo(() => ({");
  const end = source.indexOf("// eslint-disable-next-line react-hooks/exhaustive-deps", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = source.slice(start, end);
  return new Set(
    [...block.matchAll(/^\s{8}([a-zA-Z][a-zA-Z0-9]*):\s*(?:async\s*)?\(/gm)].map((m) => m[1]),
  );
}

describe("Grace hardening contracts", () => {
  it("keeps ElevenLabs config tools aligned with implemented client tools", () => {
    const toolNames = config().conversation_config.agent.prompt.tools.map((t: { name: string }) => t.name);
    const implemented = implementedClientTools();

    for (const toolName of toolNames) {
      expect(implemented.has(toolName), `${toolName} is advertised to ElevenLabs but not implemented`).toBe(true);
    }
    expect(provider()).not.toContain("Shortlist sharing isn't available yet");
  });

  it("keeps Grace strictly grounded and removes stale memorized catalog facts", () => {
    const prompt = config().conversation_config.agent.prompt.prompt;
    expect(prompt).toContain("Strict catalog grounding");
    expect(prompt).toContain("Tool routing hardening");
    expect(prompt).toContain("Movement commands are mandatory tool calls");
    expect(prompt).toContain("do not omit Cobalt Blue");
    expect(prompt).toContain("Never ask whether the customer wants to open a display");
    expect(prompt).toContain("Never treat static prompt examples as inventory");
    expect(prompt).not.toContain("# Catalog facts — MEMORIZE THESE");
    expect(prompt).not.toContain("Smallest sizes per family");
    expect(prompt).not.toContain("GUARANTEED to fit");
  });

  it("does not add cart items until the customer confirms the proposal", () => {
    const source = provider();
    const proposeStart = source.indexOf("proposeCartAdd:");
    const proceedStart = source.indexOf("proceedToCheckout:", proposeStart);
    const proposeBlock = source.slice(proposeStart, proceedStart);

    expect(proposeBlock).toContain('type: "proposeCartAdd"');
    expect(proposeBlock).toContain("analytics.graceCartProposalShown");
    expect(proposeBlock).not.toContain("addToCart(");
    expect(source).toContain("analytics.graceCartProposalConfirmed");
  });

  it("preserves Shopify checkout metadata through Grace cart proposals", () => {
    const source = provider();
    const proposeStart = source.indexOf("proposeCartAdd:");
    const proceedStart = source.indexOf("proceedToCheckout:", proposeStart);
    const proposeBlock = source.slice(proposeStart, proceedStart);
    const route = readFileSync("src/app/api/elevenlabs/server-tools/route.ts", "utf8");
    const promptTools = JSON.stringify(config().conversation_config.agent.prompt.tools);

    expect(route).toContain("shopifyVariantId: p.shopifyVariantId ?? null");
    expect(route).toContain("checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId)");
    expect(proposeBlock).toContain("websiteSku: p.websiteSku ?? null");
    expect(proposeBlock).toContain("shopifyVariantId: p.shopifyVariantId ?? null");
    expect(proposeBlock).toContain("checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId)");
    expect(promptTools).toContain("shopifyVariantId");
    expect(promptTools).toContain("checkoutEligible");
  });

  it("keeps mobile Grace available on product detail pages", () => {
    const mobileTab = readFileSync("src/components/mobile/MobileTabBar.tsx", "utf8");
    expect(mobileTab).not.toContain('TABS.filter((tab) => tab.key !== "grace")');
    expect(mobileTab).toContain("Ask Grace about fit for this bottle");
    expect(mobileTab).toContain("analytics.graceMobilePdpOpened");
  });

  it("guards public Grace routes and trusted image analysis", () => {
    expect(readFileSync("src/app/api/elevenlabs/server-tools/route.ts", "utf8")).toContain("enforceGraceRateLimit");
    const upload = readFileSync("src/app/api/grace/upload/route.ts", "utf8");
    expect(upload).toContain("File exceeds 8MB limit");
    expect(upload).toContain("Upload failed. Please try again.");
    expect(upload).not.toContain("err instanceof Error ? err.message");

    const vision = readFileSync("src/app/api/grace/vision/route.ts", "utf8");
    expect(vision).toContain("Valid ownerKey required");
    expect(vision).toContain("Image URL must come from Grace upload storage");
    expect(vision).toContain("publicVisionError");
    expect(vision).toContain("vision_credentials_invalid");
    expect(vision).toContain("PUBLIC_VISION_UNAVAILABLE_MESSAGE");
    expect(vision).not.toContain("OpenAI key not configured");
  });

  it("keeps Grace image sharing wired to catalog match without leaking provider errors", () => {
    const imageUpload = readFileSync("src/lib/useGraceImageUpload.ts", "utf8");
    const composerSurfaces = [
      "src/components/grace/GraceChatDrawer.tsx",
      "src/components/grace-workspace/DockedComposer.tsx",
      "src/components/grace-workspace/GreetingState.tsx",
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(composerSurfaces).toContain('accept="image/png,image/jpeg,image/jpg,image/webp"');
    expect(composerSurfaces).toContain("Attach reference image");

    expect(imageUpload).toContain("/api/grace/upload");
    expect(imageUpload).toContain("/api/grace/vision");
    expect(imageUpload).toContain('tool_name: "searchCatalog"');
    expect(imageUpload).toContain('action: { type: "displayReferenceMatch", payload }');
    expect(imageUpload).toContain("friendlyImageError");
    expect(imageUpload).toContain("isSensitiveProviderMessage");
    expect(imageUpload).not.toContain("I couldn't analyze that image. ${e instanceof Error ? e.message");
  });

  it("returns structured no-match results so Grace cannot invent unavailable sizes", () => {
    const route = readFileSync("src/app/api/elevenlabs/server-tools/route.ts", "utf8");
    expect(route).toContain("noMatchGraceToolResult");
    expect(route).toContain("No verified exact match found");
    expect(route).toContain("Never claim an exact size");
  });

  it("keeps compatibility tools resilient when ElevenLabs passes product names", () => {
    const route = readFileSync("src/app/api/elevenlabs/server-tools/route.ts", "utf8");
    expect(route).toContain("fallbackMatches");
    expect(route).toContain("api.grace.searchCatalog");
    expect(route).toContain("resolvedBottleSku");

    const source = provider();
    expect(source).toContain("Compatibility tray is open");
    expect(source).toContain("Do not ask whether to open it");
  });

  it("keeps build kits fitment-verified and family cards broad enough for shopping", () => {
    const source = provider();
    const buildKitStart = source.indexOf("displayBuildKit:");
    const comparisonStart = source.indexOf("displayComparison:", buildKitStart);
    const buildKitBlock = source.slice(buildKitStart, comparisonStart);
    expect(buildKitBlock).toContain('"getBottleComponents"');
    expect(buildKitBlock).toContain("incompatible_component");
    expect(buildKitBlock).toContain("bottleAlreadyConfigured");
    expect(buildKitBlock).toContain("fine mist sprayer");
    expect(buildKitBlock).toContain("Fitment-verified kit workspace is open");
    expect(source).toContain("capacityMl: params.capacityMl");

    const route = readFileSync("src/app/api/elevenlabs/server-tools/route.ts", "utf8");
    expect(route).toContain("seenCapacity");
    expect(route).toContain(".slice(0, 16)");
    expect(route).toContain("applicator: d.bottle.applicator");
    expect(route).toContain("requestedCapacityMl");
    expect(route).toContain("VERIFIED_9ML_CYLINDER_ROLLON_COLORS");
    expect(route).toContain("requestedColorReps");

    const familyCard = readFileSync("src/components/grace/patterns/PatternB_FamilyCard.tsx", "utf8");
    expect(familyCard).toContain("capacityLabelCounts");
    expect(familyCard).toContain("variantColorCounts");

    const prompt = config().conversation_config.agent.prompt.prompt;
    expect(prompt).toContain("Never pass closureSku or applicatorSku unless that SKU came from getBottleComponents");
    expect(prompt).toContain("optional swaps rather than required add-ons");
  });
});
