import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-bone flex flex-col items-center justify-center">
            <div className="mb-8 text-center">
                <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                    Client Portal
                </p>
                <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em]">
                    Best Bottles
                </h1>
            </div>
            <SignIn afterSignInUrl="/portal" afterSignUpUrl="/portal" />
        </div>
    );
}
