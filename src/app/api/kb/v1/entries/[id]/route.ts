import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { KB_API_VERSION, apiEntry } from "@/lib/help/api";
import { publicEntryById } from "@/lib/help/kb";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return kbJson(req, () => {
        const entry = publicEntryById(decodeURIComponent(id));
        return entry ? { version: KB_API_VERSION, entry: apiEntry(entry) } : null;
    }, "No published entry with that id");
}
