---
title: Grace AI Implementation
source: Notion
source_id: 2f6bff35e9ed81ebaea6dac705dfcfff
fetched_date: 2026-03-24
purpose: Grace AI training data
---

> **Purpose:** Build the AI-powered chatbot that serves as Best Bottles' knowledgeable product expert.
Grace is the "Muted Luxury" concierge - warm, professional, and deeply knowledgeable about packaging.

---
## Grace's Persona
**Name:** Grace
**Role:** Knowledgeable, warm, and professional concierge
**Tone:** Polished but approachable. No slang, no excessive exclamation points.

### Personality Traits
- Expert knowledge of 3,000+ products
- Understands B2B context (MOQs, production runs, lead times)
- Never quotes specific prices (dynamics change) - refers to configurator
- Always suggests complementary products
- Passes the "Muted Luxury" test in every response

---
## Technical Architecture
```
Customer Message
      │
      ▼
┌─────────────────────┐
│   CONVEX FUNCTION    │
│   (handleMessage)    │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌──────────┐
│ Vector  │ │ Convers- │
│ Search  │ │  ation   │
│(products)│ │ History  │
└─────┬────┘ └────┬─────┘
      │           │
      └─────┬─────┘
            │
            ▼
┌─────────────────────┐
│   GEMINI 2.5 PRO     │
│   (with context)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Response + Products │
│  (stored in Convex)  │
└─────────────────────┘
           │
           ▼
   Real-time to Frontend
   (+ optional ElevenLabs voice)
```

---
## System Prompt
```markdown
You are Grace, the product expert at Best Bottles - a premium packaging company serving the perfume, cosmetics, and personal care industries.

## Your Role
You are a knowledgeable, warm, and professional concierge. You help B2B customers find the right packaging solutions for their brands.

## Your Knowledge
You have deep expertise in:
- 2,500+ bottle variants (roll-ons, sprayers, droppers, jars)
- Glass types (amber, frosted, clear, cobalt blue, black)
- Closure options (caps, pumps, sprayers, roll-on balls)
- Industry applications (perfume, skincare, essential oils, cosmetics)
- B2B logistics (MOQs, lead times, bulk pricing)

## Response Guidelines

### Tone
- Professional yet warm
- Polished, not corporate
- Confident but not pushy
- NEVER use slang or excessive punctuation

### Pricing Rules
- NEVER quote specific unit prices (they change)
- Refer customers to the configurator for current pricing
- You CAN discuss bulk pricing TIERS generally:
  - Small quantities (1-11): Regular price
  - Medium (12-143): ~5-10% discount
  - Large (144+): ~15-20% discount
  - Custom (1000+): Contact for special pricing

### Recommendations
- Always provide 2-3 options when recommending
- Explain WHY each option fits their needs
- Suggest complementary products (closures, accessories)
- Ask clarifying questions when needed

### Context Awareness
- Remember what the customer has already discussed
- Reference products they've shown interest in
- Understand B2B context (production runs, brand positioning)
```

---
## Convex Implementation
### Chat Handler
```typescript
// convex/ai/grace.ts

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const sendMessage = action({
  args: {
    conversationId: v.optional(v.id("conversations")),
    sessionId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { conversationId, sessionId, message }) => {
    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await ctx.runMutation(internal.conversations.create, {
        sessionId,
      });
    }

    // Store user message
    await ctx.runMutation(internal.messages.create, {
      conversationId: convId,
      role: "user",
      content: message,
    });

    // Get conversation history
    const history = await ctx.runQuery(internal.messages.getHistory, {
      conversationId: convId,
      limit: 10,
    });

    // Vector search for relevant products
    const relevantProducts = await ctx.runQuery(
      internal.productKnowledge.search,
      { query: message, limit: 5 }
    );

    // Build context for Gemini
    const context = buildGraceContext(relevantProducts, history);

    // Call Gemini
    const response = await callGemini({
      systemPrompt: GRACE_SYSTEM_PROMPT,
      context,
      userMessage: message,
    });

    // Extract product references from response
    const referencedProducts = extractProductReferences(
      response,
      relevantProducts
    );

    // Store assistant message
    await ctx.runMutation(internal.messages.create, {
      conversationId: convId,
      role: "assistant",
      content: response.text,
      referencedProducts,
    });

    return {
      conversationId: convId,
      message: response.text,
      products: referencedProducts,
    };
  },
});

function buildGraceContext(
  products: ProductKnowledge[],
  history: Message[]
): string {
  let context = "## Relevant Products\n\n";

  for (const product of products) {
    context += `### ${product.name}\n`;
    context += `${product.content}\n\n`;
  }

  context += "## Conversation History\n\n";
  for (const msg of history) {
    context += `${msg.role}: ${msg.content}\n`;
  }

  return context;
}
```

### Vector Search for Products
```typescript
// convex/ai/productKnowledge.ts

export const search = internalQuery({
  args: {
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, { query, limit }) => {
    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    // Vector similarity search
    const results = await ctx.db
      .query("productKnowledge")
      .withIndex("by_embedding", (q) => q.nearestTo(embedding))
      .take(limit);

    // Get full product details
    const products = await Promise.all(
      results.map(async (r) => {
        const product = await ctx.db.get(r.productId);
        return {
          ...product,
          relevanceScore: r._score,
          knowledgeContent: r.content,
        };
      })
    );

    return products;
  },
});
```

---
## Frontend Chat Component
```typescript
// components/chat/GraceChat.tsx

import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState, useRef, useEffect } from 'react';

export function GraceChat() {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const sendMessage = useMutation(api.ai.grace.sendMessage);

  const handleSend = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    const result = await sendMessage({
      conversationId,
      sessionId: getSessionId(),
      message: input,
    });

    setConversationId(result.conversationId);
    setInput('');
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map((msg) => (
          <MessageBubble key={msg._id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Grace about packaging..."
            className="flex-1 px-4 py-2 border rounded-full"
          />
          <button
            onClick={handleSend}
            className="btn-gold rounded-full px-6"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---
## Voice Integration (ElevenLabs)
```typescript
// hooks/useGraceVoice.ts

import { useCallback, useState } from 'react';

export function useGraceVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${GRACE_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.8,
          },
        }),
      }
    );

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => setIsSpeaking(false);
    audio.play();
  }, []);

  return { speak, isListening, isSpeaking };
}
```

---
## Training Data & Knowledge Base
Grace's intelligence comes from structured knowledge captured through Brand Brain sessions with Best Bottles experts.

### 📚 Training Data Sources
| Session | Source Document | Content Focus |
|---------|-----------------|---------------|
| Session #1 | Grace Training Data — Session #1 | Company identity, customer segments, product recommendation logic, common mistakes, bottle families, technical specs, pricing guidelines |

**Related Documentation:**
- Brand Brain Session #1 — Meeting Summary (action items & strategic insights)

### Key Knowledge Areas Covered
<details>
<summary>**Company Identity & Differentiation**</summary>

- Best Bottles as B2B division of Nemat International (over two decades of expertise)
- "Boutique" positioning vs. commodity suppliers
- System guarantee, small quantity sets, proprietary roll-on innovation
</details>

<details>
<summary>**Customer Segments**</summary>

- Retail/Natural Food Stores
- Small & Large Manufacturers
- Gift/Promotional Companies
- Drammers Market
- Indie Perfumers & Craft Makers
- Essential Oil Users
</details>

<details>
<summary>**Product Recommendation Decision Tree**</summary>

1. Identify product type (oil vs. alcohol-based)
2. Determine viscosity
3. Recommend applicator type
4. Determine capacity
5. Consider aesthetics
6. Discuss decoration options
</details>

<details>
<summary>**Common Mistakes to Prevent**</summary>

- Cap size confusion (neck finish notation)
- Mixing non-system components
- Wrong applicator for viscosity (⚠️ roll-ons leak with alcohol-based products)
- US vs. Euro finish incompatibility
- Citrus oil reactivity
</details>

<details>
<summary>**Technical Knowledge**</summary>

- Glass types (flint, optical, tube)
- Flame polishing quality differentiator
- UV protection requirements
- Crimp vs. screw neck preferences
</details>

---
## Knowledge Base Generation
### Embedding Pipeline
```typescript
// convex/ai/embeddings.ts

export const generateProductEmbeddings = internalAction({
  args: {
    sanityId: v.string(),
  },
  handler: async (ctx, { sanityId }) => {
    // Get product from Convex
    const product = await ctx.runQuery(internal.products.getBySanityId, {
      sanityId,
    });

    if (!product) return;

    // Delete existing embeddings
    await ctx.runMutation(internal.productKnowledge.deleteForProduct, {
      productId: product._id,
    });

    // Generate embeddings for different knowledge types
    const knowledgeChunks = [
      {
        type: 'description',
        content: `${product.name}: ${product.shortDescription}`,
      },
      {
        type: 'use_case',
        content: `${product.name} is used for ${product.category} packaging.
                  Common applications include ${getUseCases(product.category)}.`,
      },
      {
        type: 'specifications',
        content: `${product.name} - ${product.capacity} capacity,
                  ${product.bottleFamily} family, MOQ: ${product.moq}`,
      },
    ];

    for (const chunk of knowledgeChunks) {
      const embedding = await generateEmbedding(chunk.content);

      await ctx.runMutation(internal.productKnowledge.create, {
        productId: product._id,
        content: chunk.content,
        embedding,
        knowledgeType: chunk.type,
      });
    }
  },
});
```

---
## Implementation Checklist
- [ ] Create `convex/ai/grace.ts` with chat handler
- [ ] Create `convex/ai/productKnowledge.ts` for vector search
- [ ] Create `convex/ai/embeddings.ts` for knowledge generation
- [ ] Write Grace system prompt
- [ ] Build frontend chat component
- [ ] Implement real-time message subscriptions
- [ ] Add ElevenLabs voice integration
- [ ] Run embedding pipeline for all products
- [ ] Create 50+ Q&A test suite
- [ ] Test accuracy with client
- [ ] Refine system prompt based on feedback
