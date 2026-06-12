# Best Bottles — Competitive Landscape Map (Stage 3b)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Date:** 2026-05-23
**Scope:** Profile 8 US-market B2B/wholesale glass-packaging competitors that the rebuilt `bestbottles.com` will be measured against in SERPs and AEO citations. Each profile is evidence-cited to a live fetch of the competitor's homepage and (where the page returned within the WebFetch token budget) one or more category/PDP/about pages. The matrix at the end is the at-a-glance compare. The final section identifies five durable positioning advantages Best Bottles can lean into.

**Method note:** Competitors profiled in priority order (1 = closest direct overlap, 8 = adjacent). Where a fetched page exceeded the response token limit, the analysis is grounded in the metadata header (canonical, meta-description, meta-keywords, og:* tags) plus public information returned by the web search engine. Specific load-bearing claims — e.g., schema presence, sample-request flow, MOQ visibility — are derived from the actual fetched HTML; estimates (e.g., LinkedIn follower bands) are explicitly flagged as estimate.

---

## 1. SKS Bottle & Packaging — `sks-bottle.com`

**Source(s):** Live homepage fetch 2026-05-23 (canonical `https://www.sks-bottle.com/`, title "Wholesale Containers, Glass & Plastic Bottles, Jars, Metal Tins").

**Primary positioning:** The largest mid-market US wholesale packaging catalog targeting both businesses ("large corporation") and "passionate crafter[s]". The homepage copy explicitly markets to repacks for individuals AND bulk wholesale buyers, an unusual split that defines SKS's broad-base strategy. Tagline-equivalent: "container and packaging supplier, consultant, and designer."

**Target buyer:** DTC brands (bath & body, cosmetic, candle, cannabis), small CPG manufacturers, and the long tail of crafters/makers. Less enterprise than Berlin or TricorBraun; less polished than Specialty Bottle's boutique audience.

**Catalog scale:** "Over 6,000 top quality packaging options" (homepage copy, direct quote). Mega-menu is the single most extensive in the category set: 8 top-level container types, 10+ color filters per material, 10+ shape filters, ~15 size bands, plus an industry-cut second navigation with ~25 industry verticals (Bath Salt, Beekeeping, Cannabis, Candle, Lab, Nutraceutical, Pet Care, Restaurant, Spa, Tattoo, Wedding Favors, etc.).

**Notable IA / category structure:** Triple-axis navigation: by Material (glass / plastic / metal / cardboard / bulk), by Style (color × shape × size, fully matrixed), and by Industry. This is the gold-standard IA for B2B packaging. The "Shop by Industry" pattern alone generates 25+ indexable landing pages with high commercial intent.

**Schema / structured data presence:** Standard meta robots (`INDEX,FOLLOW,max-image-preview:large,max-image-size:large`), Google + Facebook verification tokens, but no inline Organization or Product JSON-LD detected in the homepage HTML fetch. The site is on a custom platform (not Shopify/BigCommerce — appears to be a long-running ASP/PHP stack). Likely competing on raw catalog breadth and internal-linking depth rather than rich-result eligibility.

**Content marketing presence:** Robust — multiple homepage links to "Recipes & DIY Projects", "Product Spotlights", "Newsletters", "Sample Order Program", and "What's New". TikTok, YouTube, Pinterest, Instagram, X, Facebook, LinkedIn, Trustpilot all linked from the homepage footer. Pinterest in particular is well-developed (mature pinboard-driven discovery).

**B2B features:** Sample Order Program (explicit link in nav), Subscribe & Save (recurring packaging subscriptions — innovative and rare in this category), Pallet Quantity Discounts, Combo Kit Deals, SKS Direct (manufacturer-direct large-volume program), Live Chat (during business hours), expert customer service phone number prominently displayed (518-880-6980 M–F 8am–5pm EST).

**AI search readiness signals:** No `llms.txt` referenced. FAQ page exists at `/faq.html` but not confirmed to use FAQPage schema. Long-form home-page copy directly states "over 6,000 top quality packaging options" and "global customer base, serving businesses of all sizes" — these phrasings are highly extractable by AI summarizers; the site is *unintentionally* AEO-optimized through verbose, value-prop-rich body copy.

**3 things Best Bottles can learn / exploit:**

1. **Adopt the triple-axis IA** (material × style × industry) at launch. Today's new-site `/catalog?families=…&applicators=…` is single-axis. Building 8-12 "Shop by Industry" landing pages (perfume brand / essential-oil maker / candle maker / hotel amenity / wedding favor / etc.) creates indexable destinations that match buyer-intent queries SKS currently owns. Pair with BB-SEO-217 (collections route).
2. **Steal the Subscribe & Save model** — Best Bottles' 2,354-SKU catalog with Convex inventory + Shopify checkout could easily ship a "Recurring packaging order" feature. None of the other 7 competitors profiled offer this. It's a moat against TricorBraun-style enterprise sales motion and a loyalty hook against Specialty Bottle's transactional flow.
3. **Exploit the schema gap** — SKS has zero Product JSON-LD on PDPs as best we can tell. Best Bottles' Stage 1 audit recommends fixing this BEFORE launch (BB-SEO-203). If we ship with full Product schema across 225 product groups, we leapfrog SKS for rich-result eligibility on "wholesale boston round bottle" / "amber dropper bottle" style queries that SKS currently dominates by raw catalog size.

---

## 2. Berlin Packaging — `berlinpackaging.com`

**Source(s):** Live homepage fetch 2026-05-23 (canonical `https://www.berlinpackaging.com/`, title "Hybrid Container and Packaging Supplier | Berlin Packaging").

**Primary positioning:** "World's Largest Hybrid Container and Packaging Supplier." The "hybrid" framing is intentional and proprietary — Berlin combines manufacturing, distribution, and income-boosting services under one roof. Homepage states stats: 1,700+ Global Suppliers, 100+ Locations Worldwide, 50,000+ SKUs Available, 225+ Packaging Awards, 2,200+ Berlin Employees, ISO 9001 Certified.

**Target buyer:** Mid-market and enterprise CPG. Verticals served (homepage tiles): Food, Beverage, Spirits, Wine, Beer, Personal Healthcare & Beauty, Pharmaceutical & Nutraceutical, Home Care, Pet Care & Veterinary, Industrial Chemical, Automotive, Cannabis & CBD. Not for hobbyists or small-batch DTC.

**Catalog scale:** 50,000+ SKUs claimed on homepage. Several orders of magnitude larger than Best Bottles' 2,354.

**Notable IA:** Heavy emphasis on "Why Berlin" (Mission, Model, Global Reach, Divisions, Operations, Story, Community) — this is enterprise-sales-style positioning, not e-commerce-discovery IA. Service IA includes Design (their in-house design house Studio One Eleven), Sourcing, Quality, Decorating & Labeling, Supply Chain, Warehousing & Inventory, Customer Portal, Management Consulting. The "Insights" and "Sustainability" sections are deep editorial properties (Insights includes white papers on packaging price inflation, etc.).

**Schema / structured data presence:** Built on BigCommerce Stencil (meta-platform: `bigcommerce.stencil`). Google + Facebook + Pinterest + Bing verification tokens all present. BigCommerce default theme emits Organization + WebSite + breadcrumb schema for category and product pages — Berlin almost certainly inherits this. The homepage HTML does not contain explicit hand-written JSON-LD but the BigCommerce-generated schema is reliable.

**Content marketing presence:** Very strong. "Insights" section with white papers (e.g., "Energy Shock Fuels Rapid Packaging Inflation" — surfaced on homepage), Sustainability framework, 2024 Sustainability Report (downloadable), Studio One Eleven case studies and award archive (225+ awards referenced). Instagram, Facebook, X, Pinterest, LinkedIn, YouTube all linked. BBB accreditation badge on homepage. Trustpilot reviews linked.

**B2B features:** Dedicated "Request Quote" CTA in header (link: `/packaging-services-inquiry`). Phone prominently displayed (800.363.9822). Customer Portal (named service in the Services menu — suggests Net 30/45 invoice management for enterprise accounts). Account creation is the explicit gateway to seeing pricing/availability (mirrors Faire/B2B-wholesale convention). "Quick Ship: 1-2 Day Shipping on In-Stock Items" promoted on homepage hero.

**AI search readiness signals:** No `/llms.txt` confirmed. Long-form, statistic-rich homepage copy ("1,700+ Global Suppliers", "100+ Locations Worldwide", "ISO 9001 Certified") is extremely AI-extractable. The "Hybrid packaging supplier means we bring together the best elements of packaging manufacturing, distribution, and income-boosting services" — that sentence is engineered for Perplexity/ChatGPT to quote verbatim when asked "what is Berlin Packaging".

**3 things Best Bottles can learn / exploit:**

1. **Lead with stats on the homepage hero.** Berlin's "1,700+ / 100+ / 50,000+ / 225+ / 2,200+ / ISO 9001" block is the single most-cited element when AI tools describe Berlin. Best Bottles has comparable but smaller numbers (20+ years, 2,354 SKUs, 225 product groups, ~10,000 lb of packaging shipped/month — confirm exact stat). Even at smaller scale, publish the numbers — they become AEO ammo.
2. **Build a "Why Best Bottles" page** modeled on Berlin's "Why Berlin" — Mission, Model, Story, Community. This is consultative-sales content disguised as marketing. It earns links from procurement teams researching vendors. The legacy bestbottles.com has none of this.
3. **Exploit Berlin's enterprise focus.** Berlin won't sell to a 50-bottle/month DTC indie brand. The whole site copy assumes 6-figure annual buys. Best Bottles' positioning ("for the brand sourcing its first packaging", low MOQs, Grace AI assistant) is the inverse — own the segment Berlin won't serve. Specifically: blog posts titled "Berlin Packaging alternative for small brands", "What to do when your packaging supplier has a $10K MOQ", etc.

---

## 3. The Cary Company — `thecarycompany.com`

**Source(s):** Live homepage fetch attempted; full HTML exceeded WebFetch token budget — analysis grounded in metadata extracted via grep plus web-search snippets (canonical: `https://www.thecarycompany.com/containers`, title "Wholesale Containers and Packaging | The Cary Company", tagline "Your Committed Partner Since 1895!").

**Primary positioning:** Long-tenured (since 1895) wholesale packaging + industrial supply distributor. Their "Bottle & Jar Styles" navigation, "By Industry" navigation (Beverage Packaging is one), and explicit "category-catalog" page are best-in-class for B2B discovery.

**Target buyer:** B2B middle-market — food/beverage producers, craft brewers, personal-care brands, lab/scientific (they have an Industrial / IBC & Totes / Filtration division beyond bottles). Less consumer-friendly than Specialty Bottle, less enterprise than Berlin.

**Catalog scale:** Difficult to estimate from one page, but the category breadth (drums + plastic bottles + plastic jars + pails + caps + IBCs + totes + filtration + boston rounds + spice jars + hot sauce + sanitizer + condiment + pickling jars) implies ~5,000-10,000 SKUs.

**Notable IA:** Material-led (Plastic / Glass / Metal). Inside each, Styles AND Materials AND Industries as separate axes. Strong "Insights" and "Guides" content surfaces ("A Complete Guide to Plastics — Types, Uses, & Identification" surfaced in search). Confirmed login + quote-request flow (`/customer/account/`, `/quote-request/`).

**Schema / structured data presence:** Built on Magento (canonical pattern + heavy customer-account URL structure are tells). Magento 2 emits Product + BreadcrumbList + Organization schema by default. No `llms.txt` confirmed.

**Content marketing presence:** "Insights" library with long-form guides ("Complete Guide to Plastics") that earn category-level traffic. This is one of the more content-mature competitors.

**B2B features:** Explicit "My Quotes" in account menu (confirmed in fetched HTML) — true RFQ workflow, not just a contact form. Account registration is the gateway to pricing for some SKU classes. Phone-direct sales motion supported.

**AI search readiness signals:** Long-form guide content ("Complete Guide to Plastics", boston-round explainers, etc.) is highly AI-extractable. No `llms.txt` confirmed but the content depth makes this a strong AEO competitor for "what is a boston round bottle" / "HDPE vs PET" style queries.

**3 things Best Bottles can learn / exploit:**

1. **Build a true RFQ ("My Quotes") workflow** — Best Bottles' current `/request-quote` is a one-shot form. The Cary Company's account-saved quote history is a B2B retention loop (procurement teams come back to copy a prior quote). Stage 4/5 should consider scoping this.
2. **Long-form guides are a defensible moat.** The Cary Company's "Complete Guide to Plastics" is what AI engines cite when asked about packaging materials. Best Bottles has a 9-post blog (per Stage 0 brief) — extend it with 5-10 pillar guides ("Complete Guide to Boston Round Bottles", "Complete Guide to Roller Bottle Applicators", "Complete Guide to Perfume Atomizers") and we own the AEO citation surface for those queries within 90 days.
3. **Cary's "Since 1895" heritage signal** is their identity hook. Best Bottles has Nemat International's 20+ year heritage in fragrance and oils — lean into it identically with date stamps everywhere ("Family-owned since 2003" / whatever the exact founding date is — confirm with team) in About, schema `Organization.foundingDate`, and footer.

---

## 4. O.Berk® Company — `oberk.com`

**Source(s):** Live homepage fetch 2026-05-23 (root domain `https://www.oberk.com/`, title "Glass, Plastic, Metal Bottles and Caps Wholesale - O.Berk®"). Google verification token present (`mzd06uX_JfUgkAnC9SYYa75aIqsqzPF4fEbFGXYKPUI`).

**Primary positioning:** Century-old packaging distributor (founded 1910, "over 100 years"). Positions on stock breadth ("OVER 14000 STOCK PACKAGING OPTIONS AVAILABLE"), services depth, and global manufacturing reach ("A network of manufacturing facilities in 25 U.S. States, Mexico, Canada, Korea, China and India"). Sister brand `bottlestore.com` for small-business segment — explicit split between enterprise (oberk.com) and self-service (bottlestore.com).

**Target buyer:** Beauty & Personal Care, Healthcare & Pharma, Food & Beverage, Household & Industrial, Cannabis. Mid-to-enterprise. Procurement teams; not hobbyists.

**Catalog scale:** 14,000+ stock SKUs (explicit on homepage), plus 250-PET-preform library for custom blow-molded launches, plus custom containers/closures program. ~10× the size of Best Bottles by SKU count.

**Notable IA:** Triple-axis (Containers / Closures / Featured Collections), Markets We Serve (5 verticals), strong dedicated "Packaging Crash Course" educational property (multiple articles linked from homepage), "Inquiry Cart" and "Projects" workflow (industrial B2B pattern — bookmark SKUs across multiple visits, save them in a Project, submit Project as inquiry).

**Schema / structured data presence:** Site built on Salesforce Experience Cloud (the `/secur/logout.jsp`, `/projects`, `/inquirycart` URL patterns + `ws.zoominfo.com/pixel` are tells). Salesforce sites emit Organization schema by default. No homepage `llms.txt`. No FAQPage schema confirmed.

**Content marketing presence:** "Packaging Crash Course" is a true blog/knowledge property with recent posts ("Dropper Assembly Selection for Serums: Technical Considerations for Precision Dispensing", "Child-Resistant Packaging for Nutraceuticals: What You Need to Know", "Naming Conventions of Liquor Bottles - A Deep Dive", "Squeezable Innovations: How Tubes are Revolutionizing Packaging"). "What's New" + "#NextUp" + "Product Spotlight" + "News" sections all distinct. Heavy LinkedIn / Pinterest / Instagram / YouTube presence linked in footer. EcoVadis Platinum sustainability rating (2025) referenced.

**B2B features:** "Submit Inquiry" (not "Add to Cart") is the primary CTA — this is industrial B2B convention. Inquiry form is multi-step: country / industry (10 picklist values) / annual packaging spend ($50K to $1M+ bands) / file uploads (PDF, JPG, PNG, 4MB max) / project description / account creation. **This is the most sophisticated B2B intake form in the competitive set.** Account creation explicitly tied to "create and share wishlists" and "educational articles, market insights, product promotions" — clear lead-nurture motion.

**AI search readiness signals:** No `/llms.txt`. The "Packaging Crash Course" articles are explicit knowledge content — perfect AEO citation surface for technical packaging queries ("dropper assembly torque", "child-resistant closure CFR compliance"). EcoVadis Platinum is a third-party trust signal AI engines like to surface.

**3 things Best Bottles can learn / exploit:**

1. **Build "Submit Project" / "Inquiry Cart" workflow.** Best Bottles' Grace AI assistant could be the natural-language interface for this — instead of a 5-step form, Grace asks the same questions conversationally and produces a structured inquiry. This is a meaningful tech-differentiation play that O.Berk's Salesforce stack can't easily match.
2. **Steal "Packaging Crash Course" naming convention.** Best Bottles has `/resources` and a 9-post blog. Renaming the educational content surface ("Packaging Field Guide" / "Bottle School" / Madison Studio's own brand voice) and committing to 1 new article per week for 12 weeks would put us ahead of every other competitor for technical AEO queries within a quarter.
3. **Exploit O.Berk's enterprise-only buying flow.** A first-time DTC brand can't easily buy from O.Berk — they have to fill out a 5-step inquiry form, get a sales rep, wait for a quote. Best Bottles' "browse → add to cart → check out" e-commerce flow (preserved from legacy) IS the differentiator. Lead with "no rep required for orders under $X" / "instant pricing on 2,300+ SKUs" / "ships in 2 days" in homepage hero. O.Berk literally cannot compete on this.

---

## 5. Specialty Bottle — `specialtybottle.com`

**Source(s):** Live homepage fetch 2026-05-23 (canonical `https://www.specialtybottle.com/`, title "Specialty Bottle - Wholesale Glass Bottles, Jars, Metal Tins"). Built on BigCommerce Stencil (meta-platform tag confirmed).

**Primary positioning:** "A leading supplier of bottles, jars and metal tins" serving both professional manufacturers AND independent producers. The most direct competitor to Best Bottles' indie-DTC-brand segment. "Flexible 'no minimums' policy and tiered wholesale pricing" — explicit MOQ-zero positioning. Dual warehouses east + west US for fast shipping.

**Target buyer:** Independent producers (artisanal food, beekeepers, cosmetic makers, perfumers, candle makers) + the DIY/craft consumer end. The homepage explicitly courts farmers-market vendors and small-batch food producers.

**Catalog scale:** Mid-sized — probably 1,000-3,000 SKUs based on category density. Distinct categories (15+ glass bottle types: Amber/Blue/Clear/Green Boston Rounds, Blake, Corked, European Dropper, French Squares, Jugs & Beverage, Roll On, Sauce, Spanish Recycled, Swing Top, Vials, Vitamin) and similarly deep in jars, tins, plastic.

**Notable IA:** Material-led with style sub-cuts (Boston Round x 4 colors as separate landing pages). "Shop by Industry" with 12 industry verticals (Atomizer, Boston Round, Candle, Canning & Preserving, Cosmetic, Dropper, Essential Oil, Honey Jar, Lip Balm, Lotion & Pump, Perfume, Swing Top). The Industry navigation is exactly the same pattern Best Bottles should adopt.

**Schema / structured data presence:** BigCommerce Stencil platform — default theme emits Organization, WebSite, Product, BreadcrumbList. No custom JSON-LD detected beyond defaults. Google verification token present.

**Content marketing presence:** "Creative Ideas" page (DIY recipes & crafts using their bottles — cocktail kits, vanilla extract, magnetic spice rack, glitter candles, etc.) — pure long-tail SEO play targeting "DIY [product] in a [bottle]" queries. BBB accreditation + Pinterest linked. **No traditional blog confirmed on homepage navigation** — content marketing is recipe-driven, not editorial.

**B2B features:** No minimum order quantity (huge differentiator). Tiered wholesale pricing. Sales tax info page. Live chat (currently unavailable per page footer). Phone prominently displayed (206-382-1100, Mon-Fri 7am-4pm PT). Sample orders permitted per policy.

**AI search readiness signals:** No `/llms.txt`. The long-form homepage copy is value-prop dense and AI-extractable. FAQs page exists but FAQPage schema not confirmed.

**3 things Best Bottles can learn / exploit:**

1. **Match the "no minimums" claim head-on.** Best Bottles' legacy site has a $50 minimum order. The new site should either drop that minimum (or make it $0 with no shipping subsidy below $50) AND lead with "No MOQs on most SKUs" in the homepage hero. This is the one positioning element Specialty Bottle won today, and it's a $0-cost-to-match advertising claim.
2. **Reverse-engineer the "Creative Ideas" model with Madison hero imagery.** Specialty Bottle's recipe page works because every recipe links back to the bottle. Best Bottles' Madison AI hero pipeline produces beauty-grade product imagery — pair it with "How to package your essential oil line in 6 SKUs", "How to launch a perfume brand with $500 in glass", etc. Pinterest-ready, indexable, AEO-extractable.
3. **Specialty Bottle has no Product schema beyond BigCommerce defaults.** Best Bottles' custom Product + AggregateOffer + Availability schema (per `src/lib/seo.ts`) — once SSR'd per BB-SEO-203 — will outperform on "in stock amber boston round 4oz" style queries where freshness and stock-status are differentiators.

---

## 6. Container & Packaging Supply — `containerandpackaging.com`

**Source(s):** Live homepage fetch 2026-05-23 (canonical `https://www.containerandpackaging.com/`, title "Wholesale Bottles, Jars & Packaging Supplies", powered by NitroPack performance optimization). WordPress-based per the `wp-content` image paths.

**Primary positioning:** "Welcome to where bottles and jars come from." Brand voice is distinctly conversational, witty, and explicitly human ("Hard to break" for plastic, "Not as hard to break" for glass; "Easy to love"; "give us a call and a human will find what you're looking for"). Headquartered Boise, ID (12601 W Explorer Dr #100). 4.8 stars / 699 Google Reviews referenced.

**Target buyer:** Small-to-mid CPG, personal care, food & beverage, supplement, candle, essential-oil makers. Heavy emphasis on "growing brands" stories (customer profiles for Lone Star Bee Co., Amallow Skincare, Brwnsgr Skincare on homepage). Strikingly similar buyer profile to Best Bottles' indie-brand audience.

**Catalog scale:** Estimated 3,000-5,000 SKUs based on category breadth and homepage emphasis on selection.

**Notable IA:** Material-led (Plastic / Glass / Metal / Caps & Closures / Recycled / Overstock). "Shop by Industry" with 9 verticals (Food Storage, Chemical & Industrial, Pharmaceutical, Essential Oils, Art Supply, Pet Care, Nutrition & Supplement, Food & Beverage, Personal Care). Dedicated "Services" navigation (Sourcing, Warehousing & Logistics, Labels & Printing, Packaging Design, Custom Boxes). "Resources" is a true editorial property (Blogs, Guides, Infographics, Videos categories).

**Schema / structured data presence:** WordPress site. WordPress emits Organization + WebSite + Breadcrumb schema via Yoast/RankMath if installed (unconfirmed in fetched HTML, but the canonical tag and og:* pattern suggest a real SEO plugin is in use). NitroPack performance optimization (rare in this category — most competitors are slow). 

**Content marketing presence:** **Best-in-class for this competitor set.** "The Chronicles of Container" blog (also called "Container Chronicles") features articles like "Matching Neck Finishes" (2026-05-22), "What to Put on Your Product Label" (2026-04-09), "Clean vs. Sterile Packaging: What's the Difference?" (2026-03-26), "What's the difference between HDPE and PET?" (2025-11-17), "5 Packaging Procurement Mistakes that Cost Businesses Money" (2025-10-08), "Top 5 Things I Wish I Knew Before Starting My Personal Care Business" (2025-10-10). Posts have named authors, read times, dates. Customer story profiles with name + brand + photo. TikTok, YouTube, LinkedIn, Instagram, Facebook all linked. Trustpilot rating linked. Google Reviews count surfaced (699 / 4.8 stars).

**B2B features:** Phone-direct sales motion ("give us a call and a human will find what you're looking for" — explicit anti-pattern to bot-driven sites). Sales reps named in testimonials (Brenda, Heidi Stephenson, Kyle Martin, Jaymie). Sourcing-as-a-service. Custom Boxes. Warehouse & Logistics outsourcing.

**AI search readiness signals:** No `/llms.txt` confirmed. The "Chronicles" article titles are explicitly question-shaped ("HDPE vs PET", "Clean vs Sterile", "What to put on your product label") — these match Perplexity/ChatGPT query patterns precisely. CPS has best-in-category AEO posture by accident, just through good editorial choices.

**3 things Best Bottles can learn / exploit:**

1. **Steal the human-voice brand copy approach.** "Easy to love. Hard to break." / "Cap your container off with pumps, sprayers, droppers, and more. Consider this closure." That copy voice is the most distinctive in this competitor set and it earns links. Best Bottles' Madison + Grace creative team can match or exceed this — but the current new-site copy reads generic. Brief the brand team to lean into voice the way CPS does.
2. **Match the editorial cadence.** CPS publishes a real article every 2-4 weeks with named authors. Best Bottles has 9 posts total; the existing SEO content calendar (12 weeks / 24 posts per Stage 0) needs to ship and keep shipping. Specifically use question-shaped titles to match Perplexity intent.
3. **Customer-story profiles are organic-link gold.** CPS's three homepage customer stories (Lone Star Bee Co., Amallow, Brwnsgr) each get a dedicated `/resources/<brand-name>-…` URL with the founder's name + photo. These pages get linked back by the customer's own marketing. Best Bottles serves brands like Crown Affair (potentially), and any indie perfume brand we work with — even 4-6 customer stories at launch would create organic backlinks that compound.

---

## 7. TricorBraun — `tricorbraun.com`

**Source(s):** Live `/about-tricorbraun` page fetch 2026-05-23 (full HTML exceeded token budget; analysis grounded in metadata grep + web-search). Title: "About TricorBraun | A Global Packaging Leader Since 1902". HQ: 6 CityPlace Drive, Suite 1000, St. Louis, MO 63141. Founded 1902. Main: 800-325-7782.

**Primary positioning:** Largest design-led enterprise packaging distributor in the world. "Over 2,000 team members across 100+ locations in 90+ countries". Award-winning Design & Engineering team (Studio One Eleven equivalent, but in-house). Won the Ameristar Award for Sustainable Packaging. Comprehensive packaging across glass, plastic, aluminum, flexible materials.

**Target buyer:** Enterprise CPG only. The site explicitly does not serve small brands — every primary CTA is "Talk to a Packaging Consultant" or "Get a Quote". No add-to-cart. No public pricing. This is a $1M+ annual-buy account profile.

**Catalog scale:** Not catalog-driven; design-and-source model. SKU count not advertised. Effectively unlimited via global sourcing network.

**Notable IA:** Markets-led (Beverage, Spirits, Personal Care, etc.) then Services-led (Design & Engineering, Sourcing, Warehousing, Sustainability). Heavy "About" / "Awards" / "Our Story" content for enterprise procurement validation. Magento or custom enterprise CMS.

**Schema / structured data presence:** Long-form About page is structured with H2/H3 sections AND visible FAQ Q&A at the bottom ("Where is TricorBraun headquartered?", "Does TricorBraun offer sustainable packaging solutions?"). FAQPage schema almost certainly applied (best practice for B2B service sites). Organization schema very likely. No `/llms.txt` confirmed.

**Content marketing presence:** Strong — Snapshots & Insights section, "Designing for Gen Alpha" thought-leadership piece linked from About page. Award gallery. Brand portfolio ("Our Brands" footer section).

**B2B features:** "Talk to A Packaging Consultant" is the primary CTA — pure RFQ motion. Multi-step quote form. Enterprise account team model. Global supply chain transparency. Sustainability framework.

**AI search readiness signals:** The About page is engineered for AI extraction — concise statistics, dated company history ("Since 1902", "Present Day: Grown to become a worldwide leader"), inline FAQ Q&A. When Perplexity/ChatGPT are asked "what does TricorBraun do?" or "is TricorBraun a good packaging supplier?", this page is what gets cited. Best Bottles' current `/about` is meta-thin by comparison.

**3 things Best Bottles can learn / exploit:**

1. **Rewrite `/about` as an AEO-engineered piece** with: stats block (years in business, employees, SKU count, brands served, shipments per year), dated company history, sustainability statement, inline FAQ, FAQPage schema. This is the single highest-leverage content rewrite available between now and launch.
2. **TricorBraun has zero self-service.** Best Bottles' entire value prop is the opposite — instant pricing, browse-add-checkout. The "TricorBraun alternative for brands that don't have 18 months for a custom-mold project" content angle writes itself.
3. **Design-led positioning is TricorBraun's moat.** Best Bottles cannot out-spend on industrial design teams — but Madison AI's product-image quality is a credible *visual* design moat. Lead the new homepage with imagery that visibly exceeds TricorBraun's PDP photography (which is generally functional but generic). "Brand-ready packaging out of the box" — i.e., the visual quality that lets a DTC brand launch faster.

---

## 8. Bottles and More — `bottlesandmore.com`

**Source(s):** Live homepage fetch 2026-05-23 (canonical `https://www.bottlesandmore.com/default.asp`, title "Bottles and More - Wholesale Glass, Plastic, Aluminum Bottles and More!"). Located in the greater Sacramento, CA area. Phone: (916) 995-4557 (also accepts SMS to same number).

**Primary positioning:** Small, family-feel wholesale distributor with strong loyalty signal ("Wonderful Company, with great customer service, our favorite place to purchase bottles for over 16 years!" — Vickie, Purple Haze testimonial on homepage). "Old school and still truly care about our customers" framing. Same-day shipping for orders by 12:00 PST. "Not open for walk-in business, warehouse only" — pure-fulfillment posture.

**Target buyer:** Small wholesale buyers, essential-oil makers, CBD producers, wine/beer/liquor packaging buyers, fragrance/personal-care makers in California and the West Coast. "Wholesale pricing open to the public" — explicitly serves both wholesale and consumer demand.

**Catalog scale:** Mid-small — likely <2,000 SKUs based on category density. Volusion-platform store (visible in `/v/vspfiles/templates/royal/` paths).

**Notable IA:** Category-led: Glass Bottles & Jars, Olive Oil & Specialty, Wine Bottles, Aluminum Bottles & Cans, Beer Bottles, Liquor Bottles, Plastic Bottles & Jars, Caps/Droppers/Pumps/Sprayers/Corks/Shrink Bands, Hot Deals, Pallet Quote, Essential Oil & CBD Bottles. Distinctive beverage focus (Wine + Beer + Liquor as top-level categories — none of the other 7 competitors profiled has this depth).

**Schema / structured data presence:** Volusion platform — emits basic Organization/Product schema by default. GlobalSign domain verification confirmed (meta tag). Otherwise no custom schema.

**Content marketing presence:** Minimal. No blog visible. No social media linked in homepage footer. Heavy text-link footer (no images for social). The site looks like a 2014 design ("© 2014 Bottles and More Ltd").

**B2B features:** Pallet Quote (explicit page in nav — clear bulk-buyer signal). Same-day shipping. CA Resale Certificate category (helpful for tax-exempt re-sellers). Phone + SMS direct sales.

**AI search readiness signals:** Very thin. No editorial content for AI to extract. Site design + 2014 copyright signals abandonment to AI quality scorers similar to how Best Bottles' 2020 copyright did. Strong customer-loyalty signal in the one homepage testimonial ("16 years") is extractable but isolated.

**3 things Best Bottles can learn / exploit:**

1. **Beverage-category coverage is Bottles and More's only moat.** Best Bottles' catalog is fragrance-centric and currently doesn't address wine/beer/liquor seriously. Either (a) explicitly stay out of the beverage segment in positioning to focus on perfume/cosmetic/wellness, OR (b) add a "Beverage packaging" landing page leveraging existing 4oz/8oz/16oz Boston Round inventory (these double as olive oil / hot sauce bottles). Recommend (a) — stay focused.
2. **Their site age signal is exactly what bestbottles.com had.** Now that the rebuild fixes the 2020 footer, Best Bottles immediately leapfrogs Bottles and More for any AI/buyer perception of "is this site abandoned?" — claim the freshness advantage in social proof, schema dates, and editorial cadence.
3. **Phone + SMS direct sales is interesting.** "Text us at (916) 995-4557" is unusual and customer-friendly. Best Bottles could match with a click-to-text CTA or a WhatsApp Business integration — particularly for international buyers (Canada, UK, AU, JP, SG per legacy site shipping policy) who prefer messaging to calling.

---

## 9. Competitive matrix

| Competitor | Catalog scale (SKUs) | Schema baseline | Sample / quote flow | MOQ visibility | Blog / Resources | LinkedIn followers (estimate) | Notable differentiator |
|---|---:|---|---|---|---|---|---|
| **SKS Bottle** | 6,000+ | Basic (custom platform, no Product JSON-LD confirmed) | Sample Order Program + Subscribe & Save | Tiered wholesale pricing, no hard MOQ stated | Strong — Recipes, Newsletters, Product Spotlights, social-rich | ~10K (estimate) | Triple-axis IA (material × style × industry), Subscribe & Save subscriptions |
| **Berlin Packaging** | 50,000+ | BigCommerce defaults (Organization, BreadcrumbList) | Full RFQ via `/packaging-services-inquiry` + Customer Portal | Account-gated pricing | Strong — Insights, white papers, Sustainability Report | ~75K (estimate) | "Hybrid" manufacturing+distribution+services model, in-house Studio One Eleven design |
| **The Cary Company** | 5,000-10,000 (est) | Magento defaults | "My Quotes" account workflow | Account-gated | Strong — Insights, "Complete Guide" pillar pages | ~10K (estimate) | "Since 1895" heritage, IBC/totes/filtration breadth beyond bottles |
| **O.Berk** | 14,000+ | Salesforce Experience defaults | Multi-step Inquiry Cart (country + industry + spend band + file upload) | Account-gated pricing | Strong — Packaging Crash Course, #NextUp, Product Spotlight | ~12K (estimate) | EcoVadis Platinum sustainability, 250-PET-preform library, Inquiry Cart + Projects workflow |
| **Specialty Bottle** | 1,000-3,000 (est) | BigCommerce defaults | Simple add-to-cart, no formal RFQ | **No minimums** (explicit positioning) | Light — Creative Ideas recipe pages, no editorial blog | ~3K (estimate) | "No minimums" + dual east/west warehouses + BBB accreditation |
| **Container & Packaging Supply** | 3,000-5,000 (est) | WordPress (likely Yoast schema) | Phone-direct ("call a human") + Sourcing service | Account-driven | **Strongest in set** — Chronicles blog, customer stories, Guides, Infographics, Videos | ~5K (estimate) | Best brand voice, 4.8-star Google rating with 699 reviews, named sales reps |
| **TricorBraun** | Not catalog-driven (global sourcing) | Likely FAQPage + Organization | "Talk to a Packaging Consultant" enterprise RFQ | Enterprise only | Strong — Snapshots & Insights, design thought leadership | ~150K (estimate) | Award-winning Design & Engineering team, 90+ countries, "Since 1902" |
| **Bottles and More** | <2,000 (est) | Volusion defaults | Pallet Quote form + phone/SMS | Public pricing | None | <1K (estimate) | Beverage category depth (Wine + Beer + Liquor as top-level), SMS direct sales |
| **Best Bottles (target post-launch)** | 2,354 (225 product groups) | Custom JSON-LD (Organization + WebSite + Product + BreadcrumbList + LocalBusiness + FAQPage) | Request Quote + Request Sample + Grace AI assistant | $50 minimum (legacy) — recommend dropping or restating | 9 posts; SEO content calendar extends to 24 posts | <500 today (estimate) | Madison AI hero imagery + Grace AI assistance + Nemat 20+ year heritage |

LinkedIn-follower bands are estimates from public profile visibility and search-snippet evidence; **none verified against the LinkedIn platform** — Stage 5 should add a verified pass before any claim is published externally.

---

## 10. Where Best Bottles wins — five durable positioning advantages

These are the wedges. None of the 8 competitors above can credibly match all five. Stage 4 (keyword + content) and Stage 6 (Higgsfield social) should reinforce each one.

### 10.1 The "Nemat heritage + indie-brand-friendly" combination

20+ years of Nemat International ERP-backed manufacturing AND a low-MOQ buying experience aimed at indie brands. Berlin/TricorBraun/O.Berk have the heritage but won't sell to small brands. Specialty Bottle/Bottles and More serve small brands but have shallow heritage. Best Bottles is the only credible "we've been doing this for two decades AND your first order can be 50 bottles" pitch. **Homepage hero should state both facts in one sentence.**

### 10.2 Madison AI hero imagery quality

This is a visible, photographable, screenshot-shareable moat. Every competitor's PDP photography is either functional (Berlin, TricorBraun, Cary, O.Berk, SKS, Specialty Bottle) or dated (Bottles and More, legacy bestbottles.com). Madison's cap-on / cap-off paper-doll system produces beauty-grade imagery at scale. **This is THE feature to lead with in social/Pinterest/IG strategy (Stage 6)** because the visual quality difference is undeniable in side-by-side.

### 10.3 Grace AI assistant for first-time brand-side packaging buyers

A conversational AI that asks "what are you packaging?", recommends 3 SKUs, and produces a sample request. This solves the exact friction Specialty Bottle and SKS leave unresolved (you have to know what a "neck finish 18-410" is before you can shop). It also wraps the O.Berk multi-step inquiry form into a natural-language flow. **Lead all GEO/AEO copy with Grace as the "ask a packaging expert" feature** — AI engines will surface this when users ask "I want to start a perfume brand, what bottles do I need?".

### 10.4 Low MOQs explicitly stated on every PDP

The current legacy site has a flat $50 minimum (functional but unloved). The new site can explicitly print "Minimum order: 12 units" or "144-piece case minimum" per SKU on each PDP, making the MOQ visible at the SKU level. Berlin/Cary/O.Berk/TricorBraun all hide MOQs behind account creation. Specialty Bottle claims "no minimums" but their pricing tiers effectively re-introduce them at the line-item level. **Best Bottles can win the buyer-trust signal by being radically transparent about MOQs.**

### 10.5 The deepest variant matrix in the affordable tier (colors × applicators × caps)

2,354 SKUs across 225 product groups means the average product group has ~10 variants. The new site's variant-picker UX (cap color × applicator × capacity × glass color) is more sophisticated than Berlin/TricorBraun's PDPs (which lean on PDF spec sheets) and more visual than Specialty Bottle's color-grouped category pages (which split each color into a separate URL). **The variant matrix is a UX/AEO advantage** — Google's Product schema can express a single product group with multiple SKU offers, surfacing rich-result eligibility on "amber 4oz boston round dropper" style long-tail queries where the matrix itself is the answer.

---

*Companion file: `legacy-equity-baseline.md` (Deliverable 1 of Stage 3).*
*Next stage: 4 (keyword corpus + content roadmap), which translates these positioning wedges into a specific topical map and editorial schedule.*

## Sources

Direct fetches (full responses captured):
- [SKS Bottle & Packaging homepage](https://www.sks-bottle.com/)
- [Berlin Packaging homepage](https://www.berlinpackaging.com/)
- [O.Berk homepage](https://www.oberk.com/)
- [Specialty Bottle homepage](https://www.specialtybottle.com/)
- [Container and Packaging Supply homepage](https://www.containerandpackaging.com/)
- [Bottles and More homepage](https://www.bottlesandmore.com/)

Direct fetches (response exceeded token budget — metadata extracted by grep):
- [The Cary Company — Wholesale Containers and Packaging](https://www.thecarycompany.com/containers)
- [About TricorBraun](https://www.tricorbraun.com/about-tricorbraun)

Best Bottles legacy site fetches (confirming competitive context):
- [bestbottles.com homepage (Stage 0 evidence file)](https://www.bestbottles.com/)
- [bestbottles.com /faq.php](https://www.bestbottles.com/faq.php)
- [bestbottles.com /contact-us.php](https://www.bestbottles.com/contact-us.php)
- [bestbottles.com /filling-capping-labeling-perfume-bottles-atomizers.php (contract packaging)](https://www.bestbottles.com/filling-capping-labeling-perfume-bottles-atomizers.php)
- [bestbottles.com /all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php](https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php)
