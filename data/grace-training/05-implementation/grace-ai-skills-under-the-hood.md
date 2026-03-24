---
title: "Grace AI Skills: Under the Hood"
source: "Google Docs"
source_id: "1uwd3UWD4ep_zAif4O6TG-0v2iisZZ0I6LhHdE_i-k10"
source_url: "https://docs.google.com/document/d/1uwd3UWD4ep_zAif4O6TG-0v2iisZZ0I6LhHdE_i-k10/edit"
fetched_date: "2026-03-24"
purpose: "Grace AI training data"
---

# Grace AI Skills: Under the Hood

## Overview

Grace AI is built on a self-training architecture where the AI learns from every customer interaction, identifies patterns in successful vs. unsuccessful recommendations, and continuously improves its product-customer matching logic.

This document outlines how Grace works internally: what it tracks, how it learns, known failure patterns, and how to improve it.

---

## Architecture: The Four Layers

### Layer 1: Understanding the Customer
Grace asks structured questions to build a profile:

**Essential questions**:
- What's your skin type? (dry, oily, combo, sensitive)
- What are your main skincare concerns? (acne, aging, sensitivity, dryness, oiliness, hyperpigmentation)
- How experienced are you with K-beauty products? (new, intermediate, advanced)
- Do you have any ingredient sensitivities or preferences?

**Context questions**:
- Are you building a routine from scratch or adding to an existing routine?
- What's your budget range?
- How much complexity are you comfortable with (3-step vs. 10-step routines)?
- Is this for personal use, gift, or professional application?

**Qualification questions** (follow-ups):
- When did this concern start?
- Have you tried other products for this concern?
- What didn't work about them?
- What climate/season are you in?

### Layer 2: Product-Customer Matching
Grace evaluates each product in our library against the customer profile:

**Matching criteria**:
1. **Skin type fit**: Is this product suitable for their skin type?
2. **Concern relevance**: Does this product address one of their stated concerns?
3. **Routine compatibility**: Does it fit logically in their routine? (placement, interactions)
4. **Ingredient alignment**: Do they have any ingredient sensitivities that rule it out?
5. **Complexity match**: Is this product appropriate for their experience level?
6. **Budget fit**: Is the price acceptable for their stated budget?

**Recommendation logic**:
- Start with products addressing their PRIMARY concern
- Then suggest supporting products (hydration, barrier support, SPF)
- Limit to 1-2 recommendations for first-time buyers
- Explain the RATIONALE for each recommendation

### Layer 3: Recommendation & Education
Grace communicates recommendations in a way that builds confidence:

**Format**:
1. **Lead with why**: "Based on your [concern] + [skin type], I recommend [product]..."
2. **Explain the mechanism**: "This product contains [ingredient] which [mechanism]..."
3. **Set expectations**: "Most people see results in [timeline]. You might experience [adjustment signs]..."
4. **Answer concerns**: "If you're worried about [objection], here's why [product] is a good fit..."
5. **Suggest next steps**: "If this works, you might also consider [supporting product]..."

### Layer 4: Feedback & Self-Training
Grace tracks every recommendation and learns from outcomes:

**Data collected**:
- What was recommended
- Why it was recommended
- Customer feedback (if provided)
- Purchase decision (yes/no)
- Post-purchase satisfaction (if tracked)

**Learning patterns**:
- Which recommendations lead to purchases
- Which recommendations lead to returns/dissatisfaction
- Which customer profiles respond best to which products
- Common objections and how to overcome them

---

## Known Failure Patterns

### Failure Pattern 1: The Frosted Family Confusion
**What happens**: Grace confuses products within a family (e.g., COSRX Snail Mucin 96% vs. other hydrating essences) and recommends the wrong variant for the customer's needs.

**Symptoms**:
- Customer buys Product A but it doesn't match their concern
- Customer reports "this was for anti-aging but I needed hydration"
- Recommendation doesn't fit their routine step

**Root cause**: Grace's product library isn't specific enough about product-level differences. It groups similar products without distinguishing nuances.

**Fix**:
- Add variant-level product profiles
- Include "ideal customer profile" for each SKU
- Flag products that are frequently mismatched

**Prevention**:
- Ask qualification questions before recommending within a product family
- Be explicit: "This product is specifically for [use case], not for [other use case]"
- Provide clear differentiation between similar products

### Failure Pattern 2: Phantom SKU Generation
**What happens**: Grace recommends a product that doesn't exist in our inventory, or recommends a variant we don't stock.

**Symptoms**:
- Customer says "I want the [variant] you recommended"
- Product isn't in our system
- Inventory mismatch between recommendation and fulfillment

**Root cause**: Grace's product library is incomplete or outdated. It references products or variants we don't actually carry.

**Fix**:
- Audit product library regularly (weekly)
- Cross-check against actual inventory system
- Remove or flag products we're phasing out

**Prevention**:
- Always verify product availability before recommending
- Say "We currently stock..." not "You should get..."
- Flag out-of-stock items clearly

### Failure Pattern 3: Thread Size Assumption
**What happens**: Grace assumes a customer's skin concern is straightforward when it's actually nuanced or multi-layered.

**Symptoms**:
- Customer says "I have acne" but it's actually dehydration-triggered acne
- Grace recommends an acne treatment, which worsens the problem
- Customer is frustrated because the root cause wasn't addressed

**Root cause**: Grace accepts surface-level answers and doesn't dig deeper. It recommends based on the symptom, not the cause.

**Fix**:
- Add deeper qualifying questions
- "Your acne seems stress-related; are you getting good sleep?"
- "Are you experiencing dehydration alongside the acne?"
- "When did this acne start? Any lifestyle changes?"

**Prevention**:
- Always ask "why" at least once
- Avoid single-product recommendations for multi-factor concerns
- Position recommendations as "addressing this specific aspect; you may also need..."

---

## Improvement Roadmap

### Short-term Wins (Week 1-2)
1. **Audit product library**: Verify all 50 products with current inventory
2. **Add customer profiles**: Define ideal customer for each product
3. **Deepen qualification**: Add follow-up questions for common concerns

### Medium-term Improvements (Week 3-4)
1. **Feedback loop**: Implement customer feedback collection post-purchase
2. **Success metrics**: Track recommendation → purchase → satisfaction conversion
3. **Objection library**: Document common objections and best responses

### Long-term (Week 5+)
1. **Sentiment analysis**: Monitor customer language for dissatisfaction signals
2. **Cohort analysis**: Identify which customer profiles have highest satisfaction
3. **Continuous learning**: Monthly review of recommendation patterns and outcomes

---

## Testing Grace Recommendations

### How to Test a Recommendation
1. **Pick a customer profile** (e.g., "25-year-old with oily, acne-prone skin, new to K-beauty")
2. **Ask Grace for a recommendation**
3. **Evaluate the recommendation**:
   - Does it address the stated concern?
   - Is it appropriate for the experience level?
   - Would you recommend this product for this profile?
   - Is the explanation clear and persuasive?
4. **Provide feedback** to Grace (if tracking system is in place)

### Key Test Scenarios
- **Edge case**: Customer with multiple, conflicting concerns (oily + sensitive)
- **Beginner**: New customer with minimal skincare knowledge
- **Expert**: Experienced customer looking for specialized products
- **Gift**: Recommendation for a gift scenario
- **Professional**: Recommendation for makeup artist use

