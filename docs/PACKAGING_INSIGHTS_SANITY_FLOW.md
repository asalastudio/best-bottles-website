# Packaging Insights ↔ Sanity Flow

## Overview

**"Packaging Insights"** on the homepage is the **Education Preview** section. It is wired to Sanity, but falls back to hard-coded content when nothing is configured.

## Architecture

```
Sanity (homepagePage)
  └── educationPreview
        ├── sectionTitle      → "Packaging Insights" (default)
        ├── sectionEyebrow    → "From the Lab" (default)
        ├── featuredArticles  → [references to journal documents]
        └── viewAllHref       → "/blog" (default)

Sanity (journal)              →  /blog (list) + /blog/[slug] (article)
  └── Journal articles (blog posts)
```

## Data Flow

1. **Homepage** (`src/app/page.tsx`) calls `getHomepageData()`.
2. **HOMEPAGE_QUERY** fetches the first `homepagePage` document, including:
   - `educationPreview.featuredArticles[]->` — dereferences journal refs to get `title`, `slug`, `category`, `excerpt`, `image`.
3. **EducationPreview** (`HomePage.tsx`) receives `homepageData?.educationPreview`.
4. **If** `featuredArticles` has items → uses Sanity data (title, category, image, slug).
5. **Else** → uses `DEFAULT_ARTICLES` (hard-coded titles, generic images, all link to `/blog`).

## The Disconnect

| Issue | What happens |
|-------|--------------|
| **No featured articles in Sanity** | `DEFAULT_ARTICLES` show — 3 hard-coded cards with placeholder images (`/assets/collection_perfume.png`, etc.) and slugs all pointing to `/blog`. Looks like it's not connected. |
| **Excerpt ignored** | Query fetches `excerpt` but the component uses a generic line: *"Expert insights and strategies to elevate your brand's packaging presence."* for every card. |
| **Category display** | Journal stores `packaging-101`, `fragrance-guides`, etc. BlogGrid maps these to labels; EducationPreview does not — it shows the raw value or "Insights". |

## How to Wire It Up

1. Open **Sanity Studio** (e.g. `/studio` or your Studio URL).
2. Edit the **Homepage** document.
3. Scroll to **Education Preview**.
4. In **Featured Articles**, add references to Journal articles (create them in the Journal section first).
5. Optionally set **Section Title** (e.g. "Packaging Insights") and **Section Eyebrow** (e.g. "From the Lab").
6. Save and publish.

Once `featuredArticles` has at least one item, the homepage will show real Journal content (title, image, slug) instead of `DEFAULT_ARTICLES`.

## Journal = Blog

- **Sanity type:** `journal` (Journal Article)
- **Routes:** `/blog` (grid) and `/blog/[slug]` (article)
- **Nav:** "Journal" links to `/blog`

The same Journal documents power both the blog listing and the homepage Education Preview.
