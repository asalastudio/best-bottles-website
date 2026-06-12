# Best Bottles — Complete SEO/GEO/AEO/Social Audit
## Asala Studio · 2026-05-23 · Target launch 2026-06-15

This folder contains the complete audit and strategy package for the Best Bottles site relaunch. **Total content: ~64,000 words across 16 files**, plus a production-ready `llms.txt` and a 153-entry redirect map CSV.

The executive summary (`07-executive-summary/best-bottles-seo-audit-executive-summary.docx`) is the 10-minute read for stakeholders. Everything else is reference for the engineering, content, and social teams.

---

## Read order recommendations

**If you have 10 minutes:** Read `07-executive-summary/best-bottles-seo-audit-executive-summary.docx`.

**If you have 30 minutes:**
1. Executive summary (10 min)
2. `01-technical-seo/p0-dev-tickets-urgent.md` (10 min)
3. `05-migration-launch/launch-go-nogo-scorecard.md` (5 min)
4. `02-geo-aeo/llms.txt` (5 min — read the actual file to deploy)

**If you're engineering:** Start with `01-technical-seo/technical-seo-audit.md`, then `05-migration-launch/migration-runbook.md`, then the redirect map CSV.

**If you're content/marketing:** Start with `04-keyword-content/persona-keyword-corpus.md`, then the 90-day roadmap, then `06-social-higgsfield/social-strategy.md`.

**If you're Abbas / stakeholder:** Executive summary only. Everything else flows up to it.

---

## Full deliverables index

### Stage 0 — Discovery
| File | Words | Purpose |
|---|---|---|
| `00-discovery/00-discovery-brief.md` | 2,337 | Domain plan, master data inventory, P0 launch-blockers, open questions |
| `raw/legacy-homepage-fetch-2026-05-23.md` | 766 | Raw evidence — legacy bestbottles.com homepage crawl |

### Stage 1 — Technical SEO audit
| File | Words | Purpose |
|---|---|---|
| `01-technical-seo/technical-seo-audit.md` | 5,677 | Full technical audit · score 62/100 · 19 new tickets BB-SEO-201–219 |
| `01-technical-seo/p0-dev-tickets-urgent.md` | 1,200 | 4 P0 launch-blocker tickets (5th added during Stage 1) |

### Stage 2 — GEO/AEO audit
| File | Words | Purpose |
|---|---|---|
| `02-geo-aeo/geo-aeo-audit.md` | 6,536 | AI search readiness · AEO score 45.5/100 · 8-query live test · 12 BB-AEO tickets |
| `02-geo-aeo/llms.txt` | 1,999 | **PRODUCTION-READY** — deploy to `/public/llms.txt` |

### Stage 3 — Legacy baseline + competitive map
| File | Words | Purpose |
|---|---|---|
| `03-legacy-baseline/legacy-equity-baseline.md` | 3,214 | What to preserve through cutover · pages likely earning today |
| `03-legacy-baseline/competitive-landscape-map.md` | 5,777 | 8 competitors profiled · matrix · "Where Best Bottles wins" |

### Stage 4 — Keyword + content strategy
| File | Words | Purpose |
|---|---|---|
| `04-keyword-content/persona-keyword-corpus.md` | 5,192 | 150 keywords across 5 personas · intent + journey stage |
| `04-keyword-content/content-roadmap-90d.md` | 7,210 | Weeks 13–26 · 28 pieces extending the existing 24-post calendar |
| `04-keyword-content/copy-templates.md` | 5,658 | PDP + category copy templates · worked examples · tone-of-voice |

### Stage 5 — Migration + launch plan
| File | Words / Rows | Purpose |
|---|---|---|
| `05-migration-launch/migration-runbook.md` | 5,176 words | T-23 to T+90 runbook · hour-by-hour cutover playbook · rollback |
| `05-migration-launch/redirect-map.csv` | 153 rows | Legacy `.php` → new clean URLs · ready for `next.config.ts` |
| `05-migration-launch/launch-go-nogo-scorecard.md` | 1,418 words | 30-item Go/No-Go checklist for June 14 evening |

### Stage 6 — Higgsfield social/visual strategy
| File | Words | Purpose |
|---|---|---|
| `06-social-higgsfield/social-strategy.md` | 7,052 | B2B reframe of 5 UGC formats · 90-day cadence · IG/Pinterest/TikTok/LinkedIn |
| `06-social-higgsfield/higgsfield-starter-batch.md` | 6,904 | 25 production-ready Higgsfield prompts · ready to generate |

### Stage 7 — Executive summary
| File | Format | Purpose |
|---|---|---|
| `07-executive-summary/best-bottles-seo-audit-executive-summary.docx` | Word doc | 10-min stakeholder read · top findings · action plan |
| `07-executive-summary/best-bottles-seo-audit-executive-summary.md` | Markdown source | Source-of-truth for the .docx |

---

## The 5 P0 launch-blockers (must fix before June 15)

1. **🚨 BB-SEO-001 — Decommission `bestbottles.company`** · ✅ DONE 2026-05-23
2. **🚨 BB-SEO-002 — Fix `SITE_URL` default in `src/lib/seo.ts`** — currently defaults to staging domain
3. **🚨 BB-SEO-003 — Restore GSC + Bing verification tokens** in `src/app/layout.tsx`
4. **🚨 BB-SEO-004 — Build dynamic sitemap** with 2,400+ URLs (currently 21)
5. **🚨 BB-SEO-208 — Add per-page canonicals** to `/products/[slug]`, `/blog/[slug]`, `/collections/[slug]` — currently every page emits same canonical and Google would collapse the site

Plus one stealth migration risk:

6. **🚨 Build `/services/contract-packaging` page** before launch — legacy site is currently ranking for "private label perfume filler", "custom perfume filling service" via a PHP page with no destination on the new site

## Readiness scores (today vs minimum-for-launch)

| Dimension | Today | Min for launch | Gap |
|---|---|---|---|
| Technical SEO | 62/100 | 85/100 | Fix P0s + 5 P1 tickets |
| GEO/AEO | 45.5/100 | 60/100 | Ship llms.txt + FAQPage schema |
| Content depth | Strong existing 24-post calendar | Extend with /services/contract-packaging | Stage 4 Week 13A |
| Social presence | Minimal | Foundation set | Higgsfield batch ready to generate |
| Migration prep | Not started | Required by T-1 | Stage 5 runbook |

## Top 3 strategic insights

1. **Stage 3 competitive insight:** Container & Packaging Supply's "Chronicles" blog + named-customer-story model is the most copyable, highest-AEO-ROI move available. Reframe the existing 24-post content calendar to use question-shaped titles. Ship 4–6 indie-brand customer stories in the first wave. Estimated impact: AEO citation parity with SKS/Berlin/Cary/O.Berk in 90 days.

2. **Stage 4 persona gap:** The existing content calendar has zero pieces targeting **Persona 2 — Established Brand Procurement Manager** ($5M–$100M cosmetics brands with Net 30 PO buyers). This is the highest dollar-value-per-visitor segment Best Bottles can serve. 30 unowned keywords. Stage 4 Week 15A pillar + Week 16B Berlin-alternative + Week 23A Pantone-custom-color pillar all target this gap.

3. **Stage 6 social channel insight:** **Pinterest is the under-priced channel** for B2B packaging. Indie founders save bottle imagery to mood boards 6–12 months before sourcing — the save IS the conversion event. Zero competitors are producing serious Pinterest volume. Allocate 30% of social production budget there (8 pins/week) and use Higgsfield's ASMR + color-study clips as the primary feed.

---

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Stakeholders:** Abbas + Best Bottles team
**Source of truth Linear project:** Best Bottles Site Launch
