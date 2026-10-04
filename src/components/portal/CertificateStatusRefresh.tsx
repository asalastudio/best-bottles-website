"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Refresh visible tabs, but never replace a form while someone is editing it. */
export default function CertificateStatusRefresh() {
    const router = useRouter();
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === "visible" && !document.activeElement?.closest("form")) router.refresh();
        };
        const timer = setInterval(refresh, 30_000);
        window.addEventListener("focus", refresh);
        return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
    }, [router]);
    return null;
}
