import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

function implementedClientTools(): Set<string> {
  const source = read("src/components/grace/GraceProvider.tsx");
  const start = source.indexOf("const clientTools = useMemo(() => ({");
  const end = source.indexOf("// ── End provider-neutral client tools", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = source.slice(start, end);
  return new Set(
    [...block.matchAll(/^\s{8}([a-zA-Z][a-zA-Z0-9]*):\s*(?:async\s*)?\(/gm)].map((m) => m[1]),
  );
}

describe("Grace 100-point hardening contracts", () => {
  it("implements every client tool the provider advertises and drops stale copy", () => {
    const implemented = implementedClientTools();
    expect(implemented.size).toBeGreaterThan(10);
    expect(read("src/components/grace/GraceProvider.tsx")).not.toContain("Shortlist sharing isn't available yet");
  });

  it("provides a client implementation for every declared OpenAI tool spec", async () => {
    // The Realtime adapter throws at mount for any spec without an
    // implementation ("Missing Grace tool implementation: X") — this contract
    // catches that at CI time instead of as a storefront runtime crash.
    const { GRACE_OPENAI_TOOL_SPECS } = await import("../src/lib/knowledge/toolSchemas");
    const implemented = implementedClientTools();
    for (const spec of GRACE_OPENAI_TOOL_SPECS) {
      expect(implemented.has(spec.name), `spec "${spec.name}" has no client implementation in GraceProvider`).toBe(true);
    }
  });

  it("preserves Shopify checkout metadata through Grace cart proposals", () => {
    const source = read("src/components/grace/GraceProvider.tsx");
    const proposeStart = source.indexOf("proposeCartAdd:");
    const navigateStart = source.indexOf("navigateToPage:", proposeStart);
    const proposeBlock = source.slice(proposeStart, navigateStart);
    const route = read("src/lib/grace/toolGatewayServer.ts");
    const specTools = read("src/lib/knowledge/toolSchemas.ts");

    expect(route).toContain("shopifyVariantId: p.shopifyVariantId ?? null");
    expect(route).toContain("checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId)");
    expect(proposeBlock).toContain("websiteSku: p.websiteSku ?? null");
    expect(proposeBlock).toContain("shopifyVariantId: p.shopifyVariantId ?? null");
    expect(proposeBlock).toContain("checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId)");
    expect(specTools).toContain("shopifyVariantId");
    expect(specTools).toContain("checkoutEligible");
  });

  it("keeps mobile Grace available on product detail pages", () => {
    const mobileTab = read("src/components/mobile/MobileTabBar.tsx");
    expect(mobileTab).not.toContain('TABS.filter((tab) => tab.key !== "grace")');
    expect(mobileTab).toContain("Ask Grace about fit for this bottle");
    expect(mobileTab).toContain("analytics.graceMobilePdpOpened");
  });

  it("guards public Grace routes and trusted image analysis", () => {
    expect(read("src/app/api/grace/tools/route.ts")).toContain("enforceGraceRateLimit");
    const upload = read("src/app/api/grace/upload/route.ts");
    expect(upload).toContain("File exceeds 8MB limit");
    expect(upload).toContain("Upload failed. Please try again.");
    expect(upload).not.toContain("err instanceof Error ? err.message");

    const vision = read("src/app/api/grace/vision/route.ts");
    expect(vision).toContain("Valid ownerKey required");
    expect(vision).toContain("Image URL must come from Grace upload storage");
    expect(vision).toContain("publicVisionError");
    expect(vision).toContain("vision_credentials_invalid");
    expect(vision).toContain("PUBLIC_VISION_UNAVAILABLE_MESSAGE");
    expect(vision).not.toContain("OpenAI key not configured");
  });

  it("keeps Grace image sharing wired to catalog match without leaking provider errors", () => {
    const imageUpload = read("src/lib/useGraceImageUpload.ts");
    const composerSurfaces = [
      "src/components/grace/GraceChatDrawer.tsx",
      "src/components/grace-workspace/DockedComposer.tsx",
      "src/components/grace-workspace/GreetingState.tsx",
    ].map((file) => read(file)).join("\n");
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
    const route = read("src/lib/grace/toolGatewayServer.ts");
    expect(route).toContain("noMatchGraceToolResult");
    expect(route).toContain("No verified exact match found");
    expect(route).toContain("Never claim an exact size");
  });

  it("keeps compatibility tools resilient when ElevenLabs passes product names", () => {
    const route = read("src/lib/grace/toolGatewayServer.ts");
    expect(route).toContain("fallbackMatches");
    expect(route).toContain("api.grace.searchCatalog");
    expect(route).toContain("resolvedBottleSku");

    const source = read("src/components/grace/GraceProvider.tsx");
    expect(source).toContain("Compatibility tray is open");
    expect(source).toContain("Do not ask whether to open it");
  });

  it("keeps build kits fitment-verified and family cards broad enough for shopping", () => {
    const source = read("src/components/grace/GraceProvider.tsx");
    const buildKitStart = source.indexOf("displayBuildKit:");
    const comparisonStart = source.indexOf("displayComparison:", buildKitStart);
    const buildKitBlock = source.slice(buildKitStart, comparisonStart);
    expect(buildKitBlock).toContain('"getBottleComponents"');
    expect(buildKitBlock).toContain("incompatible_component");
    expect(buildKitBlock).toContain("bottleAlreadyConfigured");
    expect(buildKitBlock).toContain("fine mist sprayer");
    expect(buildKitBlock).toContain("Fitment-verified kit workspace is open");
    expect(source).toContain("capacityMl: params.capacityMl");

    const route = read("src/lib/grace/toolGatewayServer.ts");
    expect(route).toContain("seenCapacity");
    expect(route).toContain(".slice(0, 16)");
    expect(route).toContain("applicator: d.bottle.applicator");
    expect(route).toContain("requestedCapacityMl");
    expect(route).toContain("VERIFIED_9ML_CYLINDER_ROLLON_COLORS");
    expect(route).toContain("requestedColorReps");

    const familyCard = read("src/components/grace/patterns/PatternB_FamilyCard.tsx");
    expect(familyCard).toContain("capacityLabelCounts");
    expect(familyCard).toContain("variantColorCounts");

    const specTools = read("src/lib/knowledge/toolSchemas.ts");
    expect(specTools).toContain("closureSku");
    expect(specTools).toContain("getBottleComponents");
  });

  it("renders every Grace tool action emitted in a single assistant turn and tracks it", () => {
    const context = read("src/components/GraceContext.ts");
    const provider = read("src/components/grace/GraceProvider.tsx");
    const message = read("src/components/grace/GraceChatMessage.tsx");
    const drawer = read("src/components/grace/GraceChatDrawer.tsx");
    const analytics = read("src/lib/analytics.ts");

    expect(context).toContain("actions?: GraceAction[]");
    expect(provider).toContain("const actions = pendingActionsRef.current.splice(0)");
    expect(provider).toContain("mergeGraceActions");
    expect(message).toContain("const actions = message.actions");
    expect(message).toContain("actions.map");
    expect(message).toContain("analytics.graceMultiActionRendered");
    expect(drawer).toContain("const showEmptyState = messages.length === 0");
    expect(analytics).toContain("graceMultiActionRendered");
    expect(analytics).toContain('"Grace Multi-Action Rendered"');
  });

  it("does not leave Grace looking down after microphone permission is denied", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");

    expect(provider).toContain("const publicErrorMessage");
    expect(provider).toContain("Microphone access is blocked");
    expect(provider).toContain("if (useTextOnly)");
    expect(provider).toContain('setErrorMessage("")');
    expect(provider).toContain("setVoiceFailed(false)");
  });

  it("keeps Grace cart adds confirmation-first even when bundled with other actions", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");
    const renderer = read("src/components/grace/GraceActionRenderer.tsx");

    const proposeStart = provider.indexOf("proposeCartAdd:");
    const navigateStart = provider.indexOf("navigateToPage:", proposeStart);
    const proposeBlock = provider.slice(proposeStart, navigateStart);

    expect(proposeBlock).toContain('type: "proposeCartAdd"');
    expect(proposeBlock).toContain("analytics.graceCartProposalShown");
    expect(proposeBlock).toContain("Math.max(1, Math.floor(Number(p.quantity) || 1))");
    expect(proposeBlock).not.toContain("addToCart(");
    expect(provider).toContain("analytics.graceCartProposalConfirmed");
    expect(provider).toContain("pendingCartProposals");
    expect(provider).toContain("updateCartProposalAction");
    // Confirm adds every pending proposal (never marks skipped products as
    // added); dismiss only drops proposals still awaiting confirmation.
    expect(provider).toContain("proposals.flatMap((proposal) => proposal.products)");
    expect(provider).toContain("action.awaitingConfirmation ? null : action");
    expect(renderer).toContain("Review before adding");
    expect(renderer).toContain("onConfirmAction");
  });

  it("keeps checkout and form tools proposal-only until the customer confirms in visible UI", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");
    const schemas = read("src/lib/knowledge/toolSchemas.ts");

    const checkoutStart = provider.indexOf("proceedToCheckout:");
    const navigateStart = provider.indexOf("navigateToPage:", checkoutStart);
    const checkoutBlock = provider.slice(checkoutStart, navigateStart);
    const formStart = provider.indexOf("submitForm:");
    const nextToolStart = provider.indexOf("displayProductCard:", formStart);
    const formBlock = provider.slice(formStart, nextToolStart);

    expect(checkoutBlock).toContain('new Event("open-cart-drawer")');
    expect(checkoutBlock).toContain("customer must confirm checkout");
    expect(checkoutBlock).not.toContain("checkoutRef.current");
    expect(formBlock).toContain("routerRef.current.push");
    expect(formBlock).toContain('sessionStorage.setItem("bb-grace-form-draft"');
    expect(formBlock).toContain('newsletter: { path: "/contact", formType: "contact" }');
    expect(formBlock).toContain("customer must review and submit");
    expect(formBlock).not.toContain("submitFormRef.current");
    expect(formBlock).not.toContain("new URLSearchParams");
    expect(schemas).toContain("never place an order directly");
    expect(schemas).toContain("never submit the form directly");
  });

  it("guards the voice-search transcribe route from anonymous cost abuse via the shared Convex limiter", () => {
    const transcribe = read("src/app/api/voice/transcribe/route.ts");

    expect(transcribe).toContain("enforceGraceRateLimit");
    expect(transcribe).toContain('route: "voice-transcribe"');
    expect(transcribe).toContain("api.openai.com/v1/audio/transcriptions");
    expect(transcribe).not.toContain("elevenlabs");
  });

  it("runs Grace exclusively on OpenAI Realtime — no ElevenLabs pathway remains", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");
    expect(provider).toContain("createGraceOpenAIRealtimeAdapter");
    expect(provider).toContain('"/api/openai/realtime-token"');
    expect(provider).toContain('"/api/grace/chat"');
    expect(provider).not.toContain("@elevenlabs/react");
    expect(provider).not.toContain("useConversation");
    expect(provider).not.toContain('"/api/elevenlabs/signed-url"');
  });

  it("closes the previous Realtime adapter when Clerk identity changes", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");
    expect(provider).toContain("if (!openAIAdapter.hasSession()) return;");
    expect(provider).toContain("openAIAdapter.disconnect();");
    expect(provider).toContain("}, [openAIAdapter]);");
    expect(provider).toContain("intentionalEndRef.current = true;");
  });

  it("caches family-card tool responses without poisoning the cache with degraded reads", () => {
    const route = read("src/lib/grace/toolGatewayServer.ts");

    expect(route).toContain("FAMILY_CARD_CACHE_TTL_MS");
    expect(route).toContain("familyCardCache");
    expect(route).toContain(".slice(0, 16)");
    expect(route).toContain("cachedAt");
    // Degraded results (failed enrichment / empty reads) must not be cached,
    // and the curated requested-capacity ordering must not be re-sorted away.
    expect(route).toContain("enrichmentFailed");
    expect(route).toContain("if (variants.length && !enrichmentFailed)");
    expect(route).not.toContain("compactFamilyCardVariants");
  });

  it("provides a real browser E2E regression for PDP fitment plus starter kit", () => {
    const script = read("scripts/grace-pdp-orchestration-e2e.mjs");
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts["test:grace:e2e"]).toBe("node scripts/grace-pdp-orchestration-e2e.mjs");
    expect(script).toContain("puppeteer-core");
    expect(script).toContain("@sparticuz/chromium");
    expect(script).toContain("__GRACE_TEST_APPEND_MESSAGE__");
    expect(script).toContain("displayCompatibility");
    expect(script).toContain("displayBuildKit");
    expect(script).toContain("Build-a-kit");
    expect(script).toContain("pairs with");
  });

  it("normalizes Grace direct size navigation so stale filters do not trap shoppers", () => {
    const provider = read("src/components/grace/GraceProvider.tsx");
    const shapeIntent = read("src/lib/graceShapeIntent.ts");
    const catalogFilters = read("src/lib/catalogFilters.ts");

    expect(provider).toContain("normalizeGraceCatalogNavigationPath");
    expect(provider).toContain("graceCapacityOnlySearchTerm");
    expect(shapeIntent).toContain("normalizeGraceCatalogNavigationPath");
    // Facet keys come from the canonical catalog list so they can't drift
    // from the params the catalog actually reads (threads, not neckThreadSizes).
    expect(shapeIntent).toContain("CATALOG_FACET_PARAM_KEYS");
    expect(catalogFilters).toContain("CATALOG_FACET_PARAM_KEYS");
    expect(catalogFilters).toContain('"threads"');
  });
});
