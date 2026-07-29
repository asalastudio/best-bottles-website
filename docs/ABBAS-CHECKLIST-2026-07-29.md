# What We Need From Abbas — Best Bottles Launch

**Date:** 2026-07-29 · One page of decisions. Everything here is blocked on you, not on us.

Nothing below is about product photography — that's tracked separately. These are the
non-image gaps, all verified against the live Shopify store and production database today.

---

## 🔴 Decide today — these stop us taking money

### 1. 377 products are set to DRAFT in Shopify → customers hit a dead checkout

We tested it: a draft product's checkout link returns **"410 Gone"**. An active one goes
straight to a working checkout. **398 of 2,330 SKUs (17%) cannot be bought right now.**

Affected: Elegant 77 · Round 48 · Diva 43 · Sleek 36 · Slim 36 · Circle 34 · Cylinder 24 ·
Empire 24 · Sprayer 15 · Atomizer 12 · Grace 12 · Diamond 12 · Lotion Pump 7

> **Q: Were these held back on purpose (discontinued, not launched yet), or just never published?**
>
> - [ ] Publish them all → we run one command and they're buyable
> - [ ] Some are intentionally unavailable → **we need the list**
> - [ ] Leave as quote-only for launch

*We've already made the site safe: these now say "Request a Quote" instead of breaking. But
they're invisible revenue until you decide.*

---

### 2. Volume discounts: the site promises them, Shopify doesn't give them

Tested with a real order: a bottle whose 12+ price is **$7.46** was charged at **$7.85** —
customer pays **$94.20** instead of the **$89.49** we advertised.

We also found the *real* pricing ladder in the database, and it's much deeper than the site shows:

| Qty | Price | | Qty | Price |
|---|---|---|---|---|
| 1 | $2.25 | | 600 | $1.91 |
| 12 | $2.14 | | 3,000 | $1.76 |
| 144 | $2.03 | | | |

A distributor buying 3,000 units currently sees **no hint** that the price drops 22%.

> **Q: How should volume pricing work online?**
>
> - [ ] **Make it real** — turn on quantity discounts in Shopify (we're on Shopify Plus, it's included) and show the full ladder
> - [ ] **Quote-only** — volume stays a conversation with sales (this is what the site says today)

> **Q: 34 prices look wrong.** One cap shows $4.25 → **$0.08** (98% off). Someone needs to
> eyeball these — we can't tell a typo from a real closeout. *(list attached: `suspect-tier-pricing-prod.json`)*

---

### 3. Every quote request currently goes nowhere

When a customer submits a quote, sample, or contact form, it saves to the database and
**nobody is notified**. No email. No alert. Someone would have to log into a developer
dashboard to find it.

This matters more than it sounds: quotes are the fallback for all 398 unsellable SKUs *and*
for all volume pricing. It's the main way customers reach you right now.

> **Q: Where should leads go?**
>
> - Email address(es): ______________________
> - Also want Slack/text alerts? ______________________
> - Who owns responding, and how fast? ______________________

---

## 📦 Shipping — the biggest unanswered area

**Every single one of the 2,309 products in Shopify has a weight of ZERO.** They're all
marked "requires shipping," but with no weight.

What this means: if you want FedEx/UPS to quote real rates at checkout, **it cannot work** —
the carrier has nothing to price. Customers would see no shipping options, or a wrong price.

Good news: we already have weights for **2,164** of them in our database and can push them
to Shopify. But we need your answers first.

> **Q1: How do you actually ship?**
> - [ ] Live FedEx/UPS rates at checkout (needs weights + box sizes + account connected)
> - [ ] Flat rate — how much? ______________________
> - [ ] Free over a threshold, flat under
> - [ ] Quote shipping manually after the order

> **Q2: The site says "Free shipping on orders above $99."** Is that real and current?
> (Our internal notes elsewhere say **$199** — these contradict.) → **$______**
> And is it set up in Shopify, or just written on the website?

> **Q3: Which carrier(s) and whose account?** FedEx / UPS / USPS / freight for pallets?
> Do we have the account number to connect?

> **Q4: Box and packing weights.** We know bottle weights, but not:
> - What boxes do you ship in? (sizes) ______________________
> - Packing material weight per box? ______________________
> - Do you ship loose units, or only full cases? ______________________

> **Q5: Large orders.** At 3,000+ units this becomes pallets/LTL freight, not parcel.
> At what quantity does it stop being a normal shipment? ______________________

> **Q6: Where do you ship from?** One warehouse (Union City) or multiple? Any regions or
> countries you *won't* ship to? ______________________

> **Q7: Lead times.** The site says "1–3 business days." Still accurate? Different for
> large orders? ______________________

---

## ⚙️ Accounts & access we need from you

| Item | Why we need it | Status |
|---|---|---|
| **Shopify test mode** | So we can demo a complete purchase without a real charge | You toggle in Shopify admin |
| **Clerk production instance** | Login currently runs in "development mode" — customers would see that badge | Needs DNS + your Google sign-in credentials |
| **Google Cloud OAuth credentials** | ⚠️ "Sign in with Google" **will break** the moment we go to production without this | Need a Google Cloud account |
| **Working OpenAI key** | Grace's chat is dead in production right now (key rejected) | Need a valid key + billing |
| **Shopify API permission** | We can't read your shipping settings — permission is missing | Enable `read_shipping` |
| **Who gets orders?** | Order confirmation + notification emails | ______________________ |

---

## 📋 Business questions we can't answer for you

**Portal / accounts**
> Customers who sign up on their own currently reach a portal they can't use — it needs a
> company account attached.
> - [ ] Invite-only (you approve each customer) ← *recommended, works today*
> - [ ] Anyone can sign up and self-serve

**Claims on the website** — these are legal/regulatory, so we need certainty:
> - Site says products are **"sourced and warehoused domestically in the USA"** with a
>   **"domestic supply chain."** Is that accurate? *("Made in USA" claims are FTC-regulated —
>   if the glass is imported, this has to change.)* → ______________________
> - Free shipping threshold: **$99 or $199?** → ______________________
> - "Over two decades of expertise" — correct? → ______________________

**Returns & terms**
> - Return window and restocking fee? ______________________
> - Who pays return shipping? ______________________
> - Minimum order? Any SKU-level minimums? ______________________

**Tax**
> - Is Shopify tax calculation configured for the states you sell into?
> - How are tax-exempt wholesale customers handled at checkout? ______________________

**Domain**
> - Launch means pointing **bestbottles.com** at the new site. Confirmed? Who controls DNS?
> - When? ______________________

---

## ✅ Already handled — no action needed

- Checkout works across **all 39 product families** and every price tier (42/42 tested)
- 1-piece pricing matches Shopify exactly (0 mismatches in 150 checked)
- Catalog is clean: no duplicate SKUs, no orphans, 2,330 products / 356 groups
- Grace's product knowledge is accurate (36/36 retrieval tests)
- Login redesigned to live inside the Best Bottles site; "Secured by Clerk" removed
- Account settings now editable inside the portal
- Site builds clean, 303 automated tests passing

---

## Two things to delete

- **A test page is live and purchasable**: `/products/webhook-test-hmac` — titled
  "HMAC integration test." Google can index it. OK to delete?
- **Four empty product pages** (2 vial, 2 cylinder) with prices but no actual products.
  Delete, or should they have inventory?
