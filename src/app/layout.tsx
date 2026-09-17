import type { Metadata, Viewport } from "next";
import { brandFace, cormorant, ebGaramond } from "./fonts";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import AppProviders from "@/components/AppProviders";
import { REGION_COOKIE } from "@/lib/region";
import { getMegaMenuPanels } from "@/sanity/lib/queries";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/seo";
import { defaultLocale, isEnglishOnlyPath, isLocale, LOCALE_HEADER, PATHNAME_HEADER, type AppLocale } from "@/i18n/config";
import { localizedAbsoluteUrl, localeOpenGraph } from "@/i18n/metadata";
import { stripLocalePrefix } from "@/i18n/paths";
import esMessages from "../../messages/es.json";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const headerLocale = headerStore.get(LOCALE_HEADER);
  const locale: AppLocale = isLocale(headerLocale) ? headerLocale : defaultLocale;
  const pathname = headerStore.get(PATHNAME_HEADER) ?? "/";
  const stripped = stripLocalePrefix(pathname) || "/";
  const isEs = locale === "es";
  const description = isEs ? esMessages.meta.homeDescription : SITE_DESCRIPTION;
  const title = `${SITE_NAME} — ${SITE_TAGLINE}`;
  const og = localeOpenGraph(locale, stripped);

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
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
    },
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
    alternates: isEnglishOnlyPath(stripped)
      ? undefined
      : {
          languages: {
            en: localizedAbsoluteUrl("en", stripped),
            es: localizedAbsoluteUrl("es", stripped),
            "x-default": localizedAbsoluteUrl("en", stripped),
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
  const megaMenuPanels = await getMegaMenuPanels();
  const initialMarketCode = (await cookies()).get(REGION_COOKIE)?.value ?? null;
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${brandFace.variable} ${cormorant.variable} ${ebGaramond.variable}`}>
      <body className="antialiased selection:bg-muted-gold/20 selection:text-obsidian">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders megaMenuPanels={megaMenuPanels} initialMarketCode={initialMarketCode}>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
