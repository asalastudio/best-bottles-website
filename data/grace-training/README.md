# Best Bottles — Grace AI Training Corpus

Centralized training data for Grace, the AI-powered product concierge on bestbottles.com.

## What Is Grace?

Grace is Best Bottles' conversational AI assistant — a "Muted Luxury" concierge that helps B2B customers find the right glass packaging for perfumes, essential oils, skincare, and aromatherapy products. She knows 2,278+ products, understands compatibility (threads, fitments, caps), and speaks with domain expertise.

## Training Data Structure

```
training-data/
├── 01-brand-knowledge/       ← Who Best Bottles is, brand voice, visual identity
│   ├── brand-brain-v2.md              (Google Drive — master brand doc)
│   ├── best-bottles-brand-book.md     (Notion — brand positioning)
│   ├── brand-identity-design-brief.md (Notion — visual system)
│   ├── best-bottles-presentation.md   (Google Drive — partnership proposal)
│   ├── smart-storefront-merchandising.md (Google Drive — UX strategy)
│   └── strategic-roadmap-2025-2027.md (Google Drive — digital transformation)
│
├── 02-product-data/          ← Product catalog, technical specs, RAG readiness
│   ├── complete-product-knowledge-base.md (Google Drive — 2,278 products)
│   └── rag-readiness-status.md        (Google Drive — data pipeline status)
│
├── 03-training-sessions/     ← Brand Brain sessions, training enhancements
│   ├── brand-brain-session-1.md       (Google Drive — Abbas interview Jan 29)
│   ├── brand-brain-session-1-meeting-summary.md (Notion — session summary)
│   ├── grace-training-session-1-data.md (Notion — extracted training data)
│   ├── grace-training-session-1-enhancements.md (Notion — expanded scenarios)
│   └── grace-training-enhancement-intelligence-report.md (Notion — psychology, objections)
│
├── 04-competitive-intel/     ← Competitor analysis, market positioning
│   ├── competitive-landscape-master.md (Notion — vs top 8 competitors)
│   └── catalog-product-mapping.md     (Notion — competitor product mapping)
│
├── 05-implementation/        ← Technical architecture, system prompts, best practices
│   ├── grace-ai-complete-reference-hub.md (Notion — navigation hub)
│   ├── grace-ai-implementation.md     (Notion — Convex code, ElevenLabs, system prompt)
│   └── ai-agent-voice-training-best-practices.md (Notion — multimodal AI patterns)
│
└── 06-meeting-transcripts/   ← (Empty — add client meeting transcripts here)
```

## Sources

| Source | Documents | Size |
|--------|-----------|------|
| Google Drive | 7 docs | ~900 KB |
| Notion | 11 pages | ~80 KB |
| **Total** | **18 files** | **~1 MB** |

All files include YAML frontmatter with source, URL/ID, and fetch date for traceability.

## How to Use This Data

**For Grace's system prompt:** Start with `05-implementation/grace-ai-implementation.md` — contains the current system prompt and architecture.

**For product knowledge:** `02-product-data/complete-product-knowledge-base.md` is the full 2,278-product catalog. This is the core RAG document.

**For brand voice training:** `01-brand-knowledge/brand-brain-v2.md` defines who Best Bottles is, how Grace should talk, and what differentiates the brand.

**For competitive context:** `04-competitive-intel/` teaches Grace how to position Best Bottles against SKS, Berlin Packaging, and others.

## Refreshing This Data

To re-fetch from source platforms, run the Grace AI self-training skill or manually fetch updated docs from Google Drive/Notion. Each file's frontmatter records when it was last fetched.

## Last Updated

2026-03-24 — Initial corpus assembled from Google Drive + Notion.
