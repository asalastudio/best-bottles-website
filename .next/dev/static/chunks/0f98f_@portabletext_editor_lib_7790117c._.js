(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "blockOffsetToSpanSelectionPoint",
    ()=>blockOffsetToSpanSelectionPoint,
    "defaultKeyGenerator",
    ()=>defaultKeyGenerator,
    "getBlockEndPoint",
    ()=>getBlockEndPoint,
    "getBlockKeyFromSelectionPoint",
    ()=>getBlockKeyFromSelectionPoint,
    "getBlockStartPoint",
    ()=>getBlockStartPoint,
    "getChildKeyFromSelectionPoint",
    ()=>getChildKeyFromSelectionPoint,
    "getSelectionEndPoint",
    ()=>getSelectionEndPoint,
    "getSelectionStartPoint",
    ()=>getSelectionStartPoint,
    "isEqualPathSegments",
    ()=>isEqualPathSegments,
    "isEqualPaths",
    ()=>isEqualPaths,
    "isEqualSelectionPoints",
    ()=>isEqualSelectionPoints,
    "isKeyedSegment",
    ()=>isKeyedSegment,
    "isListBlock",
    ()=>isListBlock,
    "isSelectionCollapsed",
    ()=>isSelectionCollapsed,
    "isTypedObject",
    ()=>isTypedObject,
    "parseAnnotation",
    ()=>parseAnnotation,
    "parseBlock",
    ()=>parseBlock,
    "parseBlocks",
    ()=>parseBlocks,
    "parseInlineObject",
    ()=>parseInlineObject,
    "parseMarkDefs",
    ()=>parseMarkDefs,
    "parseSpan",
    ()=>parseSpan,
    "sliceBlocks",
    ()=>sliceBlocks,
    "spanSelectionPointToBlockOffset",
    ()=>spanSelectionPointToBlockOffset
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+schema@2.1.1/node_modules/@portabletext/schema/dist/index.js [app-client] (ecmascript)");
;
function isTypedObject(object) {
    return isRecord(object) && typeof object._type == "string";
}
function isRecord(value) {
    return !!value && (typeof value == "object" || typeof value == "function");
}
function isKeyedSegment(segment) {
    return typeof segment == "object" && segment !== null && "_key" in segment;
}
function getBlockEndPoint({ context, block }) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block.node)) {
        const lastChild = block.node.children[block.node.children.length - 1];
        if (lastChild) return {
            path: [
                ...block.path,
                "children",
                {
                    _key: lastChild._key
                }
            ],
            offset: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, lastChild) ? lastChild.text.length : 0
        };
    }
    return {
        path: block.path,
        offset: 0
    };
}
function getBlockStartPoint({ context, block }) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block.node)) {
        const firstChild = block.node.children[0];
        return {
            path: [
                ...block.path,
                "children",
                {
                    _key: firstChild?._key ?? ""
                }
            ],
            offset: 0
        };
    }
    return {
        path: block.path,
        offset: 0
    };
}
function isEqualPathSegments(segA, segB) {
    return segA === segB ? !0 : segA === void 0 || segB === void 0 ? !1 : (typeof segA == "string" || typeof segA == "number") && (typeof segB == "string" || typeof segB == "number") ? segA === segB : isKeyedSegment(segA) && isKeyedSegment(segB) ? segA._key === segB._key : Array.isArray(segA) && Array.isArray(segB) ? segA[0] === segB[0] && segA[1] === segB[1] : !1;
}
function isEqualPaths(a, b) {
    if (a.length !== b.length) return !1;
    for(let i = 0; i < a.length; i++)if (!isEqualPathSegments(a[i], b[i])) return !1;
    return !0;
}
function isSelectionCollapsed(selection) {
    return selection ? isEqualPaths(selection.anchor.path, selection.focus.path) && selection.anchor.offset === selection.focus.offset : !1;
}
function getBlockKeyFromSelectionPoint(point) {
    const blockPathSegment = point.path.at(0);
    if (isKeyedSegment(blockPathSegment)) return blockPathSegment._key;
}
function getChildKeyFromSelectionPoint(point) {
    const childPathSegment = point.path.at(2);
    if (isKeyedSegment(childPathSegment)) return childPathSegment._key;
}
function parseBlocks({ context, blocks, options }) {
    return Array.isArray(blocks) ? blocks.flatMap((block)=>{
        const parsedBlock = parseBlock({
            context,
            block,
            options
        });
        return parsedBlock ? [
            parsedBlock
        ] : [];
    }) : [];
}
function parseBlock({ context, block, options }) {
    return parseTextBlock({
        block,
        context,
        options
    }) ?? parseBlockObject({
        blockObject: block,
        context,
        options
    });
}
function parseBlockObject({ blockObject, context, options }) {
    if (!isTypedObject(blockObject)) return;
    const schemaType = context.schema.blockObjects.find(({ name })=>name === blockObject._type);
    if (schemaType) return parseObject({
        object: blockObject,
        context: {
            keyGenerator: context.keyGenerator,
            schemaType
        },
        options
    });
}
function isListBlock(context, block) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block) && block.level !== void 0 && block.listItem !== void 0;
}
function parseTextBlock({ block, context, options }) {
    if (!isTypedObject(block)) return;
    const customFields = {};
    for (const key of Object.keys(block))key === "_type" || key === "_key" || key === "children" || key === "markDefs" || key === "style" || key === "listItem" || key === "level" || (options.validateFields ? context.schema.block.fields?.some((field)=>field.name === key) && (customFields[key] = block[key]) : customFields[key] = block[key]);
    if (block._type !== context.schema.block.name) return;
    const _key = typeof block._key == "string" ? block._key : context.keyGenerator(), { markDefs, markDefKeyMap } = parseMarkDefs({
        context,
        markDefs: block.markDefs,
        options
    }), parsedChildren = (Array.isArray(block.children) ? block.children : []).map((child)=>parseChild({
            child,
            context,
            markDefKeyMap,
            options
        })).filter((child)=>child !== void 0), marks = parsedChildren.flatMap((child)=>child.marks ?? []), children = parsedChildren.length > 0 ? parsedChildren : [
        {
            _key: context.keyGenerator(),
            _type: context.schema.span.name,
            text: "",
            marks: []
        }
    ], normalizedChildren = options.normalize ? // Ensure that inline objects re surrounded by spans
    children.reduce((normalizedChildren2, child, index)=>{
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) return [
            ...normalizedChildren2,
            child
        ];
        const previousChild = normalizedChildren2.at(-1);
        return !previousChild || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, previousChild) ? [
            ...normalizedChildren2,
            {
                _key: context.keyGenerator(),
                _type: context.schema.span.name,
                text: "",
                marks: []
            },
            child,
            ...index === children.length - 1 ? [
                {
                    _key: context.keyGenerator(),
                    _type: context.schema.span.name,
                    text: "",
                    marks: []
                }
            ] : []
        ] : [
            ...normalizedChildren2,
            child
        ];
    }, []) : children, parsedBlock = {
        _type: context.schema.block.name,
        _key,
        children: normalizedChildren,
        ...customFields
    };
    return typeof block.markDefs == "object" && block.markDefs !== null && (parsedBlock.markDefs = options.removeUnusedMarkDefs ? markDefs.filter((markDef)=>marks.includes(markDef._key)) : markDefs), typeof block.style == "string" && context.schema.styles.find((style)=>style.name === block.style) && (parsedBlock.style = block.style), typeof block.listItem == "string" && context.schema.lists.find((list)=>list.name === block.listItem) && (parsedBlock.listItem = block.listItem), typeof block.level == "number" && (parsedBlock.level = block.level), parsedBlock;
}
function parseMarkDefs({ context, markDefs, options }) {
    const unparsedMarkDefs = Array.isArray(markDefs) ? markDefs : [], markDefKeyMap = /* @__PURE__ */ new Map();
    return {
        markDefs: unparsedMarkDefs.flatMap((markDef)=>{
            if (!isTypedObject(markDef)) return [];
            const schemaType = context.schema.annotations.find(({ name })=>name === markDef._type);
            if (!schemaType) return [];
            if (typeof markDef._key != "string") return [];
            const parsedAnnotation = parseObject({
                object: markDef,
                context: {
                    schemaType,
                    keyGenerator: context.keyGenerator
                },
                options
            });
            return ("TURBOPACK compile-time truthy", 1) ? (markDefKeyMap.set(markDef._key, parsedAnnotation._key), [
                parsedAnnotation
            ]) : "TURBOPACK unreachable";
        }),
        markDefKeyMap
    };
}
function parseChild({ child, context, markDefKeyMap, options }) {
    return parseSpan({
        span: child,
        context,
        markDefKeyMap,
        options
    }) ?? parseInlineObject({
        inlineObject: child,
        context,
        options
    });
}
function parseSpan({ span, context, markDefKeyMap, options }) {
    if (!isRecord(span)) return;
    const customFields = {};
    for (const key of Object.keys(span))key !== "_type" && key !== "_key" && key !== "text" && key !== "marks" && (customFields[key] = span[key]);
    const marks = (Array.isArray(span.marks) ? span.marks : []).flatMap((mark)=>{
        if (typeof mark != "string") return [];
        const markDefKey = markDefKeyMap.get(mark);
        return markDefKey !== void 0 ? [
            markDefKey
        ] : context.schema.decorators.some((decorator)=>decorator.name === mark) ? [
            mark
        ] : [];
    });
    if (!(typeof span._type == "string" && span._type !== context.schema.span.name)) return typeof span._type != "string" ? typeof span.text == "string" ? {
        _type: context.schema.span.name,
        _key: typeof span._key == "string" ? span._key : context.keyGenerator(),
        text: span.text,
        marks,
        ...options.validateFields ? {} : customFields
    } : void 0 : {
        _type: context.schema.span.name,
        _key: typeof span._key == "string" ? span._key : context.keyGenerator(),
        text: typeof span.text == "string" ? span.text : "",
        marks,
        ...options.validateFields ? {} : customFields
    };
}
function parseInlineObject({ inlineObject, context, options }) {
    if (!isTypedObject(inlineObject)) return;
    const schemaType = context.schema.inlineObjects.find(({ name })=>name === inlineObject._type);
    if (schemaType) return parseObject({
        object: inlineObject,
        context: {
            keyGenerator: context.keyGenerator,
            schemaType
        },
        options
    });
}
function parseAnnotation({ annotation, context, options }) {
    if (!isTypedObject(annotation)) return;
    const schemaType = context.schema.annotations.find(({ name })=>name === annotation._type);
    if (schemaType) return parseObject({
        object: annotation,
        context: {
            keyGenerator: context.keyGenerator,
            schemaType
        },
        options
    });
}
function parseObject({ object, context, options }) {
    const { _type, _key, ...customFields } = object, values = options.validateFields ? context.schemaType.fields.reduce((fieldValues, field)=>{
        const fieldValue = object[field.name];
        return fieldValue !== void 0 && (fieldValues[field.name] = fieldValue), fieldValues;
    }, {}) : customFields;
    return {
        _type: context.schemaType.name,
        _key: typeof object._key == "string" ? object._key : context.keyGenerator(),
        ...values
    };
}
function blockOffsetToSpanSelectionPoint({ context, blockOffset, direction }) {
    let offsetLeft = blockOffset.offset, selectionPoint, skippedInlineObject = !1;
    for (const block of context.value)if (block._key === blockOffset.path[0]._key && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) for (const child of block.children){
        if (direction === "forward") {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) continue;
            if (offsetLeft <= child.text.length) {
                selectionPoint = {
                    path: [
                        ...blockOffset.path,
                        "children",
                        {
                            _key: child._key
                        }
                    ],
                    offset: offsetLeft
                };
                break;
            }
            offsetLeft -= child.text.length;
            continue;
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) {
            skippedInlineObject = !0;
            continue;
        }
        if (offsetLeft === 0 && selectionPoint && !skippedInlineObject) {
            skippedInlineObject && (selectionPoint = {
                path: [
                    ...blockOffset.path,
                    "children",
                    {
                        _key: child._key
                    }
                ],
                offset: 0
            });
            break;
        }
        if (offsetLeft > child.text.length) {
            offsetLeft -= child.text.length;
            continue;
        }
        if (offsetLeft <= child.text.length && (selectionPoint = {
            path: [
                ...blockOffset.path,
                "children",
                {
                    _key: child._key
                }
            ],
            offset: offsetLeft
        }, offsetLeft -= child.text.length, offsetLeft !== 0)) break;
    }
    return selectionPoint;
}
function spanSelectionPointToBlockOffset({ context, selectionPoint }) {
    let offset = 0;
    const blockKey = getBlockKeyFromSelectionPoint(selectionPoint), spanKey = getChildKeyFromSelectionPoint(selectionPoint);
    if (!(!blockKey || !spanKey)) {
        for (const block of context.value)if (block._key === blockKey && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) {
            for (const child of block.children)if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) {
                if (child._key === spanKey) return {
                    path: [
                        {
                            _key: block._key
                        }
                    ],
                    offset: offset + selectionPoint.offset
                };
                offset += child.text.length;
            }
        }
    }
}
function getSelectionEndPoint(selection) {
    return selection ? selection.backward ? selection.anchor : selection.focus : null;
}
function getSelectionStartPoint(selection) {
    return selection ? selection.backward ? selection.focus : selection.anchor : null;
}
function isEqualSelectionPoints(a, b) {
    return a.offset === b.offset && isEqualPaths(a.path, b.path);
}
const defaultKeyGenerator = ()=>randomKey(12), getByteHexTable = /* @__PURE__ */ (()=>{
    let table;
    return ()=>{
        if (table) return table;
        table = [];
        for(let i = 0; i < 256; ++i)table[i] = (i + 256).toString(16).slice(1);
        return table;
    };
})();
function whatwgRNG(length = 16) {
    const rnds8 = new Uint8Array(length);
    return crypto.getRandomValues(rnds8), rnds8;
}
function randomKey(length) {
    const table = getByteHexTable();
    return whatwgRNG(length).reduce((str, n)=>str + table[n], "").slice(0, length);
}
function sliceBlocks({ context, blocks }) {
    const slice = [];
    if (!context.selection) return slice;
    let startBlock;
    const middleBlocks = [];
    let endBlock;
    const startPoint = getSelectionStartPoint(context.selection), endPoint = getSelectionEndPoint(context.selection), startBlockKey = getBlockKeyFromSelectionPoint(startPoint), startChildKey = getChildKeyFromSelectionPoint(startPoint), endBlockKey = getBlockKeyFromSelectionPoint(endPoint), endChildKey = getChildKeyFromSelectionPoint(endPoint);
    if (!startBlockKey || !endBlockKey) return slice;
    for (const block of blocks){
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block) && block._key === startBlockKey && block._key === endBlockKey) {
            startBlock = block;
            break;
        }
        if (block._key === startBlockKey) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) {
                startBlock = block;
                continue;
            }
            if (startChildKey) {
                for (const child of block.children){
                    if (child._key === startChildKey) {
                        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) {
                            const text = child._key === endChildKey ? child.text.slice(startPoint.offset, endPoint.offset) : child.text.slice(startPoint.offset);
                            startBlock = {
                                ...block,
                                children: [
                                    {
                                        ...child,
                                        text
                                    }
                                ]
                            };
                        } else startBlock = {
                            ...block,
                            children: [
                                child
                            ]
                        };
                        if (block._key === endBlockKey && startChildKey === endChildKey) break;
                        continue;
                    }
                    if (startBlock && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, startBlock) && (endChildKey && child._key === endChildKey && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child) ? startBlock.children.push({
                        ...child,
                        text: child.text.slice(0, endPoint.offset)
                    }) : startBlock.children.push(child), block._key === endBlockKey && endChildKey && child._key === endChildKey)) break;
                }
                if (startBlockKey === endBlockKey) break;
                continue;
            }
            if (startBlock = block, startBlockKey === endBlockKey) break;
        }
        if (block._key === endBlockKey) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) {
                endBlock = block;
                break;
            }
            if (endChildKey) {
                endBlock = {
                    ...block,
                    children: []
                };
                for (const child of block.children)if (endBlock && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, endBlock)) {
                    if (child._key === endChildKey && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) {
                        endBlock.children.push({
                            ...child,
                            text: child.text.slice(0, endPoint.offset)
                        });
                        break;
                    }
                    if (endBlock.children.push(child), endChildKey && child._key === endChildKey) break;
                }
                break;
            }
            endBlock = block;
            break;
        }
        startBlock && middleBlocks.push(parseBlock({
            context: {
                schema: context.schema,
                keyGenerator: context.keyGenerator ?? defaultKeyGenerator
            },
            block,
            options: {
                normalize: !1,
                removeUnusedMarkDefs: !0,
                validateFields: !1
            }
        }) ?? block);
    }
    const parsedStartBlock = startBlock ? parseBlock({
        context: {
            schema: context.schema,
            keyGenerator: context.keyGenerator ?? defaultKeyGenerator
        },
        block: startBlock,
        options: {
            normalize: !1,
            removeUnusedMarkDefs: !0,
            validateFields: !1
        }
    }) : void 0, parsedEndBlock = endBlock ? parseBlock({
        context: {
            schema: context.schema,
            keyGenerator: context.keyGenerator ?? defaultKeyGenerator
        },
        block: endBlock,
        options: {
            normalize: !1,
            removeUnusedMarkDefs: !0,
            validateFields: !1
        }
    }) : void 0;
    return [
        ...parsedStartBlock ? [
            parsedStartBlock
        ] : [],
        ...middleBlocks,
        ...parsedEndBlock ? [
            parsedEndBlock
        ] : []
    ];
}
;
 //# sourceMappingURL=util.slice-blocks.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/selector.is-selecting-entire-blocks.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "comparePoints",
    ()=>comparePoints,
    "getActiveAnnotations",
    ()=>getActiveAnnotations,
    "getActiveAnnotationsMarks",
    ()=>getActiveAnnotationsMarks,
    "getActiveDecorators",
    ()=>getActiveDecorators,
    "getActiveListItem",
    ()=>getActiveListItem,
    "getActiveStyle",
    ()=>getActiveStyle,
    "getCaretWordSelection",
    ()=>getCaretWordSelection,
    "getFocusBlock",
    ()=>getFocusBlock,
    "getFocusBlockObject",
    ()=>getFocusBlockObject,
    "getFocusChild",
    ()=>getFocusChild,
    "getFocusInlineObject",
    ()=>getFocusInlineObject,
    "getFocusListBlock",
    ()=>getFocusListBlock,
    "getFocusSpan",
    ()=>getFocusSpan,
    "getFocusTextBlock",
    ()=>getFocusTextBlock,
    "getLastBlock",
    ()=>getLastBlock,
    "getMarkState",
    ()=>getMarkState,
    "getNextBlock",
    ()=>getNextBlock,
    "getNextInlineObject",
    ()=>getNextInlineObject,
    "getNextSpan",
    ()=>getNextSpan,
    "getPreviousBlock",
    ()=>getPreviousBlock,
    "getPreviousInlineObject",
    ()=>getPreviousInlineObject,
    "getPreviousSpan",
    ()=>getPreviousSpan,
    "getSelectedBlocks",
    ()=>getSelectedBlocks,
    "getSelectedChildren",
    ()=>getSelectedChildren,
    "getSelectedSpans",
    ()=>getSelectedSpans,
    "getSelectedTextBlocks",
    ()=>getSelectedTextBlocks,
    "getSelectedValue",
    ()=>getSelectedValue,
    "getSelectionEndBlock",
    ()=>getSelectionEndBlock,
    "getSelectionEndChild",
    ()=>getSelectionEndChild,
    "getSelectionEndPoint",
    ()=>getSelectionEndPoint,
    "getSelectionStartBlock",
    ()=>getSelectionStartBlock,
    "getSelectionStartChild",
    ()=>getSelectionStartChild,
    "getSelectionStartPoint",
    ()=>getSelectionStartPoint,
    "getSelectionText",
    ()=>getSelectionText,
    "isActiveAnnotation",
    ()=>isActiveAnnotation,
    "isActiveDecorator",
    ()=>isActiveDecorator,
    "isActiveListItem",
    ()=>isActiveListItem,
    "isActiveStyle",
    ()=>isActiveStyle,
    "isAtTheEndOfBlock",
    ()=>isAtTheEndOfBlock,
    "isAtTheStartOfBlock",
    ()=>isAtTheStartOfBlock,
    "isOverlappingSelection",
    ()=>isOverlappingSelection,
    "isSelectingEntireBlocks",
    ()=>isSelectingEntireBlocks,
    "isSelectionCollapsed",
    ()=>isSelectionCollapsed,
    "isSelectionExpanded",
    ()=>isSelectionExpanded,
    "isSpanNode",
    ()=>isSpanNode,
    "isTextBlockNode",
    ()=>isTextBlockNode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+schema@2.1.1/node_modules/@portabletext/schema/dist/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)");
;
;
function isTextBlockNode(context, node) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTypedObject"])(node) && node._type === context.schema.block.name;
}
function isSpanNode(context, node) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTypedObject"])(node) && node._type === context.schema.span.name;
}
function isBlockPath(path) {
    const firstSegment = path.at(0);
    return path.length === 1 && firstSegment !== void 0 && isRecord(firstSegment) && "_key" in firstSegment && typeof firstSegment._key == "string";
}
function isRecord(value) {
    return !!value && (typeof value == "object" || typeof value == "function");
}
function isSelectionExpanded$1(selection) {
    return selection ? !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSelectionCollapsed"])(selection) : !1;
}
const getFocusBlock = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(snapshot.context.selection.focus), index = key ? snapshot.blockIndexMap.get(key) : void 0, node = index !== void 0 ? snapshot.context.value.at(index) : void 0;
    return node && key ? {
        node,
        path: [
            {
                _key: key
            }
        ]
    } : void 0;
}, getFocusTextBlock = (snapshot)=>{
    const focusBlock = getFocusBlock(snapshot);
    return focusBlock && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, focusBlock.node) ? {
        node: focusBlock.node,
        path: focusBlock.path
    } : void 0;
}, getFocusChild = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const focusBlock = getFocusTextBlock(snapshot);
    if (!focusBlock) return;
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(snapshot.context.selection.focus), node = key ? focusBlock.node.children.find((span)=>span._key === key) : void 0;
    return node && key ? {
        node,
        path: [
            ...focusBlock.path,
            "children",
            {
                _key: key
            }
        ]
    } : void 0;
}, getFocusSpan = (snapshot)=>{
    const focusChild = getFocusChild(snapshot);
    return focusChild && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, focusChild.node) ? {
        node: focusChild.node,
        path: focusChild.path
    } : void 0;
}, getSelectionEndBlock = (snapshot)=>{
    const endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection);
    if (endPoint) return getFocusBlock({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: endPoint,
                focus: endPoint
            }
        }
    });
}, getSelectionEndPoint = (snapshot)=>{
    if (snapshot.context.selection) return snapshot.context.selection.backward ? snapshot.context.selection.anchor : snapshot.context.selection.focus;
}, getNextSpan = (snapshot)=>{
    const selectionEndBlock = getSelectionEndBlock(snapshot), selectionEndPoint = getSelectionEndPoint(snapshot);
    if (!selectionEndBlock || !selectionEndPoint || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, selectionEndBlock.node)) return;
    const selectionEndPointChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(selectionEndPoint);
    let endPointChildFound = !1, nextSpan;
    for (const child of selectionEndBlock.node.children){
        if (child._key === selectionEndPointChildKey) {
            endPointChildFound = !0;
            continue;
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child) && endPointChildFound) {
            nextSpan = {
                node: child,
                path: [
                    ...selectionEndBlock.path,
                    "children",
                    {
                        _key: child._key
                    }
                ]
            };
            break;
        }
    }
    return nextSpan;
}, getSelectionStartBlock = (snapshot)=>{
    const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection);
    if (startPoint) return getFocusBlock({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: startPoint,
                focus: startPoint
            }
        }
    });
}, getSelectionStartPoint = (snapshot)=>{
    if (snapshot.context.selection) return snapshot.context.selection.backward ? snapshot.context.selection.focus : snapshot.context.selection.anchor;
}, getPreviousSpan = (snapshot)=>{
    const selectionStartBlock = getSelectionStartBlock(snapshot), selectionStartPoint = getSelectionStartPoint(snapshot);
    if (!selectionStartBlock || !selectionStartPoint || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, selectionStartBlock.node)) return;
    const selectionStartPointChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(selectionStartPoint);
    let previousSpan;
    for (const child of selectionStartBlock.node.children){
        if (child._key === selectionStartPointChildKey) break;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child) && (previousSpan = {
            node: child,
            path: [
                ...selectionStartBlock.path,
                "children",
                {
                    _key: child._key
                }
            ]
        });
    }
    return previousSpan;
};
function getSelectedChildren(options) {
    const filter = options?.filter;
    return (snapshot)=>{
        const startPoint = getSelectionStartPoint(snapshot), endPoint = getSelectionEndPoint(snapshot);
        if (!startPoint || !endPoint) return [];
        const startBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(startPoint), endBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(endPoint), startChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(startPoint), endChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(endPoint);
        if (!startBlockKey || !endBlockKey) return [];
        const startBlockIndex = snapshot.blockIndexMap.get(startBlockKey), endBlockIndex = snapshot.blockIndexMap.get(endBlockKey);
        if (startBlockIndex === void 0 || endBlockIndex === void 0) return [];
        const selectedChildren = [], minBlockIndex = Math.min(startBlockIndex, endBlockIndex), maxBlockIndex = Math.max(startBlockIndex, endBlockIndex), blocks = snapshot.context.value.slice(minBlockIndex, maxBlockIndex + 1);
        let startChildFound = !1;
        for (const block of blocks){
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block)) continue;
            const isStartBlock = block._key === startBlockKey, isEndBlock = block._key === endBlockKey, isMiddleBlock = !isStartBlock && !isEndBlock;
            for (const child of block.children){
                const isStartChild = child._key === startChildKey, isEndChild = child._key === endChildKey, addChild = ()=>{
                    (!filter || filter(child)) && selectedChildren.push({
                        node: child,
                        path: [
                            {
                                _key: block._key
                            },
                            "children",
                            {
                                _key: child._key
                            }
                        ]
                    });
                };
                if (isMiddleBlock) {
                    addChild();
                    continue;
                }
                if (isStartChild) {
                    if (startChildFound = !0, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child) ? startPoint.offset < child.text.length && addChild() : addChild(), startChildKey === endChildKey) break;
                    continue;
                }
                if (isEndChild) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child) ? endPoint.offset > 0 && addChild() : addChild();
                    break;
                }
                startChildFound && addChild();
            }
            if (isStartBlock && startBlockKey === endBlockKey) break;
            isStartBlock && (startChildFound = !0);
        }
        return selectedChildren;
    };
}
const getSelectedSpans = (snapshot)=>snapshot.context.selection ? getSelectedChildren({
        filter: (child)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child)
    })(snapshot) : [], getMarkState = (snapshot)=>{
    if (!snapshot.context.selection) return;
    let selection = snapshot.context.selection;
    if (!getFocusTextBlock(snapshot)) return;
    if (isBlockPath(selection.anchor.path)) {
        const spanSelectionPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blockOffsetToSpanSelectionPoint"])({
            context: snapshot.context,
            blockOffset: {
                path: selection.anchor.path,
                offset: selection.anchor.offset
            },
            direction: selection.backward ? "backward" : "forward"
        });
        selection = spanSelectionPoint ? {
            ...selection,
            anchor: spanSelectionPoint
        } : selection;
    }
    if (isBlockPath(selection.focus.path)) {
        const spanSelectionPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blockOffsetToSpanSelectionPoint"])({
            context: snapshot.context,
            blockOffset: {
                path: selection.focus.path,
                offset: selection.focus.offset
            },
            direction: selection.backward ? "backward" : "forward"
        });
        selection = spanSelectionPoint ? {
            ...selection,
            focus: spanSelectionPoint
        } : selection;
    }
    const focusSpan = getFocusSpan({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection
        }
    });
    if (!focusSpan) return;
    if (isSelectionExpanded$1(selection)) {
        const selectedSpans = getSelectedSpans({
            ...snapshot,
            context: {
                ...snapshot.context,
                selection
            }
        });
        let index = 0, marks2 = [];
        for (const span of selectedSpans){
            if (index === 0) marks2 = span.node.marks ?? [];
            else {
                if (span.node.marks?.length === 0) {
                    marks2 = [];
                    continue;
                }
                marks2 = marks2.filter((mark)=>(span.node.marks ?? []).some((spanMark)=>spanMark === mark));
            }
            index++;
        }
        return {
            state: "unchanged",
            marks: marks2
        };
    }
    const decorators = snapshot.context.schema.decorators.map((decorator)=>decorator.name), marks = focusSpan.node.marks ?? [], marksWithoutAnnotations = marks.filter((mark)=>decorators.includes(mark)), spanHasAnnotations = marks.length > marksWithoutAnnotations.length, spanIsEmpty = focusSpan.node.text.length === 0, atTheBeginningOfSpan = snapshot.context.selection.anchor.offset === 0, atTheEndOfSpan = snapshot.context.selection.anchor.offset === focusSpan.node.text.length, previousSpan = getPreviousSpan({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection
        }
    }), nextSpan = getNextSpan({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection
        }
    }), nextSpanAnnotations = nextSpan?.node?.marks?.filter((mark)=>!decorators.includes(mark)) ?? [], spanAnnotations = marks.filter((mark)=>!decorators.includes(mark)), previousSpanHasAnnotations = previousSpan ? previousSpan.node.marks?.some((mark)=>!decorators.includes(mark)) : !1, previousSpanHasSameAnnotations = previousSpan ? previousSpan.node.marks?.filter((mark)=>!decorators.includes(mark)).every((mark)=>marks.includes(mark)) : !1, previousSpanHasSameAnnotation = previousSpan ? previousSpan.node.marks?.some((mark)=>!decorators.includes(mark) && marks.includes(mark)) : !1, previousSpanHasSameMarks = previousSpan ? previousSpan.node.marks?.every((mark)=>marks.includes(mark)) : !1, nextSpanSharesSomeAnnotations = spanAnnotations.some((mark)=>nextSpanAnnotations?.includes(mark));
    if (spanHasAnnotations && !spanIsEmpty) {
        if (atTheBeginningOfSpan) {
            if (previousSpanHasSameMarks) return {
                state: "changed",
                previousMarks: marks,
                marks: previousSpan?.node.marks ?? []
            };
            if (previousSpanHasSameAnnotations) return {
                state: "changed",
                previousMarks: marks,
                marks: previousSpan?.node.marks ?? []
            };
            if (previousSpanHasSameAnnotation) return {
                state: "unchanged",
                marks: focusSpan.node.marks ?? []
            };
            if (!previousSpan) return {
                state: "changed",
                previousMarks: marks,
                marks: []
            };
        }
        if (atTheEndOfSpan) {
            if (!nextSpan) return {
                state: "changed",
                previousMarks: marks,
                marks: []
            };
            if (nextSpanAnnotations.length > 0 && !nextSpanSharesSomeAnnotations) return {
                state: "changed",
                previousMarks: marks,
                marks: []
            };
            if (nextSpanSharesSomeAnnotations && nextSpanAnnotations.length < spanAnnotations.length || !nextSpanSharesSomeAnnotations) return {
                state: "changed",
                previousMarks: marks,
                marks: nextSpan?.node.marks ?? []
            };
        }
    }
    return atTheBeginningOfSpan && !spanIsEmpty && previousSpan ? previousSpanHasAnnotations ? {
        state: "changed",
        marks,
        previousMarks: previousSpan?.node.marks ?? []
    } : {
        state: "changed",
        previousMarks: marks,
        marks: (previousSpan?.node.marks ?? []).filter((mark)=>decorators.includes(mark))
    } : {
        state: "unchanged",
        marks
    };
}, getSelectedBlocks = (snapshot)=>{
    if (!snapshot.context.selection) return [];
    const selectedBlocks = [], startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection), endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection), startKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(startPoint), endKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(endPoint);
    if (!startKey || !endKey) return selectedBlocks;
    const startBlockIndex = snapshot.blockIndexMap.get(startKey), endBlockIndex = snapshot.blockIndexMap.get(endKey);
    if (startBlockIndex === void 0 || endBlockIndex === void 0) return selectedBlocks;
    const slicedValue = snapshot.context.value.slice(startBlockIndex, endBlockIndex + 1);
    for (const block of slicedValue){
        if (block._key === startKey) {
            if (selectedBlocks.push({
                node: block,
                path: [
                    {
                        _key: block._key
                    }
                ]
            }), startKey === endKey) break;
            continue;
        }
        if (block._key === endKey) {
            selectedBlocks.push({
                node: block,
                path: [
                    {
                        _key: block._key
                    }
                ]
            });
            break;
        }
        selectedBlocks.length > 0 && selectedBlocks.push({
            node: block,
            path: [
                {
                    _key: block._key
                }
            ]
        });
    }
    return selectedBlocks;
}, getActiveAnnotations = (snapshot)=>{
    if (!snapshot.context.selection) return [];
    const selectedBlocks = getSelectedBlocks(snapshot), activeAnnotations = (getMarkState(snapshot)?.marks ?? []).filter((mark)=>!snapshot.context.schema.decorators.map((decorator)=>decorator.name).includes(mark));
    return selectedBlocks.flatMap((block)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block.node) ? block.node.markDefs ?? [] : []).filter((markDef)=>activeAnnotations.includes(markDef._key));
}, getActiveListItem = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const selectedTextBlocks = getSelectedBlocks(snapshot).map((block)=>block.node).filter((block)=>isTextBlockNode(snapshot.context, block)), firstTextBlock = selectedTextBlocks.at(0);
    if (!firstTextBlock) return;
    const firstListItem = firstTextBlock.listItem;
    if (firstListItem && selectedTextBlocks.every((block)=>block.listItem === firstListItem)) return firstListItem;
}, getActiveStyle = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const selectedTextBlocks = getSelectedBlocks(snapshot).map((block)=>block.node).filter((block)=>isTextBlockNode(snapshot.context, block)), firstTextBlock = selectedTextBlocks.at(0);
    if (!firstTextBlock) return;
    const firstStyle = firstTextBlock.style;
    if (firstStyle && selectedTextBlocks.every((block)=>block.style === firstStyle)) return firstStyle;
}, getNextInlineObject = (snapshot)=>{
    const focusTextBlock = getFocusTextBlock(snapshot), selectionEndPoint = getSelectionEndPoint(snapshot), selectionEndPointChildKey = selectionEndPoint && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isKeyedSegment"])(selectionEndPoint.path[2]) ? selectionEndPoint.path[2]._key : void 0;
    if (!focusTextBlock || !selectionEndPointChildKey) return;
    let endPointChildFound = !1, inlineObject;
    for (const child of focusTextBlock.node.children){
        if (child._key === selectionEndPointChildKey) {
            endPointChildFound = !0;
            continue;
        }
        if (!isSpanNode(snapshot.context, child) && endPointChildFound) {
            inlineObject = {
                node: child,
                path: [
                    ...focusTextBlock.path,
                    "children",
                    {
                        _key: child._key
                    }
                ]
            };
            break;
        }
    }
    return inlineObject;
}, getPreviousInlineObject = (snapshot)=>{
    const focusTextBlock = getFocusTextBlock(snapshot), selectionStartPoint = getSelectionStartPoint(snapshot), selectionStartPointChildKey = selectionStartPoint && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isKeyedSegment"])(selectionStartPoint.path[2]) ? selectionStartPoint.path[2]._key : void 0;
    if (!focusTextBlock || !selectionStartPointChildKey) return;
    let inlineObject;
    for (const child of focusTextBlock.node.children){
        if (child._key === selectionStartPointChildKey) break;
        isSpanNode(snapshot.context, child) || (inlineObject = {
            node: child,
            path: [
                ...focusTextBlock.path,
                "children",
                {
                    _key: child._key
                }
            ]
        });
    }
    return inlineObject;
}, getSelectedValue = (snapshot)=>{
    const selection = snapshot.context.selection;
    if (!selection) return [];
    const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(selection), endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(selection), startBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(startPoint), endBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(endPoint);
    if (!startBlockKey || !endBlockKey) return [];
    const startBlockIndex = snapshot.blockIndexMap.get(startBlockKey), endBlockIndex = snapshot.blockIndexMap.get(endBlockKey);
    if (startBlockIndex === void 0 || endBlockIndex === void 0) return [];
    const startBlock = snapshot.context.value.at(startBlockIndex), slicedStartBlock = startBlock ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sliceBlocks"])({
        context: snapshot.context,
        blocks: [
            startBlock
        ]
    }).at(0) : void 0;
    if (startBlockIndex === endBlockIndex) return slicedStartBlock ? [
        slicedStartBlock
    ] : [];
    const endBlock = snapshot.context.value.at(endBlockIndex), slicedEndBlock = endBlock ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sliceBlocks"])({
        context: snapshot.context,
        blocks: [
            endBlock
        ]
    }).at(0) : void 0, middleBlocks = snapshot.context.value.slice(startBlockIndex + 1, endBlockIndex);
    return [
        ...slicedStartBlock ? [
            slicedStartBlock
        ] : [],
        ...middleBlocks,
        ...slicedEndBlock ? [
            slicedEndBlock
        ] : []
    ];
}, getSelectionText = (snapshot)=>getSelectedValue(snapshot).reduce((text, block)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block) ? text + block.children.reduce((text2, child)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, child) ? text2 + child.text : text2, "") : text, ""), isSelectionCollapsed = (snapshot)=>snapshot.context.selection ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualPaths"])(snapshot.context.selection.anchor.path, snapshot.context.selection.focus.path) && snapshot.context.selection.anchor.offset === snapshot.context.selection.focus.offset : !1, isSelectionExpanded = (snapshot)=>snapshot.context.selection !== null && !isSelectionCollapsed(snapshot), getCaretWordSelection = (snapshot)=>{
    if (!snapshot.context.selection || !isSelectionCollapsed(snapshot)) return null;
    const focusTextBlock = getFocusTextBlock(snapshot), selectionStartPoint = getSelectionStartPoint(snapshot), selectionStartOffset = selectionStartPoint ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["spanSelectionPointToBlockOffset"])({
        context: snapshot.context,
        selectionPoint: selectionStartPoint
    }) : void 0;
    if (!focusTextBlock || !selectionStartPoint || !selectionStartOffset) return null;
    const previousInlineObject = getPreviousInlineObject(snapshot), blockStartPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockStartPoint"])({
        context: snapshot.context,
        block: focusTextBlock
    }), textDirectlyBefore = getSelectionText({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: previousInlineObject ? {
                    path: previousInlineObject.path,
                    offset: 0
                } : blockStartPoint,
                focus: selectionStartPoint
            }
        }
    }).split(/\s+/).at(-1), nextInlineObject = getNextInlineObject(snapshot), blockEndPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockEndPoint"])({
        context: snapshot.context,
        block: focusTextBlock
    }), textDirectlyAfter = getSelectionText({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: selectionStartPoint,
                focus: nextInlineObject ? {
                    path: nextInlineObject.path,
                    offset: 0
                } : blockEndPoint
            }
        }
    }).split(/\s+/).at(0);
    if ((textDirectlyBefore === void 0 || textDirectlyBefore === "") && (textDirectlyAfter === void 0 || textDirectlyAfter === "")) return null;
    const caretWordStartOffset = textDirectlyBefore ? {
        ...selectionStartOffset,
        offset: selectionStartOffset.offset - textDirectlyBefore.length
    } : selectionStartOffset, caretWordEndOffset = textDirectlyAfter ? {
        ...selectionStartOffset,
        offset: selectionStartOffset.offset + textDirectlyAfter.length
    } : selectionStartOffset, caretWordStartSelectionPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blockOffsetToSpanSelectionPoint"])({
        context: snapshot.context,
        blockOffset: caretWordStartOffset,
        direction: "backward"
    }), caretWordEndSelectionPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blockOffsetToSpanSelectionPoint"])({
        context: snapshot.context,
        blockOffset: caretWordEndOffset,
        direction: "forward"
    });
    if (!caretWordStartSelectionPoint || !caretWordEndSelectionPoint) return null;
    const caretWordSelection = {
        anchor: caretWordStartSelectionPoint,
        focus: caretWordEndSelectionPoint
    };
    return isSelectionExpanded({
        context: {
            ...snapshot.context,
            selection: caretWordSelection
        }
    }) ? caretWordSelection : null;
}, getFocusBlockObject = (snapshot)=>{
    const focusBlock = getFocusBlock(snapshot);
    return focusBlock && !isTextBlockNode(snapshot.context, focusBlock.node) ? {
        node: focusBlock.node,
        path: focusBlock.path
    } : void 0;
}, getFocusInlineObject = (snapshot)=>{
    const focusChild = getFocusChild(snapshot);
    return focusChild && !isSpanNode(snapshot.context, focusChild.node) ? {
        node: focusChild.node,
        path: focusChild.path
    } : void 0;
}, getFocusListBlock = (snapshot)=>{
    const focusTextBlock = getFocusTextBlock(snapshot);
    return focusTextBlock && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isListBlock"])(snapshot.context, focusTextBlock.node) ? {
        node: focusTextBlock.node,
        path: focusTextBlock.path
    } : void 0;
}, getLastBlock = (snapshot)=>{
    const node = snapshot.context.value[snapshot.context.value.length - 1] ? snapshot.context.value[snapshot.context.value.length - 1] : void 0;
    return node ? {
        node,
        path: [
            {
                _key: node._key
            }
        ]
    } : void 0;
}, getNextBlock = (snapshot)=>{
    const selectionEndBlock = getSelectionEndBlock(snapshot);
    if (!selectionEndBlock) return;
    const index = snapshot.blockIndexMap.get(selectionEndBlock.node._key);
    if (index === void 0 || index === snapshot.context.value.length - 1) return;
    const nextBlock = snapshot.context.value.at(index + 1);
    return nextBlock ? {
        node: nextBlock,
        path: [
            {
                _key: nextBlock._key
            }
        ]
    } : void 0;
}, getPreviousBlock = (snapshot)=>{
    const selectionStartBlock = getSelectionStartBlock(snapshot);
    if (!selectionStartBlock) return;
    const index = snapshot.blockIndexMap.get(selectionStartBlock.node._key);
    if (index === void 0 || index === 0) return;
    const previousBlock = snapshot.context.value.at(index - 1);
    return previousBlock ? {
        node: previousBlock,
        path: [
            {
                _key: previousBlock._key
            }
        ]
    } : void 0;
}, getSelectedTextBlocks = (snapshot)=>{
    if (!snapshot.context.selection) return [];
    const selectedTextBlocks = [], startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection), endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection), startBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(startPoint), endBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(endPoint);
    if (!startBlockKey || !endBlockKey) return selectedTextBlocks;
    const startBlockIndex = snapshot.blockIndexMap.get(startBlockKey), endBlockIndex = snapshot.blockIndexMap.get(endBlockKey);
    if (startBlockIndex === void 0 || endBlockIndex === void 0) return selectedTextBlocks;
    const slicedValue = snapshot.context.value.slice(startBlockIndex, endBlockIndex + 1);
    for (const block of slicedValue){
        if (block._key === startBlockKey) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block) && selectedTextBlocks.push({
                node: block,
                path: [
                    {
                        _key: block._key
                    }
                ]
            }), startBlockKey === endBlockKey) break;
            continue;
        }
        if (block._key === endBlockKey) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block) && selectedTextBlocks.push({
                node: block,
                path: [
                    {
                        _key: block._key
                    }
                ]
            });
            break;
        }
        selectedTextBlocks.length > 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block) && selectedTextBlocks.push({
            node: block,
            path: [
                {
                    _key: block._key
                }
            ]
        });
    }
    return selectedTextBlocks;
}, getSelectionEndChild = (snapshot)=>{
    const endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection);
    if (endPoint) return getFocusChild({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: endPoint,
                focus: endPoint
            }
        }
    });
}, getSelectionStartChild = (snapshot)=>{
    const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection);
    if (startPoint) return getFocusChild({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: startPoint,
                focus: startPoint
            }
        }
    });
};
function getActiveAnnotationsMarks(snapshot) {
    const schema = snapshot.context.schema;
    return (getMarkState(snapshot)?.marks ?? []).filter((mark)=>!schema.decorators.map((decorator)=>decorator.name).includes(mark));
}
function isActiveAnnotation(annotation, options) {
    return (snapshot)=>{
        if ((options?.mode ?? "full") === "partial") return getSelectedValue(snapshot).flatMap((block)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block) ? block.markDefs ?? [] : []).some((markDef)=>markDef._type === annotation);
        const selectionMarkDefs = getSelectedBlocks(snapshot).flatMap((block)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block.node) ? block.node.markDefs ?? [] : []), activeAnnotations = getActiveAnnotationsMarks(snapshot);
        return selectionMarkDefs.filter((markDef)=>markDef._type === annotation && activeAnnotations.includes(markDef._key)).length > 0;
    };
}
function getActiveDecorators(snapshot) {
    const schema = snapshot.context.schema, decoratorState = snapshot.decoratorState, markState = getMarkState(snapshot), decorators = schema.decorators.map((decorator)=>decorator.name);
    let activeDecorators = (markState?.marks ?? []).filter((mark)=>decorators.includes(mark));
    for(const decorator in decoratorState)decoratorState[decorator] === !1 ? activeDecorators = activeDecorators.filter((activeDecorator)=>activeDecorator !== decorator) : decoratorState[decorator] === !0 && (activeDecorators.includes(decorator) || activeDecorators.push(decorator));
    return activeDecorators;
}
function isActiveDecorator(decorator) {
    return (snapshot)=>{
        if (isSelectionExpanded(snapshot)) {
            const selectedSpans = getSelectedSpans(snapshot);
            return selectedSpans.length > 0 && selectedSpans.every((span)=>span.node.marks?.includes(decorator));
        }
        return getActiveDecorators(snapshot).includes(decorator);
    };
}
function isActiveListItem(listItem) {
    return (snapshot)=>getActiveListItem(snapshot) === listItem;
}
function isActiveStyle(style) {
    return (snapshot)=>getActiveStyle(snapshot) === style;
}
function isAtTheEndOfBlock(block) {
    return (snapshot)=>{
        if (!snapshot.context.selection || !isSelectionCollapsed(snapshot)) return !1;
        const blockEndPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockEndPoint"])({
            context: snapshot.context,
            block
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(snapshot.context.selection.focus, blockEndPoint);
    };
}
function isAtTheStartOfBlock(block) {
    return (snapshot)=>{
        if (!snapshot.context.selection || !isSelectionCollapsed(snapshot)) return !1;
        const blockStartPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockStartPoint"])({
            context: snapshot.context,
            block
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(snapshot.context.selection.focus, blockStartPoint);
    };
}
function comparePoints(snapshot, pointA, pointB) {
    const blockKeyA = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(pointA), blockKeyB = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(pointB);
    if (!blockKeyA) throw new Error(`Cannot compare points: no block key found for ${pointA}`);
    if (!blockKeyB) throw new Error(`Cannot compare points: no block key found for ${pointB}`);
    const blockIndexA = snapshot.blockIndexMap.get(blockKeyA), blockIndexB = snapshot.blockIndexMap.get(blockKeyB);
    if (blockIndexA === void 0) throw new Error(`Cannot compare points: block "${blockKeyA}" not found`);
    if (blockIndexB === void 0) throw new Error(`Cannot compare points: block "${blockKeyB}" not found`);
    if (blockIndexA < blockIndexB) return -1;
    if (blockIndexA > blockIndexB) return 1;
    const block = snapshot.context.value.at(blockIndexA);
    if (!block || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, block)) return 0;
    const childKeyA = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(pointA), childKeyB = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(pointB);
    if (!childKeyA) throw new Error(`Cannot compare points: no child key found for ${pointA}`);
    if (!childKeyB) throw new Error(`Cannot compare points: no child key found for ${pointB}`);
    let childIndexA, childIndexB;
    for(let i = 0; i < block.children.length; i++){
        const child = block.children.at(i);
        if (child) {
            if (child._key === childKeyA && child._key === childKeyB) return pointA.offset < pointB.offset ? -1 : pointA.offset > pointB.offset ? 1 : 0;
            if (child._key === childKeyA && (childIndexA = i), child._key === childKeyB && (childIndexB = i), childIndexA !== void 0 && childIndexB !== void 0) break;
        }
    }
    if (childIndexA === void 0) throw new Error(`Cannot compare points: child "${childKeyA}" not found`);
    if (childIndexB === void 0) throw new Error(`Cannot compare points: child "${childKeyB}" not found`);
    return childIndexA < childIndexB ? -1 : childIndexA > childIndexB ? 1 : 0;
}
function isOverlappingSelection(selection) {
    return (snapshot)=>{
        const editorSelection = snapshot.context.selection;
        if (!selection || !editorSelection) return !1;
        const selectionStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(selection), selectionEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(selection), editorSelectionStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(editorSelection), editorSelectionEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(editorSelection), selectionStartBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(selectionStart), selectionEndBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(selectionEnd), editorSelectionStartBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(editorSelectionStart), editorSelectionEndBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(editorSelectionEnd);
        if (!selectionStartBlockKey || !selectionEndBlockKey || !editorSelectionStartBlockKey || !editorSelectionEndBlockKey) return !1;
        const selectionStartBlockIndex = snapshot.blockIndexMap.get(selectionStartBlockKey), selectionEndBlockIndex = snapshot.blockIndexMap.get(selectionEndBlockKey), editorSelectionStartBlockIndex = snapshot.blockIndexMap.get(editorSelectionStartBlockKey), editorSelectionEndBlockIndex = snapshot.blockIndexMap.get(editorSelectionEndBlockKey);
        if (selectionStartBlockIndex === void 0 || selectionEndBlockIndex === void 0 || editorSelectionStartBlockIndex === void 0 || editorSelectionEndBlockIndex === void 0) return !1;
        const [selectionMinBlockIndex, selectionMaxBlockIndex] = selectionStartBlockIndex <= selectionEndBlockIndex ? [
            selectionStartBlockIndex,
            selectionEndBlockIndex
        ] : [
            selectionEndBlockIndex,
            selectionStartBlockIndex
        ], [editorSelectionMinBlockIndex, editorSelectionMaxBlockIndex] = editorSelectionStartBlockIndex <= editorSelectionEndBlockIndex ? [
            editorSelectionStartBlockIndex,
            editorSelectionEndBlockIndex
        ] : [
            editorSelectionEndBlockIndex,
            editorSelectionStartBlockIndex
        ];
        return selectionMaxBlockIndex < editorSelectionMinBlockIndex || selectionMinBlockIndex > editorSelectionMaxBlockIndex ? !1 : hasPointLevelOverlap(snapshot, selectionStart, selectionEnd, editorSelectionStart, editorSelectionEnd);
    };
}
function hasPointLevelOverlap(snapshot, selectionStart, selectionEnd, editorSelectionStart, editorSelectionEnd) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(selectionStart, editorSelectionStart) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(selectionEnd, editorSelectionEnd)) return !0;
    const selectionStartVsEditorSelectionStart = comparePoints(snapshot, selectionStart, editorSelectionStart), selectionStartVsEditorSelectionEnd = comparePoints(snapshot, selectionStart, editorSelectionEnd), selectionEndVsEditorSelectionStart = comparePoints(snapshot, selectionEnd, editorSelectionStart), selectionEndVsEditorSelectionEnd = comparePoints(snapshot, selectionEnd, editorSelectionEnd), editorSelectionStartVsSelectionStart = comparePoints(snapshot, editorSelectionStart, selectionStart), editorSelectionEndVsSelectionEnd = comparePoints(snapshot, editorSelectionEnd, selectionEnd), selectionStartBeforeEditorSelectionStart = selectionStartVsEditorSelectionStart === -1, selectionStartAfterEditorSelectionEnd = selectionStartVsEditorSelectionEnd === 1, selectionEndBeforeEditorSelectionStart = selectionEndVsEditorSelectionStart === -1, selectionEndAfterEditorSelectionEnd = selectionEndVsEditorSelectionEnd === 1, editorSelectionStartBeforeSelectionStart = editorSelectionStartVsSelectionStart === -1, editorSelectionStartAfterSelectionStart = editorSelectionStartVsSelectionStart === 1, editorSelectionEndBeforeSelectionEnd = editorSelectionEndVsSelectionEnd === -1, editorSelectionEndAfterSelectionEnd = editorSelectionEndVsSelectionEnd === 1, selectionStartEqualEditorSelectionEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(selectionStart, editorSelectionEnd), selectionEndEqualEditorSelectionStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(selectionEnd, editorSelectionStart);
    return !selectionEndEqualEditorSelectionStart && !selectionStartEqualEditorSelectionEnd && !editorSelectionStartBeforeSelectionStart && !editorSelectionStartAfterSelectionStart && !editorSelectionEndBeforeSelectionEnd && !editorSelectionEndAfterSelectionEnd || selectionEndBeforeEditorSelectionStart && !selectionEndEqualEditorSelectionStart || selectionStartAfterEditorSelectionEnd && !selectionStartEqualEditorSelectionEnd ? !1 : !editorSelectionStartBeforeSelectionStart && editorSelectionStartAfterSelectionStart && !editorSelectionEndBeforeSelectionEnd && editorSelectionEndAfterSelectionEnd ? !selectionEndEqualEditorSelectionStart : editorSelectionStartBeforeSelectionStart && !editorSelectionStartAfterSelectionStart && editorSelectionEndBeforeSelectionEnd && !editorSelectionEndAfterSelectionEnd ? !selectionStartEqualEditorSelectionEnd : !selectionStartAfterEditorSelectionEnd || !selectionStartBeforeEditorSelectionStart || !selectionEndAfterEditorSelectionEnd || !selectionEndBeforeEditorSelectionStart;
}
const isSelectingEntireBlocks = (snapshot)=>{
    if (!snapshot.context.selection) return !1;
    const startPoint = snapshot.context.selection.backward ? snapshot.context.selection.focus : snapshot.context.selection.anchor, endPoint = snapshot.context.selection.backward ? snapshot.context.selection.anchor : snapshot.context.selection.focus, startBlock = getSelectionStartBlock(snapshot), endBlock = getSelectionEndBlock(snapshot);
    if (!startBlock || !endBlock) return !1;
    const startBlockStartPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockStartPoint"])({
        context: snapshot.context,
        block: startBlock
    }), endBlockEndPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockEndPoint"])({
        context: snapshot.context,
        block: endBlock
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(startBlockStartPoint, startPoint) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(endBlockEndPoint, endPoint);
};
;
 //# sourceMappingURL=selector.is-selecting-entire-blocks.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-text-block.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getTextBlockText",
    ()=>getTextBlockText,
    "isEmptyTextBlock",
    ()=>isEmptyTextBlock,
    "sliceTextBlock",
    ()=>sliceTextBlock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+schema@2.1.1/node_modules/@portabletext/schema/dist/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)");
;
;
function getTextBlockText(block) {
    return block.children.map((child)=>child.text ?? "").join("");
}
function isEmptyTextBlock(context, block) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) return !1;
    const onlyText = block.children.every((child)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)), blockText = getTextBlockText(block);
    return onlyText && blockText === "";
}
function sliceTextBlock({ context, block }) {
    const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(context.selection), endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(context.selection);
    if (!startPoint || !endPoint) return block;
    const startBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(startPoint), endBlockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(endPoint);
    if (startBlockKey !== endBlockKey || startBlockKey !== block._key) return block;
    const startChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(startPoint), endChildKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(endPoint);
    if (!startChildKey || !endChildKey) return block;
    let startChildFound = !1;
    const children = [];
    for (const child of block.children){
        if (child._key === startChildKey) {
            if (startChildFound = !0, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child)) {
                const text = child._key === endChildKey ? child.text.slice(startPoint.offset, endPoint.offset) : child.text.slice(startPoint.offset);
                children.push({
                    ...child,
                    text
                });
            } else children.push(child);
            if (startChildKey === endChildKey) break;
            continue;
        }
        if (child._key === endChildKey) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child) ? children.push({
                ...child,
                text: child.text.slice(0, endPoint.offset)
            }) : children.push(child);
            break;
        }
        startChildFound && children.push(child);
    }
    return {
        ...block,
        children
    };
}
;
 //# sourceMappingURL=util.slice-text-block.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/use-editor.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EditorContext",
    ()=>EditorContext,
    "useEditor",
    ()=>useEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
function getGlobalScope() {
    if (typeof globalThis < "u") return globalThis;
    if (typeof window < "u") return window;
    if (typeof self < "u") return self;
    if (("TURBOPACK compile-time value", "object") < "u") return /*TURBOPACK member replacement*/ __turbopack_context__.g;
    throw new Error("@portabletext/editor: could not locate global scope");
}
const globalScope = getGlobalScope();
function createGloballyScopedContext(key, defaultValue) {
    const symbol = Symbol.for(key);
    return typeof document > "u" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(defaultValue) : (globalScope[symbol] = globalScope[symbol] ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(defaultValue), globalScope[symbol]);
}
const EditorContext = createGloballyScopedContext("@portabletext/editor/context/editor", null);
function useEditor() {
    const editor = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useContext(EditorContext);
    if (!editor) throw new Error("No Editor set. Use EditorProvider to set one.");
    return editor;
}
;
 //# sourceMappingURL=use-editor.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript) <export defaultKeyGenerator as keyGenerator>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "keyGenerator",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultKeyGenerator"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)");
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/behaviors/index.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "defineBehavior",
    ()=>defineBehavior,
    "effect",
    ()=>effect,
    "execute",
    ()=>execute,
    "forward",
    ()=>forward,
    "raise",
    ()=>raise
]);
function execute(event) {
    return {
        type: "execute",
        event
    };
}
function forward(event) {
    return {
        type: "forward",
        event
    };
}
function raise(event) {
    return {
        type: "raise",
        event
    };
}
function effect(effect2) {
    return {
        type: "effect",
        effect: effect2
    };
}
function defineBehavior(behavior) {
    return behavior;
}
;
 //# sourceMappingURL=index.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/plugins/index.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BehaviorPlugin",
    ()=>BehaviorPlugin,
    "EditorRefPlugin",
    ()=>EditorRefPlugin,
    "EventListenerPlugin",
    ()=>EventListenerPlugin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/compiled/react/compiler-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$use$2d$editor$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/use-editor.js [app-client] (ecmascript)");
;
;
;
function BehaviorPlugin(props) {
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["c"])(4), editor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$use$2d$editor$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    let t0, t1;
    return $[0] !== editor || $[1] !== props.behaviors ? (t0 = ()=>{
        const unregisterBehaviors = props.behaviors.map((behavior)=>editor.registerBehavior({
                behavior
            }));
        return ()=>{
            unregisterBehaviors.forEach(_temp);
        };
    }, t1 = [
        editor,
        props.behaviors
    ], $[0] = editor, $[1] = props.behaviors, $[2] = t0, $[3] = t1) : (t0 = $[2], t1 = $[3]), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t0, t1), null;
}
function _temp(unregister) {
    unregister();
}
const EditorRefPlugin = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].forwardRef((_, ref)=>{
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["c"])(2), editor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$use$2d$editor$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])(), portableTextEditorRef = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useRef(editor);
    let t0, t1;
    return $[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (t0 = ()=>portableTextEditorRef.current, t1 = [], $[0] = t0, $[1] = t1) : (t0 = $[0], t1 = $[1]), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useImperativeHandle(ref, t0, t1), null;
});
EditorRefPlugin.displayName = "EditorRefPlugin";
function EventListenerPlugin(props) {
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["c"])(4), editor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$use$2d$editor$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    let t0, t1;
    return $[0] !== editor || $[1] !== props.on ? (t0 = ()=>{
        const subscription = editor.on("*", props.on);
        return ()=>{
            subscription.unsubscribe();
        };
    }, t1 = [
        editor,
        props.on
    ], $[0] = editor, $[1] = props.on, $[2] = t0, $[3] = t1) : (t0 = $[2], t1 = $[3]), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t0, t1), null;
}
;
 //# sourceMappingURL=index.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/utils/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "blockOffsetToBlockSelectionPoint",
    ()=>blockOffsetToBlockSelectionPoint,
    "blockOffsetToSelectionPoint",
    ()=>blockOffsetToSelectionPoint,
    "blockOffsetsToSelection",
    ()=>blockOffsetsToSelection,
    "childSelectionPointToBlockOffset",
    ()=>childSelectionPointToBlockOffset,
    "isEqualSelections",
    ()=>isEqualSelections,
    "mergeTextBlocks",
    ()=>mergeTextBlocks,
    "reverseSelection",
    ()=>reverseSelection,
    "selectionPointToBlockOffset",
    ()=>selectionPointToBlockOffset,
    "splitTextBlock",
    ()=>splitTextBlock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+schema@2.1.1/node_modules/@portabletext/schema/dist/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$text$2d$block$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-text-block.js [app-client] (ecmascript)");
;
;
;
;
;
;
function blockOffsetToBlockSelectionPoint({ context, blockOffset }) {
    let selectionPoint;
    for (const block of context.value)if (block._key === blockOffset.path[0]._key) {
        selectionPoint = {
            path: [
                {
                    _key: block._key
                }
            ],
            offset: blockOffset.offset
        };
        break;
    }
    return selectionPoint;
}
function blockOffsetToSelectionPoint({ context, blockOffset, direction }) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["blockOffsetToSpanSelectionPoint"])({
        context,
        blockOffset,
        direction
    }) || blockOffsetToBlockSelectionPoint({
        context,
        blockOffset
    });
}
function blockOffsetsToSelection({ context, offsets, backward }) {
    const anchor = blockOffsetToSelectionPoint({
        context,
        blockOffset: offsets.anchor,
        direction: backward ? "backward" : "forward"
    }), focus = blockOffsetToSelectionPoint({
        context,
        blockOffset: offsets.focus,
        direction: backward ? "forward" : "backward"
    });
    return !anchor || !focus ? null : {
        anchor,
        focus,
        backward
    };
}
function childSelectionPointToBlockOffset({ context, selectionPoint }) {
    let offset = 0;
    const blockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(selectionPoint), childKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(selectionPoint);
    if (!(!blockKey || !childKey)) {
        for (const block of context.value)if (block._key === blockKey && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, block)) for (const child of block.children){
            if (child._key === childKey) return {
                path: [
                    {
                        _key: block._key
                    }
                ],
                offset: offset + selectionPoint.offset
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, child) && (offset += child.text.length);
        }
    }
}
function isEqualSelections(a, b) {
    return !a && !b ? !0 : !a || !b ? !1 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(a.anchor, b.anchor) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isEqualSelectionPoints"])(a.focus, b.focus);
}
function mergeTextBlocks({ context, targetBlock, incomingBlock }) {
    const parsedIncomingBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseBlock"])({
        context,
        block: incomingBlock,
        options: {
            normalize: !1,
            removeUnusedMarkDefs: !0,
            validateFields: !1
        }
    });
    return !parsedIncomingBlock || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(context, parsedIncomingBlock) ? targetBlock : {
        ...targetBlock,
        children: [
            ...targetBlock.children,
            ...parsedIncomingBlock.children
        ],
        markDefs: [
            ...targetBlock.markDefs ?? [],
            ...parsedIncomingBlock.markDefs ?? []
        ]
    };
}
function reverseSelection(selection) {
    return selection && (selection.backward ? {
        anchor: selection.focus,
        focus: selection.anchor,
        backward: !1
    } : {
        anchor: selection.focus,
        focus: selection.anchor,
        backward: !0
    });
}
function selectionPointToBlockOffset({ context, selectionPoint }) {
    const blockKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(selectionPoint);
    return selectionPoint.path.length === 1 && blockKey !== void 0 ? {
        path: [
            {
                _key: blockKey
            }
        ],
        offset: selectionPoint.offset
    } : childSelectionPointToBlockOffset({
        context,
        selectionPoint
    });
}
function splitTextBlock({ context, block, point }) {
    const firstChild = block.children.at(0), lastChild = block.children.at(block.children.length - 1);
    if (!firstChild || !lastChild) return;
    const before = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$text$2d$block$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sliceTextBlock"])({
        context: {
            schema: context.schema,
            selection: {
                anchor: {
                    path: [
                        {
                            _key: block._key
                        },
                        "children",
                        {
                            _key: firstChild._key
                        }
                    ],
                    offset: 0
                },
                focus: point
            }
        },
        block
    }), after = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$text$2d$block$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sliceTextBlock"])({
        context: {
            schema: context.schema,
            selection: {
                anchor: point,
                focus: {
                    path: [
                        {
                            _key: block._key
                        },
                        "children",
                        {
                            _key: lastChild._key
                        }
                    ],
                    offset: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(context, lastChild) ? lastChild.text.length : 0
                }
            }
        },
        block
    });
    return {
        before,
        after
    };
}
;
 //# sourceMappingURL=index.js.map
}),
"[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/selectors/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAnchorBlock",
    ()=>getAnchorBlock,
    "getAnchorChild",
    ()=>getAnchorChild,
    "getAnchorSpan",
    ()=>getAnchorSpan,
    "getAnchorTextBlock",
    ()=>getAnchorTextBlock,
    "getBlockOffsets",
    ()=>getBlockOffsets,
    "getBlockTextAfter",
    ()=>getBlockTextAfter,
    "getBlockTextBefore",
    ()=>getBlockTextBefore,
    "getFirstBlock",
    ()=>getFirstBlock,
    "getNextInlineObjects",
    ()=>getNextInlineObjects,
    "getPreviousInlineObjects",
    ()=>getPreviousInlineObjects,
    "getSelection",
    ()=>getSelection,
    "getValue",
    ()=>getValue,
    "isPointAfterSelection",
    ()=>isPointAfterSelection,
    "isPointBeforeSelection",
    ()=>isPointBeforeSelection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/selector.is-selecting-entire-blocks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+editor@6.6.0_@types+react@19.2.14_react@19.2.3/node_modules/@portabletext/editor/lib/_chunks-es/util.slice-blocks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@portabletext+schema@2.1.1/node_modules/@portabletext/schema/dist/index.js [app-client] (ecmascript)");
;
;
;
;
const getAnchorBlock = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockKeyFromSelectionPoint"])(snapshot.context.selection.anchor), index = key ? snapshot.blockIndexMap.get(key) : void 0, node = index !== void 0 ? snapshot.context.value.at(index) : void 0;
    return node && key ? {
        node,
        path: [
            {
                _key: key
            }
        ]
    } : void 0;
}, getAnchorTextBlock = (snapshot)=>{
    const anchorBlock = getAnchorBlock(snapshot);
    return anchorBlock && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isTextBlock"])(snapshot.context, anchorBlock.node) ? {
        node: anchorBlock.node,
        path: anchorBlock.path
    } : void 0;
}, getAnchorChild = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const anchorBlock = getAnchorTextBlock(snapshot);
    if (!anchorBlock) return;
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChildKeyFromSelectionPoint"])(snapshot.context.selection.anchor), node = key ? anchorBlock.node.children.find((span)=>span._key === key) : void 0;
    return node && key ? {
        node,
        path: [
            ...anchorBlock.path,
            "children",
            {
                _key: key
            }
        ]
    } : void 0;
}, getAnchorSpan = (snapshot)=>{
    const anchorChild = getAnchorChild(snapshot);
    return anchorChild && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$schema$40$2$2e$1$2e$1$2f$node_modules$2f40$portabletext$2f$schema$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpan"])(snapshot.context, anchorChild.node) ? {
        node: anchorChild.node,
        path: anchorChild.path
    } : void 0;
}, getBlockOffsets = (snapshot)=>{
    if (!snapshot.context.selection) return;
    const selectionStartPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot), selectionEndPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot);
    if (!selectionStartPoint || !selectionEndPoint) return;
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["spanSelectionPointToBlockOffset"])({
        context: snapshot.context,
        selectionPoint: selectionStartPoint
    }), end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["spanSelectionPointToBlockOffset"])({
        context: snapshot.context,
        selectionPoint: selectionEndPoint
    });
    return start && end ? {
        start,
        end
    } : void 0;
}, getFirstBlock = (snapshot)=>{
    const node = snapshot.context.value[0];
    return node ? {
        node,
        path: [
            {
                _key: node._key
            }
        ]
    } : void 0;
}, getNextInlineObjects = (snapshot)=>{
    const focusTextBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getFocusTextBlock"])(snapshot), selectionEndPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot), selectionEndPointChildKey = selectionEndPoint && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isKeyedSegment"])(selectionEndPoint.path[2]) ? selectionEndPoint.path[2]._key : void 0;
    if (!focusTextBlock || !selectionEndPointChildKey) return [];
    let endPointChildFound = !1;
    const inlineObjects = [];
    for (const child of focusTextBlock.node.children){
        if (child._key === selectionEndPointChildKey) {
            endPointChildFound = !0;
            continue;
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpanNode"])(snapshot.context, child) && endPointChildFound) {
            inlineObjects.push({
                node: child,
                path: [
                    ...focusTextBlock.path,
                    "children",
                    {
                        _key: child._key
                    }
                ]
            });
            break;
        }
    }
    return inlineObjects;
}, getPreviousInlineObjects = (snapshot)=>{
    const focusTextBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getFocusTextBlock"])(snapshot), selectionStartPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot), selectionStartPointChildKey = selectionStartPoint && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isKeyedSegment"])(selectionStartPoint.path[2]) ? selectionStartPoint.path[2]._key : void 0;
    if (!focusTextBlock || !selectionStartPointChildKey) return [];
    const inlineObjects = [];
    for (const child of focusTextBlock.node.children){
        if (child._key === selectionStartPointChildKey) break;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSpanNode"])(snapshot.context, child) || inlineObjects.push({
            node: child,
            path: [
                ...focusTextBlock.path,
                "children",
                {
                    _key: child._key
                }
            ]
        });
    }
    return inlineObjects;
}, getSelection = (snapshot)=>snapshot.context.selection, getBlockTextAfter = (snapshot)=>{
    if (!snapshot.context.selection) return "";
    const endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection), block = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getFocusBlock"])({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: endPoint,
                focus: endPoint
            }
        }
    });
    if (!block) return "";
    const endOfBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockEndPoint"])({
        context: snapshot.context,
        block
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionText"])({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: endPoint,
                focus: endOfBlock
            }
        }
    });
}, getBlockTextBefore = (snapshot)=>{
    if (!snapshot.context.selection) return "";
    const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection), block = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getFocusBlock"])({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: startPoint,
                focus: startPoint
            }
        }
    });
    if (!block) return "";
    const startOfBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBlockStartPoint"])({
        context: snapshot.context,
        block
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionText"])({
        ...snapshot,
        context: {
            ...snapshot.context,
            selection: {
                anchor: startOfBlock,
                focus: startPoint
            }
        }
    });
}, getValue = (snapshot)=>snapshot.context.value;
function isPointAfterSelection(point) {
    return (snapshot)=>{
        if (!snapshot.context.selection) return !1;
        const endPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionEndPoint"])(snapshot.context.selection);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["comparePoints"])(snapshot, point, endPoint) === 1;
    };
}
function isPointBeforeSelection(point) {
    return (snapshot)=>{
        if (!snapshot.context.selection) return !1;
        const startPoint = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$util$2e$slice$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSelectionStartPoint"])(snapshot.context.selection);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$portabletext$2b$editor$40$6$2e$6$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_react$40$19$2e$2$2e$3$2f$node_modules$2f40$portabletext$2f$editor$2f$lib$2f$_chunks$2d$es$2f$selector$2e$is$2d$selecting$2d$entire$2d$blocks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["comparePoints"])(snapshot, point, startPoint) === -1;
    };
}
;
 //# sourceMappingURL=index.js.map
}),
]);

//# sourceMappingURL=0f98f_%40portabletext_editor_lib_7790117c._.js.map