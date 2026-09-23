# Best Bottles hero background standard

User locked September 23, 2026: all future hero generations use **sRGB #F5F3EF / RGB(245, 243, 239)**, with natural soft shadows preserved. This applies to Boston Round, Slim, Sleek, Diva and subsequent hero families, as well as remaining Elegant renders.

The canonical prompt block is `scripts/hero-families/background-standard.json`. The shared Sunburst helper appends it at the API boundary, so individual family prompts cannot accidentally omit it. Future family runners must use that helper or explicitly consume the same standard. The family manifest renderer records the standard hash and effective prompt hash with each new output. Existing approved images, source prompts and receipts remain unchanged.

Review every output on an exact bone canvas and sample unobstructed background pixels. Background gradients, tints and rectangular seams are defects. Preserve glass optics, highlights, product edges and soft shadows; they are not flat-background pixels. No blanket white replacement or global recoloring.

The frosted Elegant pilot demonstrated that specifying the hex code, even with a reference and mask, does not guarantee exact output pixels or unchanged artwork. A generated file remains pending background review until its actual pixels and shadow transitions are checked. This standard is a generation requirement, not a claim that the current Elegant backgrounds have been normalized or that the failed retouch is approved.
