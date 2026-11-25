# Small glass bodies, 24 Nov 2026

Jordan's request: "we need to redo these bottle bodies use the hub image gen if need". This covers the 1 ml plug vials, the 2 ml 8-425 and 13-425 vials, the 3 ml green and blue 13-425 vials, the 3 ml tola and the 3 ml spray (lotion) bottle.

The PSD library has these sizes only as small photographs. Vial glass is about 190 px wide in 472×945 documents, and the 1 ml vial is about 95 px wide. The cards drew that glass soft and flat. Each body was re-shot once with the Asala Brand Hub's `generate_media` (GPT Image 2.6 Sunburst, edit, brand kit off). The only input was the card's current glass, upscaled onto the bone background, and the model kept that outline to within 2–3 px. The result was then cut with the original glass's own alpha. Caps, plugs, applicators and sprayer heads are unchanged.

**Every body below is AI-generated, geometry-locked to PSD or approved glass.** No PSD in the library has these glasses at a usable size.

| Card | SKUs | Glass geometry from | New glass | Hub asset |
|---|---|---|---|---|
| 1 ml amber plug vial | GB1mlAmbVBlk, GB1mlAmbVialWht | PSD `12. Vials/1. 1ml Amber PSD Capped` (approved kit) | generated | 6f40c063-b5a0-4dda-af17-8ec2a82d8df7 |
| 1 ml clear plug vial | GB1mlVBlk, GB1mlVWht | Amber outline redrawn clear on 3 Nov (approved kit) | generated | 44265412-f123-4d01-beec-aaf8e74774a4 |
| 2 ml amber 8-425 | GBVAmb2WhtCap, GBVAmb2BlackCap | Approved kit (slimmed 3 Nov) | generated | ddc18333-e27a-4e17-8c9b-166314fecec0 |
| 2 ml clear 8-425 | GBVialClr2mlWhtCap, GBVialClr2mlBlackCap | Approved kit (slimmed 4 Nov) | generated | 0dd41da3-f155-4a51-97a7-e74b93ff4fff |
| 2 ml amber 13-425 (hero) | GBVialAmb1o5WhtCapSht, GBVAmb1o5BlackCapSht | PSD `5. 13-415 Bottles/22. GB 1o5 Amber` (Layers 6+7) | generated, swapped into the approved hero photos | 1dd1d613-ac95-4be0-bc0b-a7f38c74fc32 |
| 3 ml green 13-425 | GBVGreen2o4BlackCapSht, GBVGreen2o4WhtCapSht | Approved kit (PSD glass) | generated | e3d85e37-24d6-44b5-be73-2c6ed89642d9 |
| 3 ml blue 13-425 | GBVBlu1o9BlackCapSht | Approved kit (PSD glass) | generated | e3fde895-d18b-4c87-814c-0b63d8a6b8cb |
| 3 ml clear tola | GB3TPlGl | PSD `16. 14.3mm/Uncapped/GB3TPlGl..psd` (glass + applicator stem) | generated | 8516cbd2-7a61-4f6d-90d6-9ba67dd8aa9f |
| 3 ml clear spray | LB3mlClear | PSD `18. …/LB3mlClear.psd` (bottle + sprayer) | generated | e3e6f188-61a5-467e-aaf8-60fb5d0dd1e3 |

The caps (8-425 and 13-425 screw caps, the 1 ml plugs and rods, the tola's gold jewel cap and the spray overcap) are the approved PSD layers, untouched.

- `before-after.jpg`: whole card image areas, production on the left and this branch's local production build on the right.
- `before-after-detail.jpg`: the same screenshots cropped to the bottle.

Rebuild: `python3 scripts/diva-vial/small-glass-bodies.py prep <work>`, then put the Hub outputs in `<work>/<key>.raw.png`, run `… build <work>` and `node scripts/paperdoll/publish-small-glass-bodies.mjs --apply`.
