module.exports = [
"[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/json.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>json
]);
// @ts-nocheck
/**
 * @import {Refractor} from '../lib/core.js'
 */ json.displayName = 'json';
json.aliases = [
    'webmanifest'
];
function json(Prism) {
    // https://www.json.org/json-en.html
    Prism.languages.json = {
        property: {
            pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
            lookbehind: true,
            greedy: true
        },
        string: {
            pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
            lookbehind: true,
            greedy: true
        },
        comment: {
            pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
            greedy: true
        },
        number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
        punctuation: /[{}[\],]/,
        operator: /:/,
        boolean: /\b(?:false|true)\b/,
        null: {
            pattern: /\bnull\b/,
            alias: 'keyword'
        }
    };
    Prism.languages.webmanifest = Prism.languages.json;
}
}),
];

//# sourceMappingURL=c141e_refractor_lang_json_1a7a2304.js.map