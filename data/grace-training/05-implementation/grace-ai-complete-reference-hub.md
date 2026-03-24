---
title: Grace AI — Complete Reference Hub
source: Notion
source_id: feb4bcc2caba4d4f95f94a355035791d
fetched_date: 2026-03-24
purpose: Grace AI training data
---

> **Purpose:** Single entry point for all Grace AI documentation. This hub links to specialized documents — no duplicated content to maintain.
---
## 🎯 What is Grace?
**Grace** is Best Bottles' AI-powered product expert — a "Muted Luxury" concierge that helps B2B customers find the right packaging solutions.

| Attribute | Value |
|-----------|-------|
| **Role** | Knowledgeable, warm, professional concierge |
| **LLM** | Google Gemini 2.5 |
| **Voice** | ElevenLabs |
| **Backend** | Convex (real-time, vector search) |
| **Knowledge Base** | 2,500+ products, FAQs, use case guides |

---
## 📚 Documentation Map
Use this table to find exactly what you need:

| I need to... | Go to | Contains |
|--------------|-------|----------|
| **Build or modify Grace** | Grace AI Implementation | Technical architecture, system prompt, Convex code, frontend components, ElevenLabs integration, implementation checklist |
| **Update Grace's knowledge** | Grace Operations & Knowledge Management | How to add FAQs, use case guides, test responses, regenerate embeddings, monitor performance |
| **Understand what Grace knows** | Grace Training Data — Session #1 | Customer segments, product decision trees, common mistakes, bottle families, pricing guidelines, example conversations |
| **See session notes & action items** | Brand Brain Session #1 — Meeting Summary | Strategic insights, decisions made, follow-up tasks from knowledge capture sessions |

---
## 🧠 Grace's Knowledge Sources
Grace learns from three types of content:

| Source | How It Works | Update Method |
|--------|--------------|----------------|
| **Product Data** | Auto-synced from Sanity/Shopify via embeddings | Automatic on publish |
| **FAQ Entries** | Specific Q&A pairs in Sanity | Manual (see SOP-003) |
| **Use Case Guides** | Industry-specific guidance in Sanity | Manual (see SOP-003) |

---
## ⚡ Quick Actions
### Adding Knowledge
1. Open Sanity Studio
2. Navigate to **FAQ Entries** or **Use Case Guides**
3. Create new entry with question, answer, and category
4. Publish — embeddings regenerate automatically
➝ Full process: Grace Operations & Knowledge Management

### Testing Grace
```bash
# Run automated Q&A test suite
npm run test:grace
```

### Regenerating Embeddings
If Grace seems "stale" or missing recent products:
```bash
npx convex run ai:regenerateAllEmbeddings
```

---
## 📊 Key Metrics

| Metric | Target | Check Frequency |
|--------|--------|-----------------|
| Response accuracy | >90% | Weekly |
| Average response time | <3 seconds | Dashboard |
| Escalation rate | <5% | Weekly |
| Customer satisfaction | >4.5/5 | Monthly |

---
## 📁 All Grace-Related Documents
### Core Documentation
- Grace AI Implementation — Technical architecture & code
- Grace Operations & Knowledge Management — Operational procedures

### Training Data & Knowledge
- Grace Training Data — Session #1 — Complete knowledge corpus
- Grace Training Data — Session #1 Enhancements (companion expansions & training recommendations)
- Brand Brain Session #1 — Meeting Summary — Session notes & action items
- Grace AI Training Enhancement — Complete Intelligence Report

### Related Infrastructure
- Convex Tables Documentation — `conversations`, `messages`, `productKnowledge` tables
- Data Integration Guide — How data flows to Grace

---
## ❓ FAQ
**Q: Where does Grace's system prompt live?**
A: In `convex/ai/grace.ts` — see Grace AI Implementation for full prompt.

**Q: How do I add a new FAQ?**
A: Follow Grace Operations & Knowledge Management → "Adding FAQ Entries" section.

**Q: Grace is giving wrong answers about a product. What do I do?**
A: First check if the product data is correct in Sanity. If yes, add a specific FAQ entry to override. See Grace Operations & Knowledge Management → "Testing Grace's Responses".

**Q: How long does it take for new content to appear in Grace?**
A: Embedding regeneration happens automatically on Sanity publish. Usually 1-2 minutes.
