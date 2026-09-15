import {NextRequest,NextResponse} from 'next/server';
import {localReviewRequestAllowed} from '../../../../../scripts/asset-ledger/standard-review.mjs';
import {saveCompletion} from '../../../../../scripts/asset-ledger/plate-completion.mjs';
import {localBostonPreview} from '../../../../../scripts/asset-ledger/product-preview.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!localBostonPreview(process.env.NODE_ENV,request.headers.get('host'),'boston'))return NextResponse.json({error:'Local preview only.'},{status:403});
 try{const raw=await readFile(path.join(process.cwd(),'data/asset-ledger/boston-plate-completion.json'));let revision=0;try{revision=JSON.parse(await readFile(path.join(process.cwd(),'data/asset-ledger/boston-completion-decisions.json'),'utf8')).revision;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 return NextResponse.json({version:createHash('sha256').update(raw).digest('hex')+':'+revision},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Prepared images are not available yet.'},{status:503});}
}
export async function POST(request:NextRequest){
 if(!localReviewRequestAllowed(request,process.env.NODE_ENV))return NextResponse.json({error:'Save from the local review workbench.'},{status:403});
 try{const raw=await request.text();if(raw.length>500000)return NextResponse.json({error:'Review is too large.'},{status:413});return NextResponse.json({sheet:await saveCompletion(process.cwd(),JSON.parse(raw))},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to save review.'},{status:409});}
}
