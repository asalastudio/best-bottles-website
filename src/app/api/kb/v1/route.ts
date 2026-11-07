import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { KB_API_VERSION } from "@/lib/help/api";
import { SITE_URL } from "@/lib/seo";

export async function GET(req: NextRequest) {
    return kbJson(req, () => ({
        name: "Best Bottles help center API",
        version: KB_API_VERSION,
        readOnly: true,
        description: "Approved public answers and catalog-listed bottle–closure fits. Only published, public entries are served. Prices and stock are not served; follow catalog links for live data.",
        openapi: `${SITE_URL}/api/kb/v1/openapi.json`,
        endpoints: {
            entries: `${SITE_URL}/api/kb/v1/entries`,
            entry: `${SITE_URL}/api/kb/v1/entries/{id}`,
            search: `${SITE_URL}/api/kb/v1/search?q={query}`,
            bottles: `${SITE_URL}/api/kb/v1/fit`,
            fit: `${SITE_URL}/api/kb/v1/fit/{bottleId}`,
        },
        humanPages: `${SITE_URL}/help`,
    }));
}
