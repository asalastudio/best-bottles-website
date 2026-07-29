# Clerk — production readiness

**Date:** 2026-07-29
**App:** `app_3ANnjbzN1RCz2dOASyExzv8OB2q` ("Best-Bottles-Portals")

---

## The headline: Clerk is NOT in production

Verified three independent ways:

```
Clerk Backend API  → GET /v1/instance
                     { "id": "ins_3ANnjcu6ELW4E1jNnnDAXzGcMZT",
                       "environment_type": "development" }

Vercel Production  → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_…
                     CLERK_SECRET_KEY                  = sk_test_…

Clerk frontend env → displayConfig.instanceEnvironmentType = "development"
                     frontend API host = together-lemur-38.clerk.accounts.dev
                     only domain       = together.lemur-38.lcl.dev
```

**The live Vercel production deployment is running Clerk's development instance.**

Note: the dashboard URL provided points at `ins_3EyaM8yXPtZB8lTO6AUP7T43Oe2`, which is a *different* instance under the same app — almost certainly the production instance. So production likely already exists in Clerk; the app simply isn't pointed at it. Confirming that requires dashboard access, which I don't have.

### Why this blocks launch

| Development instance | Consequence in production |
|---|---|
| Hard user cap (~100) and strict rate limits | Sign-ups fail once the cap is hit |
| "Development mode" badge on every auth screen | Visible to customers (see current screenshots) |
| Shared Clerk OAuth credentials for Google | Consent screen says `accounts.dev`, not Best Bottles |
| Sessions/JWTs are dev-grade; instance can be reset | Everyone gets logged out |
| Only accepts `together.lemur-38.lcl.dev` | No real custom domain |

Current instance holds **4 users**, so cutting over loses nothing meaningful — but note **users do not migrate between instances**. Any real accounts must be recreated.

---

## Cutover checklist

Items marked **dashboard** cannot be done from code.

- [ ] **dashboard** — Confirm the production instance (`ins_3Eya…`) exists and is configured.
- [ ] **dashboard** — Add the production domain (`www.bestbottles.com`, or the Vercel domain pre-cutover) and complete DNS (CNAME records for `clerk.`, `accounts.`, `clkmail.`).
- [ ] **dashboard** — Create a **Google Cloud OAuth client** and paste the Client ID/Secret into Clerk → SSO → Google. **Required:** production instances do not accept Clerk's shared dev Google credentials, so Google sign-in *will break on cutover* unless this is done. Authorized redirect URI is shown in the Clerk dashboard.
- [ ] **vercel** — Replace `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) and `CLERK_SECRET_KEY` (`sk_live_…`) in Production.
- [ ] **dashboard** — Set Paths: sign-in `/sign-in`, sign-up `/sign-up`, after-sign-in/up `/portal`.
- [ ] **dashboard** — Upload the Best Bottles logo (currently `logoImageUrl: null`).
- [ ] **dashboard** — Turn off "Secured by Clerk" (see below).
- [ ] Re-verify sign-in, Google sign-in, and `/portal/settings` on the production deployment.

```bash
npx vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
```

```bash
npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
```

---

## "Secured by Clerk" branding

Currently `displayConfig.branded = true`.

This is a **billing setting, not a code setting** — Clerk includes the badge on the free plan and unlocks removal on a paid plan. Flip it in the dashboard once the account is on a paid plan and the badge disappears automatically; no code change is needed, and the styling already in place will pick it up.

I deliberately did **not** CSS-hide the badge. On the free plan that circumvents Clerk's terms, and it would silently break the moment they audit or restyle. The "Development mode" badge next to it is separate and vanishes on its own once the production instance is live.

---

## Google sign-in

**Currently enabled** — `socialEnabled: ["oauth_google"]`, and the "Continue with Google" button renders on both `/sign-in` and `/sign-up`.

The catch: on a development instance this runs on **Clerk's shared Google OAuth app**. It works for testing, but the consent screen is not branded Best Bottles, and — critically — **it does not carry over to production**. A production instance requires your own Google Cloud OAuth client. Without it, Google sign-in goes from "working in dev" to "broken in prod" at cutover. This is the single most likely thing to be missed.

---

## Sign-up fields / onboarding

Live config from the Clerk environment:

```
email_address   enabled, REQUIRED, verified by code
password        enabled, REQUIRED
first_name      enabled, optional
last_name       enabled, optional
ticket          enabled (invitation links)
phone_number    not enabled
```

So the current flow is: email → verification code → password, with name optional.

Two things worth deciding:

1. **Names are optional**, so they render with a grey "Optional" tag and most users skip them. The portal then greets people with no name. If the portal should address customers by name, make first/last **required** in the dashboard (Clerk → User & Authentication → Personal information).
2. **No company field.** B2B accounts key off a Clerk **organization**, and the portal already shows "Choose your organization to use the portal" when none is active — meaning a self-serve signup lands in a dead end. Either enable Organizations with self-serve creation, or gate portal accounts behind invitations (the `ticket` attribute is already enabled, so invitation-based onboarding works today).

The second is the real onboarding gap: **a customer who signs up on their own cannot reach a functioning portal.** That's a product decision — invite-only vs self-serve — not something to guess at.

---

## What was done in code

| File | Change |
|---|---|
| `src/lib/clerkAppearance.ts` | **new** — brand theme applied globally at `<ClerkProvider>`, so SignIn/SignUp/UserButton/UserProfile all inherit it |
| `src/lib/clerkPortalAppearance.ts` | **new** — denser neutral theme for embedded portal surfaces |
| `src/components/auth/AuthShell.tsx` | **new** — sign-in/up now sit inside the site (Navbar, brand panel, Footer) instead of floating on a blank page |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Uses AuthShell; path routing; context-aware copy per hub |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Same treatment; cross-links preserve `redirect_url` |
| `src/app/(portal)/portal/settings/[[...rest]]/page.tsx` | **new** — `<UserProfile routing="path">` embedded in the portal shell |
| `src/components/portal/PortalSidebar.tsx` | Added "Profile & Security"; replaced the sparkle Grace icon |
| `src/components/portal/PortalTopBar.tsx` | Longest-prefix breadcrumb so Clerk sub-routes label correctly |
| `src/app/globals.css` | `.cl-*` overrides that dissolve Clerk's default card into the page |

**Account editing is now embedded**: `/portal/settings` mounts Clerk's `<UserProfile />` with `routing="path"`, so name, email addresses, password, connected accounts, and active sessions are all edited inside the portal — no redirect to `accounts.dev`. Sub-routes (`/portal/settings/security`) stay in the shell; both verified returning 307 → sign-in when logged out.

### Iconography

Replaced the generic "AI sparkle" motif with literal icons:

| Where | Before | After |
|---|---|---|
| Portal sidebar — Grace | star/sparkle | conversation bubble |
| Grace workspace greeting | filled `Star` | `ChatCircle` |
| Fitment carousel + drawer | `Sparkles` | `LinkSimple` (two parts that mate) |
| Navbar "Grace Collection" | `Sparkle` | `SprayBottle` (it's a bottle family, not AI) |
| Auth shell benefits | `ShieldCheck`/`Sparkle`/`Truck` | `Tag` / `Ruler` / `ArrowsClockwise` |

Copy was de-AI'd too: "Grace remembers your specs" → "Your specs, on file".

Remaining `Sparkle`/`Star` uses in `HomePage.tsx` (a "Something Else" browse category) and `PdpBlocks.tsx` (a Sanity-driven icon map editors pick from) were left alone — those are content choices, not AI signifiers. Say the word and I'll change them too.
