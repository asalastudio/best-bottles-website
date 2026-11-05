/* Grace's mark in the headers (2026-11-04): two small sparks, the same fine stroke as the family and collection icons. */
export default function GraceMark({ size = 20 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5c-4.2.6-5.9 2.3-6.5 6.5c-.6-4.2-2.3-5.9-6.5-6.5c4.2-.6 5.9-2.3 6.5-6.5z"/>
            <path d="M18.5 15.5c.2 1.6.9 2.3 2.5 2.5c-1.6.2-2.3.9-2.5 2.5c-.2-1.6-.9-2.3-2.5-2.5c1.6-.2 2.3-.9 2.5-2.5z"/>
        </svg>
    );
}
