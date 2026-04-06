# Best Bottles Tech Stack Context Prompt

This prompt is designed to be pasted into an AI assistant (like Claude, ChatGPT, or Cursor) to give it full context about the Best Bottles e-commerce B2B platform's tech stack.

---
**Copy the text below:**
---

Here is the complete tech stack and architecture for the **Best Bottles** B2B e-commerce platform. Keep this context in mind when writing, debugging, or reviewing code for this project.

### Core Application & Frontend
- **Next.js 16**: The foundational framework using the modern App Router, Server-Side Rendering (SSR), and Static Site Generation (SSG). Built with React 19 and strictly typed using TypeScript.
- **Vercel**: Handles hosting and deployment on their edge network with automatic CI/CD and preview environments.

### Data & Content Layer
- **Convex**: The primary real-time database and serverless backend. It handles product catalog data (2,354 product SKUs, 230+ design families, fitments), real-time updates, B2B portal orders, form submissions, and powers the search indexing.
- **Sanity.io**: The Headless CMS used by the marketing team to manage editorial content, including the homepage hero, "mega menu" navigation, product family cards, and the blog/journal without needing dev intervention.
- **Shopify**: Operates mostly as a headless commerce engine managing checkout, inventory, and order fulfillment. The Next.js storefront resolves custom SKUs to Shopify variants utilizing the Shopify Admin API for cart and checkout handoff.

### Authentication & Identity
- **Clerk**: Manages B2B portal authentication, providing organization-level accounts. Wholesale buyers sign into Clerk to view past orders, manage drafts, track shipments, and access the "Grace workspace".

### AI & Intelligence Layer (Voice & Text Assistant)
- **Grace AI**: The custom conversational AI sales assistant trained on the complete catalog, fitment data, packaging trends, and B2B pricing. It helps buyers search products, verify component compatibility, and build orders.
- **Claude (Anthropic)**: Specifically the Sonnet 4 model, powers Grace AI’s reasoning engine, giving it tool-use capabilities to query Convex securely.
- **ElevenLabs**: Powers Grace AI's Voice functionality, enabling wholesale buyers to hold natural, real-time voice conversations with Grace on the storefront.

### System Architecture Flow
1. **User/Buyer Browser** interacts primarily with the **Next.js** edge-hosted app.
2. For dynamic catalog interactions, Next.js calls **Convex** for real-time data.
3. For marketing content (blogs, structural nav), Next.js fetches from **Sanity**.
4. To check out or track inventory, the handoff happens with **Shopify**.
5. When a B2B user logs into the Wholesale Portal, **Clerk** manages auth states.
6. When users interact with the "**Grace AI**" assistant, requests flow to **Claude** (for planning/tool querying to Convex) and **ElevenLabs** (for voice synthesis).

Please acknowledge this architecture when formulating your answers, and ensure any architectural suggestions or code snippets respect this separation of concerns (e.g., using Convex for real-time app queries, Sanity for marketing content, Clerk for B2B auth, and Shopify *only* for commerce checkout execution).
