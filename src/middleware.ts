import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Clerk auth disabled — re-enable when portal auth is needed
export default function middleware(_req: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
