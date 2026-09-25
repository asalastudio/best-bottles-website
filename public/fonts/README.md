# Self-hosted web fonts

Loaded by `src/app/fonts.ts` through `next/font/local`, so the build never fetches
Google Fonts (a `next/font/google` fetch failed a Vercel build on 2026-09-25).

| family | files | source | licence |
|---|---|---|---|
| Montserrat | `montserrat/montserrat-latin-wght-normal.woff2` (variable, wght 100–900) | `@fontsource-variable/montserrat` 5.3.0 | SIL OFL 1.1 (`montserrat/LICENSE`) |
| EB Garamond | `eb-garamond/eb-garamond-latin-wght-{normal,italic}.woff2` (variable, wght 400–800) | `@fontsource-variable/eb-garamond` 5.3.0 | SIL OFL 1.1 (`eb-garamond/LICENSE`) |
| Cormorant | `cormorant/cormorant-latin-wght-{normal,italic}.woff2` (variable, wght 300–700) | `@fontsource-variable/cormorant` 5.3.0 | SIL OFL 1.1 (`cormorant/LICENSE`) |

All three are the Latin subset only, the same subset the site asked Google for. To update a
face, `npm pack @fontsource-variable/<family>` and copy the `files/*-latin-wght-*.woff2` here.

`tt-norms-pro/` is reserved for the licensed brand face (see the note in `src/app/fonts.ts`).
