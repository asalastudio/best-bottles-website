/**
 * The Journal is the one place EB Garamond stays (Jordan, 2026-09-14): `.editorial` restores the
 * serif for every `font-serif` / `.font-display` / `.font-cormorant` utility in this subtree, while
 * the rest of the site resolves those to the brand face (see globals.css).
 */
export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="editorial">{children}</div>;
}
