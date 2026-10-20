// Local schema/importer/auth-gate probe. No deployment, client, network, or database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const output=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(output,'../../..');
const require=createRequire(path.join(repo,'package.json'));
const {registerSlotV}=require('./convex/registerValidators.ts');
const {kitRowV,upsertMany}=require('./convex/productKits.ts');
const {upsertAssemblies}=require('./convex/register.ts');
const schema=require('./convex/schema.ts').default;
const {parseBuildParts}=require('./scripts/register/registerRows.ts');
const previous=['body','fitment','roller','cap','overcap','sprayer','pump','diptube','collar','bulb','tassel','reducer','pipette'];
const expected=[...previous,'ring'];
const validators={
 register:registerSlotV,
 kitMutation:kitRowV.fields.parts.element.fields.slot,
 kitTable:schema.tables.productKits.validator.fields.parts.element.fields.slot,
 componentTable:schema.tables.registerComponents.validator.fields.layers.element.fields.slot,
 assemblyTable:schema.tables.registerAssemblies.validator.fields.build.fields.parts.element.fields.role,
};
for(const [name,validator] of Object.entries(validators))assert.deepEqual(validator.json.value.map(v=>v.value),expected,name);
let importerError;
try {parseBuildParts('ring:REVIEW-ONLY','review-only');} catch(e){importerError=e.message;}
assert.match(importerError,/build role.*ring.*not one of/);
assert.deepEqual(parseBuildParts('sprayer:REVIEW-ONLY','review-only'),[{role:'sprayer',componentId:'REVIEW-ONLY'}]);
const saved=process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
try {
 process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN='local-review-only-not-a-credential';
 for(const fn of [upsertMany,upsertAssemblies]){
  await assert.rejects(()=>fn._handler({}, {writeToken:'wrong',rows:[]}),/unauthorized_product_image_write/);
  assert.deepEqual(await fn._handler({}, {writeToken:'local-review-only-not-a-credential',rows:[]}),[]);
 }
} finally {
 if(saved===undefined)delete process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
 else process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN=saved;
}
const result={scope:'Local definitions and handler gate probe only, not a deployed Convex test',slotValidatorsCompared:Object.keys(validators),previousSlotsRetained:13,newSlots:['ring'],wrongWriteTokenRejectedBeforeDbAccess:true,authorizedEmptyBatchesWriteNothing:true,csvImporterAcceptsSprayer:true,csvImporterAcceptsRing:false,ringImporterError:importerError,networkCalls:0,databaseCalls:0,productionChanges:0};
fs.writeFileSync(path.join(output,'convex-review-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
