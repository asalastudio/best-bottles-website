# Best Bottles — canonical data integrity audit

Generated 2026-09-01 23:49 by `scripts/paperdoll/audit.py` from the committed pipeline snapshots.
This audit reads; it changes nothing and relaxes no gate. Every number below is recomputed from
`data/paper-doll/*.json` and the live Convex index, not copied from an earlier report.

## Executive summary

| measure | count |
|---|---:|
| Convex products | 2477 |
| unique website SKUs | 2320 |
| duplicate website SKUs | 153 |
| products affected by a duplicate | 306 |
| exact matches | 2257 |
| approved aliases in use | 0 of 88 (all redundant — see §3) |
| near-misses (never publishable) | 49 |
| products with no PSD | 167 |
| products with no website SKU | 4 |
| publishable SKUs | 1967 |
| gate violations among publishable | 0 |
| distinct familyIds (publishable) | 129 |
| familyId collisions | 0 |
| products missing a neck finish | 60 |
| component compatibility edges | 70541 |
| COMPATIBILITY_INVALID edges | 0 |
| COMPATIBILITY_UNVERIFIED edges | 956 |
| plate rows | 280 |
| plate row conflicts (>1 per SKU) | 0 |
| plate index issues from the sweep | 49 |
| kit rows | 0 |
| source files inventoried | 12754 |
| unclassified source files | 0 |
| selection conflicts (SAME_STEM_DIFFERENT_PHOTOGRAPH) | 25 |
| token spelling collisions | 0 |
| ambiguous body tokens | 14 |
| human-review items | 188 |

**Determinism verdict: the publishing path PASSES.** 1967 SKUs resolve to exactly one Convex document, one familyId and at most one plate row. The 153 duplicated website SKUs remain blocked, as does every near-miss.

## 1. Duplicate SKU report

153 website SKUs resolve to more than one Convex product document. Publishing to any of them
is blocked by `publish.mjs` (it refuses a SKU whose presence count is not exactly one) and reported by
`productPlates.integrity` as `products_duplicate_websiteSku`. None were merged or deleted by this audit.

| classification | count | meaning |
|---|---:|---|
| `SAME_SKU_IN_TWO_FAMILIES` | 82 | documents land in different families — one is misfiled, or they are different products |
| `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | 54 | different grace SKUs in one group — two real products, one SKU string |
| `SAME_SKU_DIFFERENT_GROUP` | 17 | same SKU across groups without a family split |

<details><summary>Every duplicated SKU (click to expand)</summary>

| websiteSku | kind | docs | Convex document ids | grace SKUs | group(s) | familyId(s) | recommended resolution | confidence |
|---|---|---:|---|---|---|---|---|---|
| `AnSp18-415IvyGl` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7eb4a9a6fvnhb98entc5h0t581v24t`<br>`kd7e9hr2csfg8yasy6487b2xvs86bjc3` | `CMP-SPR-GDIV-18-415-02`<br>`CMP-SPR-IVGD-18-415-01` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSp18-415IvySl` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd741hqcampjwg5bnsh66nchex81vczz`<br>`kd7b3cjs6w62v08jrvdm15fg3d86bqgj` | `CMP-SPR-IVSL-18-415-01`<br>`CMP-SPR-IVSL-18-415-04` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSp18-415Lvn` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7anwmhnmf45dqgmemweffp8d81vftk`<br>`kd714kxynfzr9fgtgn4b7v9sb186bge2` | `CMP-SPR-LVN-18-415-01`<br>`CMP-SPR-LVSL-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSp18-415MtSl` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7ap72dx52zvyzkfgbk5vnwsh81vfjb`<br>`kd730jrfcb0vhtq5zexjpk7tth86bka6` | `CMP-SPR-MSLV-18-415-01`<br>`CMP-SPR-MTSL-18-415-04` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSp18-415Red` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd79de1mhnabh8e7ms4gbwfet181tz25`<br>`kd75z7cyxfsek5a5z623bw7v9s86bgwh` | `CMP-SPR-RDSL-18-415-02`<br>`CMP-SPR-RED-18-415-01` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSp18-415Wht` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7dq0dhka01wge6eepfy1hgq981vc5c`<br>`kd7fcqvsbtt25pgsqyrq55tsd586bkp6` | `CMP-SPR-SLWH-18-415-02`<br>`CMP-SPR-WHT-18-415-01` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415Blk` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd762fh1ne0kk95wvr3r07g3x181tjfy`<br>`kd73n338x1cgskkxjrm4h3t0n586brp4` | `CMP-SPR-BKSLWH-18-415-02`<br>`CMP-SPR-BLK-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415IvyGl` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7dm97dts1cys39frk415gs0s81v3pn`<br>`kd7746vj5ncv38gma19xx8vsfn86b955` | `CMP-SPR-GDIVSLWH-18-415-02`<br>`CMP-SPR-IVGD-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415IvySl` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7djxwjjp841tfepxgj0bty2n81tkn0`<br>`kd71xt09tf7zhc858s2jpxzgf186b4p9` | `CMP-SPR-IVSL-18-415-02`<br>`CMP-SPR-IVSLWH-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415Lvn` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd73dndn4vw7d48aytw1z1wg8581ttje`<br>`kd73tdyqhf0xenwxb0da3zxkc186a9aa` | `CMP-SPR-LVN-18-415-02`<br>`CMP-SPR-LVSLWH-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415MtS` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd72by78z0kx33zbp20bghqpy181vpff`<br>`kd7232tts6eprx7rjv75q9c6ex86agys` | `CMP-SPR-MSLV-18-415-02`<br>`CMP-SPR-MTSLWH-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415Pnk` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd78ngb55khwmvp657kxeqe5q581vne9`<br>`kd72ychx336pgy6qxcg8c58dhx86a6ky` | `CMP-SPR-GDPKSLWH-18-415-02`<br>`CMP-SPR-PNK-18-415` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415Red` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7daxyma8tbeqe97z9ppwm8f981vjq3`<br>`kd77e05msgfb6scedfbz0726jx86b108` | `CMP-SPR-RDSLWH-18-415-02`<br>`CMP-SPR-RED-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `AnSpTsl18-415Wht` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7e6328a279960jy22fjm5fz181t3bh`<br>`kd7518bxzvmydj15zd7jty2pyd86bzp7` | `CMP-SPR-SLWH-18-415-04`<br>`CMP-SPR-WHT-18-415-02` | fine-mist-sprayer-18-415<br>vintage-bulb-sprayer-with-tassel-18-415 | `sprayer-18-415` | confirm which product group is correct | medium |
| `CP13-415SpryBlkMt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd72baqmp72ys1hmvztz5mk1w581t3vm`<br>`kd7693vt2epqqe2496hyg7x39n86a9ch` | `CMP-CAP-BLK-13-415-01`<br>`CMP-SPR-MTBK-13-415-07` | cap-closure-0ml-black<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SpryBlkSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7fv9jptth8sycbfevk9dm7hh81t1m5`<br>`kd78tay42z5gzp4z3sqxdebgfs86b32n` | `CMP-CAP-BLK-13-415-02`<br>`CMP-SPR-SHBK-13-415-07` | cap-closure-0ml-black<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SpryBluMt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd740pmxrjeycm4j4zb7d5cja181v80r`<br>`kd7b0etkc0tfa39dn1d0g7fb6h86bse5` | `CMP-CAP-13-415`<br>`CMP-SPR-MTBL-13-415-07` | cap-closure-0ml-blue<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SpryGlMt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7fh3qwsytnvqp8jd7h7echq581tntw`<br>`kd708gtr7htbsk971z4qayqc1986apqc` | `CMP-CAP-SGLD-13-415-02`<br>`CMP-SPR-MTGD-13-415-07` | cap-closure-0ml-gold<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SpryGlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7cr6yqfsxemgm3rd74zcf6ks81tm1y`<br>`kd73qaepcp2wtrkjrmxp1vrbc986b7v8` | `CMP-CAP-SGLD-13-415-03`<br>`CMP-SPR-SHGD-13-415-07` | cap-closure-0ml-gold<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SprySlMt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd76392bqmeh4kbzfm81283z5981vhd3`<br>`kd70ttdmakjxyh9026bsyvgshs86b8f6` | `CMP-CAP-SLV-13-415-02`<br>`CMP-SPR-MTSL-13-415-07` | cap-closure-0ml-silver<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `CP13-415SprySlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7213hha1xkgtw0tbys446sen81vrnn`<br>`kd7c8skbx1fvsa60vcqp0drrns86a1db` | `CMP-CAP-SLV-13-415-03`<br>`CMP-SPR-SHSL-13-415-07` | cap-closure-0ml-silver<br>fine-mist-sprayer-13-415 | `cap-closure-13-415`<br>`sprayer-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBAtom5Blk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7e49ntw6nw487m8fjmhez65d82fg67`<br>`kd7apc9jynjqdhxggavfx0sbe186ahs2` | `GB-CYL-BLK-5ML-ATM-BLK`<br>`GB-CYL-BLK-5ML-ATM-BLK-01` | atomizer-5ml | `atomizer-5ml-black-13-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBAtom5PnkDot` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd751ja1qr7zaad0xgnex8gjys82fwxs`<br>`kd7fxnd2qktjhv64seta8kw8eh86a2jf` | `GB-CYL-PNK-5ML-ATM-PNK`<br>`GB-CYL-PNK-5ML-ATM-PNK-02` | atomizer-5ml | `atomizer-5ml-pink-13-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBBell10MtlRollBlkDot` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7bt6p6mve9vf3z8bqfvj38hh820efp`<br>`kd774rnn3rkk3smtk0kk536j9s82ayk3` | `GB-BEL-CLR-10ML-MRL-BLDOT`<br>`GB-BLL-CLR-10ML-MRL-BDOT` | bell-10ml-clear-13-415<br>bell-10ml-clear-13-415-rollon | `bell-10ml-clear-13-415` | confirm which product group is correct | medium |
| `GBBell10RollBlkDot` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd761a97t8jj0bm0nwdnmgdtc1821kcd`<br>`kd736nen3kgkxrt5e7zng2qz5n82a76x` | `GB-BEL-CLR-10ML-ROL-BLDOT`<br>`GB-BLL-CLR-10ML-RBL-BDOT` | bell-10ml-clear-13-415<br>bell-10ml-clear-13-415-rollon | `bell-10ml-clear-13-415` | confirm which product group is correct | medium |
| `GBCrcl100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd70dyq5avn9a5w0y57prf5gpx81vxpa`<br>`kd7c1wcdk96j90fmdnpfvgj1yh86aabt` | `GB-CIR-CLR-100ML-RDC-SBLK`<br>`GB-CIR-CLR-100ML-RDC-SBLK-01` | circle-100ml-clear-18-415-reducer | `circle-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCrcl50RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bqh73a7y4bvwb8n47hz94z981vs73`<br>`kd7cafjqq7cp23m8h35f9r932h86bqw8` | `GB-CIR-CLR-50ML-RDC-MSLV`<br>`GB-CIR-CLR-50ML-RDC-MSLV-01` | circle-50ml-clear-18-415-reducer | `circle-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCrcl50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd78t61zjrq7b4neq3bqvf873s81v8eg`<br>`kd7ay22swne9wk7tht5maq38jn86b2q2` | `GB-CIR-CLR-50ML-RDC-SBLK`<br>`GB-CIR-CLR-50ML-RDC-SBLK-01` | circle-50ml-clear-18-415-reducer | `circle-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCrclFrst50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7epwae35gh02z7pns54361c981t94a`<br>`kd72z90yaffjgv50fnea5z3be986ajda` | `GB-CIR-FRS-50ML-RDC-SBLK`<br>`GB-CIR-FRS-50ML-RDC-SBLK-01` | circle-50ml-frosted-18-415-reducer | `circle-50ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCyl100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd73mj6k00g2v31cdmzdgv138d81t1a1`<br>`kd76rfaq3a35zw8zgqx2azycnx86ajzj` | `GB-CYL-CLR-100ML-RDC-MSLV`<br>`GB-CYL-CLR-100ML-RDC-MSLV-01` | cylinder-100ml-clear-18-415-reducer | `cylinder-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCyl100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd708r8hmb2mbjfef28n12grhh81vdn0`<br>`kd7656hhftpfrsjv2a719heg9h86ahtd` | `GB-CYL-CLR-100ML-RDC-SBLK`<br>`GB-CYL-CLR-100ML-RDC-SBLK-01` | cylinder-100ml-clear-18-415-reducer | `cylinder-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCyl50RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7ezyx761v45c0e7vb1ssra8581vvx4`<br>`kd7a3y0btqvr24m2hv8fsj24qx86aj5y` | `GB-CYL-CLR-50ML-RDC-MSLV`<br>`GB-CYL-CLR-50ML-RDC-MSLV-01` | cylinder-50ml-clear-18-415-reducer | `cylinder-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCyl50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7ahj8trp70z9z2g2w9v1xexx81vh98`<br>`kd755tjzwd7a06m6f36m8knffd86bawg` | `GB-CYL-CLR-50ML-RDC-SBLK`<br>`GB-CYL-CLR-50ML-RDC-SBLK-01` | cylinder-50ml-clear-18-415-reducer | `cylinder-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBCyl5WhtSht` | SAME_SKU_DIFFERENT_GROUP | 2 | `kd7227hkh2tsrhwwz9mg4hqjw985cf47`<br>`kd79f95zdhdvjr570v7j0yjb9s86a9zt` | `GB-CYL-WHT-5ML-WHT-S`<br>`GBCyl5WhtSht` | cylinder-5ml-clear-13-415<br>cylinder-5ml-clear-13-415-capclosure | `cylinder-5ml-clear-13-415` | confirm which product group is correct | medium |
| `GBCylSwrl9MtlRollWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7avtmhsf7k6hvfvkx8p5mbrh85c01x`<br>`kd735fdwxva2y8qgn91wmwvj2s86bzmd` | `GB-CYL-WHT-9ML-MRL-WHT`<br>`GBCylSwrl9MtlRollWht` | cylinder-9ml-clear<br>cylinder-9ml-swirl-17-415-rollon | `cylinder-9ml-clear-17-415`<br>`cylinder-9ml-swirl-17-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBCylSwrl9RollWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd777kxnjf1rv2vxj6h4bh95gx85cpjm`<br>`kd7etvxn1pc21d8th4gdy7y33n86bjpn` | `GB-CYL-WHT-9ML-ROL-WHT`<br>`GBCylSwrl9RollWht` | cylinder-9ml-clear<br>cylinder-9ml-swirl-17-415-rollon | `cylinder-9ml-clear-17-415`<br>`cylinder-9ml-swirl-17-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDiva100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd72gkj9tcg1e2zjtbdxzsyey581tkjt`<br>`kd7ded8vjbkq64mmw0mbg54pms86astb` | `GB-DVA-CLR-100ML-RDC-MSLV`<br>`GB-DVA-CLR-100ML-RDC-MSLV-01` | diva-100ml-clear-18-415-reducer | `diva-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDiva100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7e83mh9hd4p50xwsgy7z84ns81vn0z`<br>`kd74a0e0bqn3men8dn3wjvsfr186brm9` | `GB-DVA-CLR-100ML-RDC-SBLK`<br>`GB-DVA-CLR-100ML-RDC-SBLK-01` | diva-100ml-clear-18-415-reducer | `diva-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDiva30RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd79btbt29nxgn5ee1fznme0zn81vz0h`<br>`kd740dbc2gztsrdh5e2wpj61wx86ayts` | `GB-DVA-CLR-30ML-RDC-MSLV`<br>`GB-DVA-CLR-30ML-RDC-MSLV-01` | diva-30ml-clear-18-415-reducer | `diva-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDiva30RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd797139y6vesqtsw0wr4qz5xn81tv8c`<br>`kd7c8xrq2q7aj2e6wvbd5zh6a986aktt` | `GB-DVA-CLR-30ML-RDC-SBLK`<br>`GB-DVA-CLR-30ML-RDC-SBLK-01` | diva-30ml-clear-18-415-reducer | `diva-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDiva46RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd719048bqcnptqka1662yewkd81tkfp`<br>`kd72ym5b0r15dhfmxe4wvtmxe186a5xc` | `GB-DVA-CLR-46ML-RDC-MSLV`<br>`GB-DVA-CLR-46ML-RDC-MSLV-01` | diva-46ml-clear-18-415-reducer | `diva-46ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDiva46RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7dm4z79h58a5n3hd9f6wt8xs81txt3`<br>`kd7f9s0dxmng1p8tpv9p979em186bsjj` | `GB-DVA-CLR-46ML-RDC-SBLK`<br>`GB-DVA-CLR-46ML-RDC-SBLK-01` | diva-46ml-clear-18-415-reducer | `diva-46ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDivaFrst46AnSpBlk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70hfyxqshwbymcsac6a476vn81t02y`<br>`kd75d7d0kaskw9w9hd0y45gx6h86b0cc` | `GB-DVA-CLR-46ML-T-12`<br>`GB-DVA-FRS-46ML-T-12` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7a0evrpsjxncb5rbewhj2svd81t5td`<br>`kd733shtv2s83gnfr1kqez3das86aj12` | `GB-DVA-CLR-46ML-T-13`<br>`GB-DVA-FRS-46ML-T-13` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpIvyGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70jm98njezpbp7qp54qcaje981t63z`<br>`kd77jkchne66j8e5b9y4vbfc6s86ave8` | `GB-DVA-CLR-46ML-T-14`<br>`GB-DVA-FRS-46ML-T-14` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpIvySl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7b4zhvs1zcpcdt58vbsk4x5981tv7a`<br>`kd7dpnvt1btxmer32wgspd1awh86axqc` | `GB-DVA-CLR-46ML-T-15`<br>`GB-DVA-FRS-46ML-T-15` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpLvn` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7bkpmqdej4bvsbr8tskfqy3x81tpbw`<br>`kd7220gx894k73t31n7cmc5pg186byak` | `GB-DVA-CLR-46ML-T-16`<br>`GB-DVA-FRS-46ML-T-16` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpMtSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd72wn3yv8xc9b8b6cwrmjr5sn81vy9h`<br>`kd745afwpccb4j4f2fm428yw2186a931` | `GB-DVA-CLR-46ML-T-17`<br>`GB-DVA-FRS-46ML-T-17` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpPnk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75nseev62fvpqmk4z92j70x581t16f`<br>`kd76m3z2fqexc02mna1q8pqxz586avgf` | `GB-DVA-CLR-46ML-T-18`<br>`GB-DVA-FRS-46ML-T-18` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpRed` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7f47emgmvxn3402b6xt5f8q181tk3h`<br>`kd7av90kq62dbmztxpjrvqtprx86bz4m` | `GB-DVA-CLR-46ML-T-19`<br>`GB-DVA-FRS-46ML-T-19` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslBlk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd73wr9pbdfd7bsh99jetmdpch81v79e`<br>`kd7ff8c295akq9g9c6fxm2bwt186avs5` | `GB-DVA-CLR-46ML-T-20`<br>`GB-DVA-FRS-46ML-T-20` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70t9x9rk3vgsj06pmx753hws81ve17`<br>`kd792x38x9p2m1bc008c3jgtsx86b010` | `GB-DVA-CLR-46ML-T-21`<br>`GB-DVA-FRS-46ML-T-21` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslIvyGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75h5gm3p6f3xr1maqk5dhta581vbnm`<br>`kd72ktb23t1vhve423mqw7sv9h86aed2` | `GB-DVA-CLR-46ML-T-22`<br>`GB-DVA-FRS-46ML-T-22` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslIvySl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7edzasycvw8vg7yrpq83vr4181tczj`<br>`kd73pkgwhj4540mr8tz0ejcnv986a1hc` | `GB-DVA-CLR-46ML-T-23`<br>`GB-DVA-FRS-46ML-T-23` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslLvn` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd77zjncc9pe4dt54jrnfdzpps81t1q0`<br>`kd7dckcsp3e320r6e72m03g17h86brbj` | `GB-DVA-CLR-46ML-T-24`<br>`GB-DVA-FRS-46ML-T-24` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslMtSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7fdj7rg603qdm5wxdtpj1hwd81vk74`<br>`kd720sp90nxp63a67cjkatff0s86a5j3` | `GB-DVA-CLR-46ML-T-25`<br>`GB-DVA-FRS-46ML-T-25` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslPnk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7ee4szebapnc0gcx88y6f2p581vwke`<br>`kd72cs6sk6hykefrc39rrkdqa586btze` | `GB-DVA-CLR-46ML-T-26`<br>`GB-DVA-FRS-46ML-T-26` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslRed` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd71vv4t21fx8txtexcthh7nts81tt1t`<br>`kd7ff90v31qw7yk38pj2g2zhv986brp8` | `GB-DVA-CLR-46ML-T-27`<br>`GB-DVA-FRS-46ML-T-27` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpTslWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75m06963z2cr3bd5ssdjv8en81vcpk`<br>`kd73e57qs4rmhyyzshnfskyyr186b6v6` | `GB-DVA-CLR-46ML-T-28`<br>`GB-DVA-FRS-46ML-T-28` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray-tassel | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46AnSpWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7c0bcfcavz90vzp2wr1gr48d81vn0w`<br>`kd7cazt0c2aghs62mfnf1v7mt186bwj2` | `GB-DVA-CLR-46ML-T-29`<br>`GB-DVA-FRS-46ML-T-29` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-antiquespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrBlkLthr` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7edb3zzswgycwbsxrpn1q6s981v2ze`<br>`kd7cc6be8n6pmv8150xa32vt7186b5ed` | `GB-DVA-CLR-46ML-T-30`<br>`GB-DVA-FRS-46ML-T-30` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrBrwnLthr` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75pw64h0k39fy1mjnry5dbcd81tj2s`<br>`kd7bcry82m8b86em5ww1bs95yx86bgn1` | `GB-DVA-CLR-46ML-T-31`<br>`GB-DVA-FRS-46ML-T-31` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrIvyLthr` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7de8hbmjq28mr1qcvwxant4n81v3dy`<br>`kd709tngx0t54wzevy5ct2ghqd86a5vw` | `GB-DVA-CLR-46ML-T-32`<br>`GB-DVA-FRS-46ML-T-32` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrLBrwnLthr` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7cqr4feqn238t269261jvh2181t5re`<br>`kd7cqmvkxyph5easdfvgg0pd6986bpqd` | `GB-DVA-CLR-46ML-T-33`<br>`GB-DVA-FRS-46ML-T-33` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrMtSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd78hvdxfkvs0mhd4z69mqxthh81tf1j`<br>`kd7exe0g66ew3yy1vqge2kr6tx86atej` | `GB-DVA-CLR-46ML-T-34`<br>`GB-DVA-FRS-46ML-T-34` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrMtSlTall` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7djqt1jbc9py9e66h1mw0ykh81v4gs`<br>`kd7dmjxm20fahgyz6qcv7mfp8n86bf30` | `GB-DVA-CLR-46ML-T-35`<br>`GB-DVA-FRS-46ML-T-35` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrPnkLthr` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7f4d7wnn70ma1j7zzhf6ytvh81tzbm`<br>`kd78j6h67xtw523rfqfxss83ds86aty8` | `GB-DVA-CLR-46ML-T-36`<br>`GB-DVA-FRS-46ML-T-36` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrShnBlk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd77nw1mz8zjghqt3n5p8jkm7n81tq43`<br>`kd7cp5gj7gehdynmbfq4xjbng986a1fp` | `GB-DVA-CLR-46ML-T-37`<br>`GB-DVA-FRS-46ML-T-37` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrShnBlkTall` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70mwva40hwcgyyswfjjq0hsh81vdz7`<br>`kd7ay17wbwrjfqnh1rb6mbvvfh86ahwf` | `GB-DVA-CLR-46ML-T-38`<br>`GB-DVA-FRS-46ML-T-38` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrShnGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd73j29hvmx3y6n7ze9f4c02cx81vy6e`<br>`kd70r9snb3c8w9xnvf12tezad986byey` | `GB-DVA-CLR-46ML-T-39`<br>`GB-DVA-FRS-46ML-T-39` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrShnSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd77nkmxf82kp0jamdpz1p8fz581t8pn`<br>`kd78j3gcxey7zayacyv3tkmnm186bebs` | `GB-DVA-CLR-46ML-T-40`<br>`GB-DVA-FRS-46ML-T-40` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46RdcrWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7c3v6g2tazq4dpwgr2znd3y181ttrq`<br>`kd7dm3pyx50gxrcfedb1vw6jz186bb3v` | `GB-DVA-CLR-46ML-T-41`<br>`GB-DVA-FRS-46ML-T-41` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-reducer | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryCu` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75g29pfa3tqh91kdhypafkvd81tqxz`<br>`kd7e36x54zq6paw8145jynn7k986bk1x` | `GB-DVA-CLR-46ML-01`<br>`GB-DVA-FRS-46ML-01` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryMtGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd78g8218g9xd70jecba9kf0v581vk8s`<br>`kd73sgxgyzqme3xnqsh532re7d86b0y9` | `GB-DVA-CLR-46ML-02`<br>`GB-DVA-FRS-46ML-02` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryMtSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd78j9qejnza9fxefm6nbz5a1981v9nb`<br>`kd7f7f7zgw6d3am1aefw8c2y3586ae0e` | `GB-DVA-CLR-46ML-03`<br>`GB-DVA-FRS-46ML-03` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryShnBlk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd732nb05nxz3tbssf5j1epat581tgp1`<br>`kd7chz88rqmg8t0sm9jbxg4yf586aee9` | `GB-DVA-CLR-46ML-04`<br>`GB-DVA-FRS-46ML-04` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryShnGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd747aw97dbjrp1zfcxtnqg5dd81vm1y`<br>`kd776ct5x3njevesvz0gardwkd86a9kb` | `GB-DVA-CLR-46ML-05`<br>`GB-DVA-FRS-46ML-05` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDivaFrst46SpryShnSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75hcmgbxshvm1k2weycst0yh81v5y6`<br>`kd765jht7andz536zaee9nfwns86ben7` | `GB-DVA-CLR-46ML-06`<br>`GB-DVA-FRS-46ML-06` | diva-46ml-clear-18-415<br>diva-46ml-frosted-18-415-perfumespray | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBDmnd2ozRdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bwhs9cm4dqrked871z5ex3d81tg6e`<br>`kd7daxdb5502bdb7tyrsrkaxmx86bcgw` | `GB-DMD-CLR-60ML-RDC-MSLV`<br>`GB-DMD-CLR-60ML-RDC-MSLV-01` | diamond-60ml-clear-18-415-reducer | `diamond-60ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBDmnd2ozRdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7er0ntbeq8faqrc4pd5ew0ah81t7mp`<br>`kd7egtm2c14s6xp327apyesrxx86b7p8` | `GB-DMD-CLR-60ML-RDC-SBLK`<br>`GB-DMD-CLR-60ML-RDC-SBLK-01` | diamond-60ml-clear-18-415-reducer | `diamond-60ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElg100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bwzpra5rsejym4cr9xycz6d81v7hs`<br>`kd73yhmd3x93a34mwzb31qs38s86aas2` | `GB-ELG-CLR-100ML-RDC-MSLV`<br>`GB-ELG-CLR-100ML-RDC-MSLV-01` | elegant-100ml-clear-18-415-reducer | `elegant-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElg100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd77fbzf8gwsnss188k7mj17ah81tbvq`<br>`kd7dca1ersq1jc9z2hxgd1xcdd86bekm` | `GB-ELG-CLR-100ML-RDC-SBLK`<br>`GB-ELG-CLR-100ML-RDC-SBLK-01` | elegant-100ml-clear-18-415-reducer | `elegant-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElg60RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd71d8nvg90e3hzxzf66qb635h81vzdk`<br>`kd73fzf887mz9kst9agkp2648986a5fr` | `GB-ELG-CLR-60ML-RDC-MSLV`<br>`GB-ELG-CLR-60ML-RDC-MSLV-01` | elegant-60ml-clear-18-415-reducer | `elegant-60ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElg60RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7a1rn4c19djwhtt14xyxnk5981vzq1`<br>`kd7arzs2a8gnw7qpdvxcztayvd86aabe` | `GB-ELG-CLR-60ML-RDC-SBLK`<br>`GB-ELG-CLR-60ML-RDC-SBLK-01` | elegant-60ml-clear-18-415-reducer | `elegant-60ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElgFrst100AnSpWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7183bcf2h4y7hy1w6msznca981t332`<br>`kd7aj8yht89r9ytqsc9r0r6g9h86bm0w` | `GB-ELG-CLR-100ML-ASP-WHT-02`<br>`GB-ELG-FRS-100ML-ASP-WHT-02` | elegant-100ml-clear-18-415-finemist<br>elegant-100ml-frosted-18-415-antiquespray | `elegant-100ml-clear-18-415`<br>`elegant-100ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd71y6sm660jwj5zxrsare1z4h81t4me`<br>`kd7cdpktbv2eb4psvf869609bn86ads0` | `GB-ELG-FRS-100ML-RDC-SBLK`<br>`GB-ELG-FRS-100ML-RDC-SBLK-01` | elegant-100ml-frosted-18-415-reducer | `elegant-100ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElgFrst15BlkSht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7aj247919e8en2h2znacj6ds81ttjg`<br>`kd78yg1z495nec1decjy9hdjxh86bb03` | `GB-ELG-CLR-15ML-BLK-S-02`<br>`GB-ELG-FRS-15ML-BLK-S-02` | elegant-15ml-clear-13-415<br>elegant-15ml-frosted-13-415 | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15Gl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd779qqhwqhnvwnyj294s20kn581t86w`<br>`kd72varbb5ga209265cr9fqvk586aqhg` | `GB-ELG-CLR-15ML-SGLD-T`<br>`GB-ELG-FRS-15ML-SGLD-T` | elegant-15ml-clear-13-415<br>elegant-15ml-frosted-13-415 | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollBlkDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7f3zz7jz85f4ha5fg70k5jts81vxn8`<br>`kd79911yy82rt0kd9y8026wt7186bd7w` | `GB-ELG-CLR-15ML-MRL-BLK-01`<br>`GB-ELG-FRS-15ML-MRL-BLK-01` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollBlkSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd74e666ndtq9mwyye7sa1twqd81vd9k`<br>`kd78aa7525f24zpgv1jc6rnyt986a054` | `GB-ELG-CLR-15ML-MRL-BLK-02`<br>`GB-ELG-FRS-15ML-MRL-BLK-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollCuMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7btgzhtjkeh53h1d37gpj52n81tas8`<br>`kd7f5wzbfnqj2b5tv43f0mdehh86berd` | `GB-ELG-CLR-15ML-MRL-MCPR-02`<br>`GB-ELG-FRS-15ML-MRL-MCPR-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollGlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd74s8m7w6x8jj2q9ba8ah7zyh81tt5y`<br>`kd70z05dbvbwpa3jzncrddqpg986azmb` | `GB-ELG-CLR-15ML-MRL-SGLD-02`<br>`GB-ELG-FRS-15ML-MRL-SGLD-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollPinkDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7dp86cmnjhq361rma20xcf8s81vmpv`<br>`kd75gt3gsb92v8c4062sskebn586a7t3` | `GB-ELG-CLR-15ML-MRL`<br>`GB-ELG-FRS-15ML-MRL` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollSlDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7dvrqvna4w5km43gwz0e8kqd81v8tp`<br>`kd76cqzcvn3fz4v5kvkmt4nnq186begr` | `GB-ELG-CLR-15ML-MRL-SLV-01`<br>`GB-ELG-FRS-15ML-MRL-SLV-01` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollSlMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd71e4tpq5qfzx1rxpv5n7105n81t3n5`<br>`kd77fe4286ey01k4vrmqqp194n86a7xj` | `GB-ELG-CLR-15ML-MRL-MSLV-02`<br>`GB-ELG-FRS-15ML-MRL-MSLV-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15MtlRollSlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd72dhr0fgg9eyggpzdncb7r3d81t9sx`<br>`kd7bnhfsw5b9fafdms1cknc5h986a3tj` | `GB-ELG-CLR-15ML-MRL-SLV-02`<br>`GB-ELG-FRS-15ML-MRL-SLV-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollBlkDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7cjpxbrzrc3e2edpqtd7aq9h81v98a`<br>`kd76v0qs4yr9r0tc5z1jacmdds86b301` | `GB-ELG-CLR-15ML-RBL-BLK-01`<br>`GB-ELG-FRS-15ML-RBL-BLK-01` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollBlkSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd72h1kpv4evws9vnqjzbjkqkn81tcsx`<br>`kd77d3fs0r8nj6z4c205ywtgw586bv1n` | `GB-ELG-CLR-15ML-RBL-BLK-02`<br>`GB-ELG-FRS-15ML-RBL-BLK-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollCuMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd72tww7580t77rrtft6wfwgnd81vcah`<br>`kd7ckw9kxwjm7qj8xcrzntd38d86bvfk` | `GB-ELG-CLR-15ML-RBL-MCPR`<br>`GB-ELG-FRS-15ML-RBL-MCPR` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollGlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7dmqvg3xhw0w0cvpbefdtgkn81vevv`<br>`kd77d1t52hsjt1badrj46wcks986b9j8` | `GB-ELG-CLR-15ML-RBL-SGLD`<br>`GB-ELG-FRS-15ML-RBL-SGLD` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollPinkDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd71b3f1m0qhpc87xzp02s66dx81tw53`<br>`kd7em8rrz4bwpy3e3dgay3hw3n86a59n` | `GB-ELG-CLR-15ML-RBL`<br>`GB-ELG-FRS-15ML-RBL` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollSlDot` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd788b2887esazywmvvdahzew181vrqt`<br>`kd7c9jjfqm677hzrdnvgvt2c0h86b7ym` | `GB-ELG-CLR-15ML-RBL-SLV-01`<br>`GB-ELG-FRS-15ML-RBL-SLV-01` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollSlMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7aga1tgayt2a7d8cezhky4an81v5f8`<br>`kd7ass4f9jrf0gv7amn7zch88h86avty` | `GB-ELG-CLR-15ML-RBL-MSLV`<br>`GB-ELG-FRS-15ML-RBL-MSLV` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15RollSlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7bj125j821dm6sxb8rhz21fh81vaab`<br>`kd7b3v84ggnn3rdd6byv6k2n6d86b13c` | `GB-ELG-CLR-15ML-RBL-SLV-02`<br>`GB-ELG-FRS-15ML-RBL-SLV-02` | elegant-15ml-clear-13-415-rollon<br>elegant-15ml-frosted-13-415-rollon | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15Sl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7619akrz06dnxchgwjtgreb181vec1`<br>`kd7aeybydmat3vp80ryvza8xg186aqey` | `GB-ELG-CLR-15ML-SLV-T-02`<br>`GB-ELG-FRS-15ML-SLV-T-02` | elegant-15ml-clear-13-415<br>elegant-15ml-frosted-13-415 | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SpryBlkMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7ck7yh5y8j963fg3wcb92a0981v9vt`<br>`kd7ets0yj1y8qtsqnxcbzs165d86bgc6` | `GB-ELG-CLR-15ML-SPR-BLK-01`<br>`GB-ELG-FRS-15ML-SPR-BLK-01` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SpryBlkSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70rr1hw79bh72dthkhp676jx81tcp1`<br>`kd70vm2rff7369nnbjv2m61wbn86a5sf` | `GB-ELG-CLR-15ML-SPR-BLK-02`<br>`GB-ELG-FRS-15ML-SPR-BLK-02` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SpryBluMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7fcvc77kxp7167zcjk38c04181vdxm`<br>`kd74vhfg3ytv9n7mv5s4qe95q186a71w` | `GB-ELG-CLR-15ML-SPR`<br>`GB-ELG-FRS-15ML-SPR` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SpryCuMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd74efvsftm3e0gvcq9km722pd81tmhg`<br>`kd7aeft8m74r5kgkfsrye8dncs86basc` | `GB-ELG-CLR-15ML-SPR-MCPR-02`<br>`GB-ELG-FRS-15ML-SPR-MCPR-02` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SpryGlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7evce8zpkb0mwrf7s08trw3181t204`<br>`kd742dva14e19g2r2eky6pj6x986by3t` | `GB-ELG-CLR-15ML-SPR-SGLD-02`<br>`GB-ELG-FRS-15ML-SPR-SGLD-02` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SprySlMatt` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd76r4gp96tj94d2kpnppm435981vvrx`<br>`kd74rj8zqrvxyh7ejbhkedxd7h86a91h` | `GB-ELG-CLR-15ML-SPR-MSLV-02`<br>`GB-ELG-FRS-15ML-SPR-MSLV-02` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15SprySlSh` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7eb1c5mtwzny4qtqs5hj59yx81vd6g`<br>`kd78kgnccrx821dck1tkekmzr586apd0` | `GB-ELG-CLR-15ML-SPR-SLV`<br>`GB-ELG-FRS-15ML-SPR-SLV` | elegant-15ml-clear-13-415-finemist<br>elegant-15ml-frosted-13-415-finemist | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst15WhtSht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7de605ym5gpeb63gmspjbegh81t3vz`<br>`kd7fn2q8mtxywkdk43w20m64b586bzkb` | `GB-ELG-CLR-15ML-WHT-S`<br>`GB-ELG-FRS-15ML-WHT-S` | elegant-15ml-clear-13-415<br>elegant-15ml-frosted-13-415 | `elegant-15ml-clear-13-415`<br>`elegant-15ml-frosted-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst60AnSpWht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd73kw1jmprr1sy81tarz860qn81v1cw`<br>`kd78rmhxe1s7eqyj4vga1jbhy586a56e` | `GB-ELG-CLR-60ML-ASP-WHT-02`<br>`GB-ELG-FRS-60ML-ASP-WHT-02` | elegant-60ml-clear-18-415-finemist<br>elegant-60ml-frosted-18-415-antiquespray | `elegant-60ml-clear-18-415`<br>`elegant-60ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `GBElgFrst60RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7cmw8zpp5qew22kvxyhjp3zn81t93r`<br>`kd7ep9m74b8r71fje4c07n3xf186ay02` | `GB-ELG-FRS-60ML-RDC-MSLV`<br>`GB-ELG-FRS-60ML-RDC-MSLV-01` | elegant-60ml-frosted-18-415-reducer | `elegant-60ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBElgFrst60RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd77v76cbmztysfep5h75wksh981tmwd`<br>`kd75wb11j4mfyfd6jzg8dhr3yd86b7m9` | `GB-ELG-FRS-60ML-RDC-SBLK`<br>`GB-ELG-FRS-60ML-RDC-SBLK-01` | elegant-60ml-frosted-18-415-reducer | `elegant-60ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBEmp100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bb4akvewaxwqzxn2g2g1qss81v6d5`<br>`kd71drkqqztgasgx9vbfa4t27186bvxq` | `GB-EMP-CLR-100ML-RDC-MSLV`<br>`GB-EMP-CLR-100ML-RDC-MSLV-01` | empire-100ml-clear-18-415-reducer | `empire-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBEmp100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7878ww43fyc1f32s2474a79181v8h0`<br>`kd795y26wmybz9y9cphdzs7zb186bqrt` | `GB-EMP-CLR-100ML-RDC-SBLK`<br>`GB-EMP-CLR-100ML-RDC-SBLK-01` | empire-100ml-clear-18-415-reducer | `empire-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBEmp50RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7dwrz146qs1ac0qg5v2em0v981t3ft`<br>`kd78k2mr1q3q6etzy7xqqcatyn86b4d5` | `GB-EMP-CLR-50ML-RDC-MSLV`<br>`GB-EMP-CLR-50ML-RDC-MSLV-01` | empire-50ml-clear-18-415-reducer | `empire-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBEmp50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7e442jt3sh1cmqmv8v71shqh81tn7r`<br>`kd7dr6k2cq74kxvce1h2d9ar9586a4wz` | `GB-EMP-CLR-50ML-RDC-SBLK`<br>`GB-EMP-CLR-50ML-RDC-SBLK-01` | empire-50ml-clear-18-415-reducer | `empire-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBGrce55RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7f09194q9ggz94t82bkd7x3981v3hp`<br>`kd7d24m11yry047e3tcjayftm586b40q` | `GB-GRC-CLR-55ML-RDC-MSLV`<br>`GB-GRC-CLR-55ML-RDC-MSLV-01` | grace-55ml-clear-18-415-reducer | `grace-55ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBGrce55RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd70j0atvmhp3es3g1fvmxxhs581v0tm`<br>`kd73yrwzqk8a9gz9gjnh90fm0h86axtn` | `GB-GRC-CLR-55ML-RDC-SBLK`<br>`GB-GRC-CLR-55ML-RDC-SBLK-01` | grace-55ml-clear-18-415-reducer | `grace-55ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRnd128RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7179e7vw2w7ynnemkypq89es81v3hh`<br>`kd7aw6ratpb8bj3fpyemyez1qd86a4gt` | `GB-RND-CLR-128ML-RDC-MSLV`<br>`GB-RND-CLR-128ML-RDC-MSLV-01` | round-128ml-clear-18-415-reducer | `round-128ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRnd128RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd799hkbvv0jhg8rv5s0b1wh7s81trcp`<br>`kd75stehtjnfek2frwhq076ab986aqmn` | `GB-RND-CLR-128ML-RDC-SBLK`<br>`GB-RND-CLR-128ML-RDC-SBLK-01` | round-128ml-clear-18-415-reducer | `round-128ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRnd78RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7e95s3jeqxczdcdanre6h3mx81vde9`<br>`kd70yry0m5hhfdv5stnbwh3ha586agvc` | `GB-RND-CLR-78ML-RDC-MSLV`<br>`GB-RND-CLR-78ML-RDC-MSLV-01` | round-78ml-clear-18-415-reducer | `round-78ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRnd78RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bf4w0rrf61q4q80rsaxs4m981t6qs`<br>`kd79v2ke7q3k4j3wrj2sjsyfp986bxvg` | `GB-RND-CLR-78ML-RDC-SBLK`<br>`GB-RND-CLR-78ML-RDC-SBLK-01` | round-78ml-clear-18-415-reducer | `round-78ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRndFrst128RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7b1y3zg3y1q17kwkk238wtys81va90`<br>`kd79n5w3jt031w3gr8033v5w6986bh8j` | `GB-RND-FRS-128ML-RDC-MSLV`<br>`GB-RND-FRS-128ML-RDC-MSLV-01` | round-128ml-frosted-18-415-reducer | `round-128ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRndFrst128RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7fwjwrjx46qn9mescy9trs6h81tx9y`<br>`kd7cjnac11yntc8j216eekwags86bkyy` | `GB-RND-FRS-128ML-RDC-SBLK`<br>`GB-RND-FRS-128ML-RDC-SBLK-01` | round-128ml-frosted-18-415-reducer | `round-128ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRndFrst78RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7090fm9h7r26h1qh1wfdtqqx81veeb`<br>`kd7b0fxte1xbafqebggsfp8thn86b9mc` | `GB-RND-FRS-78ML-RDC-MSLV`<br>`GB-RND-FRS-78ML-RDC-MSLV-01` | round-78ml-frosted-18-415-reducer | `round-78ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBRndFrst78RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd72vz1w9h97p0w3tsqpkxs84h81tjvh`<br>`kd7c9zyyynabrxmh6fs2ce6ghs86ab5m` | `GB-RND-FRS-78ML-RDC-SBLK`<br>`GB-RND-FRS-78ML-RDC-SBLK-01` | round-78ml-frosted-18-415-reducer | `round-78ml-frosted-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7bkxjsjzyze3hs6twqbfn0xx81vret`<br>`kd703tqs61ryhmve9wdk78q8t986ahfm` | `GB-SLK-CLR-100ML-RDC-MSLV`<br>`GB-SLK-CLR-100ML-RDC-MSLV-01` | sleek-100ml-clear-18-415-reducer | `sleek-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7ea7mvvba3rk0dw2bqtk7j1h81txeq`<br>`kd71nevfpx4w2wpc55pd545m6x86bgyf` | `GB-SLK-CLR-100ML-RDC-SBLK`<br>`GB-SLK-CLR-100ML-RDC-SBLK-01` | sleek-100ml-clear-18-415-reducer | `sleek-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk30RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd75katqbhs7v8g33gp3wcncyn81vygb`<br>`kd7bs1ksjf7nrjz88rtz6f01ws86bpxx` | `GB-SLK-CLR-30ML-RDC-MSLV`<br>`GB-SLK-CLR-30ML-RDC-MSLV-01` | sleek-30ml-clear-18-415-reducer | `sleek-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk30RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd71km6xydfschramz7egvg5gn81vagq`<br>`kd7f6h59et3m4022zqpacmn9cx86bw5g` | `GB-SLK-CLR-30ML-RDC-SBLK`<br>`GB-SLK-CLR-30ML-RDC-SBLK-01` | sleek-30ml-clear-18-415-reducer | `sleek-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk50RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd731yycvne2k989bjjjx0cd0h81v7qs`<br>`kd70bre44mf3pahcezc68jtzeh86bvcs` | `GB-SLK-CLR-50ML-RDC-MSLV`<br>`GB-SLK-CLR-50ML-RDC-MSLV-01` | sleek-50ml-clear-18-415-reducer | `sleek-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlk50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd75xdpgxbjxcv7bw6e8r6shbn81vt7w`<br>`kd7a5yt4k0r7be6msp5zky7rf986a0vt` | `GB-SLK-CLR-50ML-RDC-SBLK`<br>`GB-SLK-CLR-50ML-RDC-SBLK-01` | sleek-50ml-clear-18-415-reducer | `sleek-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm100RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd79tc2rj6q11xpgy8xf4nv2rh81taxv`<br>`kd7a65b0eeqhzzpnnszq70y2b586a26a` | `GB-SLM-CLR-100ML-RDC-MSLV`<br>`GB-SLM-CLR-100ML-RDC-MSLV-01` | slim-100ml-clear-18-415-reducer | `slim-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm100RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7byn3bfy71kp4vz3brxwvhb981v20y`<br>`kd77cydbd9gpnbq36pewh5w9ms86aqps` | `GB-SLM-CLR-100ML-RDC-SBLK`<br>`GB-SLM-CLR-100ML-RDC-SBLK-01` | slim-100ml-clear-18-415-reducer | `slim-100ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm30RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd75ccyppvj5h0sxtymp3j022s81ta5a`<br>`kd7cf3h0gvhhqfaq4tb1t2z2kx86a41v` | `GB-SLM-CLR-30ML-RDC-MSLV`<br>`GB-SLM-CLR-30ML-RDC-MSLV-01` | slim-30ml-clear-18-415-reducer | `slim-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm30RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7es0spqa3c300k1yx4yeaa6581tps2`<br>`kd786qgw1jyrbp2zjmz3g2p07986abyk` | `GB-SLM-CLR-30ML-RDC-SBLK`<br>`GB-SLM-CLR-30ML-RDC-SBLK-01` | slim-30ml-clear-18-415-reducer | `slim-30ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm50RdcrMtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd7byjsxspa1tx9cpyt9y6wrv981tmr5`<br>`kd79r3731ta66meagvzpe4wc4d86bxxd` | `GB-SLM-CLR-50ML-RDC-MSLV`<br>`GB-SLM-CLR-50ML-RDC-MSLV-01` | slim-50ml-clear-18-415-reducer | `slim-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBSlm50RdcrShnBlk` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd77v4jqq9jbmwjyn52mkddc4581t7ag`<br>`kd7d6x98vn3xg5xnb3bwfthadh86ak1n` | `GB-SLM-CLR-50ML-RDC-SBLK`<br>`GB-SLM-CLR-50ML-RDC-SBLK-01` | slim-50ml-clear-18-415-reducer | `slim-50ml-clear-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `GBTallCyl9WhtSht` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd74mjjja5crmqbxhpvhywx6rx85dhg9`<br>`kd705fptk7jhjk32h6mpne304n86anhf` | `GB-CYL-WHT-9ML-WHT-S`<br>`GBTallCyl9WhtSht` | cylinder-9ml-clear-13-415<br>tall-cylinder-9ml-clear-13-415-capclosure | `cylinder-9ml-clear-13-415`<br>`tall-cylinder-9ml-clear-13-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnClOvrCap` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd795ajpv3npb445xk1a6j7pxn81v8e2`<br>`kd7fg3t3jtz4s1c1cnhdv1dhqd86a8sv` | `LB-DVA-CLR-46ML-T`<br>`LB-DVA-FRS-46ML-T` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnCu` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd70j00415y81rj3dw1mwmyk2n81v20r`<br>`kd70spzkm17nsdmj4gfn4eg8rs86ba3q` | `LB-DVA-CLR-46ML-01`<br>`LB-DVA-FRS-46ML-01` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnMtGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd79kv2gt1wyn8bw4fcqakres581t4k8`<br>`kd7cymqc91m673k2cnwfqtk4rd86b5t3` | `LB-DVA-CLR-46ML-02`<br>`LB-DVA-FRS-46ML-02` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnMtSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd776rc2nadyqe02wpk0xpahfs81vnre`<br>`kd73t42k6f1eh66wtrpate902d86baky` | `LB-DVA-CLR-46ML-03`<br>`LB-DVA-FRS-46ML-03` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnShnBlk` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd7bhvr1ze3bbne8v6e4q2esdx81trnm`<br>`kd7c2sz2gre0ksmretdemr3fx186b0gs` | `LB-DVA-CLR-46ML-04`<br>`LB-DVA-FRS-46ML-04` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnShnGl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd75bsdf544zhkaxzpvmk1htnd81vyxm`<br>`kd75s0d4ptcdhk6537df5x5rqx86a9hp` | `LB-DVA-CLR-46ML-05`<br>`LB-DVA-FRS-46ML-05` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `LBDivaFrst46LtnShnSl` | SAME_SKU_IN_TWO_FAMILIES | 2 | `kd729dyh6ak7r0cwdyj6p9wf3s81th9k`<br>`kd70926p7hmhppth0xyx0a216x86ar41` | `LB-DVA-CLR-46ML-06`<br>`LB-DVA-FRS-46ML-06` | diva-46ml-clear-18-415-lotionpump<br>diva-46ml-frosted-18-415-lotionpump | `diva-46ml-clear-18-415`<br>`diva-46ml-frosted-18-415` | decide which family owns the SKU; the other document is misfiled or a different product | high |
| `Ltn18-415Cu` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd784ex2me3vvcd85vy4a1a6js81thdk`<br>`kd76dv8ryhmw422r42arph4b2d86bap8` | `CMP-LPM-CPR-18-415`<br>`CMP-LPM-MTCP-18-415-05` | lotion-pump-18-415 | `lotion-pump-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `Ltn18-415MtGl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd77fjwrtm2y66dsm6a968d8w181tc1a`<br>`kd7553gm0bzb8kh19dkxmtpxrd86ajxa` | `CMP-LPM-MGLD-18-415`<br>`CMP-LPM-MTGD-18-415-07` | lotion-pump-18-415 | `lotion-pump-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |
| `Ltn18-415MtSl` | DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU | 2 | `kd77x3d2kkebyajsdjqje2g1a981tq25`<br>`kd756cjgha8qagambzbryt2t8586ar2g` | `CMP-LPM-MSLV-18-415-01`<br>`CMP-LPM-MTSL-18-415-06` | lotion-pump-18-415 | `lotion-pump-18-415` | assign a distinct website SKU to each product, or retire the surplus | high |

</details>

Evidence for every row: `data/paper-doll/convex-snapshot.json`, products sharing one `websiteSku`.
Full machine-readable detail including the per-field spread is in `data/paper-doll/audit-findings.json`.

## 2. Family integrity report

`familyId` was recomputed from product and group fields for all 2477 products using the
implemented grammar `<family>-<capacityMl>ml-<color>-<neck>` (components: `<family>-<neck>`).

**No `FAMILY_ID_COLLISION`.** No two neck finishes recompute to the same familyId — the neck segment is
doing its job. This is the check that matters most, because dropping the neck would silently merge
physically incompatible families.

**17 family/capacity/colour combinations legitimately span more than one neck** and stay
separate under the grammar:

| family-capacity-colour | necks |
|---|---|
| `apothecary-30ml` | clear-ground, green-ground |
| `atomizer-10ml` | black-17mm, clear-17mm, green-17mm, pink-17mm |
| `atomizer-5ml` | black-10mm, clear-10mm |
| `cap-closure` | 13-415, 13-425, 18-400, 18-415, 20-400, 22-400, 24-400, 8-425, press-fit |
| `circle-50ml-frosted` | 18-400, 18-415 |
| `cream-jar-30ml` | amber-45mm, frosted-45mm |
| `cream-jar-5ml` | amber-27mm, clear-27mm |
| `cylinder-9ml-clear` | 13-415, 17-415 |
| `cylinder-9ml-frosted` | 13-415, 17-415 |
| `decorative-35ml` | clear-ground, green-ground |
| `dropper` | 17-415, 18-400, 18-415, 20-400 |
| `pillar-9ml-clear` | 13-415, 17-415 |
| `roll-on-cap` | 13-415, 15-415, 17-415, 20-400 |
| `sprayer` | 13-415, 15-415, 17-415, 18-415 |
| `teardrop-9ml` | clear-ground, green-ground |
| `vial-1ml` | amber-plug, clear-plug |
| `vial-2ml-amber` | 13-425, 8-425 |

**60 products have no neck finish**, so no familyId can be derived and they cannot publish.
They are concentrated in non-bottle lines: Gift Bag (21), Gift Box (15), Packaging Supply (12), Tool (3), Cylinder (3), Lotion Bottle (2), Plastic Bottle (1), Unknown (1).

Legacy family aliases resolve as intended:

| legacy id | canonical familyId |
|---|---|
| `diva-46-clear` | `diva-46ml-clear-18-415` |
| `diva-46-frosted` | `diva-46ml-frosted-18-415` |
| `cylinder-50ml-clear` | `cylinder-50ml-clear-18-415` |
| `cylinder-9ml-17-415` | `cylinder-9ml-<glass>-17-415` |

## 3. SKU cross-reference

| match kind | count | publishable? |
|---|---:|---|
| exact | 2257 | yes |
| no-psd | 167 | **no** |
| near-miss:case | 49 | **no** |
| no-website-sku | 4 | **no** |

The gate `publishable = matchKind ∈ {exact, alias} ∧ ¬convexDuplicate ∧ ¬selectionConflict ∧ familyGatePassed`
holds for all 1967 publishable SKUs: **0 violations**. `tokensReviewed` is
enforced separately at publish time and is currently **unset — --dist publishing is blocked**.

**The approved aliases are currently doing no work, and that is correct rather than broken.** Each maps a
library spelling to a catalogue SKU (`GBSleek5SpryGlMatt` -> `GBSleek5SpryGlMt`); all
88 of the 88 values are catalogue SKUs, and all 88 of those also exist as a PSD stem in
their own right, so the exact match already succeeds and the alias is never consulted. 0 aliases are
strictly required today and 0 are stale. Keep them: they cost nothing and become load-bearing the
moment a spelling disappears from the library.

49 near-misses sit in `alias-candidates.json` awaiting manual promotion. They are
case-only differences of the form `AnSp…`/`Ansp…` plus a handful of Boston Round dropper spellings.
None was promoted by this audit.

Products with no PSD, classified:

| reason | count |
|---|---:|
| photography genuinely missing | 105 |
| non-bottle product | 50 |
| unsupported family (no neck) | 8 |
| duplicate SKU | 4 |

Catalogue-image fallback covers these; no paper-doll asset was manufactured to reach coverage.

## 4. Website reconciliation

bestbottles.com was used as external evidence, never as an automatic overwrite. Material discrepancies
found and their disposition:

| SKU | Convex value | bestbottles.com | recommended | confidence | action |
|---|---|---|---|---|---|
| `GBDiva46DrpSl` | group `diva-46ml-frosted-18-415-dropper` | described with gold and copper as one clear family; 3 clear dropper detail pages in the sitemap | clear group | high | **applied on dev** — moved |
| `GBDiva46Drp{Gl,Cu,Sl}` | graceSku `GB-DVA-FRS-46ML-DRP-*` | products are clear glass | `GB-DVA-CLR-46ML-DRP-*` | high | **applied on dev** — renamed |
| `GBDivaFrst46DrpCu` | absent | live listing `large-dropper-bottles.php`, $2.90/$2.76/$2.61/$2.47/$2.26, no detail page | create | high | **applied on dev** — created |
| `GBDivaFrst46Drp{Gl,Sl}` | absent | not in live markup; Nemat confirms both sell | create at the frosted ladder | medium — price by family convention, not a listing | **applied on dev** — created, flagged |
| 72 SKUs spelling `Frst` | group colour says clear | — | HUMAN_REVIEW_REQUIRED | medium | not changed |

The 72 frosted-token SKUs filed under clear groups are reported by `xref.py` as
`sku_says_frosted_catalogue_says_clear` and are listed in `data/paper-doll/xref.json`. They are not
corrected here: each needs a decision on whether the SKU or the group is wrong.

## 5. Component compatibility report

70541 declared component relationships were checked with neck finish as a first-order
attribute. Thread was read from the component's own grace SKU (`CMP-CAP-BLK-18415-LTR` → 18-415) and
compared with the product's `neckThreadSize`. Nothing was inferred from appearance, folder or colour.

| verdict | edges |
|---|---:|
| confirmed (threads agree) | 69585 |
| `COMPATIBILITY_INVALID` | 0 |
| `COMPATIBILITY_UNVERIFIED` | 956 |

**No `COMPATIBILITY_INVALID` edge exists.** Every component whose thread can be read is declared only on
bottles of that same thread: 55,170 edges on 18-415, 9,996 on 13-415, 2,732 on 17-415, 1,391 on 20-400,
147 on 15-415, 129 on 18-400, 20 on 8-425. The stored compatibility data is thread-consistent.


All 956 unverified edges come from just 6 component SKUs that
carry no thread designation, so their fit cannot be established from the data:

| component SKU | edges | note |
|---|---:|---|
| `CMP-SPR-CLR-30ML` | 472 | names a capacity, not a thread |
| `CMP-SPR-SLV-` | 472 | malformed SKU — trailing separator, no thread |
| `BB-ALU250SPRYBL` | 6 | a product id, not a component id |
| `CMP-PLUG-WHT-VIAL` | 2 | orphan: no product document defines it |
| `CMP-PLUG-BLK-VIAL` | 2 | orphan: no product document defines it |
| `BB-CREAMJARAMB5MLSLCAP` | 2 | a product id, not a component id |

These are `COMPATIBILITY_UNVERIFIED`, not `COMPATIBILITY_INVALID`: nothing shows them to be wrong,
and nothing shows them to be right. They are review items, not assumptions.

`fitments` holds 63 thread rules that `getCompatibleFitments` already applies at read time; this audit
checks the stored edges themselves, which the runtime filter can hide but not fix.

## 6. Physical component reuse report

A different SKU does not imply a different physical part, and a different finish does not imply different
geometry. How widely each component is already shared:

| SKUs referencing the component | components |
|---|---:|
| 2–10 | 10 |
| 11–100 | 28 |
| 101–1000 | 48 |
| 1000+ | 45 |

The largest group is the standard 18-415 closure set — 18 sprayers, pumps, caps and droppers each
referenced by 1226 SKUs across 30 families. That is reuse working as intended: one component
record, many products pointing at it.

### Components registered under more than one id

24 component descriptors exist as several component ids (the id minus its trailing `-NN`).
These are the candidates for one physical part represented as unrelated components — but the suffix is not
always cosmetic, so **none is merged here**:

| descriptor | ids | website SKUs | descriptions | verdict |
|---|---|---|---|---|
| `CMP-CAP-BLK-13-415` | `CMP-CAP-BLK-13-415-01`<br>`CMP-CAP-BLK-13-415-02` | `CP13-415SpryBlkMt`<br>`CP13-415SpryBlkSh` | Cap/Closure Thread 13-415 | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-CAP-SGLD-13-415` | `CMP-CAP-SGLD-13-415-01`<br>`CMP-CAP-SGLD-13-415-02`<br>`CMP-CAP-SGLD-13-415-03` | `CP13-415Gl`<br>`CP13-415SpryGlMt`<br>`CP13-415SpryGlSh` | Cap/Closure Thread 13-415<br>Shiny gold lid or closure for glass bottle, Thread size 13-415 | DESCRIPTIONS_DIFFER |
| `CMP-CAP-SLV-13-415` | `CMP-CAP-SLV-13-415-01`<br>`CMP-CAP-SLV-13-415-02`<br>`CMP-CAP-SLV-13-415-03` | `CP13-415Sl`<br>`CP13-415SprySlMt`<br>`CP13-415SprySlSh` | Cap/Closure Thread 13-415<br>Shiny silver lid or closure for glass bottle, Thread size 13-415 | DESCRIPTIONS_DIFFER |
| `CMP-CLS-BLK` | `CMP-CLS-BLK-03`<br>`CMP-CLS-BLK-06`<br>`CMP-CLS-BLK-07`<br>`CMP-CLS-BLK-08` | `CJ30BlkCap`<br>`CJ40BlkCap`<br>`CJ5BlkCap`<br>`CapBlackPoly22mm-400` | Cap/Closure Black | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-CLS-SLV` | `CMP-CLS-SLV-02`<br>`CMP-CLS-SLV-03`<br>`CMP-CLS-SLV-04` | `CJ30SlCap`<br>`CJ40SlCap`<br>`CJ5SlCap` | Cap/Closure Silver | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-DRP-BKGD-20400` | `CMP-DRP-BKGD-20400-76`<br>`CMP-DRP-BKGD-20400-90` | `Drp20-4001ozShnGlTrimBlkBulb`<br>`Drp20-4002ozShnGlTrimBlkBulb` | Black rubber bulb dropper with shiny gold collar cap. Glass stem lengt<br>Black rubber bulb dropper with shiny gold collar cap. Glass stem lengt | DESCRIPTIONS_DIFFER |
| `CMP-DRP-BKSL-20400` | `CMP-DRP-BKSL-20400-76`<br>`CMP-DRP-BKSL-20400-90` | `Drp20-4001ozShnSlTrimBlkBulb`<br>`Drp20-4002ozShnSlTrimBlkBulb` | Black rubber bulb dropper with shiny silver collar cap. Glass stem len<br>Black rubber bulb dropper with shiny silver collar cap. Glass stem len | DESCRIPTIONS_DIFFER |
| `CMP-DRP-WHT-20400` | `CMP-DRP-WHT-20400-76`<br>`CMP-DRP-WHT-20400-90` | `Drp20-4001ozWhiteBulb`<br>`Drp20-4002ozWhiteBulb` | White rubber bulb dropper with white cap. Glass stem length is 76 mm, <br>White rubber bulb dropper with white cap. Glass stem length is 90 mm,  | DESCRIPTIONS_DIFFER |
| `CMP-DRP-WTGD-20400` | `CMP-DRP-WTGD-20400-76`<br>`CMP-DRP-WTGD-20400-90` | `Drp20-4001ozlShnGlTrimWhiteBulb`<br>`Drp20-4002ozlShnGlTrimWhiteBulb` | White rubber bulb dropper with shiny gold collar cap. Glass stem lengt<br>White rubber bulb dropper with shiny gold collar cap. Glass stem lengt | DESCRIPTIONS_DIFFER |
| `CMP-DRP-WTSL-20400` | `CMP-DRP-WTSL-20400-76`<br>`CMP-DRP-WTSL-20400-90` | `Drp20-4001ozlShnSlTrimWhiteBulb`<br>`Drp20-4002ozlShnSlTrimWhiteBulb` | White rubber bulb dropper with shiny silver collar cap. Glass stem len<br>White rubber bulb dropper with shiny silver collar cap. Glass stem len | DESCRIPTIONS_DIFFER |
| `CMP-LPM-MSLV-18-415` | `CMP-LPM-MSLV-18-415-01`<br>`CMP-LPM-MSLV-18-415-02` | `Ltn18-415MtSl`<br>`Ltn18-415MtSlCl` | Lotion Pump Thread 18-415<br>Matte Silver Lotion or treatment pump with clear overcap, Threadsize 1 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-IVGD-18-415` | `CMP-SPR-IVGD-18-415-01`<br>`CMP-SPR-IVGD-18-415-02` | `AnSp18-415IvyGl`<br>`AnSpTsl18-415IvyGl` | Sprayer Thread 18-415 | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-SPR-IVSL-18-415` | `CMP-SPR-IVSL-18-415-01`<br>`CMP-SPR-IVSL-18-415-02`<br>`CMP-SPR-IVSL-18-415-04` | `AnSp18-415IvySl`<br>`AnSp18-415IvySl`<br>`AnSpTsl18-415IvySl` | Ivory Silver Antique or Vintage style bulb sprayer with silver fitting<br>Sprayer Thread 18-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-LVN-18-415` | `CMP-SPR-LVN-18-415-01`<br>`CMP-SPR-LVN-18-415-02` | `AnSp18-415Lvn`<br>`AnSpTsl18-415Lvn` | Sprayer Thread 18-415 | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-SPR-MSLV-18-415` | `CMP-SPR-MSLV-18-415-01`<br>`CMP-SPR-MSLV-18-415-02` | `AnSp18-415MtSl`<br>`AnSpTsl18-415MtS` | Sprayer Thread 18-415 | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-SPR-MTCP-13-415` | `CMP-SPR-MTCP-13-415-01`<br>`CMP-SPR-MTCP-13-415-07` | `13-415CAP4SpryCuMt`<br>`CP13-415SpryCuMt` | Matte Copper Fine Mist Sprayer, Thread size 13-415<br>Sprayer Matte Copper Thread 13-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-MTGD-18-415` | `CMP-SPR-MTGD-18-415-01`<br>`CMP-SPR-MTGD-18-415-05` | `18-415CAP4SpryMtGl`<br>`Spry18-415MtGl` | Matte Gold collar sprayer, Thread size 18-415<br>Sprayer Matte Gold Thread 18-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-MTSL-13-415` | `CMP-SPR-MTSL-13-415-01`<br>`CMP-SPR-MTSL-13-415-07` | `13-415CAP4SprySlMt`<br>`CP13-415SprySlMt` | Matte silver Fine Mist Sprayer, Thread size 13-415<br>Sprayer Matte Silver Thread 13-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-MTSL-18-415` | `CMP-SPR-MTSL-18-415-04`<br>`CMP-SPR-MTSL-18-415-06` | `AnSp18-415MtSl`<br>`Spry18-415MtSl` | Matte Silver Antique or Vintage style bulb sprayer with silver fitting<br>Matte Silver collar sprayer, Thread size 18-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-RED-18-415` | `CMP-SPR-RED-18-415-01`<br>`CMP-SPR-RED-18-415-02` | `AnSp18-415Red`<br>`AnSpTsl18-415Red` | Sprayer Thread 18-415 | SAME_DESCRIPTION_DIFFERENT_IDS |
| `CMP-SPR-SHBK-18-415` | `CMP-SPR-SHBK-18-415-01`<br>`CMP-SPR-SHBK-18-415-06` | `18-415CAP4SpryShnBlk`<br>`Spry18-415ShnBlk` | Shiny Black collar sprayer, Thread size 18-415<br>Sprayer Shiny Black Thread 18-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-SHGD-13-415` | `CMP-SPR-SHGD-13-415-01`<br>`CMP-SPR-SHGD-13-415-07` | `13-415CAP4SpryGlSh`<br>`CP13-415SpryGlSh` | Shiny gold Fine Mist Sprayer, Thread size 13-415<br>Sprayer Shiny Gold Thread 13-415 | DESCRIPTIONS_DIFFER |
| `CMP-SPR-SLWH-18-415` | `CMP-SPR-SLWH-18-415-02`<br>`CMP-SPR-SLWH-18-415-04` | `AnSp18-415Wht`<br>`AnSpTsl18-415Wht` | White Antique or Vintage style bulb sprayer with silver fittings and t<br>White Antique or Vintage style bulb sprayer with silver fittings. Thre | DESCRIPTIONS_DIFFER |
| `CMP-SPR-WHT-18-415` | `CMP-SPR-WHT-18-415-01`<br>`CMP-SPR-WHT-18-415-02` | `AnSp18-415Wht`<br>`AnSpTsl18-415Wht` | Sprayer Thread 18-415 | SAME_DESCRIPTION_DIFFERENT_IDS |

Two patterns, and they need opposite treatment:

- **Genuinely different parts.** `CMP-DRP-WHT-20400-76` and `-90` are both "White rubber bulb dropper with
  white cap", but their descriptions end "glass stem length is 7…" and "…9…" — a 1 oz and a 2 oz dropper.
  Merging them on the strength of a shared descriptor would put the wrong stem in the bottle.
- **One part, several finishes.** `CMP-CAP-BLK-13-415-01` and `-02` carry the identical description
  "Cap/Closure Thread 13-415" and differ only as `CP13-415SpryBlkMt` (matte) versus `CP13-415SpryBlkSh`
  (shiny). Same geometry, different material — the case where geometry should be shared and only the
  material token differs. 8 of the 24 groups have identical descriptions and are in the review queue.

131 of 131 distinct components are already referenced by more than one SKU, so reuse is
canonical at the component level: the catalogue stores one component grace SKU and points many products
at it. No duplicate geometry is introduced by the plate pipeline — plate objects are content-addressed,
so a part photographed once yields one object however many SKUs show it.

The 9 mL cylinder is the architectural pattern to preserve: 26 reusable layers compose 145 configurations,
and because keys start with the SHA-256 of the bytes, those 145 configurations cost 52 stored objects, not 145.

## 7. Asset integrity report

- 12754 source files inventoried; **0 unclassified**.
- Roles: {'front': 2751, 'component': 325, 'view': 4174, 'uncapped': 2006, 'capped': 3078, 'thumbnail': 99}
- Excluded with a reason code: {'SINGLE_LETTER': 170, 'CAMERA_NAME': 18, 'DESCRIPTIVE_NAME': 25, 'NO_SKU_PREFIX': 5, 'BARE_NUMBER': 6, 'DOS_83_NAME': 97}
- 3175 chosen assets carry more than one provenance location; all locations are kept.
- 25 `SAME_STEM_DIFFERENT_PHOTOGRAPH` conflicts remain hard selection conflicts — nothing is chosen for them.
- 9 hi-res files set aside before registration.
- Thumbnails or views selected as a canonical front plate: **0**.

Selection conflicts (each needs a human decision, none may publish):

- `cp13-415spryglsh` [part]: 5. Spry13-415GlSh.psd vs 13. CP13-415SpryGlSh.psd
- `cp13-415spryslmt` [part]: 7. Spry13-415SlMt.psd vs 15. CP13-415SprySlMt.psd
- `cp13-415spryslsh` [part]: 8 Spry13-415SlSh.psd vs 16. CP13-415SprySlSh.psd
- `gb09blackcapapp` [on]: 2. GB09BlackCapApp.psd vs GB09BlackCapApp..psd
- `gb10ozplain` [on]: GB10ozPlain..psd vs GB10ozPlain.psd
- `gb2ozapth` [on]: GB2ozApth..psd vs GB2ozApth.psd
- `gb4ozcobltbl` [on]: GB4ozCobltBl.psd vs GB4ozCobltBl..psd
- `gb6tplsl` [on]: GB6TPlSl..psd vs GB6TPlSl...psd
- `gbrndfrst128sprymtsl` [on]: 26. LBRndFrst128LtnMtSl.psd vs 26. LBRndFrst128LtnMtSl.psd
- `gbrndfrst128spryshnblk` [on]: 22. LBRndFrst128LtnShnBlk.psd vs 22. LBRndFrst128LtnShnBlk.psd
- `gbrndfrst128spryshngl` [on]: 17. GBRndFrst128SpryShnGl.psd vs 17. GBRndFrst128SpryShnGl.psd
- `gbrndfrst128spslshn` [on]: 30. GBRndFrst128SpSlShn.psd vs 30. GBRndFrst128SpSlShn.psd
- `gbslk50ansptslblk` [off]: 48. GBSlk50AnSpTslBlk.psd vs 48. GBSlk50AnSpTslBlk.psd
- `gbslk50ansptslgl` [off]: 50. GBSlk50AnSpTslGl.psd vs 50. GBSlk50AnSpTslGl.psd
- `gbslk50ansptslivygl` [off]: 43. GBSlk50AnSpTslIvyGl.psd vs 43. GBSlk50AnSpTslIvyGl.psd
- `gbslk50ansptslivysl` [off]: 44. GBSlk50AnSpTslIvySl.psd vs 44. GBSlk50AnSpTslIvySl.psd
- `gbslk50ansptsllvn` [off]: 42. GBSlk50AnSpTslLvn.psd vs 42. GBSlk50AnSpTslLvn.psd
- `gbslk50ansptslmtsl` [off]: 49. GBSlk50AnSpTslMtSl.psd vs 49. GBSlk50AnSpTslMtSl.psd
- `gbslk50ansptslpnk` [off]: 46. GBSlk50AnSpTslPnk.psd vs 46. GBSlk50AnSpTslPnk.psd
- `gbslk50ansptslred` [off]: 47. GBSlk50AnSpTslRed.psd vs 47. GBSlk50AnSpTslRed.psd
- `gbslk50ansptslwht` [off]: 45. GBSlk50AnSpTslWht.psd vs 45. GBSlk50AnSpTslWht.psd
- `lbrndfrst128ltnmtsl` [on]: 26. LBRndFrst128LtnMtSl.psd vs 26. LBRndFrst128LtnMtSl.psd
- `lbrndfrst128ltnshnblk` [on]: 22. LBRndFrst128LtnShnBlk.psd vs 22. LBRndFrst128LtnShnBlk.psd
- `lbrndfrst128ltnshngl` [on]: 17. GBRndFrst128SpryShnGl.psd vs 17. GBRndFrst128SpryShnGl.psd
- `lbrndfrst128shsl` [on]: 32. LBRndFrst128ShSl.psd vs 30. GBRndFrst128SpSlShn.psd

## 8. Plate and kit integrity

- 280 plate rows across 8 families.
- Plate rows resolving more than once for a canonical SKU: **0**.
- Field issues (missing front, grace mismatch, missing familyId): **0**.
- `productPlates.integrity` reports 49 issues, all of class
  `products_duplicate_websiteSku` — the catalogue's duplicates surfacing through the index, not index defects.
- `productKits` holds 0 rows: kits are built but not yet published, so
  `published kit → matching published plate` and `plateSha256 == the plate used for registration` are
  vacuously true today and must be enforced the moment the first kit publishes.

The kit audit over 1887 publishable SKUs found: {'capSplit': 832, 'full': 858, 'unreadable': 67, 'review': 114, 'bodyOnly': 16}.
1026 capped/uncapped pairs share a pixel-identical body, which is what
lets a kit be cut without anchoring anything.

## 9. Token system

- `reviewedAt`: **unset — publishing from the pipeline manifest is blocked**.
- Spelling collisions (one spelling, two canonical finishes): **0**.
- Ambiguous body tokens (one body, several familyIds): **14**.
- Bodies with no familyId: 30.
- SKUs that do not parse from the vocabulary: 41.

| body token | familyIds it resolves to |
|---|---|
| `1ozApth` | `apothecary-30ml-clear-ground` (1), `apothecary-30ml-cobalt-blue-ground` (1), `apothecary-30ml-green-ground` (1) |
| `65mlLotionPump` | `aluminum-bottle-65ml-white-20-410` (1), `aluminum-bottle-65ml-clear-20-410` (1) |
| `Atom10` | `atomizer-10ml-clear-17mm` (6), `atomizer-10ml-black-17mm` (2), `atomizer-10ml-cobalt-blue-17mm` (1), `atomizer-10ml-green-17mm` (1) |
| `Atom5` | `atomizer-5ml-clear-13-415` (5), `atomizer-5ml-black-13-415` (3), `atomizer-5ml-clear-10mm` (2), `atomizer-5ml-pink-13-415` (2) |
| `CrclFrst50` | `circle-50ml-frosted-18-415` (36), `circle-50ml-frosted-18-400` (1) |
| `Cyl50` | `cylinder-50ml-clear-18-415` (45), `cylinder-50ml-clear-16mm` (4) |
| `CylSwrl9` | `cylinder-9ml-swirl-17-415` (28), `cylinder-9ml-clear-17-415` (2) |
| `DivaFrst46` | `diva-46ml-frosted-18-415` (46), `diva-46ml-clear-18-415` (43) |
| `ElgFrst100` | `elegant-100ml-frosted-18-415` (44), `elegant-100ml-clear-18-415` (1) |
| `ElgFrst15` | `elegant-15ml-frosted-13-415` (28), `elegant-15ml-clear-13-415` (27) |
| `ElgFrst60` | `elegant-60ml-frosted-18-415` (49), `elegant-60ml-clear-18-415` (1) |
| `EternalFlame` | `decorative-35ml-cobalt-blue-ground` (1), `decorative-35ml-clear-ground` (1), `decorative-35ml-green-ground` (1) |
| `Pillar9` | `pillar-9ml-clear-13-415` (2), `pillar-9ml-clear-17-415` (1) |
| `TallCyl9` | `cylinder-9ml-clear-13-415` (30), `tall-cylinder-9ml-clear-13-415` (1) |

Each of these is a body token that two catalogue families spell the same way — for example a frosted
body filed under a clear group. They are reported, not auto-resolved: the body token is a label, and
`familyId` still comes from the product fields.

## 10. Human review queue

| # | item | decision required | class | confidence |
|---:|---|---|---|---|
| 1 | duplicate SKU AnSp18-415IvyGl | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 2 | duplicate SKU AnSp18-415IvySl | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 3 | duplicate SKU AnSp18-415Lvn | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 4 | duplicate SKU AnSp18-415MtSl | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 5 | duplicate SKU AnSp18-415Red | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 6 | duplicate SKU AnSp18-415Wht | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 7 | duplicate SKU AnSpTsl18-415Blk | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 8 | duplicate SKU AnSpTsl18-415IvyGl | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 9 | duplicate SKU AnSpTsl18-415IvySl | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 10 | duplicate SKU AnSpTsl18-415Lvn | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 11 | duplicate SKU AnSpTsl18-415MtS | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 12 | duplicate SKU AnSpTsl18-415Pnk | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 13 | duplicate SKU AnSpTsl18-415Red | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 14 | duplicate SKU AnSpTsl18-415Wht | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 15 | duplicate SKU CP13-415SpryBlkMt | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 16 | duplicate SKU CP13-415SpryBlkSh | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 17 | duplicate SKU CP13-415SpryBluMt | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 18 | duplicate SKU CP13-415SpryGlMt | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 19 | duplicate SKU CP13-415SpryGlSh | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 20 | duplicate SKU CP13-415SprySlMt | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 21 | duplicate SKU CP13-415SprySlSh | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 22 | duplicate SKU GBAtom5Blk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 23 | duplicate SKU GBAtom5PnkDot | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 24 | duplicate SKU GBBell10MtlRollBlkDot | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 25 | duplicate SKU GBBell10RollBlkDot | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 26 | duplicate SKU GBCrcl100RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 27 | duplicate SKU GBCrcl50RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 28 | duplicate SKU GBCrcl50RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 29 | duplicate SKU GBCrclFrst50RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 30 | duplicate SKU GBCyl100RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 31 | duplicate SKU GBCyl100RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 32 | duplicate SKU GBCyl50RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 33 | duplicate SKU GBCyl50RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 34 | duplicate SKU GBCyl5WhtSht | confirm which product group is correct | `SAME_SKU_DIFFERENT_GROUP` | medium |
| 35 | duplicate SKU GBCylSwrl9MtlRollWht | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 36 | duplicate SKU GBCylSwrl9RollWht | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 37 | duplicate SKU GBDiva100RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 38 | duplicate SKU GBDiva100RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 39 | duplicate SKU GBDiva30RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 40 | duplicate SKU GBDiva30RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 41 | duplicate SKU GBDiva46RdcrMtSl | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 42 | duplicate SKU GBDiva46RdcrShnBlk | assign a distinct website SKU to each product, or retire the surplus | `DISTINCT_PRODUCTS_SHARING_A_WEBSITE_SKU` | high |
| 43 | duplicate SKU GBDivaFrst46AnSpBlk | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 44 | duplicate SKU GBDivaFrst46AnSpGl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 45 | duplicate SKU GBDivaFrst46AnSpIvyGl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 46 | duplicate SKU GBDivaFrst46AnSpIvySl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 47 | duplicate SKU GBDivaFrst46AnSpLvn | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 48 | duplicate SKU GBDivaFrst46AnSpMtSl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 49 | duplicate SKU GBDivaFrst46AnSpPnk | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 50 | duplicate SKU GBDivaFrst46AnSpRed | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 51 | duplicate SKU GBDivaFrst46AnSpTslBlk | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 52 | duplicate SKU GBDivaFrst46AnSpTslGl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 53 | duplicate SKU GBDivaFrst46AnSpTslIvyGl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 54 | duplicate SKU GBDivaFrst46AnSpTslIvySl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 55 | duplicate SKU GBDivaFrst46AnSpTslLvn | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 56 | duplicate SKU GBDivaFrst46AnSpTslMtSl | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 57 | duplicate SKU GBDivaFrst46AnSpTslPnk | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 58 | duplicate SKU GBDivaFrst46AnSpTslRed | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 59 | duplicate SKU GBDivaFrst46AnSpTslWht | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| 60 | duplicate SKU GBDivaFrst46AnSpWht | decide which family owns the SKU; the other document is misfiled or a different product | `SAME_SKU_IN_TWO_FAMILIES` | high |
| … | 128 further items | see `data/paper-doll/audit-findings.json` | | |

## 11. Machine-readable matrix

`data/paper-doll/audit-matrix.json` carries both directions:

- `bySku`: websiteSku → graceSku, familyId, body, neck, matchKind, publishable, blockReasons,
  physicalComponents, plate, kit.
- `byComponent`: component grace SKU → SKU count, family count, necks, example SKUs.

It uses the production ids and introduces no parallel identity system.

## 12. Integrity test coverage

`scripts/paperdoll/verify.mjs` exits non-zero on index failures. Coverage today:

| check | enforced by | status |
|---|---|---|
| duplicate Convex website SKU | productPlates.integrity → products_duplicate_websiteSku | reported; fails under --strict |
| multiple plate rows for one SKU | productPlates.integrity → duplicate_index_rows; upsertMany refuses | hard fail |
| orphan plate | productPlates.integrity → orphan_plate; publish skips | hard fail |
| incorrect grace SKU | productPlates.integrity → grace_sku_mismatch | hard fail |
| malformed familyId / missing neck | xref.py familyId gate | blocks publishing |
| unsupported alias / near-miss marked publishable | xref.py assertion | hard fail in the builder |
| unpublished selection conflict imported | dedupe SAME_STEM_DIFFERENT_PHOTOGRAPH → not publishable | blocks publishing |
| missing plate front | productPlates.integrity → missing_front | hard fail |
| invalid asset host | productPlates.integrity → url_host_not_allowed | hard fail |
| incorrect content hash | publish.mjs hash drift check before upload | hard fail |
| kit without a plate / mismatched plateSha256 | productKits.integrity → kit_without_plate, kit_stale_plate | hard fail |
| unresolved token | tokens.json reviewedAt gate in publish.mjs --dist | blocks publishing |
| invalid component-family mapping | products.componentIntegrity → component_thread_mismatch | **added by this audit**; 0 today |
| orphan component reference | products.componentIntegrity → component_reference_unknown | **added by this audit**; 2 today |

This audit added the last two. `verify.mjs` now sweeps all 70,541 component edges on every run and prints
what it finds; like the duplicate-SKU check that was already there, they are classed as catalogue defects
rather than index defects, so a plate publish is not blocked by a component the catalogue has mislabelled —
but `verify.mjs --strict` fails on them, and nothing was downgraded to a silent pass. Sample run:

```
productPlates: 280 rows, 0 index issues, 49 catalogue issues
productKits: 0 rows, 0 index issues, 0 catalogue issues
components: 2477 products, 70541 edges, 131 distinct components, 2 catalogue issues
   ~~ CMP-PLUG-WHT-VIAL: component_reference_unknown no product document defines this component
   ~~ CMP-PLUG-BLK-VIAL: component_reference_unknown no product document defines this component
```

