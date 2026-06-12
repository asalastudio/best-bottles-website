# P0 Dev Tickets — URGENT (block launch / fix today)

**Source:** Asala Studio SEO/GEO/AEO Audit · 2026-05-23
**Owner:** Best Bottles engineering team
**Format:** Paste-into-Linear ready. Each ticket has a title, evidence, impact, fix, and acceptance criteria.

---

## 🚨 BB-SEO-001 · Block staging site (bestbottles.company) from indexing — DO TODAY

**Priority:** P0-immediate
**Estimated effort:** 30 minutes
**Evidence:**
- Live fetch of `https://bestbottles.company/` (2026-05-23) returns `<meta name="robots" content="index, follow">` and `<link rel="canonical" href="https://bestbottles.company">`
- Legacy site `https://www.bestbottles.com/` also returns self-canonical
- Two near-duplicate sites currently competing for brand queries in Google

**Impact:**
Google is indexing both domains as the source-of-truth for the same content. The legacy site has 5+ years of accumulated equity. Every day staging stays indexable, Google's algorithm has more reason to split or migrate authority signals. Brand searches like "best bottles wholesale" will start surfacing the staging URL with thinner content, hurting CTR and revenue.

**Fix:**
Update `src/app/layout.tsx` to compute `robots` dynamically based on hostname or env:

```ts
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const isProduction =
    process.env.VERCEL_ENV === "production" &&
    host.endsWith("bestbottles.com");

  return {
    // ...existing metadata
    robots: isProduction
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    alternates: { canonical: isProduction ? "https://www.bestbottles.com" : undefined },
  };
}
```

Also add to `next.config.ts` for double protection:
```ts
async headers() {
  return [
    {
      source: "/(.*)",
      has: [{ type: "host", value: "bestbottles.company" }],
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
  ];
}
```

**Acceptance criteria:**
- [ ] `curl -I https://bestbottles.company/` returns `X-Robots-Tag: noindex, nofollow`
- [ ] `curl -s https://bestbottles.company/ | grep -i 'meta name="robots"'` returns `noindex,nofollow`
- [ ] Google Search Console "Removals" tool submitted for `bestbottles.company`
- [ ] After June 15 launch, configure Vercel to 301 redirect `bestbottles.company/*` → `https://www.bestbottles.com/$1`

---

## 🚨 BB-SEO-002 · Fix SITE_URL default to use production domain, not staging

**Priority:** P0-blocker
**Estimated effort:** 15 minutes + 30 minutes of regression testing
**Evidence:**
`src/lib/seo.ts:8-10`:
```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://bestbottles.company";
```

**Impact:**
This constant is consumed by every canonical link, every structured-data URL, the OG image absolute URL, and the `metadataBase` in `layout.tsx`. If `NEXT_PUBLIC_SITE_URL` is missing or wrong on the production deploy on June 15, every URL the search engine sees in `<link rel="canonical">`, `<meta property="og:url">`, and the JSON-LD blocks will point to `bestbottles.company` instead of `bestbottles.com`. Google's canonical signal would override `bestbottles.com` as the source-of-truth → total ranking loss within 14 days.

**Fix:**
```ts
// src/lib/seo.ts
const DEFAULT_SITE_URL = "https://www.bestbottles.com";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? DEFAULT_SITE_URL;

// Build-time guard: throw if production env var disagrees
if (
  typeof window === "undefined" &&
  process.env.VERCEL_ENV === "production" &&
  SITE_URL !== "https://www.bestbottles.com"
) {
  throw new Error(
    `Production SITE_URL mismatch: got "${SITE_URL}", expected "https://www.bestbottles.com". Set NEXT_PUBLIC_SITE_URL in Vercel production env.`
  );
}
```

Then in Vercel dashboard:
- Production env: `NEXT_PUBLIC_SITE_URL=https://www.bestbottles.com`
- Preview env: `NEXT_PUBLIC_SITE_URL=https://bestbottles.company` (or leave unset)

**Acceptance criteria:**
- [ ] `view-source:https://www.bestbottles.com/` after launch shows `<link rel="canonical" href="https://www.bestbottles.com">`
- [ ] All JSON-LD blocks reference `https://www.bestbottles.com` URLs
- [ ] OG image URL resolves to `https://www.bestbottles.com/og-default.png`
- [ ] Build fails if env var is misconfigured

---

## 🚨 BB-SEO-003 · Restore GSC + Bing verification tokens in metadata

**Priority:** P0-blocker
**Estimated effort:** 10 minutes
**Evidence:**
- `src/app/layout.tsx:84` shows `verification: {},` — empty
- Legacy site head includes:
  - `<meta name="google-site-verification" content="laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc">`
  - `<meta name="msvalidate.01" content="DD2ECFD7F20F418A4A67662DFC0D0B03">`

**Impact:**
When the new codebase replaces the legacy one on bestbottles.com, the meta verification tags disappear from the head. Google Search Console and Bing Webmaster Tools will report property verification as broken at the next crawl. If GSC de-verifies the property, we lose access to performance reports, sitemap submission, removals, and Core Web Vitals reports — exactly when we need them most (post-launch monitoring window).

**Fix:**
```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  // ...existing
  verification: {
    google: "laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc",
    other: {
      "msvalidate.01": "DD2ECFD7F20F418A4A67662DFC0D0B03",
    },
  },
};
```

Also (belt-and-suspenders): add DNS TXT records as a second verification method in GSC and Bing — survives any future codebase change.

**Acceptance criteria:**
- [ ] `view-source:https://www.bestbottles.com/` after launch shows both verification meta tags
- [ ] GSC and Bing Webmaster verification status confirms "Verified" within 24 hours of launch
- [ ] DNS TXT record method added as backup

---

## 🚨 BB-SEO-004 · Sitemap missing 2,300+ product URLs and 225 product group URLs

**Priority:** P0-blocker
**Estimated effort:** 4–6 hours
**Evidence:**
- `public/sitemap-0.xml` contains 21 URLs
- `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv` is 25MB / 2,354 SKUs / 225 product groups
- App routes `/products/[slug]` and `/collections/[slug]` exist but produce no sitemap entries
- Only one collection (`/collections/boston-round-30ml`) is in the static sitemap

**Impact:**
Google indexes what it can find. Without sitemap entries, the new PDPs are discovered only via internal linking (slow, partial, at Google's pace — months not weeks). Customers searching for "amber boston round dropper bottle" won't find Best Bottles PDPs for that SKU. Direct competitor SKS Bottle has every SKU sitemapped.

**Fix (option A — Next.js 15 native, recommended):**
Create `src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { SITE_URL } from "@/lib/seo";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productGroups, products, collections, blogPosts] = await Promise.all([
    convex.query(api.productGroups.listPublished),
    convex.query(api.products.listPublished),
    convex.query(api.collections.listPublished),
    convex.query(api.blog.listPublished), // or Sanity
  ]);

  const staticUrls = [
    "", "catalog", "about", "contact", "blog",
    "request-quote", "request-sample", "resources",
  ].map((path) => ({
    url: `${SITE_URL}/${path}`.replace(/\/$/, "") || SITE_URL,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : 0.7,
  }));

  return [
    ...staticUrls,
    ...productGroups.map((g) => ({
      url: `${SITE_URL}/products/${g.slug}`,
      lastModified: new Date(g.updatedAt ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...collections.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: new Date(c.updatedAt ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    ...blogPosts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.publishedAt ?? Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
```

This replaces the `next-sitemap` static generation for dynamic content. Keep `next-sitemap.config.js` for `/robots.txt` generation only, or replace with `src/app/robots.ts`.

**Acceptance criteria:**
- [ ] `https://www.bestbottles.com/sitemap.xml` after launch contains ≥ 2,400 URLs
- [ ] Sample 5 PDP URLs from sitemap return 200 OK and have correct canonical + Product JSON-LD
- [ ] No `/cart`, `/grace-workspace`, `/tech-stack`, `/example`, `/fitment-demo` in sitemap
- [ ] No `/portal/*`, `/studio/*`, `/sign-in`, `/sign-up`, `/api/*` in sitemap
- [ ] Sitemap submitted to GSC and Bing Webmaster within 1 hour of launch

---

## P1 tickets (target: 7 days post-launch)

These will be detailed in `01-technical-seo/p1-dev-tickets.md` (coming in Stage 1 full audit):

- BB-SEO-101 · Complete Organization JSON-LD (full address, phone, sameAs)
- BB-SEO-102 · Add LocalBusiness schema (Union City storefront)
- BB-SEO-103 · Publish `/llms.txt` for AI crawler ingestion
- BB-SEO-104 · Align contact email (sales@bestbottles.com vs sales@nematinternational.com — pick one)
- BB-SEO-105 · Add `/cart`, `/grace-workspace`, `/tech-stack` to `exclude` in `next-sitemap.config.js`
- BB-SEO-106 · Add Product JSON-LD test cases to CI (validate every PDP renders valid schema)
- BB-SEO-107 · Add CWV monitoring (Vercel Analytics + CrUX Dashboard) before launch
