# Legacy scrape — what to collect

Input for extending `src/lib/seo/legacyRedirects.ts` beyond the 143 URLs the
May 2026 audit mapped, to the ~2,600 pages on bestbottles.com.

Three files. The first is the crawl; the second and third are what actually
decide where the effort goes.

---

## 1. `legacy-crawl.csv` — one row per URL

**Do not de-duplicate on path.** `?subcat=64`, `?subcat=65` and `?subcat=66` on
one legacy page lead to three different destinations on the new site. Collapsing
them sends two thirds of that traffic somewhere it did not ask for. This
already bit us once.

| Column | Required | Why it matters |
|---|---|---|
| `url` | **yes** | Full URL **including the query string**, exactly as crawled. |
| `status_code` | **yes** | Skip anything already 404/410 — no point redirecting a dead page. |
| `content_type` | **yes** | Separates pages from PDFs and images, which are mapped differently. |
| `indexability` | **yes** | `noindex` pages carry no ranking; they go to the back of the queue. |
| `canonical` | **yes** | Where the legacy page self-canonicalised. If ten URLs canonicalise to one, they all get that one's destination. |
| `title` | **yes** | The strongest signal for matching a legacy page to a new one. |
| `h1` | **yes** | Second strongest, and often more literal than the title. |
| `meta_description` | no | Helps disambiguate near-identical titles. |
| `word_count` | no | Thin pages are usually category stubs; long ones are usually worth a specific destination. |
| `inlinks` | **yes** | How many legacy pages linked to it. A page with 400 inlinks was a hub and deserves a precise target. |
| `breadcrumb` or `crawl_depth` | no | Reconstructs the old category tree, which is how we group hundreds of URLs into a handful of destinations. |

### The one extra field worth the trouble

| Column | Why |
|---|---|
| `skus_on_page` | **This is the difference between good and excellent.** A legacy page listing `GBCyl9SpryGl` can be mapped to that exact product rather than to a category. Without it, every product page becomes a category redirect and loses the specificity Google rewards. |

In Screaming Frog: **Configuration → Custom → Extraction**, add an XPath or
regex that pulls the SKU text from the product tables, and export the
**Custom Extraction** report. Pipe-separate multiple SKUs in one cell.

---

## 2. `search-console-performance.csv` — the priority list

**More useful than the crawl.** 2,600 URLs is not 2,600 problems; a few hundred
of them earn essentially all the traffic, and those are the ones that must have
precise destinations.

Google Search Console → **Performance → Search results** → date range **last 16
months** → **Pages** tab → Export.

| Column | Required |
|---|---|
| `page` | yes |
| `clicks` | yes |
| `impressions` | yes |
| `position` | no |

Mapping order comes from this file, not from the crawl. A page with 2,000
clicks and one with zero get very different amounts of care.

---

## 3. `backlinks.csv` — what the open web points at

External links are the equity a redirect is preserving. A legacy URL with
inbound links from other sites matters even if it gets little search traffic,
because those links are still passing authority.

From Ahrefs / Semrush / Moz, or GSC → **Links → Top linked pages → External
links** → Export.

| Column | Required |
|---|---|
| `target_url` | yes |
| `referring_domains` | yes |
| `backlinks` | no |

---

## Format

- UTF-8, comma-separated, quoted fields, **header row included**
- Absolute URLs with scheme and host (`https://www.bestbottles.com/...`)
- One row per URL; no aggregation, no de-duplication
- Include `http://` and `https://`, and `www` and non-`www`, if the crawl found both

## Crawl settings that matter

- **Follow `?` parameters.** Screaming Frog strips query strings by default —
  turn that off, or the `subcat` pages vanish.
- Ignore `robots.txt` so `noindex` pages still appear (marked as such); we want
  to know they exist even if they rank for nothing.
- Crawl the sitemap **and** follow internal links — the legacy sitemap is
  incomplete.

## What happens next

1. Join the three files on URL.
2. Sort by clicks, then referring domains, then inlinks.
3. Map top-down: exact product where `skus_on_page` allows, then category, then
   `/catalog`.
4. `npm run seo:verify-redirects -- --url <deployment>` — every destination must
   return 200 before cutover. This is the check the original map lacked: 47 of
   its 135 destinations pointed at pages that had never been built.
