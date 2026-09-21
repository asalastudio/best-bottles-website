# Team Hub product editor — spec v1.1 (2026-09-20)

**For:** the Best Bottles team, to confirm before it is switched on.
**What it is:** one staff-only screen, `/team/products`, where you look a product up and change what customers see on the website. It is the same line-item sheet as the public catalogue's *Line Items* view and the customer portal's catalogue, with **Edit** where the portal has *Add to order*. Those two pages do not change.

## Where product information lives

The website's catalogue (Convex) is the master copy of what a product **is**. Shopify is the master copy of **selling** it: checkout, orders, payment, tax, inventory counts. You edit product information **here**, not in Shopify admin — an edit made in Shopify admin does not reach the website.

## How product names work

The website **writes each product's name for you**, from its details: capacity, glass colour, family, what kind of product it is, and the SKU's finish — for example *46 ml Clear Diva Perfume Spray Bottle - Shiny Black*. That is why nearly 2,500 SKUs read as one tidy catalogue, and why you do not type names.

When a generated name is wrong or awkward, type a **Custom name** on the product. It replaces the generated part exactly as you wrote it, everywhere the name appears (catalogue, product page, customer portal, order pad). Each SKU's finish is still added after it, so *Diva Atelier Spray, 46 ml* becomes *Diva Atelier Spray, 46 ml - Shiny Black*. Clear the field and the generated name comes back. Each open product shows **"Customers see: …"** so you always know what is live.

(v1 changed here on 2026-09-20: the old *Display name* and *Item name* boxes were removed. They held imported legacy text the website only falls back to, so editing them changed nothing a customer saw.)

## What you can edit

On the product line (shared by all its SKUs):

| Field | Notes |
|---|---|
| Custom name (optional) | Leave empty to keep the generated name. See above. |
| Product description | The "About this product" text. If it is filled in it is shown for every SKU of the product; if it is empty, the selected SKU's item description is shown instead. |

Click a product line to open its SKUs. Each SKU has:

| Field | Notes |
|---|---|
| Item description | Shown on the product page when the product has no description of its own. |
| Price ladder | Up to five quantity breaks: quantity, price each. The 1-piece price is the first rung. Saving a new 1-piece price also updates Shopify, so checkout charges what the page shows. |
| Stock status | In Stock · Out of Stock · Available to order · Discontinued. |
| Case quantity | Whole number. |

## What you cannot edit here (on purpose)

SKU codes, family, capacity, glass colour, neck thread, applicator / fitment, which caps and pumps fit, images and plates. A wrong neck or fitment breaks compatibility across the catalogue, the builder and Grace. Ask whoever maintains the catalogue.

Adding a **new** product stays where it is: *Team Hub → New product*.

## Safety

- **Who:** anyone with Team Hub access. (v1 has one role. Say if prices should be limited to named people.)
- **Every change is recorded:** who, when, the old value, the new value. The history is on each line, and any entry can be **reverted** with one click.
- **No silent overwrites:** if someone else changed the same field since you opened it, your save is refused and you are shown their value.
- **Checks before saving:** a price must be a positive number; ladder quantities must rise and prices each must not rise; a custom name needs at least three characters.
- **Shopify price update:** if Shopify cannot be reached, the website price is still saved, the history line says *Shopify not updated*, and **Retry** is offered. Off until the 2026-09-20 webhook fix is live in production (`TEAM_HUB_SHOPIFY_PRICE_PUSH=1`).

## Known gaps

Grace's product cards name a single SKU without its product, so they keep the generated name even when a custom name is set.


The description is shown on the mobile product page and on the classic desktop layout. The **desktop guided layout** (the three-column page) has no place for it yet; where it should sit is a design decision, not made here.

## Questions for the team

1. Is one role enough, or should price changes be limited to certain people?
2. Which of these do you change most often? (Decides what v2 adds first: measurements, photos, bulk price changes, CSV import.)
3. Are there fields you edit today that are not on this list?
