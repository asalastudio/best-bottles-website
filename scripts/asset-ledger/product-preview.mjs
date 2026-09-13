export function localBostonPreview(environment, host, flag) {
 return environment === 'development' && flag === 'boston' && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? '');
}
// Match catalog identities, never SKU naming conventions. Held candidates stay
// in the workbench; product pages receive only verified, reviewable images.
export function previewPlates(sheet, groupId, variants, current) {
 const plates={...current};
 for(const row of sheet?.rows ?? []) {
  if(!row.eligible || row.productGroupId !== groupId) continue;
  const variant=variants.find(v=>v.websiteSku===row.sku || v.graceSku===row.sku);
  if(!variant)continue;
  const on=row.views.find(v=>v.label==='Cap on'),off=row.views.find(v=>v.label==='Cap off');
  if(!on)continue;
  const plate={image:on.url,imageCapOff:off?.url ?? null,localCandidate:true,reviewStatus:row.status};
  for(const key of [variant.graceSku,variant.websiteSku].filter(Boolean))plates[key]=plate;
 }
 return plates;
}
