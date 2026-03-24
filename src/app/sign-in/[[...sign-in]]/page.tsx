import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-bone flex flex-col items-center justify-center">
            <Link
                href="/"
                className="absolute top-6 left-6 flex items-center gap-1.5 font-sans text-[10px] tracking-[0.18em] uppercase text-slate hover:text-obsidian transition-colors"
            >
                ← Home
            </Link>
            <div className="mb-8 text-center">
                <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                    Client Portal
                </p>
                <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em]">
                    Best Bottles
                </h1>
            </div>
            <SignIn fallbackRedirectUrl="/portal" signUpFallbackRedirectUrl="/portal" />
        </div>
    );
}
