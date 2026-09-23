import {NextRequest,NextResponse} from 'next/server';
import {localReviewRequestAllowed} from '../../../../../scripts/asset-ledger/standard-review.mjs';
import {savePlateBatch} from '../../../../../scripts/asset-ledger/plate-contact-sheet.mjs';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!localReviewRequestAllowed(request,process.env.NODE_ENV))return NextResponse.json({error:'Save from the local review workbench.'},{status:403});
 try{const text=await request.text();if(text.length>500000)return NextResponse.json({error:'Batch is too large.'},{status:413});const sheet=await savePlateBatch(process.cwd(),JSON.parse(text));return NextResponse.json({sheet},{headers:{'Cache-Control':'no-store'}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save this batch.'},{status:409});}
}
