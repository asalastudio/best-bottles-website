import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());

vi.mock("mixpanel-browser", () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    track,
    people: { set: vi.fn() },
    register: vi.fn(),
    set_group: vi.fn(),
    get_group: vi.fn(() => ({ set: vi.fn() })),
    time_event: vi.fn(),
  },
}));

import { analytics } from "@/lib/analytics";

beforeEach(() => {
  track.mockClear();
});

describe("checkout analytics event semantics", () => {
  it("tracks Shopify handoff as Checkout Redirected, not Checkout Completed", () => {
    const cartProvider = readFileSync("src/components/CartProvider.tsx", "utf8");
    const analytics = readFileSync("src/lib/analytics.ts", "utf8");

    expect(cartProvider).toContain("analytics.checkoutStarted");
    expect(cartProvider).toContain("analytics.checkoutRedirected");
    expect(cartProvider).not.toContain("analytics.checkoutCompleted");

    expect(analytics).toContain('adapter.track("Checkout Redirected"');
    expect(analytics).toContain('adapter.track("Order Completed"');
    expect(analytics).not.toContain('adapter.track("Checkout Completed"');
  });
});

describe("focused shopping analytics", () => {
  it("tracks the provider-independent shopping event schema", () => {
    analytics.finderEntered({ entryMode: "application", application: "rollon", family: "Cylinder", resultCount: 4 });
    analytics.finderRefined({ entryMode: "family", dimension: "capacity", action: "selected", value: "9 ml", resultCount: 2 });
    analytics.finderZeroResultRecovered({ entryMode: "family", removedDimension: "rollerMaterial" });
    analytics.finderResultOpened({ entryMode: "application", family: "Cylinder", application: "rollon", slug: "cylinder-9ml-roll-on" });
    analytics.matrixOpened({ source: "finder", family: "Cylinder" });
    analytics.graceOpenedFromShopping({ source: "pdp", family: "Cylinder", application: "rollon" });
    analytics.pdpVariantResolved({ slug: "cylinder-9ml-roll-on", sku: "CYL9CLRROL", application: "rollon", dimension: "capFinish" });

    expect(track.mock.calls.slice(0, 6)).toEqual([
      ["Finder Entered", { entryMode: "application", application: "rollon", family: "Cylinder", resultCount: 4 }],
      ["Finder Refined", { entryMode: "family", dimension: "capacity", action: "selected", value: "9 ml", resultCount: 2 }],
      ["Finder Zero Result Recovered", { entryMode: "family", removedDimension: "rollerMaterial" }],
      ["Finder Result Opened", {
        entryMode: "application",
        family: "Cylinder",
        application: "rollon",
        slug: expect.stringMatching(/^slug_[a-f0-9]{16}$/),
      }],
      ["Matrix Opened", { source: "finder", family: "Cylinder" }],
      ["Grace Opened From Shopping", { source: "pdp", family: "Cylinder", application: "rollon" }],
    ]);
    expect(track.mock.calls[6]).toEqual(["PDP Variant Resolved", {
      slug: expect.stringMatching(/^slug_[a-f0-9]{16}$/),
      sku: expect.stringMatching(/^sku_[a-f0-9]{16}$/),
      application: "rollon",
      dimension: "capFinish",
    }]);
  });

  it("constructs allowlisted payloads and rejects customer-entered values", () => {
    analytics.finderEntered({
      entryMode: "application",
      application: "rollon",
      resultCount: 3,
      searchText: "customer@example.com",
      uploadedFile: "formula.pdf",
      conversation: "private message",
    } as never);

    analytics.finderRefined({
      entryMode: "application",
      dimension: "capacity",
      action: "selected",
      value: "customer@example.com",
      resultCount: 3,
    } as never);

    analytics.pdpVariantResolved({
      slug: "cylinder-9ml-roll-on",
      sku: "customer@example.com",
      application: "rollon",
    } as never);

    expect(track.mock.calls).toEqual([
      ["Finder Entered", { entryMode: "application", application: "rollon", resultCount: 3 }],
    ]);
  });

  it("drops obvious name-like or blob-like product identifiers while retaining legitimate design-name routes", () => {
    for (const identifier of [
      "Jane-Doe",
      "jane-doe",
      "Jane Doe",
      "jane@example.com",
      "cylinder-9ml-clear-17-415-rollon with private notes",
      "シリンダー-9ml",
    ]) {
      analytics.finderResultOpened({
        entryMode: "application",
        family: "Cylinder",
        application: "rollon",
        slug: identifier,
      } as never);
      analytics.pdpVariantResolved({
        slug: "cylinder-9ml-clear-17-415-rollon",
        sku: identifier,
        application: "rollon",
      } as never);
    }

    for (const slug of [
      "Jane-Doe-1",
      "john-smith-9ml",
      "Jane-Doe-17-415",
      "Jane-Middle-Doe-9ml",
    ]) {
      analytics.finderResultOpened({
        entryMode: "application",
        family: "Cylinder",
        application: "rollon",
        slug,
      } as never);
    }

    analytics.finderResultOpened({
      entryMode: "application",
      family: "Cylinder",
      application: "rollon",
      slug: "cylinder-9ml-clear-17-415-rollon",
    });
    analytics.finderResultOpened({
      entryMode: "application",
      family: "Cylinder",
      application: "rollon",
      slug: "eternal-flame-35ml-clear-Ground",
    });
    analytics.finderResultOpened({
      entryMode: "application",
      family: "Cylinder",
      application: "rollon",
      slug: "pear-118ml-clear-Ground-stopper",
    });
    analytics.pdpVariantResolved({
      slug: "eternal-flame-35ml-clear-Ground",
      sku: "CYL9CLRROL",
      application: "dropper",
    });

    const emitted = JSON.stringify(track.mock.calls);
    for (const identifier of [
      "Jane-Doe",
      "jane-doe",
      "Jane Doe",
      "jane@example.com",
      "private notes",
      "シリンダー-9ml",
      "Jane-Doe-1",
      "john-smith-9ml",
      "Jane-Doe-17-415",
      "Jane-Middle-Doe-9ml",
      "cylinder-9ml-clear-17-415-rollon",
      "eternal-flame-35ml-clear-Ground",
      "pear-118ml-clear-Ground-stopper",
    ]) {
      expect(emitted).not.toContain(identifier);
    }
    const finderResultEvents = track.mock.calls.filter(([event]) => event === "Finder Result Opened");
    expect(finderResultEvents).toHaveLength(3);
    for (const [, properties] of finderResultEvents) {
      expect(properties).toEqual(expect.objectContaining({
        entryMode: "application",
        family: "Cylinder",
        application: "rollon",
        slug: expect.stringMatching(/^slug_[a-f0-9]{16}$/),
      }));
    }
    const pdpEvents = track.mock.calls.filter(([event]) => event === "PDP Variant Resolved");
    expect(pdpEvents).toHaveLength(1);
    expect(pdpEvents[0][1]).toEqual(expect.objectContaining({
      application: "dropper",
      slug: finderResultEvents[1][1].slug,
      sku: expect.stringMatching(/^sku_[a-f0-9]{16}$/),
    }));
  });

  it("wires shopping events to explicit interaction boundaries without referrer reads", () => {
    const applicationFinder = readFileSync("src/app/catalog/application/[application]/ApplicationFinderClient.tsx", "utf8");
    const cylinderFinder = readFileSync("src/app/catalog/cylinder/CylinderFamilyPageClient.tsx", "utf8");
    const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
    const discovery = readFileSync("src/components/products/PdpDiscoverySections.tsx", "utf8");
    const matrix = readFileSync("src/components/matrix/MatrixClient.tsx", "utf8");

    expect(applicationFinder).toContain("analytics.finderEntered");
    expect(applicationFinder).toContain("analytics.finderRefined");
    expect(applicationFinder).toContain("analytics.finderZeroResultRecovered");
    expect(cylinderFinder).toContain("analytics.finderEntered");
    expect(cylinderFinder).toContain("analytics.finderRefined");
    expect(cylinderFinder).toContain("analytics.finderZeroResultRecovered");
    expect(pdp).toContain("analytics.pdpVariantResolved");
    expect(pdp).toContain("analytics.graceOpenedFromShopping");
    expect(discovery).toContain("from=pdp");
    expect(matrix).toContain("analytics.matrixOpened");
    expect(matrix).not.toContain("document.referrer");
  });
});
