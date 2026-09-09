# Non-plated media reconciliation

Live evidence: `2026-09-08T15:47:48.667Z` at commit `39a9b92f94da91fea1577d4af1ae15a2fee9d49c`.

All **660** website SKUs without a direct exact-plate row were matched to the live media audit.

| State | SKUs | Required action |
| --- | ---: | --- |
| Healthy remote image only | 397 | Preserve the current exact image as a permanent SKU plate. |
| Working local fallback | 17 | Promote the verified fallback into the exact plate index. |
| Exact plate under an alternate SKU key | 4 | Reconcile the website/Grace SKU key without changing the image. |
| Source match pending | 124 | Review identity and source comparison before creating a plate. |
| No verified source | 118 | Recover from the legacy site or master asset library. |

This report is an inventory and release aid. It does not publish or mutate catalog media.
