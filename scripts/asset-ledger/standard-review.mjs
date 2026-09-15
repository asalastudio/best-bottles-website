import {createHash, randomUUID} from 'node:crypto';
import {readFile, realpath, writeFile, rename, open, unlink} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {readFinalImage} from './final-image-review.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
const masterRoot = '/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';

export function localReviewRequestAllowed(request, environment) {
  const url = new URL(request.url);
  return environment === 'development' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    && request.headers.get('origin') === url.origin
    && request.headers.get('content-type')?.split(';')[0] === 'application/json';
}

async function verifiedFile(file, expected, root) {
  const actual = await realpath(file), boundary = await realpath(root);
  if (!actual.startsWith(boundary + path.sep)) throw new Error('Reference must remain inside its approved source folder.');
  const bytes = await readFile(actual);
  if (!/^[a-f0-9]{64}$/.test(expected ?? '') || bytesHash(bytes) !== expected) throw new Error('Image bytes changed. Prepare a fresh review before approving.');
  return bytes;
}
async function verifiedImage(root, asset) {
  if (!asset?.url?.startsWith('/images/') || asset.url.includes('?') || asset.url.includes('#')) throw new Error('A saved local review image is required.');
  const bytes = await verifiedFile(path.join(root,'public',asset.url),asset.sha256,path.join(root,'public/images'));
  const meta = await sharp(bytes).metadata();
  return {width:meta.width,height:meta.height};
}

// Prepared evidence is authored by the source/measurement pipeline, never accepted from a button payload.
export async function lockReadiness(root, standard) {
  const p = standard.preparedReview;
  if (standard.sizingRequest?.status === 'approved') return {ready:false,reason:'This comparison is already locked. Request a new sizing comparison to revise it.'};
  if (!p) return {ready:false, reason:'Bare-glass measurement and a same-zoom comparison still need preparation.'};
  try {
    if (p.standardVersion !== standard.version || p.referenceSha256 !== standard.reference.sha256 || p.requestId !== standard.sizingRequest?.id) throw new Error('The comparison is out of date. Prepare it again for the latest sizing request.');
    if (p.measurement !== 'full_glass' || !p.bareGlass?.identityVerified || !p.bareGlass?.verifiedBy || !p.bareGlass?.verifiedAt) throw new Error('Verify the matching bare-glass source and its rim before locking.');
    await verifiedFile(p.bareGlass.sourcePath,p.bareGlass.sourceSha256,masterRoot);
    await verifiedImage(root,p.bareGlass);
    const before = await verifiedImage(root,p.before), after = await verifiedImage(root,p.after);
    if (p.kind === 'bare-glass-standard') {
      await verifiedImage(root,p.referenceImage);
      if (p.referenceImage.sha256 !== standard.reference.sha256) throw new Error('The glass comparison must retain the approved appearance reference.');
    } else if (p.before.sha256 !== standard.reference.sha256) throw new Error('Before and after must use the reference and the same canvas size.');
    if (before.width !== after.width || before.height !== after.height || after.width !== p.canvas?.width || after.height !== p.canvas?.height) throw new Error('Before and after must use the reference and the same canvas size.');
    const {rimY,baseY} = p.glass ?? {};
    if (![rimY,baseY].every(Number.isFinite) || rimY < 0 || rimY >= baseY || baseY > after.height || p.baselinePercent !== 91 || Math.abs(baseY/after.height*100-91) > 0.1) throw new Error('Verify rim-to-base glass height at the fixed 91% baseline.');
    if (!p.registrationVerified || !p.assemblyBoundsVerified || !p.scopeVerified) throw new Error('Glass registration, complete assembly bounds and physical group membership need verification.');
    if (digest([...(p.productGroupIds??[])].sort()) !== digest([...standard.productGroupIds].sort())) throw new Error('The comparison must name every affected product group.');
    const beforeGlass = p.beforeGlass;
    if (!beforeGlass || ![beforeGlass.rimY,beforeGlass.baseY].every(Number.isFinite) || beforeGlass.rimY < 0 || beforeGlass.baseY <= beforeGlass.rimY || beforeGlass.baseY > before.height) throw new Error('Verify the original glass landmarks before comparing scale.');
    const measuredChange = ((baseY-rimY)/(beforeGlass.baseY-beforeGlass.rimY)-1)*100;
    if (standard.sizingRequest.percent !== null && Math.abs(measuredChange-standard.sizingRequest.percent) > 0.2) throw new Error('The measured scale does not match the requested percentage.');
    return {ready:true, reason:'Measured comparison ready for your approval.', packetHash:digest(p), glassHeightPercent:(baseY-rimY)/after.height*100};
  } catch (error) { return {ready:false,reason:error.message}; }
}

// A display-only plan: no new image bytes, approval, registry entry or shadow editing.
export async function appearancePreview(root, s) {
  if (s.state !== 'locked') return {ready:false,reason:'Lock the glass standard first.'};
  try {
    const p=s.preparedReview, target=s.targets?.hero, source=s.appearanceReference;
    if (!p || s.approval?.sha256 !== s.reference.sha256 || s.approval?.packetHash !== digest(p)
      || s.approval?.standardVersion !== s.version) throw new Error('The active lock needs its original verified comparison packet.');
    if (p.kind !== 'bare-glass-standard' || p.referenceImage?.sha256 !== source?.sha256
      || p.after?.sha256 !== s.reference.sha256) throw new Error('Register this appearance image against the locked glass before previewing.');
    const canvas=await verifiedImage(root,source), reference=await verifiedImage(root,s.reference);
    if ([canvas,reference,target?.canvas].some(c=>c?.width!==p.canvas.width||c?.height!==p.canvas.height)) throw new Error('The source and standard canvases must match.');
    const sourceHeight=p.beforeGlass?.baseY-p.beforeGlass?.rimY;
    const targetHeight=target?.glassHeightPercent/100*canvas.height;
    if (target?.measurement!=='full_glass'||target.baselinePercent!==91
      || !Number.isFinite(sourceHeight)||sourceHeight<=0||!Number.isFinite(targetHeight)||targetHeight<=0
      || Math.abs(targetHeight-(p.glass?.baseY-p.glass?.rimY))>0.01
      || Math.abs(p.glass.baseY-canvas.height*.91)>0.01) throw new Error('The locked target and glass landmarks do not agree.');
    const scale=targetHeight/sourceHeight;
    return {ready:true,source,canvas,scale,translateX:canvas.width/2*(1-scale),
      translateY:p.glass.baseY-p.beforeGlass.baseY*scale,
      sourceRimY:p.beforeGlass.rimY,targetRimY:p.glass.rimY,baselinePercent:91,
      sourceHeight,targetHeight,standardVersion:s.version};
  } catch(error) {return {ready:false,reason:error.message};}
}

export async function readStandards(root) {
  const document = JSON.parse(await readFile(path.join(root,'data/asset-ledger/bottle-standards.json'),'utf8'));
  return {document, standards:await Promise.all(document.standards.map(async s=>({...s,revisionToken:digest(s),lockReadiness:await lockReadiness(root,s),appearancePreview:await appearancePreview(root,s),finalCandidate:await readFinalImage(root,s)})))};
}

export async function saveStandardDecision(root, input, actor='Local workbench · explicit review action') {
  const file = path.join(root,'data/asset-ledger/bottle-standards.json'), lock = file+'.write-lock';
  let handle;
  try { handle = await open(lock,'wx'); } catch { throw new Error('Another review is being saved. Refresh and try again.'); }
  try {
    const {document} = await readStandards(root), s = document.standards.find(s=>s.id===input.id);
    if (!s || digest(s) !== input.revisionToken) throw new Error('This standard changed. Refresh before saving your decision.');
    await verifiedImage(root,s.reference);
    const at = new Date().toISOString();
    const event = {id:randomUUID(),action:input.action,at,actor,standardVersion:s.version,referenceSha256:s.reference.sha256,standardHash:digest(s)};
    if (input.action === 'request-sizing') {
      const percent = input.percent;
      if (percent !== null && (!Number.isFinite(percent) || percent < -20 || percent > 20)) throw new Error('Choose a size change between −20% and +20%.');
      const note = typeof input.note === 'string' ? input.note.trim() : '';
      if (note.length > 1000 || (percent === null && !note)) throw new Error('Add a short sizing request or choose a percentage.');
      s.sizingRequest = {...event,percent,note,status:'requested',baselinePercent:91,measurement:'full_glass'};
      // An active lock and sibling approvals survive a requested revision.
    } else if (input.action === 'approve-reference') {
      s.referenceDecision = {...event,sha256:s.reference.sha256};
    } else if (input.action === 'lock') {
      const readiness = await lockReadiness(root,s);
      if (!readiness.ready || input.packetHash !== readiness.packetHash) throw new Error(readiness.reason);
      const p = s.preparedReview;
      s.priorStandards ??= [];
      if (s.state === 'locked') s.priorStandards.push({version:s.version,reference:s.reference,targets:s.targets,approval:s.approval});
      if (s.state === 'locked') s.version += 1;
      if (p.kind === 'bare-glass-standard') s.appearanceReference ??= s.reference;
      s.reference = {...s.reference,...p.after,sharedHeightApproved:true};
      if (p.kind === 'bare-glass-standard') delete s.reference.imageApproval;
      s.targets = {...s.targets,hero:{measurement:'full_glass',glassHeightPercent:readiness.glassHeightPercent,baselinePercent:91,canvas:p.canvas}};
      s.approval = {...event,sha256:p.after.sha256,packetHash:readiness.packetHash,standardVersion:s.version};
      s.state = 'locked'; s.hold = ''; s.sizingRequest.status = 'approved';
    } else throw new Error('Unknown review action.');
    s.reviewEvents ??= []; s.reviewEvents.push({...event,...(input.action==='request-sizing'?{percent:input.percent,note:s.sizingRequest.note}:{})});
    const temporary = file+'.'+randomUUID()+'.tmp';
    await writeFile(temporary,JSON.stringify(document,null,2)+'\n');
    await rename(temporary,file);
    return (await readStandards(root)).standards.find(s=>s.id===input.id);
  } finally { await handle.close(); await unlink(lock); }
}
