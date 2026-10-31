# Persistent regenerated vial on localhost

The image reverted because normal catalog and product URLs omitted `assetPreview=kits`. The generated body had only been attached to that explicit preview path.

The local kit manifest now enables `GBVialClr2mlWhtCap` and `GBVialClr2mlBlackCap` through `defaultPdpSkus`. `localPdpComponentKits` honors that exact-SKU list on localhost and loopback hosts. Other candidate SKUs still require the explicit preview flag. Public hosts and Vercel remain excluded.

`BUILDER_LOCAL_KITS` is persisted in this checkout’s ignored `.env.local`, and the dev server was restarted using plain `npm run dev -- --port 3010` before verification. No special command-line environment was supplied for that restart.

All ten browser checks passed: entry from a catalog result, reload, black-cap selection, Cap On, Exploded, Sidecar, amber remaining unchanged, return from amber, the normal white-cap URL, and mobile reload. Each clear-vial check confirms the generated body URL with loaded images and no preview query parameter. Desktop and mobile checks found no horizontal overflow.

All four local-kit unit tests pass, including exact-SKU restrictions and production exclusion. TypeScript, changed-file lint and whitespace checks pass. The implementation is local and uncommitted; production data, images and deployments are unchanged.
