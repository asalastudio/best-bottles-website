const Module = require('node:module');
process.env.NEXT_PUBLIC_CONVEX_URL = 'https://precise-raccoon-123.convex.cloud';
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  if (request === 'next/cache') return { unstable_cache: fn => fn, revalidateTag() {}, updateTag() {} };
  return load.call(this, request, parent, isMain);
};
