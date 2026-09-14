import {NextRequest,NextResponse} from 'next/server';
import {localReviewRequestAllowed} from '../../../../../scripts/asset-ledger/standard-review.mjs';
import {saveFinalImageDecision} from '../../../../../scripts/asset-ledger/final-image-review.mjs';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!localReviewRequestAllowed(request,process.env.NODE_ENV))return NextResponse.json({error:'Save from the local review workbench.'},{status:403});
 try{
  const text=await request.text();if(text.length>8000)return NextResponse.json({error:'Review is too large.'},{status:413});
  const candidate=await saveFinalImageDecision(process.cwd(),JSON.parse(text));
  return NextResponse.json({candidate},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to save review.'},{status:409});}
}
