module.exports = [
"[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/clike.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>clike
]);
// @ts-nocheck
/**
 * @import {Refractor} from '../lib/core.js'
 */ clike.displayName = 'clike';
clike.aliases = [];
function clike(Prism) {
    Prism.languages.clike = {
        comment: [
            {
                pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
                lookbehind: true,
                greedy: true
            },
            {
                pattern: /(^|[^\\:])\/\/.*/,
                lookbehind: true,
                greedy: true
            }
        ],
        string: {
            pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
            greedy: true
        },
        'class-name': {
            pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
            lookbehind: true,
            inside: {
                punctuation: /[.\\]/
            }
        },
        keyword: /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
        boolean: /\b(?:false|true)\b/,
        function: /\b\w+(?=\()/,
        number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
        operator: /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
        punctuation: /[{}[\];(),.:]/
    };
}
}),
"[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/javascript.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>javascript
]);
// @ts-nocheck
/**
 * @import {Refractor} from '../lib/core.js'
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$clike$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/clike.js [app-ssr] (ecmascript)");
;
javascript.displayName = 'javascript';
javascript.aliases = [
    'js'
];
function javascript(Prism) {
    Prism.register(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$clike$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"]);
    Prism.languages.javascript = Prism.languages.extend('clike', {
        'class-name': [
            Prism.languages.clike['class-name'],
            {
                pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
                lookbehind: true
            }
        ],
        keyword: [
            {
                pattern: /((?:^|\})\s*)catch\b/,
                lookbehind: true
            },
            {
                pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
                lookbehind: true
            }
        ],
        // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
        function: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
        number: {
            pattern: RegExp(/(^|[^\w$])/.source + '(?:' + // constant
            (/NaN|Infinity/.source + '|' + // binary integer
            /0[bB][01]+(?:_[01]+)*n?/.source + '|' + // octal integer
            /0[oO][0-7]+(?:_[0-7]+)*n?/.source + '|' + // hexadecimal integer
            /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + '|' + // decimal bigint
            /\d+(?:_\d+)*n/.source + '|' + // decimal number (integer or float) but no bigint
            /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ')' + /(?![\w$])/.source),
            lookbehind: true
        },
        operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    });
    Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
    Prism.languages.insertBefore('javascript', 'keyword', {
        regex: {
            pattern: RegExp(// lookbehind
            // eslint-disable-next-line regexp/no-dupe-characters-character-class
            /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
            // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
            // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
            // with the only syntax, so we have to define 2 different regex patterns.
            /\//.source + '(?:' + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + '|' + // `v` flag syntax. This supports 3 levels of nested character classes.
            /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ')' + // lookahead
            /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source),
            lookbehind: true,
            greedy: true,
            inside: {
                'regex-source': {
                    pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
                    lookbehind: true,
                    alias: 'language-regex',
                    inside: Prism.languages.regex
                },
                'regex-delimiter': /^\/|\/$/,
                'regex-flags': /^[a-z]+$/
            }
        },
        // This must be declared before keyword because we use "function" inside the look-forward
        'function-variable': {
            pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
            alias: 'function'
        },
        parameter: [
            {
                pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
                lookbehind: true,
                inside: Prism.languages.javascript
            },
            {
                pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
                lookbehind: true,
                inside: Prism.languages.javascript
            },
            {
                pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
                lookbehind: true,
                inside: Prism.languages.javascript
            },
            {
                pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
                lookbehind: true,
                inside: Prism.languages.javascript
            }
        ],
        constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    });
    Prism.languages.insertBefore('javascript', 'string', {
        hashbang: {
            pattern: /^#!.*/,
            greedy: true,
            alias: 'comment'
        },
        'template-string': {
            pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
            greedy: true,
            inside: {
                'template-punctuation': {
                    pattern: /^`|`$/,
                    alias: 'string'
                },
                interpolation: {
                    pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
                    lookbehind: true,
                    inside: {
                        'interpolation-punctuation': {
                            pattern: /^\$\{|\}$/,
                            alias: 'punctuation'
                        },
                        rest: Prism.languages.javascript
                    }
                },
                string: /[\s\S]+/
            }
        },
        'string-property': {
            pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
            lookbehind: true,
            greedy: true,
            alias: 'property'
        }
    });
    Prism.languages.insertBefore('javascript', 'operator', {
        'literal-property': {
            pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
            lookbehind: true,
            alias: 'property'
        }
    });
    if (Prism.languages.markup) {
        Prism.languages.markup.tag.addInlined('script', 'javascript');
        // add attribute support for all DOM events.
        // https://developer.mozilla.org/en-US/docs/Web/Events#Standard_events
        Prism.languages.markup.tag.addAttribute(/on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source, 'javascript');
    }
    Prism.languages.js = Prism.languages.javascript;
}
}),
"[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/markup.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>markup
]);
// @ts-nocheck
/**
 * @import {Refractor} from '../lib/core.js'
 */ markup.displayName = 'markup';
markup.aliases = [
    'atom',
    'html',
    'mathml',
    'rss',
    'ssml',
    'svg',
    'xml'
];
function markup(Prism) {
    Prism.languages.markup = {
        comment: {
            pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
            greedy: true
        },
        prolog: {
            pattern: /<\?[\s\S]+?\?>/,
            greedy: true
        },
        doctype: {
            // https://www.w3.org/TR/xml/#NT-doctypedecl
            pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
            greedy: true,
            inside: {
                'internal-subset': {
                    pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
                    lookbehind: true,
                    greedy: true,
                    inside: null // see below
                },
                string: {
                    pattern: /"[^"]*"|'[^']*'/,
                    greedy: true
                },
                punctuation: /^<!|>$|[[\]]/,
                'doctype-tag': /^DOCTYPE/i,
                name: /[^\s<>'"]+/
            }
        },
        cdata: {
            pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
            greedy: true
        },
        tag: {
            pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
            greedy: true,
            inside: {
                tag: {
                    pattern: /^<\/?[^\s>\/]+/,
                    inside: {
                        punctuation: /^<\/?/,
                        namespace: /^[^\s>\/:]+:/
                    }
                },
                'special-attr': [],
                'attr-value': {
                    pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
                    inside: {
                        punctuation: [
                            {
                                pattern: /^=/,
                                alias: 'attr-equals'
                            },
                            {
                                pattern: /^(\s*)["']|["']$/,
                                lookbehind: true
                            }
                        ]
                    }
                },
                punctuation: /\/?>/,
                'attr-name': {
                    pattern: /[^\s>\/]+/,
                    inside: {
                        namespace: /^[^\s>\/:]+:/
                    }
                }
            }
        },
        entity: [
            {
                pattern: /&[\da-z]{1,8};/i,
                alias: 'named-entity'
            },
            /&#x?[\da-f]{1,8};/i
        ]
    };
    Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] = Prism.languages.markup['entity'];
    Prism.languages.markup['doctype'].inside['internal-subset'].inside = Prism.languages.markup;
    // Plugin to make entity title show the real entity, idea by Roman Komarov
    Prism.hooks.add('wrap', function(env) {
        if (env.type === 'entity') {
            env.attributes['title'] = env.content.value.replace(/&amp;/, '&');
        }
    });
    Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
        /**
     * Adds an inlined language to markup.
     *
     * An example of an inlined language is CSS with `<style>` tags.
     *
     * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addInlined('style', 'css');
     */ value: function addInlined(tagName, lang) {
            var includedCdataInside = {};
            includedCdataInside['language-' + lang] = {
                pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
                lookbehind: true,
                inside: Prism.languages[lang]
            };
            includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;
            var inside = {
                'included-cdata': {
                    pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
                    inside: includedCdataInside
                }
            };
            inside['language-' + lang] = {
                pattern: /[\s\S]+/,
                inside: Prism.languages[lang]
            };
            var def = {};
            def[tagName] = {
                pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
                    return tagName;
                }), 'i'),
                lookbehind: true,
                greedy: true,
                inside: inside
            };
            Prism.languages.insertBefore('markup', 'cdata', def);
        }
    });
    Object.defineProperty(Prism.languages.markup.tag, 'addAttribute', {
        /**
     * Adds an pattern to highlight languages embedded in HTML attributes.
     *
     * An example of an inlined language is CSS with `style` attributes.
     *
     * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addAttribute('style', 'css');
     */ value: function(attrName, lang) {
            Prism.languages.markup.tag.inside['special-attr'].push({
                pattern: RegExp(/(^|["'\s])/.source + '(?:' + attrName + ')' + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source, 'i'),
                lookbehind: true,
                inside: {
                    'attr-name': /^[^\s=]+/,
                    'attr-value': {
                        pattern: /=[\s\S]+/,
                        inside: {
                            value: {
                                pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                                lookbehind: true,
                                alias: [
                                    lang,
                                    'language-' + lang
                                ],
                                inside: Prism.languages[lang]
                            },
                            punctuation: [
                                {
                                    pattern: /^=/,
                                    alias: 'attr-equals'
                                },
                                /"|'/
                            ]
                        }
                    }
                }
            });
        }
    });
    Prism.languages.html = Prism.languages.markup;
    Prism.languages.mathml = Prism.languages.markup;
    Prism.languages.svg = Prism.languages.markup;
    Prism.languages.xml = Prism.languages.extend('markup', {});
    Prism.languages.ssml = Prism.languages.xml;
    Prism.languages.atom = Prism.languages.xml;
    Prism.languages.rss = Prism.languages.xml;
}
}),
"[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/jsx.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>jsx
]);
// @ts-nocheck
/**
 * @import {Refractor} from '../lib/core.js'
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$javascript$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/javascript.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$markup$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/markup.js [app-ssr] (ecmascript)");
;
;
jsx.displayName = 'jsx';
jsx.aliases = [];
function jsx(Prism) {
    Prism.register(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$javascript$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"]);
    Prism.register(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$refractor$40$5$2e$0$2e$0$2f$node_modules$2f$refractor$2f$lang$2f$markup$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"]);
    (function(Prism) {
        var javascript = Prism.util.clone(Prism.languages.javascript);
        var space = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source;
        var braces = /(?:\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\})/.source;
        var spread = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;
        /**
     * @param {string} source
     * @param {string} [flags]
     */ function re(source, flags) {
            source = source.replace(/<S>/g, function() {
                return space;
            }).replace(/<BRACES>/g, function() {
                return braces;
            }).replace(/<SPREAD>/g, function() {
                return spread;
            });
            return RegExp(source, flags);
        }
        spread = re(spread).source;
        Prism.languages.jsx = Prism.languages.extend('markup', javascript);
        Prism.languages.jsx.tag.pattern = re(/<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/.source);
        Prism.languages.jsx.tag.inside['tag'].pattern = /^<\/?[^\s>\/]*/;
        Prism.languages.jsx.tag.inside['attr-value'].pattern = /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/;
        Prism.languages.jsx.tag.inside['tag'].inside['class-name'] = /^[A-Z]\w*(?:\.[A-Z]\w*)*$/;
        Prism.languages.jsx.tag.inside['comment'] = javascript['comment'];
        Prism.languages.insertBefore('inside', 'attr-name', {
            spread: {
                pattern: re(/<SPREAD>/.source),
                inside: Prism.languages.jsx
            }
        }, Prism.languages.jsx.tag);
        Prism.languages.insertBefore('inside', 'special-attr', {
            script: {
                // Allow for two levels of nesting
                pattern: re(/=<BRACES>/.source),
                alias: 'language-javascript',
                inside: {
                    'script-punctuation': {
                        pattern: /^=(?=\{)/,
                        alias: 'punctuation'
                    },
                    rest: Prism.languages.jsx
                }
            }
        }, Prism.languages.jsx.tag);
        // The following will handle plain text inside tags
        var stringifyToken = function(token) {
            if (!token) {
                return '';
            }
            if (typeof token === 'string') {
                return token;
            }
            if (typeof token.content === 'string') {
                return token.content;
            }
            return token.content.map(stringifyToken).join('');
        };
        var walkTokens = function(tokens) {
            var openedTags = [];
            for(var i = 0; i < tokens.length; i++){
                var token = tokens[i];
                var notTagNorBrace = false;
                if (typeof token !== 'string') {
                    if (token.type === 'tag' && token.content[0] && token.content[0].type === 'tag') {
                        // We found a tag, now find its kind
                        if (token.content[0].content[0].content === '</') {
                            // Closing tag
                            if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
                                // Pop matching opening tag
                                openedTags.pop();
                            }
                        } else {
                            if (token.content[token.content.length - 1].content === '/>') {
                            // Autoclosed tag, ignore
                            } else {
                                // Opening tag
                                openedTags.push({
                                    tagName: stringifyToken(token.content[0].content[1]),
                                    openedBraces: 0
                                });
                            }
                        }
                    } else if (openedTags.length > 0 && token.type === 'punctuation' && token.content === '{') {
                        // Here we might have entered a JSX context inside a tag
                        openedTags[openedTags.length - 1].openedBraces++;
                    } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === 'punctuation' && token.content === '}') {
                        // Here we might have left a JSX context inside a tag
                        openedTags[openedTags.length - 1].openedBraces--;
                    } else {
                        notTagNorBrace = true;
                    }
                }
                if (notTagNorBrace || typeof token === 'string') {
                    if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
                        // Here we are inside a tag, and not inside a JSX context.
                        // That's plain text: drop any tokens matched.
                        var plainText = stringifyToken(token);
                        // And merge text with adjacent text
                        if (i < tokens.length - 1 && (typeof tokens[i + 1] === 'string' || tokens[i + 1].type === 'plain-text')) {
                            plainText += stringifyToken(tokens[i + 1]);
                            tokens.splice(i + 1, 1);
                        }
                        if (i > 0 && (typeof tokens[i - 1] === 'string' || tokens[i - 1].type === 'plain-text')) {
                            plainText = stringifyToken(tokens[i - 1]) + plainText;
                            tokens.splice(i - 1, 1);
                            i--;
                        }
                        tokens[i] = new Prism.Token('plain-text', plainText, null, plainText);
                    }
                }
                if (token.content && typeof token.content !== 'string') {
                    walkTokens(token.content);
                }
            }
        };
        Prism.hooks.add('after-tokenize', function(env) {
            if (env.language !== 'jsx' && env.language !== 'tsx') {
                return;
            }
            walkTokens(env.tokens);
        });
    })(Prism);
}
}),
];

//# sourceMappingURL=c141e_refractor_lang_73460093._.js.map