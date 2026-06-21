import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { SanityLive } from "@/sanity/lib/live";

/**
 * Mounts the Sanity Live listener (keeps sanityFetch results fresh) and the
 * Visual Editing overlays. The click-to-edit overlays only render when Draft
 * Mode is active — i.e. inside the Studio's Presentation tool — so normal
 * visitors never download the overlay runtime.
 *
 * Drop this into a route that fetches with `sanityFetch` to make that route
 * visually editable.
 */
export default async function SanityLiveVisualEditing() {
    const { isEnabled } = await draftMode();
    return (
        <>
            <SanityLive />
            {isEnabled ? <VisualEditing /> : null}
        </>
    );
}
