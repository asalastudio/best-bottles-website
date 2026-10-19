# Manual browser checks — local repair branch

Prepared 13 October 2026. All results start pending.

## Open

Local preview: http://localhost:3005/

Server reported Ready. The agent has not loaded or inspected this site because browser permission is denied. If it does not open, record the visible error. Avoid changing database settings to address an app-level browser denial.

Production comparison: https://best-bottles-website.vercel.app/

Local source repairs and production can differ. Record which environment you checked. Newly rebuilt Boston and other pilot assets are offline review candidates; they are **not** installed in the public component register. Do not expect them to appear in the preview yet.

## First pass: customer-visible reports

| Check | Action | Pass evidence |
|---|---|---|
| Footer | Click Help me choose; return and click Talk with Grace | Builder opens; Grace panel opens without jumping to an absent page section |
| Round78 frosted | Open /products/round-78ml-frosted-18-415-perfumespray?cap=shiny-silver | Exact selected finish; inspect mechanism/tube at zoom; no horizontal line behind bottle. Artwork quality remains a known open review |
| Boston15 amber dropper | Open /products/boston-round-15ml-amber-18-400-dropper?cap=white | White dropper identity, no misleading view change on a flat PHOTO fallback; document scraps, collar and pipette |
| Boston15 cobalt dropper | Open /products/boston-round-15ml-cobalt-blue-18-400-dropper?cap=black | Cobalt body and black dropper agree with selected option and product identity |
| Stationary glass rail | On a page with multiple glass options, take screenshot, select each option and take another | Options retain order and location; only selection and matching product change |
| Builder starting tiles | Open /matrix; inspect Cylinder 25, 50 and 100 ml entries where offered | Image visible, correct capacity/neck, no wrong substitute |
| Cylinder5 fitments | Enter from Glass Spray Bottles; record scoped choices, then use Explore all fitments | Scope is visible; evaluate roll-on/short-cap availability in the unscoped path before classifying a missing option |
| All Boston | Use boston-manual-results.csv and inspect every offered finish on PDP and Builder | Exact SKU, glass, cap and supported views agree; no clipping or misleading buttons |
| Loading recovery | In your browser, use offline then online if comfortable; preserve selected options | Images recover without resetting bottle/finish; capture any persistent failure |
| Product handoff and cart | From an exact PDP selection open Builder, complete an offered build, and add it to your cart | SKU/finish/quantity/image agree throughout. Stop before payment; remove only the test item you added |

## Supported views

Only test views that the product actually supports. A flat photo cannot truthfully offer multiple component views. Under the existing assembled-dropper policy, some droppers support Cap On only. Short caps may support Sidecar, Cap On and Exploded when a complete kit is available. An unsupported view must be hidden/disabled or clearly labelled; a selected button with unchanged old photo is a failure.

## Devices and receipts

Run the first pass on desktop and a physical iPhone in Safari. Desktop mobile emulation does not close the physical-device gate.

For each failure return:
- Environment and full URL.
- Visible item code, glass and finish.
- Device/browser.
- Steps and expected versus actual result.
- Screenshot before/after; loading behavior if relevant.

Use PASS, FAIL, NOT OFFERED, NOT APPLICABLE or BLOCKED, with evidence. Keep artwork approval separate from successful loading. Review the offline Boston contact sheet separately; an offline sheet does not close PDP/Builder acceptance.

The first pass is prioritization. It does not replace the existing all-SKU acceptance matrix or release verification.
