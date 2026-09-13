import {createHash} from 'node:crypto';
export const standardHash = standard => createHash('sha256').update(JSON.stringify(standard)).digest('hex');

export function resolveBottleStandard(standards, product) {
  const matches=standards.filter(s=>s.productGroupIds.includes(product.productGroupId));
  if(matches.length!==1)throw new Error('Physical bottle identity requires one explicit standard mapping');
  const s=matches[0];
  if(s.family!==product.family || s.capacityMl!==product.capacityMl || !s.neckFinishes.includes(product.neckThreadSize))throw new Error('Catalog fields disagree with the mapped bottle standard');
  return s;
}

// Geometry planning only: never edits a photograph, component or shadow.
// Landmarks come from the exact source image, never from a SKU or filename.
export function planGlassNormalization(standard, input) {
  if(standard.state!=='locked' || !standard.approval?.sha256 || standard.approval.sha256!==standard.reference.sha256)throw new Error('Bottle standard is not locked to its approved reference bytes');
  const target=standard.targets?.[input.assetKind];
  if(!target || target.measurement!=='full_glass' || !(target.glassHeightPercent>0 && target.glassHeightPercent<100) || !(target.baselinePercent>target.glassHeightPercent && target.baselinePercent<=100))throw new Error('An explicit full-glass target is required for this presentation');
  if(input.standardVersion!==standard.version)throw new Error('Stale standard version');
  const {baseY,rimY,centerX}=input.glass;
  if(![baseY,rimY,centerX,input.canvas.width,input.canvas.height].every(Number.isFinite)||baseY<=rimY)throw new Error('Verified glass landmarks are required');
  const scale=(target.glassHeightPercent/100*input.canvas.height)/(baseY-rimY);
  const x=input.canvas.width/2-centerX*scale;
  const y=target.baselinePercent/100*input.canvas.height-baseY*scale;
  const b=input.assemblyBounds;
  if(!b||![b.left,b.right,b.top,b.bottom].every(Number.isFinite)||b.left>=b.right||b.top>=b.bottom)throw new Error('Verified assembly bounds are required');
  if(b.left*scale+x<0||b.right*scale+x>input.canvas.width||b.top*scale+y<0||b.bottom*scale+y>input.canvas.height)throw new Error('Closure would clip at the locked bottle size; review the presentation, do not silently shrink the bottle');
  return {standardId:standard.id,standardVersion:standard.version,referenceSha256:standard.reference.sha256,scale,translateX:x,translateY:y,needsImageReview:true};
}
