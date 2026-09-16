# 🏗 Best Bottles — Product Launch Game Plan

> **Full checklist from raw data → fully operational e-commerce product system**
> Covering: Convex (real-time data) · Shopify (commerce) · Sanity.io (content/media) · Paper Doll Architecture (images)
>
> Last Updated: February 23, 2026

---

## 📊 Current State

| Asset | Status | Details |
|-------|--------|---------|
| **Product Data (Clean JSON)** | ✅ Complete | 2,354 SKU variants across ~230 product groups |
| **Fitment Matrix** | ✅ Complete | 63 fitment rules mapping thread sizes → compatible components |
| **Convex Seeded** | ✅ Complete | All products + fitments live in Convex |
| **Homepage** | ✅ Live data | Trust bar, design families, collections — all real counts |
| **Catalog Page** | ✅ Live data | Taxonomy sidebar, search, filtering, product cards |
| **Shopify Store** | ⬜ Not started | Need to create products + variants |
| **Sanity.io CMS** | ⬜ Not started | Need schemas + content |
| **Paper Doll Images** | ⬜ Not started | Need layer system + compositing |
| **Product Detail Pages** | ⬜ Not started | Need PDP with variant selector |
| **Grace AI Integration** | 🟡 Partial | Knowledge base seeded, conversation engine WIP |

---

## 🗺 THE GAME PLAN — 7 Phases

---

### PHASE 1: Product Grouping & Data Architecture
**Goal:** Restructure 2,354 flat SKUs into ~230 parent products with child variants
**Effort:** 1–2 days | **Dependencies:** None (can start immediately)

#### Tasks:

- [ ] **1.1** Create `productGroups` table in Convex schema
  ```
  productGroups table:
    slug: "cylinder-9ml-clear"
    family: "Cylinder"
    capacity: "9 ml"
    capacityMl: 9
    color: "Clear"
    category: "Glass Bottle"
    bottleCollection: "Cylinder"
    neckThreadSize: "18-400"
    variantCount: 85
    priceRangeMin: 0.40
    priceRangeMax: 1.40
    shopifyProductId: null    ← filled in Phase 3
    sanitySlug: null          ← filled in Phase 4
    heroImageUrl: null        ← filled in Phase 5
  ```

- [ ] **1.2** Add `productGroupId` foreign key to existing `products` table
  - Each of the 2,354 variants links back to its parent group

- [ ] **1.3** Write grouping migration script
  - Groups by: `family + capacityMl + color`
  - Creates ~230 `productGroups` documents
  - Updates all `products` with their `productGroupId`

- [ ] **1.4** Add Convex queries for grouped data
  - `getProductGroup(slug)` → returns group + all variants
  - `getProductGroupsByFamily(family)` → catalog browsing
  - `getVariantsForGroup(groupId)` → variant selector data

- [ ] **1.5** Update catalog page to show product groups (not individual SKUs)
  - Catalog cards show "Cylinder 9ml Clear — from $0.40 · 85 variants"
  - Clicking opens the PDP with variant selector

#### Deliverables:
- [ ] Convex schema migration deployed
- [ ] ~230 product group documents created
- [ ] All 2,354 variants linked to their parent group
- [ ] Catalog page rendering grouped products

---

### PHASE 2: Product Detail Page (PDP) with Variant Selector
**Goal:** Build the dynamic PDP that lets customers configure their bottle
**Effort:** 2–3 days | **Dependencies:** Phase 1

#### Tasks:

- [ ] **2.1** Create `/products/[slug]/page.tsx` dynamic route
  - URL: `/products/cylinder-9ml-clear`

- [ ] **2.2** Build variant selector UI
  - **Step 1:** Choose applicator type (Metal Roller, Sprayer, Reducer, etc.)
  - **Step 2:** Choose cap/trim color (filtered by available combos)
  - **Step 3:** Price updates in real-time based on selection
  - Step progression filters available options (no dead-ends)

- [ ] **2.3** Product specifications panel
  - Capacity, dimensions, weight, thread size
  - Data pulled from Convex product record

- [ ] **2.4** Fitment compatibility section
  - "This bottle is compatible with:" → list of compatible components
  - Powered by the fitment matrix in Convex

- [ ] **2.5** Quantity pricing tiers
  - Show per-piece pricing at: 1pc, 10pc, 12pc, and case quantity
  - Price breaks are already in the data (`webPrice1pc`, `webPrice10pc`, `webPrice12pc`)

- [ ] **2.6** Paper doll image preview (placeholder first, real in Phase 5)
  - Shows assembled bottle based on selected variant
  - Initially can use a generic placeholder per family

- [ ] **2.7** "Add to Cart" button
  - Adds the specific SKU variant to cart
  - Cart stores `graceSku` + `shopifyVariantId` (once Phase 3 complete)

#### Deliverables:
- [ ] Working PDP at `/products/[slug]`
- [ ] Real-time variant selector with price updates
- [ ] Fitment compatibility display
- [ ] Add-to-cart functionality

---

### PHASE 3: Shopify Product Sync
**Goal:** Create all products + variants in Shopify, link IDs back to Convex
**Effort:** 2–3 days | **Dependencies:** Phase 1

#### What You Need to Provide:
- [ ] **Shopify store URL** (your `.myshopify.com` domain)
- [ ] **Shopify Admin API access token** (Storefront or Custom App)
  - Requires scopes: `write_products`, `read_products`, `write_inventory`, `read_inventory`
- [ ] **Shipping & tax settings** configured in Shopify admin
- [ ] **Payment processor** connected (Shopify Payments, Stripe, etc.)

#### Tasks:

- [ ] **3.1** Create Shopify Custom App for API access
  - Admin → Settings → Apps → Develop apps
  - Grant: Products, Inventory, Orders scopes

- [ ] **3.2** Write Shopify product sync script
  - For each of the ~230 product groups:
    - Create a Shopify Product (title, description, vendor, product type, tags)
    - Create Shopify Variants (one per SKU variant)
    - Map variant options: Option1=Applicator, Option2=Cap Color
    - Set prices from `webPrice1pc`
    - Set inventory quantities
    - Set SKU = `graceSku`

- [ ] **3.3** Store Shopify IDs back in Convex
  - `productGroups.shopifyProductId` = Shopify Product GID
  - `products.shopifyVariantId` = Shopify Variant GID

- [ ] **3.4** Set up Shopify Webhooks → Convex
  - `products/update` → sync price changes back to Convex
  - `inventory_levels/update` → sync stock changes to Convex
  - `orders/create` → track orders in Convex for Grace AI context

- [ ] **3.5** Build checkout flow
  - "Add to Cart" keeps the merchandising cart on the storefront
  - Use Shopify Storefront API `cartCreate` (not the deprecated `checkoutCreate`)
  - Redirect to the hosted Shopify `checkoutUrl` for payment

- [ ] **3.6** Test end-to-end purchase flow
  - Select variant → Add to cart → Checkout → Test payment → Order confirmed
  - Verify inventory decrements in both Shopify and Convex

#### Deliverables:
- [ ] ~230 Shopify Products with 2,354 Variants
- [ ] All IDs linked between Shopify ↔ Convex
- [ ] Webhook listeners for real-time sync
- [ ] Working checkout flow

---

### PHASE 4: Sanity.io Content CMS
**Goal:** Set up Sanity as the content layer for rich media, descriptions, and SEO
**Effort:** 2–3 days | **Dependencies:** Phase 1 (needs product group slugs)

#### What You Need to Provide:
- [ ] **Sanity project** → Create at [sanity.io/manage](https://sanity.io/manage)
- [ ] **Sanity API token** (for backend queries)
- [ ] **Editorial content** for each product family (long descriptions, use cases)
- [ ] **SEO metadata** (meta titles, descriptions, keywords)
- [ ] **Lifestyle photography** (if you have product photos beyond paper doll renders)

#### Tasks:

- [ ] **4.1** Initialize Sanity project in the repo
  ```
  /sanity/
    schemas/
      product.ts       ← product content document
      productFamily.ts ← family-level content (Cylinder, Diva, etc.)
      homepage.ts      ← editable homepage content blocks
      brand.ts         ← global brand assets
  ```

- [ ] **4.2** Define Sanity product schema
  ```
  Product Document:
    title: string
    slug: slug          ← matches Convex productGroup slug
    shopifyProductId: string
    family: reference → ProductFamily
    heroImage: image    ← main product photo
    gallery: image[]    ← additional lifestyle images
    longDescription: blockContent  ← rich text
    useCases: string[]  ← "Essential Oils", "Perfume", etc.
    seoTitle: string
    seoDescription: string
    seoKeywords: string[]
  ```

- [ ] **4.3** Define ProductFamily schema (family-level content)
  ```
  ProductFamily Document:
    name: "Cylinder"
    slug: "cylinder"
    tagline: "Timeless cylindrical silhouette..."
    description: blockContent
    familyImage: image
    sizeGuide: image     ← comparison chart of family sizes
    usageCategories: string[]
  ```

- [ ] **4.4** Create Sanity Studio customization
  - Custom input components for product preview
  - Shopify product preview link
  - Live Convex variant count display

- [ ] **4.5** Populate initial Sanity content
  - Create ~12 ProductFamily documents (one per bottle family)
  - Create ~230 Product documents (matched by slug)
  - Can be bulk-imported via Sanity CLI

- [ ] **4.6** Integrate Sanity into Next.js pages
  - Install `next-sanity` package
  - PDP fetches: Convex (variants/pricing) + Sanity (content/images)
  - Homepage fetches: Sanity (editorial blocks) + Convex (stats)

#### Deliverables:
- [ ] Sanity Studio accessible at `/studio`
- [ ] Product and family content schemas
- [ ] Initial content populated
- [ ] PDP rendering Sanity content alongside Convex data

---

### PHASE 5: Paper Doll Image Architecture
**Goal:** Composable bottle images — mix any base + applicator + cap to render a product photo
**Effort:** 3–5 days (photography/design-heavy) | **Dependencies:** Phase 4 (Sanity for hosting)

#### What You Need to Provide:
- [ ] **Individual component photography** (this is the biggest effort):
  - 📸 **Bottle bases** — Each family × color, shot on white, straight-on angle
    - Example: Cylinder Clear, Cylinder Frosted, Cylinder Amber... (~40-50 shots)
  - 📸 **Applicators** — Each applicator type, shot from same angle
    - Sprayer, Metal Roller, Roller, Dropper, Reducer, Lotion Pump... (~15 shots)
  - 📸 **Caps/Trim** — Each cap finish, shot to match cap angle
    - Shiny Gold, Matte Silver, Shiny Black, etc. (~20-30 shots)
  - All photos must be:
    - **Same lighting rig** (consistent shadows)
    - **Same angle** (straight-on or 30° hero angle)
    - **Transparent PNG** (cut out backgrounds)
    - **Same scale** (components align when overlaid)

#### Tasks:

- [ ] **5.1** Define paper doll layer system
  ```
  Layer Stack (bottom to top):
    1. Shadow/reflection layer (generated)
    2. Bottle base layer (family + color)
    3. Applicator layer (type — roller ball, sprayer nozzle, etc.)
    4. Cap/overcap layer (finish color + style)
    5. Highlight/glare overlay (generated — adds glass shine)
  ```

- [ ] **5.2** Create component asset naming convention
  ```
  /assets/paperdoll/
    bases/
      cylinder-9ml-clear.png
      cylinder-9ml-frosted.png
      cylinder-9ml-amber.png
      ...
    applicators/
      metal-roller-18-400.png
      sprayer-18-400.png
      lotion-pump-18-400.png
      ...
    caps/
      shiny-gold.png
      matte-silver.png
      shiny-black.png
      ...
    overlays/
      glass-highlight.png
      shadow-base.png
  ```

- [ ] **5.3** Upload assets to Sanity
  - Each component photo stored as a Sanity asset
  - Tagged with metadata (family, color, thread size, etc.)
  - Sanity's image CDN handles resizing and optimization

- [ ] **5.4** Create Sanity "Component Asset" schema
  ```
  ComponentAsset:
    type: "bottleBase" | "applicator" | "cap"
    name: string
    image: image
    family: string
    color: string
    threadSize: string
    positionX: number  ← alignment offset
    positionY: number  ← alignment offset
    scale: number      ← size relative to base
  ```

- [ ] **5.5** Build PaperDollRenderer React component
  ```tsx
  <PaperDollRenderer
    base="cylinder-9ml-clear"
    applicator="metal-roller"
    cap="shiny-gold"
    size={400}
  />
  // Composites 3 PNG layers into a single product image
  ```

- [ ] **5.6** Pre-render popular combinations
  - Generate static images for the top ~50 most popular combos
  - Use for catalog cards, OG images, email marketing
  - On-demand rendering for the long tail of variants

- [ ] **5.7** Integrate into PDP variant selector
  - When customer selects applicator + cap → image updates live
  - Smooth crossfade transition between selections

#### Deliverables:
- [ ] Complete component photo library in Sanity
- [ ] Paper doll renderer component
- [ ] Live-updating product preview on PDP
- [ ] Pre-rendered images for popular variants

---

### PHASE 6: Grace AI Product Intelligence
**Goal:** Grace AI can recommend products, answer fitment questions, and assist configuration
**Effort:** 2–3 days | **Dependencies:** Phases 1 + 2

#### Tasks:

- [ ] **6.1** Grace AI product query tools
  - "Find me a 50ml bottle for essential oils" → Search + recommend
  - "What cap colors are available for the Cylinder 9ml?" → Variant lookup
  - "Is the 18-400 sprayer compatible with the Elegant 60ml?" → Fitment query

- [ ] **6.2** Grace AI configurator assistance
  - Customer describes their use case → Grace suggests product + configuration
  - "I'm launching a perfume line, need 500 units, elegant look, gold accents"
  - → Grace recommends: Diva 46ml Clear + Antique Sprayer + Shiny Gold cap

- [ ] **6.3** Upsell and cross-sell intelligence
  - Based on fitment matrix: "This bottle also works with these applicators..."
  - Based on customer segment: "Customers who buy X also buy Y"

- [ ] **6.4** Cart-aware recommendations
  - Grace sees what's in the cart and suggests compatible add-ons
  - "You have bottles but no caps selected — would you like to add caps?"

#### Deliverables:
- [ ] Grace AI can search, recommend, and configure products
- [ ] Fitment-aware suggestions
- [ ] Cart integration for contextual upsells

---

### PHASE 7: Go-Live & Operations
**Goal:** Everything working end-to-end, deployed to production
**Effort:** 1–2 days | **Dependencies:** All phases

#### Tasks:

- [ ] **7.1** End-to-end testing
  - Browse catalog → Select product → Configure variant → Add to cart → Checkout → Order confirmed
  - Grace AI can assist at every step
  - Paper doll images render correctly for all combinations

- [ ] **7.2** Performance optimization
  - Image lazy loading and CDN caching (Sanity handles this)
  - Convex query optimization (indexes, pagination)
  - Next.js ISR for product pages

- [ ] **7.3** SEO setup
  - Sitemap generation for all product group pages
  - Structured data (JSON-LD) for products
  - Meta tags from Sanity content

- [ ] **7.4** Analytics and tracking
  - Google Analytics 4 e-commerce events
  - Facebook Pixel product view / add to cart events
  - Shopify analytics synced

- [ ] **7.5** Deploy to production
  - Vercel deployment (Next.js)
  - Convex production instance
  - Sanity production dataset
  - Shopify live store
  - Custom domain + SSL

#### Deliverables:
- [ ] Fully operational e-commerce site
- [ ] All products browsable and purchasable
- [ ] Grace AI live and context-aware
- [ ] Paper doll images rendering dynamically

---

## 📋 SUMMARY: What We Need From You

### Immediate (Phase 1-2, can start now):
| # | Item | Status |
|---|------|--------|
| 1 | ✅ Clean product data JSON | Done — 2,354 SKUs seeded |
| 2 | ✅ Fitment matrix JSON | Done — 63 rules seeded |
| 3 | Approve product grouping logic (family + capacity + color) | ⬜ Needed |

### For Shopify (Phase 3):
| # | Item | Status |
|---|------|--------|
| 4 | Shopify store URL | ⬜ Needed |
| 5 | Shopify Admin API access token | ⬜ Needed |
| 6 | Shipping rates / rules | ⬜ Needed |
| 7 | Payment processor connected | ⬜ Needed |

### For Sanity (Phase 4):
| # | Item | Status |
|---|------|--------|
| 8 | Sanity project created | ⬜ Needed |
| 9 | Product family descriptions (marketing copy) | ⬜ Needed |
| 10 | SEO metadata per product | ⬜ Needed |

### For Paper Doll Images (Phase 5, biggest effort):
| # | Item | Status |
|---|------|--------|
| 11 | Component photography — bottle bases (~50 shots) | ⬜ Needed |
| 12 | Component photography — applicators (~15 shots) | ⬜ Needed |
| 13 | Component photography — cap finishes (~30 shots) | ⬜ Needed |
| 14 | All photos: same angle, same lighting, transparent PNG | ⬜ Needed |

### For Go-Live (Phase 7):
| # | Item | Status |
|---|------|--------|
| 15 | Custom domain + DNS access | ⬜ Needed |
| 16 | Google Analytics / Tag Manager account | ⬜ Needed |
| 17 | Social media pixels (Facebook, etc.) | ⬜ Needed |

---

## ⏱ Estimated Timeline

| Phase | Duration | Can Start |
|-------|----------|-----------|
| Phase 1: Product Grouping | 1–2 days | **Now** |
| Phase 2: Product Detail Page | 2–3 days | After Phase 1 |
| Phase 3: Shopify Sync | 2–3 days | After Phase 1 + Shopify credentials |
| Phase 4: Sanity CMS | 2–3 days | After Phase 1 + Sanity project |
| Phase 5: Paper Doll Images | 3–5 days | After Phase 4 + photos received |
| Phase 6: Grace AI Product Intel | 2–3 days | After Phase 2 |
| Phase 7: Go-Live | 1–2 days | After all phases |
| **Total** | **~3–4 weeks** | Phases 1-3 can run in parallel |

> **Note:** Phases 2, 3, and 4 can run in parallel once Phase 1 is complete.
> The critical path is: Phase 1 → Phase 5 (paper doll photos are the longest lead time).
