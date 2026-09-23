import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { SanityLive } from "@/sanity/lib/live";

/**
 * Mounts the Sanity Live listener and Visual Editing overlays only while
 * Draft Mode is on (Studio Presentation). Published visitors get the
 * server-rendered sanityFetch result without a live SSE.
 *
 * Drop this into a route that fetches with `sanityFetch` to make that route
 * visually editable inside Presentation.
 */
export default async function SanityLiveVisualEditing() {
    const { isEnabled } = await draftMode();
    // Published storefront visitors do not need the Live Content listener.
    // Leaving it mounted opened a Sanity SSE on every homepage/PDP/journal
    // view, which failed CORS on unknown origins and added a persistent
    // connection with no customer benefit. Editors in Presentation still
    // get live updates plus click-to-edit overlays.
    if (!isEnabled) return null;
    return (
        <>
            <SanityLive />
            <VisualEditing />
        </>
    );
}
