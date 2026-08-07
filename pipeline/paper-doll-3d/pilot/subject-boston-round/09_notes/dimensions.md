# Boston Round - dimensional record (VERIFIED)

Updated: 2026-08-06 (revision 2 - OPEN-1 resolved, see CORRECTION below)
Source: docs/reviews/audit-2026-08-06/live-site-full-scrape.json
        (full www.bestbottles.com scrape, 2309 products, captured 2026-08-06)

| Size | Neck | H without cap | Diameter | H with cap (varies by closure) |
|---|---|---|---|---|
| 15 ml | 18-400 | **68 +/-1 mm** | 25 +/-0.5 mm | 72 (short cap) / 91 (dropper) |
| 30 ml | 20-400 | **78 +/-1 mm** | 33 +/-0.5 mm | 97 (roller) / 102 (dropper) |
| 60 ml | 20-400 | **94 +/-1 mm** | 39 +/-0.5 mm | 110-111 (roller) / 117 (dropper) |

**Bare height is the only closure-independent figure, and it is the only one
the body model should ever be built from.** Capped height is a property of the
closure, not the bottle.

## CORRECTION - supersedes revision 1

Revision 1 recorded the 30 ml bare height as 68 mm and declared "15 ml and
30 ml are the SAME HEIGHT". **Both statements were wrong.** They came from a
single product page that is the lone outlier in its family.

Evidence for 78 mm, from the 53 live 30 ml rows:

| capped | bare | n | closure |
|---|---|---|---|
| 97 | **78** | 36 | metal roller ball |
| 102 | **78** | 14 | dropper |
| 78 | **78** | 2 | short black cap (amber, cobalt) - capped figure miskeyed |
| 78 | 68 | **1** | short black cap (clear) - the outlier |

52 of 53 rows say 78. The single dissenter is `GBBstn1ozBlkCapSht`, which is
exactly the SKU revision 1 sampled.

The three short-cap siblings are the tell: same bottle, same cap, differing
only in glass colour. All three carry the number 78 - but the clear one files
it under *capped* and puts 68 under *bare*, while amber and cobalt duplicate
78 into *both*. The consistent reading is that **78 is the bare height** and
the short-cap capped figure (~86-88 mm) is simply absent from all three rows.

Two independent cross-checks agree:

1. **Industry standard.** A 1 oz Boston Round is 3.06 in x 1.31 in =
   77.7 mm x 33.3 mm. The whole series matches: 2 oz = 3.69 x 1.55 in ->
   94/39; 1/2 oz = 2.68 x 0.98 in -> 68/25.
2. **"Item Depth" (was OPEN-4).** 30 ml depth 73, 60 ml depth 88 - in both
   cases bare height minus ~5-6 mm. Under the 68 mm hypothesis the 30 ml
   depth would *exceed* the bottle's height, which is impossible. Under
   78 mm it is a consistent offset. Still do not model to it, but it is no
   longer the incoherent field revision 1 described.

The physical argument in revision 1 inverts on inspection: 78 mm bare gives a
brim capacity of ~41 ml on a 30 ml-labelled bottle, and a fill-to-shoulder
volume of ~34 ml. That is normal headspace. A 30 ml bottle whose brim capacity
were exactly 30 ml could not be filled.

## Also corrected: the "CATALOG DATA ERROR" note

Revision 1 claimed Nemat_Product_Catalog.csv was wrong to list the 15 ml at
91 mm capped, because "the live site says 72 mm". The live site says **both**:
91 mm on 13 of 16 SKUs (all droppers) and 72 mm on 3 (all short-cap). The CSV
figure was correct for dropper SKUs. The CSV's field-shifting problem is real
and still worth flagging to the catalog lane, but this particular number was
not an error.

## Derivation strategy - SUPERSEDED

Revision 1 derived 60 ml and 15 ml from a 30 ml base by scaling, with a
standing hazard that the neck must never be scaled with the body.

That approach is no longer needed. `scripts/paper-doll-3d/build-boston-round.py`
generates each capacity from its own parameter set, and the neck finish is an
independent parameter by construction - so the neck-scaling hazard cannot
occur. There are no derive factors to get wrong.

For reference, had scaling been kept, the corrected 30 -> 60 factors would be
Z x 1.2051 (94/78), XY x 1.1818 (39/33) - not the Z x 1.3824 in revision 1.

## Neck finishes (SPI 400 series)

| Finish | T (thread major) | I (bore) | Finish height |
|---|---|---|---|
| 18-400 | 17.53 mm | 13.51 mm | 9.65 mm |
| 20-400 | 19.53 mm | 15.49 mm | 10.31 mm |

These are standard SPI/GPI 400-series table values, not measured from a sample.

**They are fitment-critical, not cosmetic.** The bottle, the roll-on/dropper
fitment and the cap are separate configurator pieces. `I` is the bore the
fitment press-fits into; `T` is what the cap skirt closes over. A wrong figure
shows up as a floating or intersecting component, not as a subtle inaccuracy.

Because 15 ml is 18-400 while 30 and 60 ml are 20-400, **every fitment and cap
needs one variant per finish**. Verify against a closure supplier drawing
before modelling any mating part.

## Still unresolved

"Item Depth" - now internally consistent (bare height minus ~5-6 mm at both
sizes) but its meaning is still unconfirmed. Do not model to it. Worth asking
Nemat whether it is a carton dimension or a fill depth.
