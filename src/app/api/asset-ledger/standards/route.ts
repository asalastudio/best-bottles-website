import {NextRequest,NextResponse} from 'next/server';
import {localReviewRequestAllowed,saveStandardDecision} from '../../../../../scripts/asset-ledger/standard-review.mjs';

export const runtime = 'nodejs';
// Local review writes only. Staff preview in deployed environments remains read-only.
export async function POST(request:NextRequest) {
  if (!localReviewRequestAllowed(request,process.env.NODE_ENV)) return NextResponse.json({error:'Save decisions from the local review workbench.'},{status:403});
  try {
    const payload = await request.text();
    if (payload.length > 4096) return NextResponse.json({error:'Review request is too large.'},{status:413});
    const standard = await saveStandardDecision(process.cwd(),JSON.parse(payload));
    return NextResponse.json({standard},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Unable to save this review.'},{status:409});
  }
}
