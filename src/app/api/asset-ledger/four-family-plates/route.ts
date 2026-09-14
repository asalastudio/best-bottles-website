import {NextRequest,NextResponse} from 'next/server';
import {localReviewRequestAllowed} from '../../../../../scripts/asset-ledger/standard-review.mjs';
import {readFourFamilyPlates,saveFourFamilyPlates} from '../../../../../scripts/asset-ledger/four-family-plates.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
    if(process.env.NODE_ENV!=='development')return NextResponse.json({error:'Open the local review workbench.'},{status:403});
    try{return NextResponse.json(await readFourFamilyPlates(process.cwd()),{headers:{'Cache-Control':'no-store'}});}
    catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to read this batch.'},{status:409});}
}
export async function POST(request:NextRequest){
    if(!localReviewRequestAllowed(request,process.env.NODE_ENV))return NextResponse.json({error:'Save from the local review workbench.'},{status:403});
    try{const raw=await request.text();if(raw.length>200000)return NextResponse.json({error:'Request too large.'},{status:413});
        return NextResponse.json(await saveFourFamilyPlates(process.cwd(),JSON.parse(raw)),{headers:{'Cache-Control':'no-store'}});}
    catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save this batch.'},{status:409});}
}
