/**
 * Unit tests exercise shared modules the way the server runs them: with the
 * full catalog hero tables registered (catalog-heroes.server.ts). The browser
 * path, where only a page's subset is registered, is covered separately in
 * tests/catalog-hero-registry-subset.test.ts with a fresh module instance.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
await import("@/lib/products/catalog-heroes.server");
