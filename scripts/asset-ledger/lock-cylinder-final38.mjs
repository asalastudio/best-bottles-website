// Freeze Jordan's existing batch decision. This does not approve or publish.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readCylinderFinalPlates} from './cylinder-final-plates.mjs';

const root=process.cwd();
const folder='docs/reviews/cylinder-final38-2026-09-13';
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=async file=>{const bytes=await readFile(path.join(root,file));return {file,sha256:digest(bytes),data:JSON.parse(bytes)};};
const sheet=await readCylinderFinalPlates(root);
if(sheet.status!=='approved'||sheet.alignmentFailures)throw Error('A verified final approval is required.');
const approval=await read('data/asset-ledger/cylinder-final38-decisions.json');
const decision=approval.data.history.findLast(d=>d.token===sheet.token);
if(!decision?.visualApproved||!decision.legacySourcesAccepted)throw Error('The recorded acknowledgments are incomplete.');
const manifest=await read('dist/paper-doll/cylinder-final38-2026-09-13/manifest.json');
if(manifest.data.reviewPacketSha256!==sheet.token||manifest.data.approvalStatus!=='approved'||manifest.data.rows.length!==38)throw Error('Restage the approved packet before locking.');
for(const row of sheet.rows){
    const saved=decision.entries.find(e=>e.sku===row.sku);
    const staged=manifest.data.rows.filter(e=>e.websiteSku===row.sku);
    if(!saved||saved.binding!==row.binding||saved.status!=='approved'||staged.length!==1||staged[0].reviewBinding!==row.binding||!staged[0].publishable)throw Error('Approval or staged identity differs: '+row.sku);
    for(const view of row.views){
        const asset=staged[0][view.role==='on'?'plate':'plateCapOff'];
        if(!saved.views.some(v=>v.role===view.role&&v.sha256===view.sha256)||asset?.sha256!==view.sha256)throw Error('Approved view mismatch: '+row.sku);
        const bytes=await readFile(path.join(root,'dist/paper-doll/cylinder-final38-2026-09-13',asset.key));
        if(digest(bytes)!==view.sha256)throw Error('Staged bytes changed: '+row.sku);
    }
}
const lock={schemaVersion:1,release:manifest.data.release,approvedAt:decision.at,actor:decision.actor,
    approvalId:decision.id,reviewPacketSha256:sheet.token,approvalFile:approval.file,approvalFileSha256:approval.sha256,
    manifestFile:manifest.file,manifestSha256:manifest.sha256,visualApproved:true,legacySourcesAccepted:true,
    publicationAuthorized:false,rows:decision.entries,
    note:'Immutable approval and exact staged-byte lock. A separate release-specific ship and hosted verification remain required.'};
const file=path.join(root,folder,'approved-lock.json'),bytes=JSON.stringify(lock,null,2)+'\n';
try{await writeFile(file,bytes,{flag:'wx'});}catch(e){
    if(e.code!=='EEXIST'||await readFile(file,'utf8')!==bytes)throw Error('An existing lock cannot be replaced. Prepare a new review revision.');
}
console.log(JSON.stringify({locked:lock.rows.length,views:76,reviewPacketSha256:sheet.token,manifestSha256:manifest.sha256,publicationAuthorized:false}));
