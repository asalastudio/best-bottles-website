// Export the 41 batch-3 Sunburst heroes Jordan approved on 2026-09-25 ("approve all").
// 39 catalog cards (Square, Footed/Tall Rectangle, Tulip, Diamond, Circle and Round frosted,
// Teardrop, SQST stopper bottles and Vials) plus the cobalt and green SQST variants.
//
// Sizing: approved curve pct = 3.5314 * mm^0.5868 (landmark span, foot at 91%), except
//   - Vials (Jordan): 1 ml and 2 ml at 32%, 3 ml and 4 ml at 35%;
//   - ground-glass stopper bottles (SQST 64 mm, Teardrop 68 mm with the stopper seated),
//     sized by full height with the stopper on the batch height curve.
// Footed Rectangle 10 ml and Square 15 ml were re-rendered (a2) after the first pass lost the
// separate glass-foot component; SQST and Teardrop were re-rendered at the new size.
//
// Usage: node scripts/hero-families/release-batch3.cjs <lane-dir>
//   <lane-dir> holds approval-candidates.json, sizing-targets.json, fitted/, renders/ and the sheets.
//
// Read-only against the lane and production: refuses any fitted or raw render whose sha256
// differs from the approved one below, and any SKU production Convex does not hold in the
// recorded group with the recorded identity.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const lane = path.resolve(process.argv[2] || process.env.HERO_LANE_DIR || '');
const docs = path.join(root, 'docs/hero-families/batch3-2026-09-25');
const publicDir = '/images/catalog/batch3-approved-2026-09-25';
const registryPath = path.join(root, 'src/lib/products/catalog-hero-batch3-release.json');
const productionQuery = 'https://precise-raccoon-123.convex.cloud/api/query';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// bottleColor keeps production's colour except where the pictured glass differs
// (productionColor records production's value; the data fix is left for later).
const APPROVED = {
  GBSQSTClear: { attempt: 'a2', fittedSha256: 'b3e20cd421ac17fd7cb484d3577f237de058eba5cf6095a42635ede0d4492d1a', renderSha256: 'ecc33ed04e02ff0ca3b940c36c6bce1577f6c1a406f2279edd24bcb1ab6489b4',
    bottleColor: 'Clear', alt: "9 ml Clear Rectangle Bottle with Faceted Ground Glass Stopper" },
  GBSQSTBlue: { attempt: 'a1', fittedSha256: '1094e9d53f2029a53bd7152e4b04585f4e8696fd909f2ea69506280f3fae3011', renderSha256: 'cbd94d9fea46e4101997d9184e31d47a332e7fd8856ae3e63a4ec6f399af9c4b',
    bottleColor: 'Cobalt Blue', productionColor: 'Clear', alt: "9 ml Cobalt Blue Rectangle Bottle with Faceted Ground Glass Stopper" },
  GBSQSTGREEN: { attempt: 'a1', fittedSha256: '20f390197b3b91b110a1f0afc95d8d6aed687c61d0ad34655592b3b2619b9d59', renderSha256: 'f91d07cb161d1ef0103337d21aa3da5c6af6c85a97acfb4e3c35f6a1e4b173a1',
    bottleColor: 'Green', productionColor: 'Clear', alt: "9 ml Green Rectangle Bottle with Faceted Ground Glass Stopper" },
  GBCrclFrst50AnSpTslBlk: { attempt: 'a1', fittedSha256: 'afa1edfa2c34e71ddc2fbd2c51b4f313e8ed4bae5156a4ec1682fffa523ccc5e', renderSha256: 'a64287f17a3c9f41b4861d8694fd5a9c0a01ee979399b95b0fe7ccbe0929012a',
    bottleColor: 'Frosted', alt: "50 ml Frosted Circle Vintage Style Bulb Spray Bottle with Silver Sprayer and Black Tassel" },
  GBDmnd2ozAnSpMtSl: { attempt: 'a1', fittedSha256: '3cfcf14210f4735ee96a891328a7a9bab669c0905904583e9c788a30f2efa5df', renderSha256: '28c2f379d0979a2bcf799b796ca480e555aea9f728187b6064928f7ec30eda95',
    bottleColor: 'Clear', alt: "60 ml Clear Diamond Vintage Style Bulb Spray Bottle with Matte Silver Sprayer" },
  GBDmnd2ozAnSpTslGl: { attempt: 'a1', fittedSha256: 'a9f3b5f16a5a0c7768312148f648834666698e189bcc42fb9b4907f0743ed8a5', renderSha256: '3fab0bd7d05052c514c7709bcacd7cc85f47bc2d4dc2a94247e769e9e2c6b4bc',
    bottleColor: 'Clear', alt: "60 ml Clear Diamond Vintage Style Bulb Spray Bottle with Gold Sprayer and Tassel" },
  GBDmnd2ozRdcrMtSl: { attempt: 'a1', fittedSha256: '185a26270a1d3181a23081ff224274e60e08d9e6ea809eaa1460d64eeed36787', renderSha256: 'efeac8a5d8be9b3e4f0d0105a1b203a024e8df86f023a8a36db8af0453f1c67b',
    bottleColor: 'Clear', alt: "60 ml Clear Diamond Reducer Bottle with Matte Silver Cap" },
  GBDmnd2ozSpryMtGl: { attempt: 'a1', fittedSha256: '734f5f29c0ceed9b81695d69425d8947abbfa7959b607604a2056badf0272203', renderSha256: '86b1052e666f0bc155b1813dc5d06308109431986754cdd7ce9a5b4300955da0',
    bottleColor: 'Clear', alt: "60 ml Clear Diamond Perfume Spray Bottle with Matte Gold Sprayer and Cap" },
  LBDmnd2ozLtnMtGl: { attempt: 'a1', fittedSha256: 'b56c19e3390749cfc2ab42a9abdd07b52e58dc6ea1d95104f10492a082aab26b', renderSha256: '746b01654cccb3036901354b7c0ecef84fac690b559e3079b5ea71030e9e77cf',
    bottleColor: 'Clear', alt: "60 ml Clear Diamond Lotion Pump Bottle with Matte Gold Pump and Cap" },
  GBRect10Gl: { attempt: 'a2', fittedSha256: 'ba038ec651c31ece84c396f799f07d15987c0d8d0562d14af0379a7bd0183acd', renderSha256: '4d0012cafe688f47e026a887cb094e6bb96af4407e2a46fc72337288b830c353',
    bottleColor: 'Clear', alt: "10 ml Clear Footed Rectangle Bottle with Shiny Gold Cap" },
  GBRect10MtlRollBlkDot: { attempt: 'a2', fittedSha256: 'f0bb9ad701b90d067030752bd7da2b814b40472887acec22e9e63dd7556be1de', renderSha256: 'a405e841d803c1d740668d943022ecaf53d16cb916a5c7cf2191e75255f21235',
    bottleColor: 'Clear', alt: "10 ml Clear Footed Rectangle Roll-On Bottle with Metal Roller Ball and Black Dotted Cap" },
  GBRect10SpryGlMatt: { attempt: 'a2', fittedSha256: '7df414dde280925eb3b6f90b337b359a5d98205376fa98386ba2c9b2b516ffda', renderSha256: '37a0822239756965d3d086a8b1e153cd9475db52831ef693f370d7f0b5f394a1',
    bottleColor: 'Clear', alt: "10 ml Clear Footed Rectangle Fine Mist Spray Bottle with Matte Gold Sprayer and Cap" },
  GBTallRect10Gl: { attempt: 'a1', fittedSha256: 'f6a852294d14bf5c1bdba51de959782ab4fad48c99c534b7145ae96e55c4b1d3', renderSha256: '781f8adba2f9c15d7b58cdf4fda3de170d0e56ba49b43da72765058c6bb0eb42',
    bottleColor: 'Clear', alt: "10 ml Clear Tall Rectangle Bottle with Shiny Gold Cap" },
  GBTallRect10MtlRollBlkDot: { attempt: 'a1', fittedSha256: '300aaa12cd2ef200a0e809a6524f95bdaed75624187c0b9f8f945e0c3c6f380e', renderSha256: 'a07b36f506976b41ce192a20a2113b6f6375dbafbfd259a2484bc42d5453377b',
    bottleColor: 'Clear', alt: "10 ml Clear Tall Rectangle Roll-On Bottle with Metal Roller Ball and Black Dotted Cap" },
  GBTallRect10SpryGlMatt: { attempt: 'a1', fittedSha256: '0b0e160135ffbb19f27bbfc4169601d989b47722a080762dcd7af0cea6e90ce5', renderSha256: '5ff219780a298480089c0b2e9b7e26670c0377c7bb9eef8fed2c8ab008d3d16f',
    bottleColor: 'Clear', alt: "10 ml Clear Tall Rectangle Fine Mist Spray Bottle with Matte Gold Sprayer and Cap" },
  GBRndFrst128AnSpTslRed: { attempt: 'a1', fittedSha256: '47a9fd1510ff06736fdc58a3bab39f666941d91d13c94c0f6413fc1f6659c595', renderSha256: '96306168a10b5e711cd078c1efd12c9f30354e38b75ce51491ae41873e71b5cd',
    bottleColor: 'Frosted', alt: "128 ml Frosted Round Vintage Style Bulb Spray Bottle with Silver Sprayer and Red Tassel" },
  GBSqr15Gl: { attempt: 'a2', fittedSha256: 'b1226d6f3e49f34497f17c5bf85e539261dfff2a0a446fcd811e96574c227612', renderSha256: '196ec9697128f41934ec03bb150a0f8da805310e4dd35dfdac98e11eb0381467',
    bottleColor: 'Clear', alt: "15 ml Clear Square Bottle with Shiny Gold Cap" },
  GBSqr15MtlRollBlkDot: { attempt: 'a2', fittedSha256: 'a4784e4ed1b2511a4596c7129ba6f69dba1b220528da454d96d59807116cece3', renderSha256: 'dec0ef8c40335e689308229a3a9b02c2220970afe9f84b651fb0fba31312f2c7',
    bottleColor: 'Clear', alt: "15 ml Clear Square Roll-On Bottle with Metal Roller Ball and Black Dotted Cap" },
  GBSqr15SpryGlMatt: { attempt: 'a2', fittedSha256: '9bd2752a1d3a611b158f7ae60aee324bfb3070a1ac0e766aba22ddf552a5ea93', renderSha256: 'aa4e2edffde252697af134b70750eeeaa7b7b006b22d832082f2b8baa52f600b',
    bottleColor: 'Clear', alt: "15 ml Clear Square Fine Mist Spray Bottle with Matte Gold Sprayer and Cap" },
  GBTRDPClear: { attempt: 'a2', fittedSha256: '245d16eacadf03758fd0ec83c5da4376f3f80d5fefaf165ed145420eaa5cd9c6', renderSha256: '2a0124f091e4d20a7b572da2f10c66e3cd1de93cf05227a12703fa784117db4f',
    bottleColor: 'Clear', alt: "9 ml Clear Teardrop Bottle with Ground Glass Stopper" },
  GBTRDPGreen: { attempt: 'a2', fittedSha256: '9be2a1a82f36452c55e6883a8c634f2882038b4f8143c6c231a2401474804529', renderSha256: '4cb7df70a8ff92cc87b7ea3f35b3ebce57b42b8c5b9b667e573211033709e933',
    bottleColor: 'Green', alt: "9 ml Green Teardrop Bottle with Ground Glass Stopper" },
  GBTrdpBlue: { attempt: 'a2', fittedSha256: '8225b9c183adb77ef8e87a532f116e7e201c7a78774cb009139fd568dda406e9', renderSha256: 'b0bd8b49aa2cc4296632473cb04d7008b77e14c714b45c94348f456518c02413',
    bottleColor: 'Cobalt Blue', alt: "9 ml Cobalt Blue Teardrop Bottle with Ground Glass Stopper" },
  GBTulip6Gl: { attempt: 'a1', fittedSha256: 'f2737bf100ae37dfec1603d971690bf9b01bfbe2c50d771b89d9fe9721795762', renderSha256: '9d799a0a8524212a6474144bf0d3d8a932dcdca04d4d6b84787a9bc63403d878',
    bottleColor: 'Clear', alt: "6 ml Clear Tulip Bottle with Shiny Gold Cap" },
  GBTulip6MtlRollBlkDot: { attempt: 'a1', fittedSha256: 'dee67377d777f5ea1742537a25ace4cae929d720a835c4ffb21341891732eb1c', renderSha256: '7edf336ed5b8fa4f3671a18e2e79ad74691d08b042def011a7ef6712a93c1c76',
    bottleColor: 'Clear', alt: "6 ml Clear Tulip Roll-On Bottle with Metal Roller Ball and Black Dotted Cap" },
  GBTulip6SpryGlMatt: { attempt: 'a1', fittedSha256: '584a6fc250d5d4c5c5c924b48875345cd4e3ff30bc92cb2dba72457a2150bb9d', renderSha256: '6219c22499e2b90957ef496f0a64e3c69dd05ab1786dcaa7eac8e257bfbb6b9e',
    bottleColor: 'Clear', alt: "6 ml Clear Tulip Fine Mist Spray Bottle with Matte Gold Sprayer and Cap" },
  GBTulipAmb5Gl: { attempt: 'a1', fittedSha256: '8e3cf9a340679600588023541ee8e33832b16e922225fa48e18f64c25b13dbb7', renderSha256: '193e5239b4aeeff7f3204340c641b7cd94fdf65238c36d1cb235346b6bd54c39',
    bottleColor: 'Amber', alt: "5 ml Amber Tulip Bottle with Shiny Gold Cap" },
  GBTulipAmb5MtlRollBlkDot: { attempt: 'a1', fittedSha256: '05b73472cbee1aea7be4b1c8b90c9da679fb998b9d1ccb8e20633ade1420d53d', renderSha256: '17860c2445ab41e3101dd529e6d2b464fa0b0cd2313e521385cce81e9d89d1d3',
    bottleColor: 'Amber', alt: "5 ml Amber Tulip Roll-On Bottle with Metal Roller Ball and Black Dotted Cap" },
  GBTulipAmb5SpryGlMatt: { attempt: 'a1', fittedSha256: 'bca9280fe37ca2f83ead23dc17bccf74d41fd2ca169f2e076e46645833a3e070', renderSha256: '21d9ce98d0b83ad10473b87ff4c573fb5126e133f8a9e09290ece9f75bd07008',
    bottleColor: 'Amber', alt: "5 ml Amber Tulip Fine Mist Spray Bottle with Matte Gold Sprayer and Cap" },
  GBVialAmb1o5WhtCapSht: { attempt: 'a1', fittedSha256: 'c2d6a7b508802e7b87d55de6a2d718ba24df66f160622575f1b4577b8e8cde43', renderSha256: 'd6ba02bf744a0c2b89e7fc691aa2724b4f513e456ac7c4e7fc0611bd47947022',
    bottleColor: 'Amber', alt: "2 ml Amber Vial with White Screw Cap" },
  GB1mlAmbVialWht: { attempt: 'a1', fittedSha256: '316839b876cf8e397285ab2552368a405e8dde59ea3f203447261e86f95cb68a', renderSha256: '5ae63a03e1d5b1b32678b5fb7068572499afad0f42981827b87bb9c97b537aa9',
    bottleColor: 'Amber', alt: "1 ml Amber Sample Vial with White Plug Applicator" },
  GB1mlVBlk: { attempt: 'a1', fittedSha256: 'ecfe455e239675a898c54d4919f41e7bb8dff85d9780b95b37eaad73f40d3fa8', renderSha256: '29af65ae29799cec645852c9f52f6b543d7f0c0f8772591b3dd4f077f8830c43',
    bottleColor: 'Clear', alt: "1 ml Clear Sample Vial with Black Plug Applicator" },
  GBVAmb2WhtCap: { attempt: 'a1', fittedSha256: '1231e92e3eb67cf8eeac6923d67ccafb61c6be65b9875e0c6f21318501f3c33e', renderSha256: '0cd4c03b68796a384c27d4b609ea1ad91cc7ef03b65e7eb6ee9df13b0776fced',
    bottleColor: 'Amber', alt: "2 ml Amber Vial with White Screw Cap" },
  GBVialClr2mlWhtCap: { attempt: 'a1', fittedSha256: '8496e0bbf7c40a14af55dbd27967cf6cbb8f65652626f51723f77a2c81305792', renderSha256: 'a12bdcc6e4ca1fbbaabc1bfdd78fd46c217e81308fbb9c5064155707fdf0be6a',
    bottleColor: 'Clear', alt: "2 ml Clear Vial with White Screw Cap" },
  GBV1DrmBlkDropper: { attempt: 'a1', fittedSha256: 'd3cc0117f398b96fb9faf3c50a0c04661bf5ccaeb9d71cc44776e1da66981118', renderSha256: 'a8df3086f1c6e6cb950c15a59708af69e9fc31dba5397860662deb5811249445',
    bottleColor: 'Clear', alt: "4 ml Clear Vial with Black Dropper" },
  GBV1DrmWhtCapSht: { attempt: 'a1', fittedSha256: '6d9e47cc4aff2d78f332218085bb401a8308f832c73c6307483d47f920b5366e', renderSha256: '1f58aaa3f65879d63a00c2f428365e37647ff1390ffecb306706ccdd89970a2c',
    bottleColor: 'Clear', alt: "4 ml Clear Vial with White Screw Cap" },
  GBVAmb1DrmBlkDrpr: { attempt: 'a1', fittedSha256: 'd0ef7b06094e3d7120258cfb03f6f1f43e0b061d7319e41f2cd5dfea0a756288', renderSha256: 'd293a0b25982a9f1ddd1ad41b644ef9747eaccbad42ebdde70f06d1b3acf373e',
    bottleColor: 'Amber', alt: "4 ml Amber Vial with Black Dropper" },
  GBVAmb1DrmWhtCapSht: { attempt: 'a1', fittedSha256: 'ac6074c267af1cc8324c00b1870eb24afc4487e0e2606949a7ac96011765d29b', renderSha256: 'db115d144a87c3391479ed98bf47a1a4407bea520ebc6e84b759675061397c78',
    bottleColor: 'Amber', alt: "4 ml Amber Vial with White Screw Cap" },
  GBVBlu1DrmBlkDropper: { attempt: 'a1', fittedSha256: 'f5c4eac748f078bdd63fe125bf26b2d2af9689c865e2f9245cda581a95ce17e0', renderSha256: 'bbf82ba5fd880b41463e68be240c48938f498ddbd4e2be0ca674f3e529a7f404',
    bottleColor: 'Blue', alt: "4 ml Blue Vial with Black Dropper" },
  GBVBlu1DrmWhtCapSht: { attempt: 'a1', fittedSha256: 'b58e8986cfedd300a1d74a193246be3f7c23167f2115d314160c44303eee830a', renderSha256: '53f11f957987b196954e677c2f32b5ac57b9a7ab35087099140a15be3dd091a4',
    bottleColor: 'Blue', alt: "4 ml Blue Vial with White Screw Cap" },
  GBVGr1DrmBlkDropper: { attempt: 'a1', fittedSha256: '5d72bf7e200cbdc68741ab216846ad8f915a0a1c6425e7c3e1e13095da53be93', renderSha256: 'b00f417a4552547f83b79ed189679dd3003f049bc39bbda8b28d9cadfe327068',
    bottleColor: 'Green', alt: "4 ml Green Vial with Black Dropper" },
  GBVGr1DrmWhtCapSht: { attempt: 'a1', fittedSha256: 'c6e78eea786b219f20900ff38f625fe1934be83b14d8d7f84eac4790fbf459a3', renderSha256: '59db8310282d84163a9b673377f75a6465b40b95f0ea67a1f3307fda40bd59ee',
    bottleColor: 'Green', alt: "4 ml Green Vial with White Screw Cap" },
};
const EXPECTED = { Square: 3, Rectangle: 9, Tulip: 6, Diamond: 5, Circle: 1, Round: 1, Teardrop: 3, Vial: 13 };
const HELD = {
  GBVGreen2o4BlackCapSht: 'not rendered: no master PSD (Vial 3 ml green)',
  GBVBlu1o9BlackCapSht: 'not rendered: no master PSD (Vial 3 ml blue)',
  GBRect10MinarCu: 'not rendered: no master PSD (10 ml Minaret)',
  GBMtlCylGl: 'not rendered: Royal 14 ml height disagreement',
  Pillar: 'not rendered: no exact master PSDs',
  Lotion: 'not rendered: lotion glass heights unknown',
  Hearts: 'kept today\'s cards by Jordan\'s decision',
};

async function productionHolder(websiteSku) {
  const response = await fetch(productionQuery, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'products:searchCatalog', format: 'json',
      args: { filters: { search: websiteSku }, sort: 'relevance', view: 'grid', limit: 24 } }),
  });
  const body = await response.json();
  if (body.status !== 'success') throw new Error(`Production query failed: ${websiteSku}`);
  const byId = new Map(body.value.items.map(item => [item._id, item]));
  const holders = body.value.variantPreviewRows.flatMap(row => row.variants
    .filter(variant => variant.websiteSku === websiteSku)
    .map(variant => ({ group: byId.get(row.groupId), variant })));
  if (holders.length !== 1 || !holders[0].group) throw new Error(`Expected one production holder: ${websiteSku}`);
  return holders[0];
}

async function main() {
  const laneJsonPath = path.join(lane, 'approval-candidates.json');
  if (!fs.existsSync(laneJsonPath)) throw new Error('Pass the lane directory: node scripts/hero-families/release-batch3.cjs <lane-dir>');
  const laneJsonBytes = fs.readFileSync(laneJsonPath);
  const candidates = JSON.parse(laneJsonBytes).candidates;
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(path.join(root, 'public', publicDir), { recursive: true });

  const heroes = [];
  const evidence = [];
  for (const [sku, approved] of Object.entries(APPROVED)) {
    const record = candidates.find(c => c.websiteSku === sku);
    if (!record || record.selectedAttempt !== approved.attempt || record.fitted.sha256 !== approved.fittedSha256
      || record.render.sha256 !== approved.renderSha256 || record.render.model !== 'gpt-image-2.5-sunburst') {
      throw new Error(`Lane record no longer matches the approved selection: ${sku}`);
    }
    const source = fs.readFileSync(path.join(lane, record.fitted.file));
    const render = fs.readFileSync(path.join(lane, record.render.file));
    if (hash(source) !== approved.fittedSha256 || hash(render) !== approved.renderSha256) throw new Error(`Changed source: ${sku}`);
    const meta = await sharp(source).metadata();
    if (meta.width !== 2080 || meta.height !== 2288) throw new Error(`Unexpected dimensions: ${sku}`);

    const { group, variant } = await productionHolder(sku);
    if (group.color !== (approved.productionColor ?? approved.bottleColor)) throw new Error(`Production colour mismatch: ${sku}`);

    const resized = await sharp(source).resize(1560, 1716, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    const webp = await sharp(resized, { raw: { width: 1560, height: 1716, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer();
    const decoded = await sharp(webp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== 1560 || decoded.info.height !== 1716 || !decoded.data.equals(resized)) throw new Error(`Lossless export failed: ${sku}`);
    const sha256 = hash(webp);
    const url = `${publicDir}/${sku}.${sha256.slice(0, 12)}.webp`;
    const target = path.join(root, 'public', url);
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(webp)) throw new Error(`Released file changed: ${sku}`);
    fs.writeFileSync(target, webp);

    heroes.push({ groupSlug: group.slug, websiteSku: sku, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, family: group.family, capacityMl: group.capacityMl,
      bottleColor: approved.bottleColor, alt: approved.alt,
      presentation: (sku !== 'GB1mlVBlk' && /AnSp|Rdcr|Clr2ml|1mlAmb|SQST|TRDP|Trdp/.test(sku)) ? 'Original product assembly' : 'Empty · cap beside',
      url, width: 1560, height: 1716, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
    evidence.push({ sku, family: group.family, groupSlug: group.slug, graceSku: variant.graceSku,
      shopifyVariantId: variant.shopifyVariantId, status: 'approved',
      production: { deployment: 'precise-raccoon-123', groupId: group._id, slug: group.slug, displayName: group.displayName,
        color: group.color, capColor: variant.capColor ?? null, applicator: variant.applicator ?? null,
        verifiedBy: 'products:searchCatalog exact websiteSku' },
      url, sha256, bytes: webp.length,
      selectedAttempt: approved.attempt, sourceFittedSha256: approved.fittedSha256, sourceBytes: source.length,
      sourceRenderSha256: approved.renderSha256, model: record.render.model, nativeSize: record.render.nativeSize,
      exportSize: [1560, 1716], resize: 'uniform 0.75 Lanczos3', encoding: 'lossless WebP', decodedPixelsVerified: true,
      attemptsForSku: record.attemptsForSku, sizing: record.sizing, fit: record.fit, qaRaw: record.qaRaw,
      input: record.input, psd: record.psd, promptSha256: record.render.promptSha256 });
  }
  for (const [family, count] of Object.entries(EXPECTED)) {
    if (heroes.filter(hero => hero.family === family).length !== count) throw new Error(`Unexpected ${family} count`);
  }
  fs.writeFileSync(registryPath, JSON.stringify(heroes, null, 2) + '\n');
  fs.writeFileSync(path.join(docs, 'approval.json'), JSON.stringify({
    date: '2026-09-25', approvedBy: 'Jordan ("approve all") after the review sheets', scope: EXPECTED, publication: false,
    source: { lane: 'batch3-2026-09-25', approvalCandidatesSha256: hash(laneJsonBytes) },
    labelFollowUps: Object.fromEntries(Object.entries(APPROVED).filter(([, a]) => a.productionColor).map(([sku, a]) => [sku, {
      registryBottleColor: a.bottleColor, productionColor: a.productionColor,
      note: 'The pictured glass is coloured; production files all three SQST variants as Clear. Data fix left for later.' }])),
    sizing: { curve: 'pct = 3.5314 * mm^0.5868 (landmark-to-foot span; foot at 91%)',
      overrides: { vials: 'Jordan 2026-09-25: 1 ml and 2 ml vials 32%, 3 ml and 4 ml vials 35%',
        stopperBottles: 'Jordan 2026-09-25: SQST (64 mm) and Teardrop (68 mm) sized by full height with the stopper seated on the batch height curve (total_px = 228.9 * mm^0.388, fitted to the open-neck renders)' },
      landmarkRule: 'shoulder = neck base; closure seat for tube vials (rim) and ground-glass stoppers (top of the glass lip)' },
    qa: 'Framing re-registered to the lock (scale within 0.05%, < 1 px); every image reviewed by eye and approved by Jordan',
    held: HELD, rows: evidence,
  }, null, 2) + '\n');
  for (const sheet of ['contact-approved.jpg', 'sizing-proof.jpg', 'review-rerender.jpg']) {
    fs.copyFileSync(path.join(lane, sheet), path.join(docs, sheet));
  }
  console.log(JSON.stringify({ images: heroes.length, shippedBytes: evidence.reduce((sum, row) => sum + row.bytes, 0) }));
}

main().catch(error => { console.error(error); process.exit(1); });
