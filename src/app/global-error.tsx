"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary: renders when the root layout itself throws. It has to
 * paint its own <html> and <body> because the layout is gone. Styling is
 * inline for the same reason — globals.css may not have loaded.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body style={{ margin: 0, background: "#f7f4ee", color: "#1d1d1f", fontFamily: "Georgia, 'Times New Roman', serif" }}>
                <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 1rem" }}>
                    <div style={{ maxWidth: 420, textAlign: "center" }}>
                        <h1 style={{ fontSize: "1.9rem", fontWeight: 500, marginBottom: "1rem" }}>Something went wrong</h1>
                        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#5b5b60", marginBottom: "2rem" }}>
                            The page could not be displayed. Our team has been notified. Please try again or return to the homepage.
                        </p>
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                            <button
                                type="button"
                                onClick={reset}
                                style={{ padding: "0.65rem 1.5rem", borderRadius: 999, border: "1px solid #1d1d1f", background: "#1d1d1f", color: "#f7f4ee", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
                            >
                                Try again
                            </button>
                            {/* A plain anchor on purpose: global-error replaces the root
                                layout, so the app router may be in the very state that
                                broke. A full document load is the recovery we want. */}
                            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                            <a
                                href="/"
                                style={{ padding: "0.65rem 1.5rem", borderRadius: 999, border: "1px solid #1d1d1f", color: "#1d1d1f", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none" }}
                            >
                                Go home
                            </a>
                        </div>
                        {error?.digest ? (
                            <p style={{ marginTop: "1.5rem", fontSize: "0.7rem", color: "#8a8a90" }}>Reference: {error.digest}</p>
                        ) : null}
                    </div>
                </main>
            </body>
        </html>
    );
}
