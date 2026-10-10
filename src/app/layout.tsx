import type { Metadata, Viewport } from "next";
import { brandFace, cormorant, ebGaramond } from "./fonts";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import StorefrontIntl from "@/components/StorefrontIntl";
import { getCachedMegaMenuPanels } from "@/lib/megaMenuPanels.server";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_ROBOTS,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/seo";
import { localeOpenGraph } from "@/i18n/metadata";

// Static English shell. Reading cookies() or the locale header here would make
// every route dynamic and push the LCP image behind a loading stream.
export function generateMetadata(): Metadata {
  const description = SITE_DESCRIPTION;
  const title = `${SITE_NAME} — ${SITE_TAGLINE}`;
  const og = localeOpenGraph("en", "/");

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    keywords: [
      "glass bottles wholesale",
      "perfume bottles",
      "essential oil bottles",
      "roll-on bottles",
      "boston round bottles",
      "euro dropper bottles",
      "glass packaging",
      "beauty packaging",
      "fragrance bottles",
      "wholesale packaging",
      "spray bottles",
      "dropper bottles",
      "cosmetic packaging",
      "Nemat International",
      "Best Bottles",
    ],
    authors: [{ name: "Best Bottles", url: SITE_URL }],
    creator: "Nemat International",
    publisher: "Best Bottles",
    robots: DEFAULT_ROBOTS,
    openGraph: {
      type: "website",
      locale: og.locale,
      url: og.url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    verification: {
      google: "laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc",
      other: {
        "msvalidate.01": "DD2ECFD7F20F418A4A67662DFC0D0B03",
      },
    },
  };
}

// viewport-fit: cover is required for env(safe-area-inset-*) on iOS. Without
// it the tab bar, sticky PDP chrome, and builder sheets sit under the home
// indicator and the URL-bar overlay (see mobile-pdp-chrome.ts).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F3EF",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch mega-menu panels on the server (Sanity) and pass to the client-side
  // provider via props. Lets AppProviders stay a Client Component without
  // rendering an async Server Component inside it (which Next.js disallows).
  const megaMenuPanels = await getCachedMegaMenuPanels();

  return (
    <html lang="en" className={`${brandFace.variable} ${cormorant.variable} ${ebGaramond.variable}`}>
      <body className="antialiased selection:bg-muted-gold/20 selection:text-obsidian">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
        />
        <StorefrontIntl>
          <AppProviders megaMenuPanels={megaMenuPanels}>{children}</AppProviders>
        </StorefrontIntl>
      </body>
    </html>
  );
}
