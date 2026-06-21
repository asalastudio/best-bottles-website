# Sanity Studio & Blog Setup

## Project & Dataset

| Setting | Value |
|---------|-------|
| **Project** | Best-Bottles-CMS |
| **Project ID** | `gh97irjh` |
| **Dataset (blog content)** | `production` |

**Critical:** The site and Studio must use the **same dataset**. Journal posts live in the `production` dataset. If you use `best-bottles-content-022826` in Studio, the site will not show that content unless you also set `NEXT_PUBLIC_SANITY_DATASET=best-bottles-content-022826` in Vercel.

## Environment Variables

Add these to `.env.local` (local) and your **production deployment** (Vercel, etc.):

```bash
# Sanity — required for blog and Studio
NEXT_PUBLIC_SANITY_PROJECT_ID=gh97irjh
NEXT_PUBLIC_SANITY_DATASET=production

# Optional: Studio-specific (defaults to above)
SANITY_STUDIO_PROJECT_ID=gh97irjh
SANITY_STUDIO_DATASET=production

# Required for seeding / writes (image-upload scripts, paper-doll render route).
# The code reads SANITY_API_TOKEN — set THIS name (a legacy SANITY_API_WRITE_TOKEN
# alias is NOT read by any script and will silently no-op).
SANITY_API_TOKEN=your_write_token_here

# Read-only (Viewer) token — live preview / Visual Editing / draft mode only.
SANITY_API_READ_TOKEN=your_viewer_token_here
```

## CORS (Required for Production)

If the blog does not load and you see CORS errors in the browser console, add your production domain to Sanity:

1. Go to [manage.sanity.io](https://manage.sanity.io)
2. Select project **Best-Bottles-CMS** (gh97irjh)
3. **API** → **CORS origins**
4. Add: `https://best-bottles-website.vercel.app` (or your production URL)
5. Add: `https://*.vercel.app` if you use preview deployments
6. Save

## Why the Blog Wasn't Showing

1. **Wrong dataset** — If `NEXT_PUBLIC_SANITY_DATASET` is `best-bottles-content-022826` but content is in `production`, the blog shows 0 posts. Align both.
2. **Missing project ID** — If `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset, `isSanityConfigured` is false and the blog returns empty.
3. **Production env not set** — Ensure Vercel has these variables for Production, Preview, and Development.
4. **CORS blocked** — Add your Vercel domain to Sanity CORS origins (see above).
5. **Posts unpublished** — The query only returns documents with `publishedAt`. Unpublished drafts do not appear. Use **Journal Drafts (Unpublished)** in Studio to find and publish them.

## Sanity Studio

- **Embedded Studio**: `https://your-site.com/studio`
- **Standalone** (optional): `npx sanity dev` from project root

Both use the same project/dataset from env vars. Use `production` so editors see the same content the site displays.

## Verify

1. Set env vars in Vercel (Project Settings → Environment Variables).
2. Add CORS origin for your production domain in manage.sanity.io.
3. Redeploy.
4. Visit `/blog` — you should see published posts.
5. Visit `/studio` — edit journal articles in **Journal Articles** or **Journal Drafts (Unpublished)**.
