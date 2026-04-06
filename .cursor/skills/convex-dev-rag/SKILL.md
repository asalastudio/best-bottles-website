---
name: convex-dev-rag
description: Guides Retrieval-Augmented Generation using @convex-dev/rag on Convex—chunking, AI SDK embeddings, vector search, namespaces, filtering, chunk expansion, and generateText for retrieval plus LLM. Use when building Convex-backed RAG, semantic search, document Q&A, knowledge-base chat, multi-tenant isolated search, or agents that retrieve before generating.
---

# Convex RAG (@convex-dev/rag)

## Instructions

`@convex-dev/rag` is a Convex component for RAG: it chunks text, generates embeddings via AI SDK models, and performs vector similarity search with namespaced content. It supports custom filtering, importance weighting, chunk context expansion, and keyed content updates for production RAG.

### Installation

```bash
npm install @convex-dev/rag
```

Wire the component in `convex.config.ts` using the standard Convex component pattern. Instantiate RAG with the chosen embedding model from the AI SDK.

### Core API surface

| Concern | Use |
|--------|-----|
| Ingest | `add()` — chunks text, generates embeddings, organizes by namespace |
| Search | `search()` — vector similarity; tune score thresholds, expand chunk context, apply filters |
| RAG in one step | `generateText()` — retrieves context and formats it for the LLM |
| Updates | Keyed replacement — update documents without breaking in-flight search semantics |

### When to use

- AI chatbots that ground answers in docs, KBs, or user-specific content
- Document Q&A with uploads and semantic (not just keyword) retrieval
- Multi-tenant RAG with isolated namespaces and metadata filters (type, category, tenant)
- Semantic search over large repositories
- Agents that retrieve and synthesize before responding

### When not to use

- The app does not use Convex as the backend
- A simpler non-RAG approach fits (e.g., exact lookup only)
- You do not need retrieval or embeddings

## Resources

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Frag)
- [GitHub repository](https://github.com/get-convex/rag)
- [Convex Components Directory](https://www.convex.dev/components/rag)
- [Convex documentation](https://docs.convex.dev)
